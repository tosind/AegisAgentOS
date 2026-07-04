// ── Audit Logger ───────────────────────────────────────────────
// Immutable audit trail for all agent actions.

import type { AuditLog, SensitivityLevel } from "@enterprise/shared";
import { pool } from "./db.js";

interface LogInput {
  tenantId: string;
  agentId: string;
  agentName?: string;
  action: string;
  target?: string;
  details?: Record<string, unknown>;
  sensitivityLevel?: SensitivityLevel;
  llmBackendUsed?: string;
  tokensUsed?: number;
  piiDetected?: boolean;
  piiScrubbed?: boolean;
  success?: boolean;
  errorMessage?: string;
  durationMs?: number;
}

export class AuditLogger {
  /**
   * Log an audit event.
   */
  async log(input: LogInput): Promise<void> {
    await pool.query(
      `INSERT INTO audit_logs (
        tenant_id, agent_id, agent_name, action, target, details,
        sensitivity_level, llm_backend_used, tokens_used,
        pii_detected, pii_scrubbed, success, error_message, duration_ms
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        input.tenantId,
        input.agentId,
        input.agentName || null,
        input.action,
        input.target || null,
        JSON.stringify(input.details || {}),
        input.sensitivityLevel || "internal",
        input.llmBackendUsed || null,
        input.tokensUsed || 0,
        input.piiDetected || false,
        input.piiScrubbed || false,
        input.success ?? true,
        input.errorMessage || null,
        input.durationMs || null,
      ],
    );
  }

  /**
   * Query audit logs with optional filters.
   */
  async query(filters: {
    tenantId?: string;
    agentId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.tenantId) {
      conditions.push(`tenant_id = $${paramIndex++}`);
      params.push(filters.tenantId);
    }
    if (filters.agentId) {
      conditions.push(`agent_id = $${paramIndex++}`);
      params.push(filters.agentId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const query = `
      SELECT * FROM audit_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(filters.limit || 50, filters.offset || 0);

    const result = await pool.query(query, params);
    return result.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      action: row.action,
      target: row.target,
      details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
      sensitivityLevel: row.sensitivity_level,
      llmBackendUsed: row.llm_backend_used,
      piiDetected: row.pii_detected,
      piiScrubbed: row.pii_scrubbed,
      tokensUsed: row.tokens_used,
      durationMs: row.duration_ms,
      success: row.success,
      errorMessage: row.error_message,
    }));
  }
}
