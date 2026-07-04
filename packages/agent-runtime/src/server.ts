// ── Agent Runtime HTTP Server ─────────────────────────────────
// REST API for agent execution, memory, and skill management.

import express, { type Request, type Response } from "express";
import { AgentEngine } from "./engine.js";
import { MemorySystem } from "./memory.js";
import { AgentRegistry } from "./registry.js";
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
  const registry = new AgentRegistry();
  const skills = new SkillEngine();
  const tools = new ToolRegistry();

  // ── Health ───────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "agent-runtime" });
  });

  // ── Agent registry ───────────────────────────────────────
  app.get("/agents", async (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || "00000000-0000-0000-0000-000000000000";
      const agents = await registry.listAgents(tenantId);
      res.json({ agents });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/agents", authMiddleware, requireFields("name"), async (req: Request, res: Response) => {
    try {
      const agent = await registry.createAgent({
        tenantId: req.body.tenantId,
        name: req.body.name,
        role: req.body.role,
        paperclipAgentId: req.body.paperclipAgentId,
        defaultModel: req.body.defaultModel,
        fallbackModel: req.body.fallbackModel,
        externalApiAllowed: req.body.externalApiAllowed,
        heartbeatIntervalSec: req.body.heartbeatIntervalSec,
      });
      res.status(201).json({ agent });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Sessions ─────────────────────────────────────────────
  app.get("/sessions", async (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || "00000000-0000-0000-0000-000000000000";
      const limit = parseInt((req.query.limit as string) || "25", 10);
      const sessions = await registry.listSessions(tenantId, limit);
      res.json({ sessions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/sessions", authMiddleware, requireFields("title"), async (req: Request, res: Response) => {
    try {
      const session = await registry.createSession({
        tenantId: req.body.tenantId || "00000000-0000-0000-0000-000000000000",
        title: req.body.title,
        objective: req.body.objective,
        createdBy: req.body.createdBy,
        metadata: req.body.metadata || {},
      });
      res.status(201).json({ session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/sessions/:id", async (req: Request, res: Response) => {
    try {
      const session = await registry.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      const tasks = await registry.listSessionTasks(req.params.id, 50);
      res.json({ session, tasks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/sessions/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const session = await registry.updateSession({
        sessionId: req.params.id,
        title: req.body.title,
        objective: req.body.objective,
        status: req.body.status,
      });
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      res.json({ session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Adapter intake: Paperclip / Hermes / OpenClaw ─────────
  app.post("/adapters/:source/tasks", authMiddleware, async (req: Request, res: Response) => {
    try {
      const source = String(req.params.source || "").toLowerCase();
      if (!["paperclip", "hermes", "openclaw"].includes(source)) {
        res.status(400).json({ error: "source must be paperclip, hermes, or openclaw" });
        return;
      }

      const payload = req.body || {};
      const tenantId =
        payload.tenantId ||
        payload.companyId ||
        payload.orgId ||
        payload.context?.tenantId ||
        payload.context?.companyId ||
        "00000000-0000-0000-0000-000000000000";
      const agentId =
        payload.agentId ||
        payload.assigneeAgentId ||
        payload.agent?.id ||
        payload.context?.agentId ||
        null;
      const agent = agentId ? await registry.findAgent(agentId) : null;
      const taskPayload = payload.task || payload.issue || payload;
      const prompt = taskPayload.prompt || taskPayload.description || payload.prompt || payload.description;
      if (!prompt) {
        res.status(400).json({ error: "prompt or description is required" });
        return;
      }

      let sessionId = payload.sessionId || payload.context?.sessionId || null;
      if (!sessionId && (payload.session || payload.goal)) {
        const session = await registry.createSession({
          tenantId,
          title: payload.session?.title || payload.goal?.title || `${source} intake`,
          objective: payload.session?.objective || payload.goal?.description || null,
          createdBy: source,
          metadata: { source, externalSessionId: payload.session?.id || payload.goal?.id || null },
        });
        sessionId = session.id;
      }

      const task = await registry.createTask({
        tenantId,
        sessionId,
        agentId: agent?.id || agentId,
        agentName: agent?.name || payload.agentName || payload.agent?.name || null,
        title: taskPayload.title || payload.title || prompt.slice(0, 72),
        prompt,
        priority: payload.priority || taskPayload.priority || "medium",
        boardStatus: payload.boardStatus || "queued",
      });
      await registry.addTaskEvent({
        tenantId,
        taskId: task.id,
        agentId: task.agentId,
        eventType: "adapter_ingested",
        title: `${source} task ingested`,
        message: task.title,
        payload: {
          source,
          externalTaskId: payload.taskId || payload.id || taskPayload.id || null,
          runNow: !!payload.runNow,
        },
      });

      res.status(202).json({ accepted: true, source, task });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/tasks", async (req: Request, res: Response) => {
    try {
      const tenantId = (req.query.tenantId as string) || "00000000-0000-0000-0000-000000000000";
      const limit = parseInt((req.query.limit as string) || "25", 10);
      const tasks = await registry.listTasks(tenantId, limit);
      res.json({ tasks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/tasks", authMiddleware, requireFields("title", "prompt"), async (req: Request, res: Response) => {
    try {
      const agent = req.body.agentId ? await registry.findAgent(req.body.agentId) : null;
      const task = await registry.createTask({
        tenantId: req.body.tenantId || "00000000-0000-0000-0000-000000000000",
        sessionId: req.body.sessionId || null,
        agentId: agent?.id || req.body.agentId || null,
        agentName: agent?.name || req.body.agentName || null,
        title: req.body.title,
        prompt: req.body.prompt,
        priority: req.body.priority || "medium",
        boardStatus: req.body.boardStatus || "queued",
      });
      res.status(201).json({ task });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/tasks/:id", authMiddleware, async (req: Request, res: Response) => {
    try {
      const agent = req.body.agentId ? await registry.findAgent(req.body.agentId) : null;
      const task = await registry.updateTask({
        taskId: req.params.id,
        tenantId: req.body.tenantId,
        sessionId: req.body.sessionId,
        agentId: agent?.id ?? req.body.agentId,
        agentName: agent?.name ?? req.body.agentName,
        title: req.body.title,
        prompt: req.body.prompt,
        priority: req.body.priority,
        boardStatus: req.body.boardStatus,
      });
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json({ task });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/tasks/:id/events", async (req: Request, res: Response) => {
    try {
      const events = await registry.listTaskEvents(req.params.id);
      res.json({ events });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/tasks/:id/events/stream", async (req: Request, res: Response) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    let lastSequence = Number(req.query.after || 0);
    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const sendEvents = async () => {
      try {
        const events = await registry.listTaskEvents(req.params.id);
        for (const event of events.filter((item) => item.sequence > lastSequence)) {
          lastSequence = event.sequence;
          res.write(`event: trace\n`);
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (err: any) {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      }
    };

    await sendEvents();
    const interval = setInterval(() => {
      if (closed) {
        clearInterval(interval);
        return;
      }
      void sendEvents();
    }, 1500);
  });

  app.post("/tasks/:id/run", authMiddleware, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const existingTask = await registry.getTask(req.params.id);
      if (!existingTask) {
        res.status(404).json({ success: false, error: "Task not found" });
        return;
      }

      const agentId = req.body.agentId || existingTask.agentId;
      if (!agentId) {
        res.status(400).json({ success: false, error: "agentId is required to run this task" });
        return;
      }

      const agent = await registry.findAgent(agentId);
      if (!agent) {
        res.status(404).json({ success: false, error: `No agent config found for ${agentId}` });
        return;
      }

      const task = await registry.markTaskRunning(existingTask.id, agent);
      if (!task) {
        res.status(404).json({ success: false, error: "Task not found" });
        return;
      }

      const result = await engine.executeTask({
        taskId: task.externalTaskId,
        tenantId: task.tenantId,
        agentId: agent.id,
        agentName: agent.name,
        prompt: task.prompt,
        context: req.body.context || {},
        maxIterations: req.body.maxIterations || 10,
        onEvent: async (event) => {
          await registry.addTaskEvent({
            tenantId: task.tenantId,
            taskId: task.id,
            agentId: agent.id,
            ...event,
          });
        },
      });

      const completedTask = await registry.completeTask(task.id, {
        output: result.output,
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        toolCalls: result.toolCalls,
        durationMs: Date.now() - startTime,
      });

      res.json({ ...result, task: completedTask, durationMs: Date.now() - startTime });
    } catch (err: any) {
      let task = null;
      try {
        task = await registry.failTask(req.params.id, err.message, Date.now() - startTime);
      } catch (taskErr: any) {
        console.error(`❌ Failed to update task ledger:`, taskErr.message);
      }
      res.status(500).json({
        success: false,
        error: err.message,
        task,
        durationMs: Date.now() - startTime,
      });
    }
  });

  // ── Execute task (auth required) ─────────────────────────
  app.post("/execute", authMiddleware, requireFields("taskId", "tenantId", "agentId", "prompt"), async (req: Request, res: Response) => {
    const startTime = Date.now();
    let taskRecordId: string | null = null;
    try {
      const {
        taskId,
        tenantId,
        agentId,
        agentName,
        sessionId,
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

      const agent = await registry.findAgent(agentId);
      if (!agent) {
        res.status(404).json({
          success: false,
          error: `No agent config found for ${agentId}`,
          durationMs: Date.now() - startTime,
        });
        return;
      }

      const task = await registry.startTask({
        tenantId,
        agentId: agent.id,
        agentName: agentName || agent.name,
        sessionId: sessionId || null,
        externalTaskId: taskId,
        title: req.body.title,
        prompt,
      });
      taskRecordId = task.id;

      console.log(`📋 Executing task ${taskId} for agent ${agentName || agent.name}`);

      const result = await engine.executeTask({
        taskId,
        tenantId,
        agentId: agent.id,
        agentName: agentName || agent.name,
        prompt,
        context,
        maxIterations: maxIterations || 10,
        onEvent: async (event) => {
          await registry.addTaskEvent({
            tenantId,
            taskId: task.id,
            agentId: agent.id,
            ...event,
          });
        },
      });

      const completedTask = await registry.completeTask(task.id, {
        output: result.output,
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        toolCalls: result.toolCalls,
        durationMs: Date.now() - startTime,
      });

      console.log(
        `✅ Task ${taskId} completed in ${Date.now() - startTime}ms (${result.iterations} iterations, ${result.tokensUsed} tokens)`,
      );

      res.json({
        ...result,
        task: completedTask,
        durationMs: Date.now() - startTime,
      });
    } catch (err: any) {
      console.error(`❌ Task execution failed:`, err.message);
      let task = null;
      if (taskRecordId) {
        try {
          task = await registry.failTask(taskRecordId, err.message, Date.now() - startTime);
        } catch (taskErr: any) {
          console.error(`❌ Failed to update task ledger:`, taskErr.message);
        }
      }
      res.status(500).json({
        success: false,
        error: err.message,
        task,
        durationMs: Date.now() - startTime,
      });
    }
  });

  // ── Agent status ─────────────────────────────────────────
  app.get("/agents/:id/status", async (req: Request, res: Response) => {
    try {
      const agent = await registry.findAgent(req.params.id);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      res.json({
        agentId: agent.id,
        paperclipAgentId: agent.paperclipAgentId,
        status: agent.status,
        currentTask: null,
        lastHeartbeat: agent.lastActive,
        tasksToday: agent.tasksToday,
        successRate: agent.successRate,
        memoryEntries: agent.memoryEntries,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
