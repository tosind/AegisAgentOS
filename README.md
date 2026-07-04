# Aegis Agent OS

Aegis Agent OS is a self-hosted AI agent platform that combines a Hermes-style operations dashboard with a Paperclip orchestration backbone, local-first LLM routing, PII scrubbing, audit logs, and MCP-based enterprise integrations.

Status: alpha internal harness. The workspace builds and tests cleanly, the dashboard can run from demo data or live local services, and Docker Compose defines the intended full stack. It is suitable for a public repo as an early open-source foundation, but it is not enterprise-ready production software yet.

## What Is Included

- Next.js admin dashboard for agents, Kanban work management, execution traces, audit logs, policies, integrations, onboarding, and settings
- Agent runtime service with DB-backed agent registry, task ledger, execution events, memory, skills, tool execution, and Paperclip webhook intake
- Security layer with PII detection, policy evaluation, audit logging, and local-first LLM routing
- MCP hub with connector scaffolds for PostgreSQL, Slack, GitHub, REST APIs, SMTP email, and filesystem tools
- Postgres + pgvector schema for policies, agents, task runs, trace events, audit logs, memory, skills, MCP connections, and approvals
- Docker Compose stack for dashboard, Paperclip, Postgres, Ollama, vLLM, runtime, security layer, MCP hub, and nginx

## Quick Start

```bash
npm install
npm run typecheck
npm test
npm run build
```

Run the dashboard locally:

```bash
DASHBOARD_ADMIN_PASSWORD=change-me-now npm run dev -w @enterprise/dashboard -- --port 3000
```

Default local dashboard login:

```text
admin@enterprise.local
change-me-now
```

Production-mode dashboard login requires `DASHBOARD_ADMIN_PASSWORD` to be set.

Smoke-test the dashboard:

```bash
DASHBOARD_BASE_URL=http://localhost:3000 \
DASHBOARD_SMOKE_PASSWORD=change-me-now \
npm run smoke:dashboard
```

## Full Stack With Docker

Clone Paperclip next to this repo, or set `PAPERCLIP_CONTEXT` in `.env`:

```bash
cp .env.example .env
git clone <paperclip-repo-url> ../paperclip
docker compose -f docker/docker-compose.yml up -d --build
```

Open:

- Dashboard: http://localhost:3000
- Paperclip: http://localhost:9123
- Agent runtime health: http://localhost:8421/health
- MCP hub health: http://localhost:8422/health
- Security layer health: http://localhost:8423/health

For GPU-backed vLLM:

```bash
docker compose -f docker/docker-compose.yml --profile gpu up -d --build
```

## Dashboard Data Mode

The dashboard calls `/api/ops`. If the local services are online, it reports live service health, agent records, task runs, audit rows, integrations, and backend availability. If services are offline, it falls back to packaged demo data so a fresh checkout still presents the product clearly.

The Agents page is a live harness when the runtime is online:

- `Create Agent` writes to `agent_configs`
- `Run Task` calls the runtime `/execute` endpoint through `/api/tasks`
- the Kanban board creates queued cards in `agent_tasks`
- `Run` on a card executes that existing work item through `/tasks/:id/run`
- task output, board status, priority, and errors are persisted in `agent_tasks`
- observable execution events are persisted in `agent_task_events`
- successful runs write memory to `agent_memory`
- LLM calls write audit rows through the security layer

The trace view intentionally records observable execution metadata, model summaries, tool calls, and state transitions. It does not expose hidden model chain-of-thought.

## Enterprise Readiness

Aegis is not enterprise-ready yet. The current repo is a functional pre-production harness for building toward Hermes/OpenClaw/Paperclip-style internal agents. Before using it for production operations, the project still needs:

- hardened authentication and role-based access control across every service route
- approval queues for write tools, deployments, finance actions, shell execution, and external API calls
- first-class Paperclip and Hermes/OpenClaw adapters instead of only compatible task/runtime primitives
- streaming execution traces and resumable multi-agent sessions
- budgets, quotas, tenant isolation tests, and stronger policy enforcement around MCP tools
- production secret storage, backup/restore drills, audit retention, and observability dashboards

## Deployment Docs

- [Deployment guide](docs/DEPLOYMENT.md) covers local preview, Docker Compose, managed Postgres/pgvector, model backends, reverse proxy, backups, and production hardening.
- [Agent deployment guide](docs/AGENTS.md) covers Paperclip agent registration, database-backed memory, MCP tool connections, policy defaults, and runtime task execution.

## Security Notes

This repo is not production-hardened yet. Before deploying beyond local development:

- Change every secret in `.env`
- Replace placeholder connector secret encoding with a real KMS or vault
- Put authentication in front of all service endpoints
- Enforce approval gates before write tools and shell execution
- Restrict filesystem and command tools per tenant/agent policy
- Review `npm audit` output and dependency upgrades
- Add TLS and network policy around exposed ports

## Useful Commands

```bash
npm run typecheck
npm test
npm run build
npm run docker:up
npm run docker:up:gpu
npm run docker:logs
npm run docker:down
```

## Project Layout

```text
packages/dashboard       Next.js admin UI
packages/agent-runtime   Agent execution, memory, skills, tools, Paperclip webhook
packages/security-layer  PII scrubber, policy engine, LLM router, audit API
packages/mcp-hub         Enterprise connector hub
packages/shared          Shared schemas, types, and auth helpers
docker/                  Compose, nginx, and database initialization
docs/                    Architecture and deployment notes
```
