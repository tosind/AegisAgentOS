import { NextResponse } from "next/server";
import {
  demoOpsData,
  type AgentSessionSummary,
  type AgentTaskSummary,
  type AgentSummary,
  type AuditEvent,
  type IntegrationConnection,
  type ServiceHealth,
} from "@/lib/ops-data";
import { DEFAULT_TENANT_ID, getJson, serviceUrls } from "@/lib/service-client";

async function checkHealth(): Promise<ServiceHealth> {
  const [agentRuntime, securityLayer, mcpHub] = await Promise.all([
    getJson(`${serviceUrls.agentRuntime}/health`),
    getJson(`${serviceUrls.securityLayer}/health`),
    getJson(`${serviceUrls.mcpHub}/health`),
  ]);

  return {
    agentRuntime: !!agentRuntime,
    securityLayer: !!securityLayer,
    mcpHub: !!mcpHub,
  };
}

function mapAuditRows(rows: any[] | undefined): AuditEvent[] {
  if (!rows?.length) return demoOpsData.auditLogs;
  return rows.map((row, index) => ({
    id: row.id || String(index),
    time: row.createdAt || row.created_at || new Date().toISOString(),
    agent: row.agentName || row.agent_name || row.agentId || "Agent",
    action: row.action || "event",
    target: row.target || row.details?.modelUsed || "agent action",
    sensitivity: row.sensitivityLevel || row.sensitivity_level || "internal",
    backend: row.llmBackendUsed || row.llm_backend_used || "n/a",
    tokens: row.tokensUsed || row.tokens_used || 0,
    status: row.success === false ? "blocked" : "success",
  }));
}

function mapConnections(rows: any[] | undefined): IntegrationConnection[] {
  if (!rows?.length) return demoOpsData.connections;
  return rows.map((row) => ({
    name: row.name,
    type: row.serverType || row.server_type,
    status: row.status,
    tools: row.toolsEnabled?.length || row.tools_enabled?.length || 0,
    lastConnected: row.lastConnectedAt || row.last_connected_at || "Never",
  }));
}

function mapAgents(rows: any[] | undefined, runtimeOnline: boolean): AgentSummary[] {
  if (!runtimeOnline) return demoOpsData.agents.map((agent) => ({ ...agent, status: "offline", lastActive: "runtime offline" }));
  if (!rows?.length) return [];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role || "assistant",
    status: row.status || "idle",
    model: row.model || "local / ollama",
    tasksToday: row.tasksToday || row.tasks_today || 0,
    successRate: row.successRate || row.success_rate || "n/a",
    skillsLearned: row.skillsLearned || row.skills_learned || 0,
    externalAllowed: !!(row.externalApiAllowed || row.external_api_allowed),
    memoryEntries: row.memoryEntries || row.memory_entries || 0,
    heartbeatInterval: row.heartbeatIntervalSec
      ? `${Math.round(row.heartbeatIntervalSec / 60)} min`
      : "5 min",
    paperclipId: row.paperclipAgentId || row.paperclip_agent_id || row.id,
    lastActive: row.lastActive || row.last_active || "never",
  }));
}

function mapTasks(rows: any[] | undefined): AgentTaskSummary[] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    id: row.id,
    externalTaskId: row.externalTaskId || row.external_task_id || row.id,
    sessionId: row.sessionId || row.session_id || null,
    agentId: row.agentId || row.agent_id || null,
    agentName: row.agentName || row.agent_name || null,
    title: row.title || row.prompt?.slice(0, 72) || "Untitled task",
    prompt: row.prompt,
    boardStatus: row.boardStatus || row.board_status || "queued",
    priority: row.priority || "medium",
    status: row.status,
    output: row.output || null,
    errorMessage: row.errorMessage || row.error_message || null,
    iterations: row.iterations || 0,
    tokensUsed: row.tokensUsed || row.tokens_used || 0,
    toolCalls: row.toolCalls || row.tool_calls || [],
    durationMs: row.durationMs || row.duration_ms || null,
    createdAt: row.createdAt || row.created_at,
    completedAt: row.completedAt || row.completed_at || null,
  }));
}

function mapSessions(rows: any[] | undefined): AgentSessionSummary[] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    objective: row.objective || null,
    status: row.status || "active",
    taskCount: row.taskCount || row.task_count || 0,
    latestTaskAt: row.latestTaskAt || row.latest_task_at || null,
    createdAt: row.createdAt || row.created_at,
  }));
}

export async function GET() {
  const [serviceHealth, runtimeAgents, runtimeSessions, runtimeTasks, audit, connections, backends] = await Promise.all([
    checkHealth(),
    getJson<{ agents?: any[] }>(
      `${serviceUrls.agentRuntime}/agents?tenantId=${DEFAULT_TENANT_ID}`,
    ),
    getJson<{ sessions?: any[] }>(
      `${serviceUrls.agentRuntime}/sessions?tenantId=${DEFAULT_TENANT_ID}&limit=25`,
    ),
    getJson<{ tasks?: any[] }>(
      `${serviceUrls.agentRuntime}/tasks?tenantId=${DEFAULT_TENANT_ID}&limit=25`,
    ),
    getJson<{ logs?: any[]; auditLogs?: any[] }>(
      `${serviceUrls.securityLayer}/audit?tenantId=${DEFAULT_TENANT_ID}&limit=50`,
    ),
    getJson<{ connections?: any[] }>(
      `${serviceUrls.mcpHub}/connections?tenantId=${DEFAULT_TENANT_ID}`,
    ),
    getJson<{ backends?: Record<string, boolean> }>(`${serviceUrls.securityLayer}/backends`),
  ]);

  const source =
    serviceHealth.agentRuntime || serviceHealth.securityLayer || serviceHealth.mcpHub
      ? "live"
      : "demo";
  const auditRows = Array.isArray(audit)
    ? audit
    : audit?.logs || audit?.auditLogs || (audit as any)?.rows;

  return NextResponse.json({
    source,
    agents: mapAgents(runtimeAgents?.agents, serviceHealth.agentRuntime),
    sessions: mapSessions(runtimeSessions?.sessions),
    tasks: mapTasks(runtimeTasks?.tasks),
    auditLogs: mapAuditRows(auditRows),
    connections: mapConnections(connections?.connections),
    serviceHealth,
    backends: backends?.backends || demoOpsData.backends,
  });
}
