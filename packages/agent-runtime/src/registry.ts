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
  agentId: string;
  agentName: string;
  prompt: string;
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
    agentId: row.agent_id,
    agentName: row.agent_name,
    prompt: row.prompt,
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

export class AgentRegistry {
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
    externalTaskId?: string;
    prompt: string;
  }): Promise<RuntimeTask> {
    const result = await pool.query(
      `INSERT INTO agent_tasks (
         tenant_id,
         agent_id,
         agent_name,
         external_task_id,
         prompt,
         status,
         started_at
       )
       VALUES ($1, $2, $3, $4, $5, 'running', NOW())
       RETURNING *`,
      [
        params.tenantId,
        params.agentId,
        params.agentName,
        params.externalTaskId || randomUUID(),
        params.prompt,
      ],
    );

    return rowToTask(result.rows[0]);
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
    return rowToTask(rows.rows[0]);
  }

  async failTask(taskId: string, errorMessage: string, durationMs: number): Promise<RuntimeTask> {
    const rows = await pool.query(
      `UPDATE agent_tasks
       SET status = 'failed',
           error_message = $2,
           duration_ms = $3,
           completed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [taskId, errorMessage, durationMs],
    );
    return rowToTask(rows.rows[0]);
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
}
