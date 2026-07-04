-- Enterprise Agent OS — Database Initialization
-- Run once on first startup

-- Paperclip uses its own database inside the same Postgres service.
SELECT 'CREATE DATABASE paperclip OWNER enterprise'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'paperclip')\gexec

-- Enable pgvector extension for agent memory
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Security Policies ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS security_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default security policy
INSERT INTO security_policies (tenant_id, name, description, rules, priority)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Default Enterprise Policy',
  'Default security policy: local-first, no external API calls, scrub PII',
  '{
    "allowExternalAPI": false,
    "allowedExternalModels": [],
    "scrubPII": true,
    "piiPatterns": ["email", "phone", "ssn", "credit_card", "api_key"],
    "maxTokensPerRequest": 32768,
    "dailyTokenBudget": 250000,
    "requireApprovalFor": ["deploy", "financial", "external_api_call"],
    "auditLevel": "all"
  }',
  0
);

-- ── Agent Configurations ───────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  employee_id UUID,
  paperclip_agent_id UUID,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'assistant',
  llm_preferences JSONB NOT NULL DEFAULT '{
    "defaultModel": "local",
    "fallbackModel": "ollama",
    "maxTokens": 32768,
    "temperature": 0.7
  }',
  tool_permissions JSONB NOT NULL DEFAULT '{
    "allowedTools": ["*"],
    "deniedTools": []
  }',
  external_api_allowed BOOLEAN DEFAULT FALSE,
  allowed_external_models TEXT[] DEFAULT '{}',
  skill_learning_enabled BOOLEAN DEFAULT TRUE,
  memory_enabled BOOLEAN DEFAULT TRUE,
  heartbeat_interval_sec INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Agent Task Ledger ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_tenant_time ON agent_sessions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions (tenant_id, status);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
  agent_id UUID,
  agent_name TEXT,
  external_task_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled task',
  prompt TEXT NOT NULL,
  board_status TEXT NOT NULL DEFAULT 'queued',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'queued',
  output TEXT,
  error_message TEXT,
  iterations INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  tool_calls JSONB DEFAULT '[]',
  duration_ms INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled task';
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS board_status TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL;
ALTER TABLE agent_tasks ALTER COLUMN agent_id DROP NOT NULL;
ALTER TABLE agent_tasks ALTER COLUMN agent_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_tenant_time ON agent_tasks (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_time ON agent_tasks (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_board ON agent_tasks (tenant_id, board_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_session ON agent_tasks (session_id, created_at DESC);

-- ── Agent Execution Trace Events ───────────────────────────
CREATE TABLE IF NOT EXISTS agent_task_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  agent_id UUID,
  sequence INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_task_events_task_sequence ON agent_task_events (task_id, sequence, created_at);

-- ── Audit Logs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  agent_name TEXT,
  action TEXT NOT NULL,
  target TEXT,
  details JSONB DEFAULT '{}',
  sensitivity_level TEXT DEFAULT 'internal',
  llm_backend_used TEXT,
  pii_detected BOOLEAN DEFAULT FALSE,
  pii_scrubbed BOOLEAN DEFAULT FALSE,
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast audit queries
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_agent_time ON audit_logs (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_sensitivity ON audit_logs (sensitivity_level);

-- ── PII Detection Patterns ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pii_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  pattern_name TEXT NOT NULL,
  regex_pattern TEXT NOT NULL,
  replacement_strategy TEXT DEFAULT 'mask',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Built-in PII patterns
INSERT INTO pii_patterns (tenant_id, pattern_name, regex_pattern, replacement_strategy) VALUES
  ('00000000-0000-0000-0000-000000000000', 'email', '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', 'mask'),
  ('00000000-0000-0000-0000-000000000000', 'phone_us', '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', 'mask'),
  ('00000000-0000-0000-0000-000000000000', 'ssn', '\b\d{3}-\d{2}-\d{4}\b', 'redact'),
  ('00000000-0000-0000-0000-000000000000', 'credit_card', '\b(?:\d{4}[ -]?){3}\d{4}\b', 'redact'),
  ('00000000-0000-0000-0000-000000000000', 'api_key', '(?:api[_-]?key|apikey|secret|token|password)[:=]\s*["'']?[a-zA-Z0-9_\-\.]{20,}["'']?', 'redact'),
  ('00000000-0000-0000-0000-000000000000', 'ip_address', '\b(?:\d{1,3}\.){3}\d{1,3}\b', 'mask'),
  ('00000000-0000-0000-0000-000000000000', 'aws_key', 'AKIA[0-9A-Z]{16}', 'redact');

-- ── Agent Memory (vector store) ────────────────────────────
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  memory_type TEXT DEFAULT 'conversation',  -- 'conversation', 'knowledge', 'skill', 'preference'
  metadata JSONB DEFAULT '{}',
  importance FLOAT DEFAULT 0.5,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_agent ON agent_memory (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_embedding ON agent_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ── Skills Library ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  agent_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,
  category TEXT,
  source TEXT DEFAULT 'manual',  -- 'manual', 'learned', 'imported'
  usage_count INTEGER DEFAULT 0,
  success_rate FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MCP Connections ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mcp_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  server_type TEXT NOT NULL,
  connection_config JSONB NOT NULL DEFAULT '{}',
  tools_enabled TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'disconnected',
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Approval Requests ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target TEXT,
  details JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  requested_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approval_requests (tenant_id, status);
