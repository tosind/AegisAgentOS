// ── Connector Types ────────────────────────────────────────────
// Shared types for MCP connectors.

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  serverType: string;
  connectionId: string;
}

export interface Connector {
  listTools(config: Record<string, unknown>): Tool[];
  callTool(
    toolName: string,
    args: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<unknown>;
  testConnection(config: Record<string, unknown>): Promise<boolean>;
}
