// ── Tool Registry ──────────────────────────────────────────────
// Manages MCP tools and custom tools available to agents.

import { createHash } from "crypto";
import { pool } from "./db.js";

const MCP_HUB_URL = process.env.MCP_HUB_URL || "http://localhost:8422";

interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  serverType: string;
}

type ToolPermissions = {
  allowedTools?: string[];
  deniedTools?: string[];
};

export class ApprovalRequiredError extends Error {
  approvalId?: string;

  constructor(message: string, approvalId?: string) {
    super(message);
    this.name = "ApprovalRequiredError";
    this.approvalId = approvalId;
  }
}

export class ToolRegistry {
  private toolCache: Map<string, Tool[]> = new Map();

  /**
   * List all tools available to a tenant.
   */
  async listTools(tenantId: string, agentId?: string): Promise<Tool[]> {
    const cached = this.toolCache.get(tenantId);
    if (cached) return agentId ? this.filterToolsForAgent(agentId, cached) : cached;

    try {
      const response = await fetch(`${MCP_HUB_URL}/tools?tenantId=${tenantId}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return this.getBuiltInTools();
      }

      const data = await response.json() as { tools: Tool[] };
      const tools = [...this.getBuiltInTools(), ...(data.tools || [])];
      this.toolCache.set(tenantId, tools);
      return agentId ? this.filterToolsForAgent(agentId, tools) : tools;
    } catch {
      const tools = this.getBuiltInTools();
      return agentId ? this.filterToolsForAgent(agentId, tools) : tools;
    }
  }

  /**
   * Execute a tool.
   */
  async executeTool(
    tenantId: string,
    agentId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    await this.assertToolAllowed(agentId, toolName);
    await this.requireApprovalIfNeeded(tenantId, agentId, toolName, args);

    // Check built-in tools first
    const builtIn = this.getBuiltInTools();
    const builtInTool = builtIn.find((t) => t.name === toolName);
    if (builtInTool) {
      return this.executeBuiltIn(toolName, args);
    }

    // Forward to MCP Hub for enterprise tools
    const response = await fetch(
      `${MCP_HUB_URL}/tools/${encodeURIComponent(toolName)}/call`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, arguments: args }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Tool execution failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Invalidate the tool cache for a tenant.
   */
  invalidateCache(tenantId: string): void {
    this.toolCache.delete(tenantId);
  }

  // ── Built-in Tools ─────────────────────────────────────────

  private getBuiltInTools(): Tool[] {
    return [
      {
        name: "read_file",
        description: "Read the contents of a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to the file" },
          },
          required: ["path"],
        },
        serverType: "built-in",
      },
      {
        name: "write_file",
        description: "Write content to a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to the file" },
            content: { type: "string", description: "Content to write" },
          },
          required: ["path", "content"],
        },
        serverType: "built-in",
      },
      {
        name: "run_command",
        description: "Run a terminal command. ⚠️ REQUIRES APPROVAL for destructive operations. Commands are logged and audited.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "The command to run" },
            cwd: { type: "string", description: "Working directory" },
          },
          required: ["command"],
        },
        serverType: "built-in",
      },
      {
        name: "search_code",
        description: "Search for code patterns in the codebase",
        parameters: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Search pattern" },
            fileTypes: { type: "string", description: "File extensions to search" },
          },
          required: ["pattern"],
        },
        serverType: "built-in",
      },
      {
        name: "web_search",
        description: "Search the web (external — requires permission)",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
        serverType: "built-in",
      },
      {
        name: "get_current_time",
        description: "Get the current date and time",
        parameters: {
          type: "object",
          properties: {},
        },
        serverType: "built-in",
      },
    ];
  }

  private async executeBuiltIn(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    switch (toolName) {
      case "read_file": {
        const fs = await import("fs/promises");
        return fs.readFile(args.path as string, "utf-8");
      }
      case "write_file": {
        const fs = await import("fs/promises");
        await fs.writeFile(args.path as string, args.content as string);
        return { success: true, path: args.path };
      }
      case "run_command": {
        const { exec } = await import("child_process");
        const util = await import("util");
        const execPromise = util.promisify(exec);
        const { stdout, stderr } = await execPromise(args.command as string, {
          cwd: (args.cwd as string) || process.cwd(),
        });
        return { stdout, stderr };
      }
      case "search_code": {
        // Placeholder — would integrate with ripgrep in real implementation
        return {
          message: `Would search for pattern: ${args.pattern} in files: ${args.fileTypes || "*"}`,
        };
      }
      case "web_search": {
        return { message: "Web search requires external API permission" };
      }
      case "get_current_time": {
        return { time: new Date().toISOString() };
      }
      default:
        throw new Error(`Unknown built-in tool: ${toolName}`);
    }
  }

  private async filterToolsForAgent(agentId: string, tools: Tool[]): Promise<Tool[]> {
    const permissions = await this.getToolPermissions(agentId);
    return tools.filter((tool) => this.isToolAllowedByPermissions(tool.name, permissions));
  }

  private async assertToolAllowed(agentId: string, toolName: string): Promise<void> {
    const permissions = await this.getToolPermissions(agentId);
    if (!this.isToolAllowedByPermissions(toolName, permissions)) {
      throw new Error(`Tool "${toolName}" is denied by agent policy`);
    }
  }

  private isToolAllowedByPermissions(toolName: string, permissions: ToolPermissions): boolean {
    const denied = permissions.deniedTools || [];
    if (denied.includes("*") || denied.includes(toolName)) return false;

    const allowed = permissions.allowedTools || ["*"];
    return allowed.includes("*") || allowed.includes(toolName);
  }

  private async getToolPermissions(agentId: string): Promise<ToolPermissions> {
    const result = await pool.query(
      `SELECT tool_permissions
       FROM agent_configs
       WHERE id = $1 OR paperclip_agent_id = $1
       LIMIT 1`,
      [agentId],
    );
    const raw = result.rows[0]?.tool_permissions;
    if (!raw) return { allowedTools: ["*"], deniedTools: [] };
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  private async requireApprovalIfNeeded(
    tenantId: string,
    agentId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isHighRiskTool(toolName)) return;

    const target = this.toolApprovalTarget(toolName, args);
    const approved = await pool.query(
      `SELECT id
       FROM approval_requests
       WHERE tenant_id = $1
         AND agent_id = $2
         AND action_type = $3
         AND target = $4
         AND status = 'approved'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, agentId, `tool:${toolName}`, target],
    );
    if (approved.rows[0]) return;

    const existing = await pool.query(
      `SELECT id
       FROM approval_requests
       WHERE tenant_id = $1
         AND agent_id = $2
         AND action_type = $3
         AND target = $4
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, agentId, `tool:${toolName}`, target],
    );

    const approvalId = existing.rows[0]?.id || (
      await pool.query(
        `INSERT INTO approval_requests (tenant_id, agent_id, action_type, target, details, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING id`,
        [
          tenantId,
          agentId,
          `tool:${toolName}`,
          target,
          JSON.stringify({
            toolName,
            arguments: args,
            reason: "High-risk tool execution requires human approval",
          }),
        ],
      )
    ).rows[0].id;

    throw new ApprovalRequiredError(
      `Tool "${toolName}" requires approval before execution`,
      approvalId,
    );
  }

  private isHighRiskTool(toolName: string): boolean {
    if (["write_file", "run_command", "web_search"].includes(toolName)) return true;
    return /(write|delete|update|send|deploy|payment|external|shell|command)/i.test(toolName);
  }

  private toolApprovalTarget(toolName: string, args: Record<string, unknown>): string {
    const digest = createHash("sha256")
      .update(JSON.stringify(args))
      .digest("hex")
      .slice(0, 24);
    return `tool:${toolName}:${digest}`;
  }
}
