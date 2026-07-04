// ── PostgreSQL Connector ───────────────────────────────────────
// Provides database query tools via MCP.

import type { Connector, Tool } from "./types.js";
import { decodeConfigValue } from "./utils.js";
import pg from "pg";

export class PostgresConnector implements Connector {
  listTools(config: Record<string, unknown>): Tool[] {
    return [
      {
        name: "postgres_query",
        description: "Execute a SQL query on the connected PostgreSQL database",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "SQL query to execute" },
            params: {
              type: "array",
              items: { type: "string" },
              description: "Query parameters",
            },
          },
          required: ["query"],
        },
        serverType: "postgres",
        connectionId: "",
      },
      {
        name: "postgres_list_tables",
        description: "List all tables in the database",
        parameters: {
          type: "object",
          properties: {
            schema: { type: "string", description: "Schema name (default: public)" },
          },
        },
        serverType: "postgres",
        connectionId: "",
      },
      {
        name: "postgres_describe_table",
        description: "Describe columns of a table",
        parameters: {
          type: "object",
          properties: {
            table: { type: "string", description: "Table name" },
            schema: { type: "string", description: "Schema name (default: public)" },
          },
          required: ["table"],
        },
        serverType: "postgres",
        connectionId: "",
      },
    ];
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<unknown> {
    const client = new pg.Client({
      host: config.host as string,
      port: (config.port as number) || 5432,
      database: config.database as string,
      user: config.user as string,
      password: decodeConfigValue(config.password as string),
      ssl: config.ssl as boolean,
    });

    try {
      await client.connect();

      switch (toolName) {
        case "postgres_query": {
          const result = await client.query(
            args.query as string,
            (args.params as any[]) || [],
          );
          return { rows: result.rows, rowCount: result.rowCount };
        }
        case "postgres_list_tables": {
          const schema = (args.schema as string) || "public";
          const result = await client.query(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
            [schema],
          );
          return { tables: result.rows.map((r: any) => r.table_name) };
        }
        case "postgres_describe_table": {
          const schema = (args.schema as string) || "public";
          const result = await client.query(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = $2`,
            [schema, args.table],
          );
          return { columns: result.rows };
        }
        default:
          throw new Error(`Unknown PostgreSQL tool: ${toolName}`);
      }
    } finally {
      await client.end();
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    const client = new pg.Client({
      host: config.host as string,
      port: (config.port as number) || 5432,
      database: config.database as string,
      user: config.user as string,
      password: decodeConfigValue(config.password as string),
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      await client.query("SELECT 1");
      return true;
    } catch {
      return false;
    } finally {
      await client.end().catch(() => {});
    }
  }

}
