export type AgentSummary = {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "offline";
  model: string;
  tasksToday: number;
  successRate: string;
  skillsLearned: number;
  externalAllowed: boolean;
  memoryEntries: number;
  heartbeatInterval: string;
  paperclipId: string;
  lastActive: string;
};

export type AgentTaskSummary = {
  id: string;
  externalTaskId: string;
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
  completedAt: string | null;
};

export type AgentTaskEvent = {
  id: string;
  taskId: string;
  agentId: string | null;
  sequence: number;
  eventType: string;
  title: string;
  message: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AuditEvent = {
  id: string;
  time: string;
  agent: string;
  action: string;
  target: string;
  sensitivity: "internal" | "scrubbed" | "external";
  backend: string;
  tokens: number;
  status: "success" | "blocked" | "error";
};

export type IntegrationConnection = {
  name: string;
  type: string;
  status: "connected" | "disconnected" | "error";
  tools: number;
  lastConnected: string;
};

export type ServiceHealth = {
  agentRuntime: boolean;
  securityLayer: boolean;
  mcpHub: boolean;
};

export type OpsData = {
  source: "live" | "demo";
  agents: AgentSummary[];
  tasks: AgentTaskSummary[];
  auditLogs: AuditEvent[];
  connections: IntegrationConnection[];
  serviceHealth: ServiceHealth;
  backends: Record<string, boolean>;
};

export const demoAgents: AgentSummary[] = [
  { id: "1", name: "Dev Assistant", role: "Software Engineer Assistant", status: "active", model: "vLLM / Llama 3.1 70B", tasksToday: 12, successRate: "98.2%", skillsLearned: 7, externalAllowed: false, memoryEntries: 342, heartbeatInterval: "5 min", paperclipId: "agent-dev-1", lastActive: "2 min ago" },
  { id: "2", name: "Data Analyst", role: "Data Analysis Agent", status: "active", model: "vLLM / Llama 3.1 70B", tasksToday: 8, successRate: "95.8%", skillsLearned: 4, externalAllowed: false, memoryEntries: 156, heartbeatInterval: "5 min", paperclipId: "agent-data-1", lastActive: "15 min ago" },
  { id: "3", name: "Security Auditor", role: "Security Compliance Agent", status: "active", model: "vLLM / Llama 3.1 70B", tasksToday: 3, successRate: "100%", skillsLearned: 2, externalAllowed: false, memoryEntries: 89, heartbeatInterval: "10 min", paperclipId: "agent-sec-1", lastActive: "5 min ago" },
  { id: "4", name: "Support Bot", role: "Customer Support Agent", status: "idle", model: "Ollama / Mistral 7B", tasksToday: 24, successRate: "92.1%", skillsLearned: 15, externalAllowed: false, memoryEntries: 1089, heartbeatInterval: "3 min", paperclipId: "agent-sup-1", lastActive: "1 hr ago" },
];

export const demoAuditLogs: AuditEvent[] = [
  { id: "1", time: "2026-07-04T14:32:01Z", agent: "Dev Assistant", action: "llm_call_blocked", target: "PII detected (email) in prompt", sensitivity: "internal", backend: "n/a", tokens: 0, status: "blocked" },
  { id: "2", time: "2026-07-04T14:28:15Z", agent: "Data Analyst", action: "llm_call", target: "Database query analysis for Q3 report", sensitivity: "internal", backend: "vllm", tokens: 4500, status: "success" },
  { id: "3", time: "2026-07-04T14:15:43Z", agent: "Support Bot", action: "tool_call", target: "slack_send_message to #general", sensitivity: "scrubbed", backend: "n/a", tokens: 0, status: "success" },
  { id: "4", time: "2026-07-04T13:58:22Z", agent: "Security Auditor", action: "file_scan", target: "/data/reports/*.csv", sensitivity: "internal", backend: "n/a", tokens: 0, status: "success" },
  { id: "5", time: "2026-07-04T13:45:10Z", agent: "Dev Assistant", action: "llm_call", target: "Refactor authentication module", sensitivity: "scrubbed", backend: "vllm", tokens: 8900, status: "success" },
  { id: "6", time: "2026-07-04T13:22:05Z", agent: "Data Analyst", action: "tool_call", target: "postgres_query on analytics db", sensitivity: "internal", backend: "n/a", tokens: 0, status: "success" },
  { id: "7", time: "2026-07-04T12:58:40Z", agent: "Security Auditor", action: "llm_call_blocked", target: "Credential pattern detected", sensitivity: "internal", backend: "n/a", tokens: 0, status: "blocked" },
  { id: "8", time: "2026-07-04T12:30:15Z", agent: "Dev Assistant", action: "llm_call", target: "Implement rate limiting middleware", sensitivity: "scrubbed", backend: "ollama", tokens: 3400, status: "success" },
];

export const demoConnections: IntegrationConnection[] = [
  { name: "Production DB", type: "PostgreSQL", status: "connected", tools: 3, lastConnected: "2 min ago" },
  { name: "Slack Workspace", type: "Slack", status: "connected", tools: 4, lastConnected: "5 min ago" },
  { name: "GitHub Enterprise", type: "GitHub", status: "connected", tools: 4, lastConnected: "1 hr ago" },
  { name: "SMTP Server", type: "Email (SMTP)", status: "disconnected", tools: 1, lastConnected: "Never" },
];

export const demoTasks: AgentTaskSummary[] = [];

export const demoOpsData: OpsData = {
  source: "demo",
  agents: demoAgents,
  tasks: demoTasks,
  auditLogs: demoAuditLogs,
  connections: demoConnections,
  serviceHealth: {
    agentRuntime: false,
    securityLayer: false,
    mcpHub: false,
  },
  backends: {
    vllm: false,
    ollama: false,
    openai: false,
    anthropic: false,
  },
};

export const availableIntegrations = [
  { icon: "DB", name: "PostgreSQL", desc: "Connect to enterprise databases" },
  { icon: "SL", name: "Slack", desc: "Send messages and interact with channels" },
  { icon: "GH", name: "GitHub", desc: "Access repositories, issues, and PRs" },
  { icon: "JI", name: "Jira", desc: "Manage issues and workflows" },
  { icon: "EM", name: "Email (SMTP)", desc: "Send emails via enterprise SMTP" },
  { icon: "SF", name: "Salesforce", desc: "Access CRM data and records" },
  { icon: "API", name: "REST API", desc: "Connect to any REST API" },
  { icon: "FS", name: "File System", desc: "Access local files" },
];
