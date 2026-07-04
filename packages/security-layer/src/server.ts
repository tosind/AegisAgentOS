// ── Security Layer HTTP Server ────────────────────────────────
// Exposes REST API for other services to use the security layer.

import express, { type Request, type Response } from "express";
import { LLMRouter } from "./llm-router.js";
import { PolicyEngine } from "./policy-engine.js";
import { classifyPrompt, scrubPII, maskPII } from "./pii-scrubber.js";
import { AuditLogger } from "./audit-logger.js";

export function createServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const policyEngine = new PolicyEngine();
  const llmRouter = new LLMRouter(policyEngine);
  const auditLogger = new AuditLogger();

  // ── Health ───────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "security-layer" });
  });

  // ── Classify a prompt ────────────────────────────────────
  app.post("/classify", (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const result = classifyPrompt(text);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Scrub PII from text ──────────────────────────────────
  app.post("/scrub", (req: Request, res: Response) => {
    try {
      const { text, mode = "redact" } = req.body;
      if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const scrubbed = mode === "mask" ? maskPII(text) : scrubPII(text);
      res.json({ original: text, scrubbed, mode });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── LLM Route (main endpoint for agent runtime) ──────────
  app.post("/v1/chat/completions", async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const { messages, agentId, tenantId, maxTokens, temperature, tools } = req.body;

      if (!messages || !agentId || !tenantId) {
        res.status(400).json({ error: "messages, agentId, and tenantId are required" });
        return;
      }

      // Get agent config and tenant policy
      const agentConfig = await policyEngine.getAgentConfig(agentId);
      const tenantPolicy = await policyEngine.getPolicy(tenantId);

      // Classify the prompt
      const fullText = messages.map((m: any) => m.content).join("\n");
      const classification = classifyPrompt(fullText);

      // Evaluate policy
      const evaluation = await policyEngine.evaluate(
        tenantId,
        agentId,
        classification,
        "llm_call",
      );

      if (!evaluation.allowed) {
        // Log blocked attempt
        await auditLogger.log({
          tenantId,
          agentId,
          agentName: agentConfig.name,
          action: "llm_call_blocked",
          details: { evaluation, classification },
          sensitivityLevel: classification.sensitivityLevel,
          success: false,
          durationMs: Date.now() - startTime,
        });

        res.status(403).json({
          error: "LLM call blocked by policy",
          reasons: evaluation.reasons,
          requiresApproval: evaluation.requiresApproval,
        });
        return;
      }

      // Route to LLM
      const preferredModel = agentConfig.llmPreferences.defaultModel;
      const model =
        preferredModel && preferredModel !== "local" ? preferredModel : undefined;

      const { response } = await llmRouter.route(
        { messages, model, maxTokens, temperature, tools },
        agentConfig,
        tenantPolicy,
      );

      // Log successful call
      await auditLogger.log({
        tenantId,
        agentId,
        agentName: agentConfig.name,
        action: "llm_call",
        details: { modelUsed: response.model },
        sensitivityLevel: classification.sensitivityLevel,
        llmBackendUsed: response.backend,
        tokensUsed: response.tokensUsed,
        piiDetected: classification.piiDetected.length > 0,
        piiScrubbed: classification.piiDetected.length > 0,
        success: true,
        durationMs: Date.now() - startTime,
      });

      res.json({
        ...response,
        classification: {
          sensitivityLevel: classification.sensitivityLevel,
          piiDetected: classification.piiDetected.length > 0,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Backend availability ─────────────────────────────────
  app.get("/backends", async (_req: Request, res: Response) => {
    try {
      const availability = await llmRouter.checkAvailability();
      res.json({ backends: availability });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Policy management ────────────────────────────────────
  app.get("/policies/:tenantId", async (req: Request, res: Response) => {
    try {
      const policy = await policyEngine.getPolicy(req.params.tenantId);
      res.json(policy);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ── Agent config management ──────────────────────────────
  app.get("/agents/:agentId/config", async (req: Request, res: Response) => {
    try {
      const config = await policyEngine.getAgentConfig(req.params.agentId);
      res.json(config);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // ── Audit log query ──────────────────────────────────────
  app.get("/audit", async (req: Request, res: Response) => {
    try {
      const { tenantId, agentId, limit = "50", offset = "0" } = req.query;
      const logs = await auditLogger.query({
        tenantId: tenantId as string,
        agentId: agentId as string,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
