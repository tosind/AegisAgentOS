// ── Database Connection ───────────────────────────────────────

import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://enterprise:enterprise_secret@localhost:5432/enterprise_agents",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test connection on startup
pool.query("SELECT 1").then(() => {
  console.log("📦 PostgreSQL connected");
}).catch((err) => {
  console.error("❌ PostgreSQL connection failed:", err.message);
  process.exit(1);
});
