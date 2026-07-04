// ── Security Layer — Main Entry Point ─────────────────────────
// Enterprise Agent OS
//
// This module provides:
// 1. LLM Router — classifies prompts and routes to appropriate backend
// 2. PII Scrubber — detects and scrubs sensitive data
// 3. Policy Engine — enforces security policies per tenant/agent

import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "8423", 10);

async function main() {
  const app = createServer();
  app.listen(PORT, () => {
    console.log(`🔒 Security Layer running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Security Layer failed to start:", err);
  process.exit(1);
});
