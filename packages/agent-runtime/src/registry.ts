import { randomUUID } from "crypto";
import { pool } from "./db.js";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export type RuntimeAgent = {
  id: string;
  tenantId: string;
  paperclipAgentId: string | null;
  name: string;
  role: string;
  model: string;
  status: "active" | "idle" | "offline";
  externalApiAllowed: boolean;
  heartbeatIntervalSec: number;
  tasksToday: number;
  successRate: string;
  skillsLearned: number;
  memoryEntries: number;
  lastActive: string;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeTask = {
  id: string;
  externalTaskId: string;
  tenantId: string;
  sessionId: string | null;
  agentId: string | null;
  agentName: string | null;
  title: string;
  prompt: string;
  boardStatus: "queued" | "running" | "review" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  status: "queued" | "running" | "succeeded" | "failed";
  output: string | null;
  errorMessage: string | null;
  iterations: number;
  tokensUsed: number;
  toolCalls: unknown[];
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type RuntimeSession = {
  id: string;
  tenantId: string;
  title: string;
  objective: string | null;
  status: "active" | "paused" | "closed";
  createdBy: string | null;
  metadata: Record<string, unknown>;
  taskCount: number;
  latestTaskAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type RuntimeTaskEvent = {
  id: string;
  tenantId: string;
  taskId: string;
  agentId: string | null;
  sequence: number;
  eventType: string;
  title: string;
  message: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function rowToAgent(row: any): RuntimeAgent {
  const llmPreferences = parseJson(row.llm_preferences, {
    defaultModel: "local",
    fallbackModel: "ollama",
  });
  const completed = Number(row.completed_count || 0);
  const succeeded = Number(row.success_count || 0);
  const successRate = completed > 0 ? `${Math.round((succeeded / completed) * 1000) / 10}%` : "n/a";

  return {
    id: row.id,
    tenantId: row.tenant_id,
    paperclipAgentId: row.paperclip_agent_id,
    name: row.name,
    role: row.role || "assistant",
    model: `${llmPreferences.defaultModel || "local"} / ${llmPreferences.fallbackModel || "ollama"}`,
    status: row.status || "idle",
    externalApiAllowed: !!row.external_api_allowed,
    heartbeatIntervalSec: Number(row.heartbeat_interval_sec || 300),
    tasksToday: Number(row.tasks_today || 0),
    successRate,
    skillsLearned: Number(row.skills_learned || 0),
    memoryEntries: Number(row.memory_entries || 0),
    lastActive: row.last_task_at ? new Date(row.last_task_at).toISOString() : "never",
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function rowToTask(row: any): RuntimeTask {
  return {
    id: row.id,
    externalTaskId: row.external_task_id,
    tenantId: row.tenant_id,
    sessionId: row.session_id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    title: row.title || row.prompt?.slice(0, 72) || "Untitled task",
    prompt: row.prompt,
    boardStatus: row.board_status,
    priority: row.priority,
    status: row.status,
    output: row.output,
    errorMessage: row.error_message,
    iterations: Number(row.iterations || 0),
    tokensUsed: Number(row.tokens_used || 0),
    toolCalls: parseJson(row.tool_calls, []),
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    createdAt: new Date(row.created_at).toISOString(),
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

function rowToSession(row: any): RuntimeSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    objective: row.objective,
    status: row.status || "active",
    createdBy: row.created_by,
    metadata: parseJson(row.metadata, {}),
    taskCount: Number(row.task_count || 0),
    latestTaskAt: row.latest_task_at ? new Date(row.latest_task_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
  };
}

function rowToEvent(row: any): RuntimeTaskEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    taskId: row.task_id,
    agentId: row.agent_id,
    sequence: Number(row.sequence || 0),
    eventType: row.event_type,
    title: row.title,
    message: row.message,
    payload: parseJson(row.payload, {}),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class AgentRegistry {
  async createSession(params: {
    tenantId?: string;
    title: string;
    objective?: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<RuntimeSession> {
    const tenantId = params.tenantId || DEFAULT_TENANT_ID;
    const result = await pool.query(
      `INSERT INTO agent_sessions (tenant_id, title, objective, created_by, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *, 0 AS task_count, NULL AS latest_task_at`,
      [
        tenantId,
        params.title,
        params.objective || null,
        params.createdBy || null,
        JSON.stringify(params.metadata || {}),
      ],
    );
    return rowToSession(result.rows[0]);
  }

  async listSessions(tenantId = DEFAULT_TENANT_ID, limit = 25): Promise<RuntimeSession[]> {
    const result = await pool.query(
      `SELECT s.*,
              COUNT(t.id) AS task_count,
              MAX(t.created_at) AS latest_task_at
       FROM agent_sessions s
       LEFT JOIN agent_tasks t ON t.session_id = s.id
       WHERE s.tenant_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(rowToSession);
  }

  async getSession(sessionId: string): Promise<RuntimeSession | null> {
    const result = await pool.query(
      `SELECT s.*,
              COUNT(t.id) AS task_count,
              MAX(t.created_at) AS latest_task_at
       FROM agent_sessions s
       LEFT JOIN agent_tasks t ON t.session_id = s.id
       WHERE s.id = $1
       GROUP BY s.id
       LIMIT 1`,
      [sessionId],
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  async updateSession(params: {
    sessionId: string;
    status?: RuntimeSession["status"];
    title?: string;
    objective?: string;
  }): Promise<RuntimeSession | null> {
    const current = await this.getSession(params.sessionId);
    if (!current) return null;

    const result = await pool.query(
      `UPDATE agent_sessions
       SET title = $2,
           objective = $3,
           status = $4,
           closed_at = CASE WHEN $4 = 'closed' THEN COALESCE(closed_at, NOW()) ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *,
         (SELECT COUNT(*) FROM agent_tasks t WHERE t.session_id = agent_sessions.id) AS task_count,
         (SELECT MAX(created_at) FROM agent_tasks t WHERE t.session_id = agent_sessions.id) AS latest_task_at`,
      [
        params.sessionId,
        params.title || current.title,
        params.objective === undefined ? current.objective : params.objective,
        params.status || current.status,
      ],
    );
    return rowToSession(result.rows[0]);
  }

  async listAgents(tenantId = DEFAULT_TENANT_ID): Promise<RuntimeAgent[]> {
    const result = await pool.query(
      `SELECT
         a.*,
         COALESCE(today.tasks_today, 0) AS tasks_today,
         COALESCE(done.completed_count, 0) AS completed_count,
         COALESCE(done.success_count, 0) AS success_count,
         COALESCE(skills.skills_learned, 0) AS skills_learned,
         COALESCE(memory.memory_entries, 0) AS memory_entries,
         last_task.last_task_at,
         CASE
           WHEN running.running_count > 0 THEN 'active'
           WHEN last_task.last_task_at > NOW() - INTERVAL '15 minutes' THEN 'idle'
           ELSE 'idle'
         END AS status
       FROM agent_configs a
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS tasks_today
         FROM agent_tasks t
         WHERE t.agent_id = a.id AND t.created_at >= date_trunc('day', NOW())
       ) today ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS completed_count,
                COUNT(*) FILTER (WHERE status = 'succeeded') AS success_count
         FROM agent_tasks t
         WHERE t.agent_id = a.id AND t.status IN ('succeeded', 'failed')
       ) done ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS skills_learned
         FROM skills s
         WHERE s.agent_id = a.id
       ) skills ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS memory_entries
         FROM agent_memory m
         WHERE m.agent_id = a.id
       ) memory ON TRUE
       LEFT JOIN LATERAL (
         SELECT MAX(created_at) AS last_task_at
         FROM agent_tasks t
         WHERE t.agent_id = a.id
       ) last_task ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS running_count
         FROM agent_tasks t
         WHERE t.agent_id = a.id AND t.status = 'running'
       ) running ON TRUE
       WHERE a.tenant_id = $1
       ORDER BY a.created_at DESC`,
      [tenantId],
    );

    return result.rows.map(rowToAgent);
  }

  async createAgent(params: {
    tenantId?: string;
    name: string;
    role?: string;
    paperclipAgentId?: string;
    defaultModel?: string;
    fallbackModel?: string;
    externalApiAllowed?: boolean;
    heartbeatIntervalSec?: number;
  }): Promise<RuntimeAgent> {
    const tenantId = params.tenantId || DEFAULT_TENANT_ID;
    const paperclipAgentId = params.paperclipAgentId || randomUUID();
    const llmPreferences = {
      defaultModel:
        params.defaultModel ||
        process.env.DEFAULT_AGENT_MODEL ||
        process.env.OLLAMA_MODEL ||
        "llama3.1:8b",
      fallbackModel: params.fallbackModel || "ollama",
      maxTokens: 32768,
      temperature: 0.7,
    };

    const result = await pool.query(
      `INSERT INTO agent_configs (
         tenant_id,
         paperclip_agent_id,
         name,
         role,
         llm_preferences,
         tool_permissions,
         external_api_allowed,
         heartbeat_interval_sec
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenantId,
        paperclipAgentId,
        params.name,
        params.role || "assistant",
        JSON.stringify(llmPreferences),
        JSON.stringify({ allowedTools: ["*"], deniedTools: [] }),
        !!params.externalApiAllowed,
        params.heartbeatIntervalSec || 300,
      ],
    );

    return rowToAgent({
      ...result.rows[0],
      tasks_today: 0,
      completed_count: 0,
      success_count: 0,
      skills_learned: 0,
      memory_entries: 0,
      status: "idle",
    });
  }

  async findAgent(agentId: string): Promise<RuntimeAgent | null> {
    const result = await pool.query(
      `SELECT
         a.*,
         0 AS tasks_today,
         0 AS completed_count,
         0 AS success_count,
         0 AS skills_learned,
         0 AS memory_entries,
         NULL AS last_task_at,
         'idle' AS status
       FROM agent_configs a
       WHERE a.id = $1 OR a.paperclip_agent_id = $1
       LIMIT 1`,
      [agentId],
    );

    return result.rows[0] ? rowToAgent(result.rows[0]) : null;
  }

  async startTask(params: {
    tenantId: string;
    agentId: string;
    agentName: string;
    sessionId?: string | null;
    externalTaskId?: string;
    title?: string;
    prompt: string;
  }): Promise<RuntimeTask> {
    const result = await pool.query(
      `INSERT INTO agent_tasks (
         tenant_id,
         session_id,
         agent_id,
         agent_name,
         external_task_id,
         title,
         prompt,
         board_status,
         status,
         started_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'running', 'running', NOW())
       RETURNING *`,
      [
        params.tenantId,
        params.sessionId || null,
        params.agentId,
        params.agentName,
        params.externalTaskId || randomUUID(),
        params.title || params.prompt.slice(0, 72),
        params.prompt,
      ],
    );

    const task = rowToTask(result.rows[0]);
    await this.addTaskEvent({
      tenantId: params.tenantId,
      taskId: task.id,
      agentId: params.agentId,
      eventType: "task_started",
      title: "Task started",
      message: `${params.agentName} started execution.`,
      payload: { externalTaskId: task.externalTaskId },
    });
    return task;
  }

  async createTask(params: {
    tenantId?: string;
    sessionId?: string | null;
    agentId?: string | null;
    agentName?: string | null;
    title: string;
    prompt: string;
    priority?: RuntimeTask["priority"];
    boardStatus?: RuntimeTask["boardStatus"];
  }): Promise<RuntimeTask> {
    const tenantId = params.tenantId || DEFAULT_TENANT_ID;
    const result = await pool.query(
      `INSERT INTO agent_tasks (
         tenant_id,
         session_id,
         agent_id,
         agent_name,
         external_task_id,
         title,
         prompt,
         priority,
         board_status,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued')
       RETURNING *`,
      [
        tenantId,
        params.sessionId || null,
        params.agentId || null,
        params.agentName || null,
        randomUUID(),
        params.title,
        params.prompt,
        params.priority || "medium",
        params.boardStatus || "queued",
      ],
    );

    const task = rowToTask(result.rows[0]);
    await this.addTaskEvent({
      tenantId,
      taskId: task.id,
      agentId: params.agentId || null,
      eventType: "task_created",
      title: "Task created",
      message: task.title,
      payload: { priority: task.priority, boardStatus: task.boardStatus },
    });
    return task;
  }

  async updateTask(params: {
    taskId: string;
    tenantId?: string;
    sessionId?: string | null;
    agentId?: string | null;
    agentName?: string | null;
    title?: string;
    prompt?: string;
    priority?: RuntimeTask["priority"];
    boardStatus?: RuntimeTask["boardStatus"];
  }): Promise<RuntimeTask | null> {
    const existing = await pool.query(`SELECT * FROM agent_tasks WHERE id = $1`, [params.taskId]);
    if (!existing.rows[0]) return null;

    const current = rowToTask(existing.rows[0]);
    const result = await pool.query(
      `UPDATE agent_tasks
       SET agent_id = $2,
           agent_name = $3,
           title = $4,
           prompt = $5,
           priority = $6,
           board_status = $7,
           session_id = $8
       WHERE id = $1
       RETURNING *`,
      [
        params.taskId,
        params.agentId === undefined ? current.agentId : params.agentId,
        params.agentName === undefined ? current.agentName : params.agentName,
        params.title || current.title,
        params.prompt || current.prompt,
        params.priority || current.priority,
        params.boardStatus || current.boardStatus,
        params.sessionId === undefined ? current.sessionId : params.sessionId,
      ],
    );

    const task = rowToTask(result.rows[0]);
    await this.addTaskEvent({
      tenantId: params.tenantId || task.tenantId,
      taskId: task.id,
      agentId: task.agentId,
      eventType: "task_updated",
      title: "Task updated",
      message: task.title,
      payload: { priority: task.priority, boardStatus: task.boardStatus },
    });
    return task;
  }

  async markTaskRunning(taskId: string, agent: RuntimeAgent): Promise<RuntimeTask | null> {
    const result = await pool.query(
      `UPDATE agent_tasks
       SET agent_id = $2,
           agent_name = $3,
           status = 'running',
           board_status = 'running',
           started_at = NOW(),
           completed_at = NULL,
           error_message = NULL
       WHERE id = $1
       RETURNING *`,
      [taskId, agent.id, agent.name],
    );
    if (!result.rows[0]) return null;
    const task = rowToTask(result.rows[0]);
    await this.addTaskEvent({
      tenantId: task.tenantId,
      taskId: task.id,
      agentId: agent.id,
      eventType: "task_started",
      title: "Task started",
      message: `${agent.name} started execution.`,
      payload: { externalTaskId: task.externalTaskId },
    });
    return task;
  }

  async completeTask(
    taskId: string,
    result: {
      output: string;
      iterations: number;
      tokensUsed: number;
      toolCalls: unknown[];
      durationMs: number;
    },
  ): Promise<RuntimeTask> {
    const rows = await pool.query(
      `UPDATE agent_tasks
       SET status = 'succeeded',
           board_status = 'review',
           output = $2,
           iterations = $3,
           tokens_used = $4,
           tool_calls = $5,
           duration_ms = $6,
           completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        taskId,
        result.output,
        result.iterations,
        result.tokensUsed,
        JSON.stringify(result.toolCalls),
        result.durationMs,
      ],
    );
    const task = rowToTask(rows.rows[0]);
    await this.addTaskEvent({
      tenantId: task.tenantId,
      taskId: task.id,
      agentId: task.agentId,
      eventType: "task_completed",
      title: "Task completed",
      message: result.output.slice(0, 500),
      payload: {
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        toolCalls: result.toolCalls.length,
        durationMs: result.durationMs,
      },
    });
    return task;
  }

  async failTask(taskId: string, errorMessage: string, durationMs: number): Promise<RuntimeTask> {
    const rows = await pool.query(
      `UPDATE agent_tasks
       SET status = 'failed',
           board_status = 'blocked',
           error_message = $2,
           duration_ms = $3,
           completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [taskId, errorMessage, durationMs],
    );
    const task = rowToTask(rows.rows[0]);
    await this.addTaskEvent({
      tenantId: task.tenantId,
      taskId: task.id,
      agentId: task.agentId,
      eventType: "task_failed",
      title: "Task failed",
      message: errorMessage,
      payload: { durationMs },
    });
    return task;
  }

  async listTasks(tenantId = DEFAULT_TENANT_ID, limit = 25): Promise<RuntimeTask[]> {
    const result = await pool.query(
      `SELECT *
       FROM agent_tasks
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit],
    );

    return result.rows.map(rowToTask);
  }

  async listSessionTasks(sessionId: string, limit = 50): Promise<RuntimeTask[]> {
    const result = await pool.query(
      `SELECT *
       FROM agent_tasks
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [sessionId, limit],
    );
    return result.rows.map(rowToTask);
  }

  async getTask(taskId: string): Promise<RuntimeTask | null> {
    const result = await pool.query(`SELECT * FROM agent_tasks WHERE id = $1`, [taskId]);
    return result.rows[0] ? rowToTask(result.rows[0]) : null;
  }

  async addTaskEvent(params: {
    tenantId: string;
    taskId: string;
    agentId?: string | null;
    eventType: string;
    title: string;
    message?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<RuntimeTaskEvent> {
    const sequence = await pool.query(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
       FROM agent_task_events
       WHERE task_id = $1`,
      [params.taskId],
    );
    const result = await pool.query(
      `INSERT INTO agent_task_events (
         tenant_id,
         task_id,
         agent_id,
         sequence,
         event_type,
         title,
         message,
         payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        params.tenantId,
        params.taskId,
        params.agentId || null,
        Number(sequence.rows[0].next_sequence),
        params.eventType,
        params.title,
        params.message || null,
        JSON.stringify(params.payload || {}),
      ],
    );
    return rowToEvent(result.rows[0]);
  }

  async listTaskEvents(taskId: string): Promise<RuntimeTaskEvent[]> {
    const result = await pool.query(
      `SELECT *
       FROM agent_task_events
       WHERE task_id = $1
       ORDER BY sequence ASC, created_at ASC`,
      [taskId],
    );
    return result.rows.map(rowToEvent);
  }
}
