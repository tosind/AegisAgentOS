import { NextResponse } from "next/server";
import {
  demoOpsData,
  type AgentSummary,
  type AuditEvent,
  type IntegrationConnection,
  type ServiceHealth,
} from "@/lib/ops-data";

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000000";

const urls = {
  agentRuntime:
    process.env.AGENT_RUNTIME_URL ||
    process.env.NEXT_PUBLIC_AGENT_RUNTIME_URL ||
    "http://localhost:8421",
  securityLayer:
    process.env.SECURITY_LAYER_URL ||
    process.env.NEXT_PUBLIC_SECURITY_LAYER_URL ||
    "http://localhost:8423",
  mcpHub:
    process.env.MCP_HUB_URL ||
    process.env.NEXT_PUBLIC_MCP_HUB_URL ||
    "http://localhost:8422",
};

async function getJson<T>(url: string, timeoutMs = 1500): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function checkHealth(): Promise<ServiceHealth> {
  const [agentRuntime, securityLayer, mcpHub] = await Promise.all([
    getJson(`${urls.agentRuntime}/health`),
    getJson(`${urls.securityLayer}/health`),
    getJson(`${urls.mcpHub}/health`),
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

export async function GET() {
  const [serviceHealth, audit, connections, backends] = await Promise.all([
    checkHealth(),
    getJson<{ logs?: any[]; auditLogs?: any[] }>(
      `${urls.securityLayer}/audit?tenantId=${TENANT_ID}&limit=50`,
    ),
    getJson<{ connections?: any[] }>(
      `${urls.mcpHub}/connections?tenantId=${TENANT_ID}`,
    ),
    getJson<{ backends?: Record<string, boolean> }>(`${urls.securityLayer}/backends`),
  ]);

  const source =
    serviceHealth.agentRuntime || serviceHealth.securityLayer || serviceHealth.mcpHub
      ? "live"
      : "demo";

  const agents: AgentSummary[] = demoOpsData.agents.map((agent) => ({
    ...agent,
    status: serviceHealth.agentRuntime ? agent.status : "offline",
    lastActive: serviceHealth.agentRuntime ? agent.lastActive : "runtime offline",
  }));

  return NextResponse.json({
    source,
    agents,
    auditLogs: mapAuditRows(audit?.logs || audit?.auditLogs || (audit as any)?.rows),
    connections: mapConnections(connections?.connections),
    serviceHealth,
    backends: backends?.backends || demoOpsData.backends,
  });
}
