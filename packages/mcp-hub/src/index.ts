// ── MCP Hub — Main Entry Point ────────────────────────────────
// Enterprise Agent OS
//
// Connects enterprise systems (databases, APIs, SaaS) to agents
// via the Model Context Protocol.

import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "8422", 10);

async function main() {
  const app = createServer();
  app.listen(PORT, () => {
    console.log(`🔌 MCP Hub running on port ${PORT}`);
    console.log(`   Agent Runtime: ${process.env.AGENT_RUNTIME_URL || "http://localhost:8421"}`);
  });
}

main().catch((err) => {
  console.error("MCP Hub failed to start:", err);
  process.exit(1);
});
