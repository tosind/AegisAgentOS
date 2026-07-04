# Aegis Agent OS — Architecture

## Overview

Aegis Agent OS is a self-hosted platform that provides enterprises with
24/7 AI agents that integrate with internal systems while maintaining strict
data security. It combines the best ideas from:

- **Paperclip** — Agent orchestration, governance, heartbeats, approvals
- **Hermes Agent** — Self-improving agents, memory, skills, cross-platform
- **Downy** — Self-hosted architecture, data isolation, security-first design

## Design Principles

### 1. Local-First LLM (No Data Leakage)
Every agent prompt is classified and routed:
- **Sensitive data** → vLLM (local GPU server, never leaves the network)
- **General tasks** → vLLM by default
- **Specialized tasks** → External API (admin opt-in per agent, with PII scrubbing)

### 2. Per-Employee Agents
Each employee gets a personal AI assistant that:
- Inherits the employee's access permissions
- Maintains personal memory and knowledge graph
- Learns skills from repeated tasks
- Has an independent audit trail

### 3. MCP-Native Integrations
All enterprise system connections use Model Context Protocol:
- Standardized, auditable protocol
- No hardcoded credentials in agent code
- Encrypted credential vault with rotation support

### 4. Paperclip Orchestration Backbone
Uses Paperclip's battle-tested:
- Heartbeat scheduler (agents wake, work, sleep)
- Task ticketing with dependencies
- Org chart with reporting lines
- Approval gates for sensitive actions
- Immutable audit logs

## System Components

```
┌──────────────────────────────────────────────────────────────┐
│                    DOCKER COMPOSE                             │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Dashboard │  │ Paperclip │  │ vLLM     │  │ PostgreSQL  │ │
│  │ :3000     │  │ :9123     │  │ :8000    │  │ :5432       │ │
│  └─────┬─────┘  └─────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│        │              │              │                │        │
│  ┌─────▼──────────────▼──────────────▼────────────────▼──────┐ │
│  │           ENTERPRISE AGENT RUNTIME (:8421)                 │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │ │
│  │  │ Security    │  │ LLM Router  │  │ MCP Hub          │  │ │
│  │  │ Layer       │  │              │  │                   │  │ │
│  │  │ • PII scrub │  │ • Classifier │  │ • DB connectors   │  │ │
│  │  │ • Policy    │  │ • vLLM client│  │ • API connectors  │  │ │
│  │  │   engine    │  │ • Ext API    │  │ • SaaS connectors │  │ │
│  │  │ • Audit log │  │   gateway    │  │ • File system     │  │ │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │ │
│  │  │ Memory      │  │ Skill       │  │ Tool Registry    │  │ │
│  │  │ System      │  │ Learning    │  │                   │  │ │
│  │  │ • Vector DB │  │ • Auto-skill│  │ • MCP tools       │  │ │
│  │  │ • Knowledge │  │   creation  │  │ • Custom tools    │  │ │
│  │  │   graph     │  │ • Skill lib │  │ • Permissions     │  │ │
│  │  └─────────────┘  └─────────────┘  └──────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### Task Execution Flow
```
1. Paperclip heartbeat triggers agent
2. Agent runtime receives task with context
3. Security layer classifies task sensitivity
4. PII scrubber removes sensitive data (if external call needed)
5. LLM router selects backend:
   - Local (vLLM): default for all tasks
   - External: only if agent has explicit external API permission
6. MCP Hub provides enterprise tools as needed
7. Agent executes, memory system records context
8. Result flows back through Paperclip for audit/approval
9. Skill learning extracts patterns for future reuse
```

### Security Decision Tree
```
Incoming task
  │
  ├── Contains PII? ──→ Scrub → Route to vLLM only
  │
  ├── Contains credentials? ──→ Scrub → Route to vLLM only
  │
  ├── Needs external API? ──→ Check agent permissions
  │     │
  │     ├── Allowed → Route to external (with scrubbed data)
  │     └── Denied  → Route to vLLM, note limitation
  │
  └── General task → Route to vLLM (default)
```

## API Design

### Agent Runtime API (internal, :8421)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/execute` | Execute a task via the agent runtime |
| GET | `/health` | Health check |
| GET | `/agents/:id/status` | Get agent status and current task |
| GET | `/agents/:id/memory` | Query agent memory/knowledge |
| POST | `/agents/:id/skills` | Register a new skill |
| GET | `/policies` | List security policies |
| POST | `/policies` | Create/update security policy |
| GET | `/audit` | Query audit logs |

### LLM Router API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | OpenAI-compatible chat endpoint |
| POST | `/classify` | Classify prompt sensitivity |
| GET | `/backends` | List available LLM backends |

### MCP Hub API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tools` | List available MCP tools |
| POST | `/tools/:name/call` | Call a specific MCP tool |
| POST | `/connections` | Register a new MCP server connection |
| GET | `/connections` | List active MCP connections |

## Database Schema

### PostgreSQL + pgvector - Tenant-isolated

```sql
-- Security policies
CREATE TABLE security_policies (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  rules JSONB NOT NULL,       -- {allowExternal: bool, allowedModels: [], scrubPII: bool}
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Agent configurations
CREATE TABLE agent_configs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  employee_id UUID,
  paperclip_agent_id UUID,
  llm_preferences JSONB,      -- {defaultModel, fallbackModel, maxTokens}
  tool_permissions JSONB,     -- {allowedTools: [], deniedTools: []}
  external_api_allowed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details JSONB,
  sensitivity_level TEXT,     -- 'internal_only', 'scrubbed', 'external'
  llm_backend_used TEXT,
  created_at TIMESTAMP
);

-- PII detection patterns
CREATE TABLE pii_patterns (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  pattern_name TEXT NOT NULL,
  regex_pattern TEXT NOT NULL,
  replacement_strategy TEXT,  -- 'mask', 'redact', 'hash'
  created_at TIMESTAMP
);

-- MCP connections
CREATE TABLE mcp_connections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  server_type TEXT NOT NULL,  -- 'postgres', 'slack', 'jira', 'github', etc.
  connection_config JSONB,    -- encrypted credentials
  status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Security Model

### Data Isolation
- Each tenant (company/department) has its own database schema
- Agent memory is per-tenant, never shared across tenants
- MCP connections are tenant-scoped

### PII Protection
- Regex-based PII detection (emails, phones, SSNs, credit cards, API keys)
- Automatic scrubbing before any external API call
- Configurable per-tenant PII patterns

### Audit Trail
- Every agent action is logged with:
  - Which agent performed it
  - What data was accessed
  - Which LLM backend was used
  - Sensitivity classification
- Immutable append-only log

### Network Security
- All inter-service communication is internal Docker network
- No ports exposed except dashboard (:3000) and optional API (:8421)
- Paperclip's built-in API key auth for all agent actions
