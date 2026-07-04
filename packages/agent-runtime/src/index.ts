// ── Agent Runtime — Main Entry Point ──────────────────────────
// Enterprise Agent OS
//
// The core agent execution engine that:
// 1. Receives tasks from Paperclip (via heartbeats)
// 2. Routes LLM calls through the Security Layer
// 3. Uses MCP tools for enterprise integrations
// 4. Maintains agent memory and learns skills

import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "8421", 10);

async function main() {
  const app = createServer();
  app.listen(PORT, () => {
    console.log(`🤖 Agent Runtime running on port ${PORT}`);
    console.log(`   Security Layer: ${process.env.SECURITY_LAYER_URL || "http://localhost:8423"}`);
    console.log(`   Paperclip: ${process.env.PAPERCLIP_API_URL || "http://localhost:9123"}`);
    console.log(`   vLLM: ${process.env.VLLM_URL || "http://localhost:8000/v1"}`);
    console.log(`   Ollama: ${process.env.OLLAMA_URL || "http://localhost:11434"}`);
  });
}

main().catch((err) => {
  console.error("Agent Runtime failed to start:", err);
  process.exit(1);
});
