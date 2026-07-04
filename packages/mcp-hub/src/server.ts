// ── MCP Hub Server ─────────────────────────────────────────────
// HTTP API for managing and calling MCP connections.

import express, { type Request, type Response } from "express";
import { ConnectionManager } from "./connections.js";

export function createServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const manager = new ConnectionManager();

  // ── Health ───────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "mcp-hub" });
  });

  // ── List connections ─────────────────────────────────────
  app.get("/connections", async (req: Request, res: Response) => {
    try {
      const tenantId = req.query.tenantId as string;
      const connections = tenantId
        ? await manager.listConnections(tenantId)
        : await manager.listConnections();
      res.json({ connections });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Register new connection ──────────────────────────────
  app.post("/connections", async (req: Request, res: Response) => {
    try {
      const { tenantId, name, serverType, config, toolsEnabled } = req.body;

      if (!tenantId || !name || !serverType || !config) {
        res.status(400).json({
          error: "tenantId, name, serverType, and config are required",
        });
        return;
      }

      const connection = await manager.registerConnection({
        tenantId,
        name,
        serverType,
        config,
        toolsEnabled: toolsEnabled || [],
      });

      res.status(201).json({ connection });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Test connection ──────────────────────────────────────
  app.post("/connections/:id/test", async (req: Request, res: Response) => {
    try {
      const result = await manager.testConnection(req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Delete connection ────────────────────────────────────
  app.delete("/connections/:id", async (req: Request, res: Response) => {
    try {
      await manager.removeConnection(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── List tools (all connections for a tenant) ────────────
  app.get("/tools", async (req: Request, res: Response) => {
    try {
      const tenantId = req.query.tenantId as string;
      if (!tenantId) {
        res.status(400).json({ error: "tenantId is required" });
        return;
      }

      const tools = await manager.listTools(tenantId);
      res.json({ tools });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Call a specific tool ─────────────────────────────────
  app.post("/tools/:name/call", async (req: Request, res: Response) => {
    try {
      const { tenantId, arguments: args } = req.body;
      if (!tenantId) {
        res.status(400).json({ error: "tenantId is required" });
        return;
      }

      const result = await manager.callTool(
        tenantId,
        req.params.name,
        args || {},
      );
      res.json({ result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Supported server types ───────────────────────────────
  app.get("/server-types", (_req: Request, res: Response) => {
    res.json({
      types: [
        {
          type: "postgres",
          label: "PostgreSQL",
          description: "Connect to a PostgreSQL database",
          configSchema: {
            host: "string",
            port: "number",
            database: "string",
            user: "string",
            password: "string (encrypted)",
            ssl: "boolean",
          },
        },
        {
          type: "slack",
          label: "Slack",
          description: "Send messages and interact with Slack workspaces",
          configSchema: {
            token: "string (encrypted)",
            defaultChannel: "string",
          },
        },
        {
          type: "github",
          label: "GitHub",
          description: "Access repositories, issues, PRs, and actions",
          configSchema: {
            token: "string (encrypted)",
            owner: "string",
            repo: "string",
          },
        },
        {
          type: "jira",
          label: "Jira",
          description: "Manage issues, projects, and workflows",
          configSchema: {
            host: "string",
            email: "string",
            apiToken: "string (encrypted)",
          },
        },
        {
          type: "email_smtp",
          label: "Email (SMTP)",
          description: "Send emails via SMTP server",
          configSchema: {
            host: "string",
            port: "number",
            user: "string",
            password: "string (encrypted)",
            from: "string",
          },
        },
        {
          type: "salesforce",
          label: "Salesforce",
          description: "Access CRM data and manage records",
          configSchema: {
            instanceUrl: "string",
            clientId: "string",
            clientSecret: "string (encrypted)",
            username: "string",
            password: "string (encrypted)",
          },
        },
        {
          type: "rest_api",
          label: "REST API",
          description: "Connect to any REST API",
          configSchema: {
            baseUrl: "string",
            authType: "string (none|basic|bearer|api_key)",
            authConfig: "object (encrypted)",
            headers: "object",
          },
        },
        {
          type: "filesystem",
          label: "File System",
          description: "Access local files and directories",
          configSchema: {
            basePath: "string",
            readOnly: "boolean",
          },
        },
      ],
    });
  });

  return app;
}
