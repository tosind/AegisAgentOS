// ── Connection Manager Tests ───────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

// Dynamic import after mock setup
const { ConnectionManager } = await import("../connections.js");

describe("ConnectionManager", () => {
  let manager: InstanceType<typeof ConnectionManager>;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  describe("registerConnection", () => {
    it("should register a Postgres connection", async () => {
      const { pool } = await import("../db.js");
      const mockQuery = pool.query as any;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "conn-1",
            tenant_id: "tenant-1",
            name: "Test DB",
            server_type: "postgres",
            connection_config: JSON.stringify({
              host: "localhost",
              port: 5432,
              database: "testdb",
              user: "admin",
              password: "encrypted:cGFzc3dvcmQ=",
            }),
            tools_enabled: ["postgres_query"],
            status: "disconnected",
          },
        ],
      });

      const connection = await manager.registerConnection({
        tenantId: "tenant-1",
        name: "Test DB",
        serverType: "postgres",
        config: {
          host: "localhost",
          port: 5432,
          database: "testdb",
          user: "admin",
          password: "password",
        },
        toolsEnabled: ["postgres_query"],
      });

      expect(connection.name).toBe("Test DB");
      expect(connection.serverType).toBe("postgres");
      expect(connection.status).toBe("disconnected");
      expect(connection.config.password).toContain("encrypted:");
    });

    it("should register a Slack connection", async () => {
      const { pool } = await import("../db.js");
      const mockQuery = pool.query as any;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "conn-2",
            tenant_id: "tenant-1",
            name: "Slack Workspace",
            server_type: "slack",
            connection_config: JSON.stringify({
              token: "encrypted:eG94Yi0xMjM0",
              defaultChannel: "general",
            }),
            tools_enabled: [],
            status: "disconnected",
          },
        ],
      });

      const connection = await manager.registerConnection({
        tenantId: "tenant-1",
        name: "Slack Workspace",
        serverType: "slack",
        config: {
          token: "xoxb-1234",
          defaultChannel: "general",
        },
        toolsEnabled: [],
      });

      expect(connection.serverType).toBe("slack");
    });
  });

  describe("listConnections", () => {
    it("should list all connections for a tenant", async () => {
      const { pool } = await import("../db.js");
      const mockQuery = pool.query as any;

      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "conn-1",
            tenant_id: "tenant-1",
            name: "Test DB",
            server_type: "postgres",
            connection_config: JSON.stringify({ host: "localhost" }),
            tools_enabled: [],
            status: "connected",
          },
        ],
      });

      const connections = await manager.listConnections("tenant-1");
      expect(connections).toHaveLength(1);
      expect(connections[0].name).toBe("Test DB");
    });

    it("should list all connections without tenant filter", async () => {
      const { pool } = await import("../db.js");
      const mockQuery = pool.query as any;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const connections = await manager.listConnections();
      expect(connections).toEqual([]);
    });
  });

  describe("removeConnection", () => {
    it("should remove a connection", async () => {
      const { pool } = await import("../db.js");
      const mockQuery = pool.query as any;

      mockQuery.mockResolvedValueOnce({ rows: [] });

      await manager.removeConnection("conn-1");
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
