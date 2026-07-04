// ── Agent Runtime HTTP Server ─────────────────────────────────
// REST API for agent execution, memory, and skill management.

import express, { type Request, type Response } from "express";
import { AgentEngine } from "./engine.js";
import { MemorySystem } from "./memory.js";
import { SkillEngine } from "./skills.js";
import { ToolRegistry } from "./tools.js";
import {
  authMiddleware,
  requestLogger,
  requireFields,
  tenantContext,
  errorHandler,
} from "./middleware.js";

export function createServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // Global middleware
  app.use(requestLogger);
  app.use(tenantContext);

  const engine = new AgentEngine();
  const memory = new MemorySystem();
  const skills = new SkillEngine();
  const tools = new ToolRegistry();

  // ── Health ───────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "agent-runtime" });
  });

  // ── Execute task (auth required) ─────────────────────────
  app.post("/execute", authMiddleware, requireFields("taskId", "tenantId", "agentId", "prompt"), async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const {
        taskId,
        tenantId,
        agentId,
        agentName,
        prompt,
        context,
        maxIterations,
      } = req.body;

      if (!taskId || !tenantId || !agentId || !prompt) {
        res.status(400).json({
          error: "taskId, tenantId, agentId, and prompt are required",
        });
        return;
      }

      console.log(`📋 Executing task ${taskId} for agent ${agentName || agentId}`);

      const result = await engine.executeTask({
        taskId,
        tenantId,
        agentId,
        agentName: agentName || "Agent",
        prompt,
        context,
        maxIterations: maxIterations || 10,
      });

      console.log(
        `✅ Task ${taskId} completed in ${Date.now() - startTime}ms (${result.iterations} iterations, ${result.tokensUsed} tokens)`,
      );

      res.json({
        ...result,
        durationMs: Date.now() - startTime,
      });
    } catch (err: any) {
      console.error(`❌ Task execution failed:`, err.message);
      res.status(500).json({
        success: false,
        error: err.message,
        durationMs: Date.now() - startTime,
      });
    }
  });

  // ── Agent status ─────────────────────────────────────────
  app.get("/agents/:id/status", (_req: Request, res: Response) => {
    // Query agent status from Paperclip
    res.json({
      agentId: _req.params.id,
      status: "idle",
      currentTask: null,
      lastHeartbeat: new Date().toISOString(),
    });
  });

  // ── Memory endpoints ─────────────────────────────────────
  app.get("/agents/:id/memory", async (req: Request, res: Response) => {
    try {
      const { query, limit } = req.query;
      const agentId = req.params.id;

      if (query) {
        const results = await memory.search(
          agentId,
          query as string,
          parseInt((limit as string) || "5", 10),
        );
        res.json({ results });
      } else {
        const results = await memory.getRecent(
          agentId,
          parseInt((limit as string) || "10", 10),
        );
        res.json({ results });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/agents/:id/memory", async (req: Request, res: Response) => {
    try {
      const { fact, importance } = req.body;
      const agentId = req.params.id;
      const tenantId = req.body.tenantId || "00000000-0000-0000-0000-000000000000";

      if (!fact) {
        res.status(400).json({ error: "fact is required" });
        return;
      }

      await memory.storeKnowledge(agentId, tenantId, fact, importance);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Skill endpoints ──────────────────────────────────────
  app.get("/agents/:id/skills", async (req: Request, res: Response) => {
    try {
      const agentId = req.params.id;
      const result = await skills.listSkills(agentId);
      res.json({ skills: result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/agents/:id/skills", async (req: Request, res: Response) => {
    try {
      const { name, description, instructions, category } = req.body;
      const agentId = req.params.id;
      const tenantId = req.body.tenantId || "00000000-0000-0000-0000-000000000000";

      if (!name || !instructions) {
        res.status(400).json({ error: "name and instructions are required" });
        return;
      }

      const skill = await skills.createSkill({
        tenantId,
        agentId,
        name,
        description: description || "",
        instructions,
        category,
      });

      res.json({ skill });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Tool endpoints ───────────────────────────────────────
  app.get("/tools", async (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || "00000000-0000-0000-0000-000000000000";
      const toolList = await tools.listTools(tenantId);
      res.json({ tools: toolList });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/tools/refresh", (req: Request, res: Response) => {
    const tenantId = req.body.tenantId || "00000000-0000-0000-0000-000000000000";
    tools.invalidateCache(tenantId);
    res.json({ success: true });
  });

  // ── Paperclip heartbeat handler ──────────────────────────
  app.post("/webhook", async (req: Request, res: Response) => {
    try {
      const payload = req.body;

      // Extract task info from Paperclip webhook
      const taskId = payload.taskId || payload.context?.taskId;
      const tenantId = payload.companyId || payload.context?.companyId;
      const agentId = payload.agentId;
      const agentName = payload.agentName || "Agent";
      const prompt = payload.prompt || payload.description;
      const context = payload.context || {};

      if (!taskId || !agentId || !prompt) {
        // If no task, just acknowledge heartbeat
        res.json({ status: "acknowledged", message: "No task to execute" });
        return;
      }

      // Execute asynchronously (Paperclip polls for results)
      engine
        .executeTask({
          taskId,
          tenantId: tenantId || "00000000-0000-0000-0000-000000000000",
          agentId,
          agentName,
          prompt,
          context,
        })
        .then((result) => {
          console.log(`✅ Background task ${taskId} completed`);
        })
        .catch((err) => {
          console.error(`❌ Background task ${taskId} failed:`, err.message);
        });

      res.json({ status: "accepted", taskId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use(errorHandler);

  return app;
}
