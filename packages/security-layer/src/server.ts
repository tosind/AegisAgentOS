// ── Security Layer HTTP Server ────────────────────────────────
// Exposes REST API for other services to use the security layer.

import express, { type Request, type Response } from "express";
import { createHash } from "crypto";
import { requireServiceAuth } from "@enterprise/shared/auth";
import { LLMRouter } from "./llm-router.js";
import { PolicyEngine } from "./policy-engine.js";
import { classifyPrompt, scrubPII, maskPII } from "./pii-scrubber.js";
import { AuditLogger } from "./audit-logger.js";

function approvalTarget(actionType: string, value: string): string {
  return `${actionType}:${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

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
  app.post("/v1/chat/completions", requireServiceAuth, async (req: Request, res: Response) => {
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
      const usage = await policyEngine.getUsage(tenantId);
      const requestedTokens = Number(maxTokens || agentConfig.llmPreferences.maxTokens || usage.maxTokensPerRequest);

      if (requestedTokens > usage.maxTokensPerRequest) {
        await auditLogger.log({
          tenantId,
          agentId,
          agentName: agentConfig.name,
          action: "llm_call_blocked",
          details: { reason: "max_tokens_per_request_exceeded", requestedTokens, maxTokensPerRequest: usage.maxTokensPerRequest },
          sensitivityLevel: "internal",
          success: false,
          durationMs: Date.now() - startTime,
        });
        res.status(429).json({
          error: "LLM call exceeds max tokens per request",
          requestedTokens,
          maxTokensPerRequest: usage.maxTokensPerRequest,
        });
        return;
      }

      if (usage.usedTokensToday + requestedTokens > usage.dailyTokenBudget) {
        await auditLogger.log({
          tenantId,
          agentId,
          agentName: agentConfig.name,
          action: "llm_call_blocked",
          details: { reason: "daily_token_budget_exceeded", requestedTokens, usage },
          sensitivityLevel: "internal",
          success: false,
          durationMs: Date.now() - startTime,
        });
        res.status(429).json({
          error: "Daily token budget exceeded",
          usage,
          requestedTokens,
        });
        return;
      }

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
      const target = approvalTarget("llm_call", fullText);

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

      if (evaluation.requiresApproval) {
        const approved = await policyEngine.findApproval(
          tenantId,
          agentId,
          "llm_call",
          target,
          ["approved"],
        );
        if (!approved) {
          const approval = await policyEngine.createApproval(
            tenantId,
            agentId,
            "llm_call",
            {
              reasons: evaluation.reasons,
              sensitivityLevel: classification.sensitivityLevel,
              piiDetected: classification.piiDetected.map((item) => item.patternName),
              messagePreview: fullText.slice(0, 1000),
            },
            target,
          );

          await auditLogger.log({
            tenantId,
            agentId,
            agentName: agentConfig.name,
            action: "approval_required",
            target,
            details: { approvalId: approval.id, evaluation, classification },
            sensitivityLevel: classification.sensitivityLevel,
            success: false,
            durationMs: Date.now() - startTime,
          });

          res.status(403).json({
            error: "LLM call requires approval",
            requiresApproval: true,
            approval,
            reasons: evaluation.reasons,
          });
          return;
        }
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

  // ── Approval queue ───────────────────────────────────────
  app.get("/approvals", requireServiceAuth, async (req: Request, res: Response) => {
    try {
      const tenantId =
        (req.query.tenantId as string) || "00000000-0000-0000-0000-000000000000";
      const status = req.query.status as any;
      const limit = parseInt((req.query.limit as string) || "50", 10);
      const approvals = await policyEngine.listApprovals({ tenantId, status, limit });
      res.json({ approvals });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/approvals/:id", requireServiceAuth, async (req: Request, res: Response) => {
    try {
      const status = req.body.status;
      if (status !== "approved" && status !== "rejected") {
        res.status(400).json({ error: "status must be approved or rejected" });
        return;
      }
      const approval = await policyEngine.updateApproval({
        approvalId: req.params.id,
        status,
        actorId: req.body.actorId,
      });
      if (!approval) {
        res.status(404).json({ error: "Approval request not found" });
        return;
      }
      res.json({ approval });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Budget usage ─────────────────────────────────────────
  app.get("/usage/:tenantId", requireServiceAuth, async (req: Request, res: Response) => {
    try {
      const usage = await policyEngine.getUsage(req.params.tenantId);
      res.json({ usage });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}
