// ── Connection Manager ─────────────────────────────────────────
// Manages MCP connections to enterprise systems.

import { pool } from "./db.js";
import { PostgresConnector } from "./connectors/postgres.js";
import { SlackConnector } from "./connectors/slack.js";
import { GitHubConnector } from "./connectors/github.js";
import { EmailConnector } from "./connectors/email.js";
import { RESTAPIConnector } from "./connectors/rest-api.js";
import { FileSystemConnector } from "./connectors/filesystem.js";
import { encodeConfigValue } from "./connectors/utils.js";

interface Connection {
  id: string;
  tenantId: string;
  name: string;
  serverType: string;
  config: Record<string, unknown>;
  toolsEnabled: string[];
  status: string;
}

interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  serverType: string;
  connectionId: string;
}

// Connector interface — each enterprise system has a connector
interface Connector {
  listTools(config: Record<string, unknown>): Tool[];
  callTool(
    toolName: string,
    args: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<unknown>;
  testConnection(config: Record<string, unknown>): Promise<boolean>;
}

export class ConnectionManager {
  private connectors: Map<string, Connector>;

  constructor() {
    this.connectors = new Map([
      ["postgres", new PostgresConnector()],
      ["slack", new SlackConnector()],
      ["github", new GitHubConnector()],
      ["email_smtp", new EmailConnector()],
      ["rest_api", new RESTAPIConnector()],
      ["filesystem", new FileSystemConnector()],
      ["jira", new RESTAPIConnector()],       // Jira uses REST API connector
      ["salesforce", new RESTAPIConnector()],  // Salesforce uses REST API connector
    ]);
  }

  /**
   * Register a new MCP connection.
   */
  async registerConnection(params: {
    tenantId: string;
    name: string;
    serverType: string;
    config: Record<string, unknown>;
    toolsEnabled: string[];
  }): Promise<Connection> {
    // Encrypt sensitive config values
    const encryptedConfig = this.encryptConfig(params.config);

    const result = await pool.query(
      `INSERT INTO mcp_connections (tenant_id, name, server_type, connection_config, tools_enabled, status)
       VALUES ($1, $2, $3, $4, $5, 'disconnected')
       RETURNING *`,
      [
        params.tenantId,
        params.name,
        params.serverType,
        JSON.stringify(encryptedConfig),
        params.toolsEnabled,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Test a connection.
   */
  async testConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
    const result = await pool.query(
      `SELECT * FROM mcp_connections WHERE id = $1`,
      [connectionId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const conn = this.mapRow(result.rows[0]);
    const connector = this.connectors.get(conn.serverType);

    if (!connector) {
      return { success: false, message: `No connector for type: ${conn.serverType}` };
    }

    try {
      const isConnected = await connector.testConnection(conn.config);
      const newStatus = isConnected ? "connected" : "error";

      await pool.query(
        `UPDATE mcp_connections SET status = $1, last_connected_at = $2, updated_at = NOW()
         WHERE id = $3`,
        [newStatus, isConnected ? new Date() : null, connectionId],
      );

      return {
        success: isConnected,
        message: isConnected ? "Connection successful" : "Connection failed",
      };
    } catch (err: any) {
      await pool.query(
        `UPDATE mcp_connections SET status = 'error', updated_at = NOW() WHERE id = $1`,
        [connectionId],
      );
      return { success: false, message: err.message };
    }
  }

  /**
   * List all connections for a tenant.
   */
  async listConnections(tenantId?: string): Promise<Connection[]> {
    let query = "SELECT * FROM mcp_connections";
    const params: any[] = [];

    if (tenantId) {
      query += " WHERE tenant_id = $1";
      params.push(tenantId);
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);
    return result.rows.map(this.mapRow);
  }

  /**
   * Remove a connection.
   */
  async removeConnection(connectionId: string): Promise<void> {
    await pool.query(`DELETE FROM mcp_connections WHERE id = $1`, [connectionId]);
  }

  /**
   * List all tools available across all connections for a tenant.
   */
  async listTools(tenantId: string): Promise<Tool[]> {
    const result = await pool.query(
      `SELECT * FROM mcp_connections
       WHERE tenant_id = $1 AND status = 'connected'`,
      [tenantId],
    );

    const allTools: Tool[] = [];
    for (const row of result.rows) {
      const conn = this.mapRow(row);
      const connector = this.connectors.get(conn.serverType);
      if (connector) {
        const tools = connector.listTools(conn.config);
        // Filter to enabled tools only
        const enabled = conn.toolsEnabled.length > 0
          ? tools.filter((t) => conn.toolsEnabled.includes(t.name))
          : tools;
        allTools.push(...enabled);
      }
    }

    return allTools;
  }

  /**
   * Call a specific tool by name.
   */
  async callTool(
    tenantId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    // Find which connection has this tool
    const result = await pool.query(
      `SELECT * FROM mcp_connections WHERE tenant_id = $1 AND status = 'connected'`,
      [tenantId],
    );

    for (const row of result.rows) {
      const conn = this.mapRow(row);
      const connector = this.connectors.get(conn.serverType);
      if (!connector) continue;

      const tools = connector.listTools(conn.config);
      const tool = tools.find((t) => t.name === toolName);
      if (tool) {
        return connector.callTool(toolName, args, conn.config);
      }
    }

    throw new Error(`Tool not found: ${toolName}`);
  }

  // ── Helpers ──────────────────────────────────────────────

  private encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
    // ⚠️ PRODUCTION WARNING: This is base64 encoding, NOT encryption.
    // Replace with HashiCorp Vault, AWS KMS, or Azure Key Vault for production.
    const sensitive = ["password", "token", "apiToken", "clientSecret", "api_key", "secret"];
    const processed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (sensitive.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
        processed[key] = encodeConfigValue(String(value));
      } else {
        processed[key] = value;
      }
    }

    return processed;
  }

  private mapRow(row: any): Connection {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      serverType: row.server_type,
      config:
        typeof row.connection_config === "string"
          ? JSON.parse(row.connection_config)
          : row.connection_config,
      toolsEnabled: row.tools_enabled || [],
      status: row.status,
    };
  }
}
