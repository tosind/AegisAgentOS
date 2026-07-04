# Enterprise Agent OS

Enterprise Agent OS is a self-hosted AI agent platform that combines a Hermes-style operations dashboard with a Paperclip orchestration backbone, local-first LLM routing, PII scrubbing, audit logs, and MCP-based enterprise integrations.

Status: alpha. The workspace now builds and tests cleanly, the dashboard can run from demo data or live local services, and Docker Compose defines the intended full stack. It is ready for a public repo as an early platform foundation, not as a hardened production release.

## What Is Included

- Next.js admin dashboard for agents, audit logs, policies, integrations, onboarding, and settings
- Agent runtime service with memory, skills, tool execution, and Paperclip webhook intake
- Security layer with PII detection, policy evaluation, audit logging, and local-first LLM routing
- MCP hub with connector scaffolds for PostgreSQL, Slack, GitHub, REST APIs, SMTP email, and filesystem tools
- Postgres + pgvector schema for policies, agents, audit logs, memory, skills, MCP connections, and approvals
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
npm run dev -w @enterprise/dashboard -- --port 3000
```

Default local dashboard login:

```text
admin@enterprise.local
change-me-now
```

Override the password with `DASHBOARD_ADMIN_PASSWORD`.

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

The dashboard calls `/api/ops`. If the local services are online, it reports live service health, audit rows, integrations, and backend availability. If services are offline, it falls back to packaged demo data so a fresh checkout still presents the product clearly.

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
