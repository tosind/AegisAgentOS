import { z } from "zod";

// ── Security Classification ─────────────────────────────────

export const SensitivityLevel = {
  INTERNAL: "internal",
  SCRUBBED: "scrubbed",
  EXTERNAL: "external",
} as const;
export type SensitivityLevel =
  (typeof SensitivityLevel)[keyof typeof SensitivityLevel];

export const PIIStrategy = {
  MASK: "mask",
  REDACT: "redact",
  HASH: "hash",
} as const;
export type PIIStrategy = (typeof PIIStrategy)[keyof typeof PIIStrategy];

// ── LLM Backend ──────────────────────────────────────────────

export const LLMBackend = {
  VLLM: "vllm",
  OLLAMA: "ollama",
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
} as const;
export type LLMBackend = (typeof LLMBackend)[keyof typeof LLMBackend];

// ── Zod Schemas ──────────────────────────────────────────────

export const SecurityPolicySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  rules: z.object({
    allowExternalAPI: z.boolean().default(false),
    allowedExternalModels: z.array(z.string()).default([]),
    scrubPII: z.boolean().default(true),
    piiPatterns: z.array(z.string()).default(["email", "phone", "ssn"]),
    maxTokensPerRequest: z.number().default(32768),
    dailyTokenBudget: z.number().default(250000),
    requireApprovalFor: z.array(z.string()).default([]),
    auditLevel: z.enum(["none", "errors", "all"]).default("all"),
  }),
  priority: z.number().default(0),
  enabled: z.boolean().default(true),
});

export const AgentConfigSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  paperclipAgentId: z.string().uuid().optional(),
  name: z.string(),
  role: z.string().default("assistant"),
  llmPreferences: z.object({
    defaultModel: z.string().default("local"),
    fallbackModel: z.string().default("ollama"),
    maxTokens: z.number().default(32768),
    temperature: z.number().default(0.7),
  }),
  toolPermissions: z.object({
    allowedTools: z.array(z.string()).default(["*"]),
    deniedTools: z.array(z.string()).default([]),
  }),
  externalApiAllowed: z.boolean().default(false),
  allowedExternalModels: z.array(z.string()).default([]),
  skillLearningEnabled: z.boolean().default(true),
  memoryEnabled: z.boolean().default(true),
  heartbeatIntervalSec: z.number().default(300),
});

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().uuid(),
  agentName: z.string().optional(),
  action: z.string(),
  target: z.string().optional(),
  details: z.record(z.unknown()).default({}),
  sensitivityLevel: z
    .enum(["internal", "scrubbed", "external"])
    .default("internal"),
  llmBackendUsed: z.string().optional(),
  piiDetected: z.boolean().default(false),
  piiScrubbed: z.boolean().default(false),
  tokensUsed: z.number().default(0),
  durationMs: z.number().optional(),
  success: z.boolean().default(true),
  errorMessage: z.string().optional(),
});

export const PIIPatternSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  patternName: z.string(),
  regexPattern: z.string(),
  replacementStrategy: z.enum(["mask", "redact", "hash"]).default("mask"),
  enabled: z.boolean().default(true),
});

export const MCPConnectionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  serverType: z.string(),
  connectionConfig: z.record(z.unknown()).default({}),
  toolsEnabled: z.array(z.string()).default([]),
  status: z.enum(["connected", "disconnected", "error"]).default("disconnected"),
});

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentId: z.string().uuid(),
  actionType: z.string(),
  target: z.string().optional(),
  details: z.record(z.unknown()).default({}),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  requestedBy: z.string().uuid().optional(),
  approvedBy: z.string().uuid().optional(),
});

// ── Agent Task ───────────────────────────────────────────────

export interface AgentTask {
  id: string;
  tenantId: string;
  agentId: string;
  prompt: string;
  context?: {
    issueId?: string;
    projectId?: string;
    ancestors?: Array<{ title: string; description: string }>;
    goal?: { title: string; description: string };
  };
  tools?: string[];
  maxTokens?: number;
  requireApproval?: boolean;
}

// ── LLM Request/Response ─────────────────────────────────────

export interface LLMRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface LLMResponse {
  content: string;
  model: string;
  backend: LLMBackend;
  tokensUsed: number;
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

// ── PII Detection ────────────────────────────────────────────

export interface PIIDetection {
  patternName: string;
  matches: Array<{
    value: string;
    startIndex: number;
    endIndex: number;
  }>;
  strategy: PIIStrategy;
}

// ── Classification Result ────────────────────────────────────

export interface ClassificationResult {
  sensitivityLevel: SensitivityLevel;
  piiDetected: PIIDetection[];
  recommendedBackend: LLMBackend;
  requiresApproval: boolean;
  approvalReasons: string[];
}

// ── Type exports ─────────────────────────────────────────────

export type SecurityPolicy = z.infer<typeof SecurityPolicySchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
export type PIIPattern = z.infer<typeof PIIPatternSchema>;
export type MCPConnection = z.infer<typeof MCPConnectionSchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
