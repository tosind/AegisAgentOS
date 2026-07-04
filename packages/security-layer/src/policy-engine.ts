// ── Policy Engine ─────────────────────────────────────────────
// Enforces security policies per tenant and agent.

import type {
  SecurityPolicy,
  AgentConfig,
  ClassificationResult,
  ApprovalRequest,
} from "@enterprise/shared";
import { pool } from "./db.js";

export class PolicyEngine {
  private policyCache: Map<string, SecurityPolicy> = new Map();
  private agentCache: Map<string, AgentConfig> = new Map();

  /**
   * Get the security policy for a tenant.
   */
  async getPolicy(tenantId: string): Promise<SecurityPolicy> {
    const cached = this.policyCache.get(tenantId);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT * FROM security_policies
       WHERE tenant_id = $1 AND enabled = TRUE
       ORDER BY priority DESC
       LIMIT 1`,
      [tenantId],
    );

    if (result.rows.length === 0) {
      // Fall back to default policy
      const defaultResult = await pool.query(
        `SELECT * FROM security_policies
         WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
         AND enabled = TRUE
         ORDER BY priority DESC
         LIMIT 1`,
      );

      if (defaultResult.rows.length === 0) {
        throw new Error(`No security policy found for tenant ${tenantId}`);
      }
      const policy = this.rowToPolicy(defaultResult.rows[0]);
      this.policyCache.set(tenantId, policy);
      return policy;
    }

    const policy = this.rowToPolicy(result.rows[0]);
    this.policyCache.set(tenantId, policy);
    return policy;
  }

  /**
   * Get agent configuration.
   */
  async getAgentConfig(agentId: string): Promise<AgentConfig> {
    const cached = this.agentCache.get(agentId);
    if (cached) return cached;

    const result = await pool.query(
      `SELECT * FROM agent_configs WHERE paperclip_agent_id = $1 OR id = $1 LIMIT 1`,
      [agentId],
    );

    if (result.rows.length === 0) {
      throw new Error(`No agent config found for agent ${agentId}`);
    }

    const config = this.rowToAgentConfig(result.rows[0]);
    this.agentCache.set(agentId, config);
    return config;
  }

  /**
   * Evaluate whether an action is allowed based on policies.
   */
  async evaluate(
    tenantId: string,
    agentId: string,
    classification: ClassificationResult,
    actionType: string,
  ): Promise<{
    allowed: boolean;
    requiresApproval: boolean;
    reasons: string[];
    backend: string;
  }> {
    const policy = await this.getPolicy(tenantId);
    const agentConfig = await this.getAgentConfig(agentId);

    const reasons: string[] = [];
    let requiresApproval = false;

    // Check: is external API allowed?
    if (
      classification.recommendedBackend === "openai" ||
      classification.recommendedBackend === "anthropic"
    ) {
      if (!policy.rules.allowExternalAPI) {
        reasons.push("External API calls not allowed by tenant policy");
        return { allowed: false, requiresApproval: true, reasons, backend: "vllm" };
      }
      if (!agentConfig.externalApiAllowed) {
        reasons.push("External API calls not allowed for this agent");
        return { allowed: false, requiresApproval: true, reasons, backend: "vllm" };
      }
    }

    // Check: PII detected?
    if (classification.piiDetected.length > 0 && policy.rules.scrubPII) {
      reasons.push(
        `PII detected (${classification.piiDetected.map((p) => p.patternName).join(", ")}) — will be scrubbed`,
      );
    }

    // Check: requires approval?
    if (classification.requiresApproval) {
      requiresApproval = true;
      reasons.push(...classification.approvalReasons);
    }

    // Check action-specific approval requirements
    if (policy.rules.requireApprovalFor.includes(actionType)) {
      requiresApproval = true;
      reasons.push(`Action type "${actionType}" requires approval`);
    }

    return {
      allowed: true,
      requiresApproval,
      reasons,
      backend: classification.recommendedBackend,
    };
  }

  /**
   * Create an approval request.
   */
  async createApproval(
    tenantId: string,
    agentId: string,
    actionType: string,
    details: Record<string, unknown>,
  ): Promise<ApprovalRequest> {
    const result = await pool.query(
      `INSERT INTO approval_requests (tenant_id, agent_id, action_type, details, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [tenantId, agentId, actionType, JSON.stringify(details)],
    );

    return this.rowToApproval(result.rows[0]);
  }

  /**
   * Clear caches (useful after policy updates).
   */
  clearCaches(): void {
    this.policyCache.clear();
    this.agentCache.clear();
  }

  // ── Row mappers ──────────────────────────────────────────

  private rowToPolicy(row: any): SecurityPolicy {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      rules: typeof row.rules === "string" ? JSON.parse(row.rules) : row.rules,
      priority: row.priority,
      enabled: row.enabled,
    };
  }

  private rowToAgentConfig(row: any): AgentConfig {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      employeeId: row.employee_id,
      paperclipAgentId: row.paperclip_agent_id,
      name: row.name,
      role: row.role,
      llmPreferences:
        typeof row.llm_preferences === "string"
          ? JSON.parse(row.llm_preferences)
          : row.llm_preferences,
      toolPermissions:
        typeof row.tool_permissions === "string"
          ? JSON.parse(row.tool_permissions)
          : row.tool_permissions,
      externalApiAllowed: row.external_api_allowed,
      allowedExternalModels: row.allowed_external_models || [],
      skillLearningEnabled: row.skill_learning_enabled,
      memoryEnabled: row.memory_enabled,
      heartbeatIntervalSec: row.heartbeat_interval_sec,
    };
  }

  private rowToApproval(row: any): ApprovalRequest {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      agentId: row.agent_id,
      actionType: row.action_type,
      target: row.target,
      details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
      status: row.status,
      requestedBy: row.requested_by,
      approvedBy: row.approved_by,
    };
  }
}
