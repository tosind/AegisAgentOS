# Aegis Agent OS Deployment Guide

This guide covers three deployment shapes:

- Local preview: dashboard only, backed by packaged demo data.
- Full local stack: Docker Compose with Postgres/pgvector, Paperclip, agent runtime, MCP hub, security layer, Ollama, and the dashboard.
- Hosted stack: the same services pointed at your own managed Postgres-compatible database.

The project is alpha software. Use it as a self-hosted harness foundation and review the security checklist before exposing it outside a private network. Do not treat this checkout as production enterprise software until the readiness items in the root README are complete.

## Prerequisites

- Node.js 20+
- Docker and Docker Compose v2+
- A Paperclip checkout available to Docker via `PAPERCLIP_CONTEXT`
- PostgreSQL 16 with the `vector` extension for production or managed database deployments
- Optional: NVIDIA GPU drivers for the `vllm` Compose profile

## Local Dashboard Preview

Use this when you only want to inspect the Hermes-style dashboard and demo data.

```bash
npm install
npm run build -w @enterprise/dashboard
DASHBOARD_ADMIN_PASSWORD=change-me-now npm run start -w @enterprise/dashboard -- --hostname 0.0.0.0 --port 3000
```

Open `http://localhost:3000` and sign in with:

```text
admin@enterprise.local
change-me-now
```

Run the dashboard smoke test:

```bash
DASHBOARD_BASE_URL=http://localhost:3000 \
DASHBOARD_SMOKE_EMAIL=admin@enterprise.local \
DASHBOARD_SMOKE_PASSWORD=change-me-now \
npm run smoke:dashboard
```

## Full Stack With Docker Compose

1. Copy the example environment.

```bash
cp .env.example .env
```

2. Edit `.env` and change every `change-me-now` value.

3. Clone Paperclip next to this repo, or set `PAPERCLIP_CONTEXT` to its path.

```bash
git clone <paperclip-repo-url> ../paperclip
```

4. Start the stack.

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

5. Verify the services.

```bash
docker compose -f docker/docker-compose.yml ps
curl http://localhost:8421/health
curl http://localhost:8422/health
curl http://localhost:8423/health
```

Open:

- Dashboard: `http://localhost:3000`
- Paperclip: `http://localhost:9123`
- Agent runtime: `http://localhost:8421`
- MCP hub: `http://localhost:8422`
- Security layer: `http://localhost:8423`

## Use Your Own Database

Aegis services share one application database named by `AEGIS_DATABASE_URL`. Paperclip can use a separate database named by `PAPERCLIP_DATABASE_URL`.

For a managed database, create two databases or schemas:

```text
enterprise_agents
paperclip
```

Your database must support:

- PostgreSQL 16 compatible SQL
- `uuid-ossp`
- `vector` from pgvector
- TLS connections if the database is outside the Docker network

Set these values in `.env`:

```bash
AEGIS_DATABASE_URL=postgresql://aegis_user:strong-password@db.example.com:5432/enterprise_agents?sslmode=require
PAPERCLIP_DATABASE_URL=postgresql://paperclip_user:strong-password@db.example.com:5432/paperclip?sslmode=require
```

Then initialize the Aegis schema:

```bash
psql "$AEGIS_DATABASE_URL" -f docker/init-db.sql
```

If your managed provider does not allow `CREATE DATABASE`, remove the first Paperclip database creation block from `docker/init-db.sql` before running it. Keep the table, index, `uuid-ossp`, and `vector` setup for the Aegis database.

Start the services after the schema exists:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

## Local Models

The default Compose stack starts Ollama. Pull at least one chat model and one embedding model:

```bash
docker compose -f docker/docker-compose.yml exec ollama ollama pull llama3.1:8b
docker compose -f docker/docker-compose.yml exec ollama ollama pull nomic-embed-text
```

For GPU-backed vLLM:

```bash
docker compose -f docker/docker-compose.yml --profile gpu up -d --build
```

Useful environment values:

```bash
DEFAULT_LLM=ollama
OLLAMA_MODEL=llama3.1:8b
DEFAULT_AGENT_MODEL=llama3.1:8b
VLLM_MODEL=meta-llama/Llama-3.1-70B-Instruct
VLLM_GPU_COUNT=1
HF_TOKEN=<token-for-gated-models>
```

`OLLAMA_MODEL` is the model the security layer sends to Ollama. `DEFAULT_AGENT_MODEL` is written into new `agent_configs` rows when an agent is created from the dashboard.

## Live Agent Harness

The dashboard becomes a real harness when these services are online:

- Agent runtime
- Security layer
- PostgreSQL/pgvector with `docker/init-db.sql` applied
- Ollama or vLLM with a compatible model installed

The live flow is:

1. Open `http://localhost:3000/agents`.
2. Create an agent. This writes an `agent_configs` row.
3. Queue work on the Kanban board. The dashboard posts to `/api/tasks` with `mode: "create"` and writes a queued `agent_tasks` row.
4. Run a card. The dashboard posts to `/api/tasks/:id/run`, which calls the runtime `/tasks/:id/run` endpoint.
5. The runtime marks the existing task `running`, assigns the selected agent, and starts appending observable trace rows to `agent_task_events`.
6. The runtime calls the security layer, which classifies the prompt, enforces policy, routes to Ollama/vLLM, and writes `audit_logs`.
7. The runtime writes output, token count, duration, tool calls, and the final board status back to `agent_tasks`.
8. Successful runs store task memory in `agent_memory`.

For one-off execution, the dashboard `Run Task` form still posts through `/api/tasks` to the runtime `/execute` endpoint. That path creates and runs a task immediately instead of first placing it on the Kanban board.

The trace view records state transitions such as task creation, context preparation, memory/skill loading, model calls, tool calls, memory writes, success, and failure. It does not expose hidden model chain-of-thought.

If a model is not installed, the task fails and the failure is preserved in `agent_tasks`; the UI should show that error instead of pretending the agent ran.

For an existing database created before the Kanban and trace schema existed, apply the latest `docker/init-db.sql` or add the `agent_tasks` columns and `agent_task_events` table from that file.

## Reverse Proxy

The optional production profile starts nginx:

```bash
docker compose -f docker/docker-compose.yml --profile production up -d --build
```

Before using it publicly:

- Add TLS certificates and hostnames in `docker/nginx.conf`.
- Expose only `80` and `443` at the firewall.
- Keep service ports `8421`, `8422`, `8423`, `9123`, and `5432` private.
- Put authentication and rate limits in front of any public route.

## Backups

Back up both Aegis and Paperclip data. For the bundled Postgres service:

```bash
docker compose -f docker/docker-compose.yml exec postgres \
  pg_dump -U enterprise enterprise_agents > aegis-$(date +%F).sql

docker compose -f docker/docker-compose.yml exec postgres \
  pg_dump -U enterprise paperclip > paperclip-$(date +%F).sql
```

For managed databases, use provider snapshots plus periodic logical dumps.

## Production Checklist

- Change `DB_PASSWORD`, `DASHBOARD_ADMIN_PASSWORD`, `JWT_SECRET`, all service API keys, and all Paperclip secrets.
- Use `AEGIS_DATABASE_URL` and `PAPERCLIP_DATABASE_URL` values with TLS.
- Run `docker/init-db.sql` once against the Aegis database.
- Pull the model named by `OLLAMA_MODEL`, or point vLLM at the model named by `VLLM_MODEL`.
- Enable backups and test restore into a staging database.
- Restrict service ports to the private network.
- Replace placeholder credential storage with KMS, Vault, or your provider secret store.
- Review policy defaults before allowing write tools or shell/filesystem connectors.
- Run `npm run test`, `npm run typecheck`, `npm run build`, and `npm run smoke:dashboard`.
- Review `npm audit --omit=dev` before each release.

## Troubleshooting

`/api/ops` shows demo data:
The dashboard could not reach the runtime, security layer, or MCP hub. Check `AGENT_RUNTIME_URL`, `SECURITY_LAYER_URL`, `MCP_HUB_URL`, service health endpoints, and Docker networking.

Dashboard login fails:
Set `DASHBOARD_ADMIN_PASSWORD` in the running environment. The development shortcut for `@enterprise.local` users is not enabled in production mode.

Postgres startup fails on `vector`:
Use the `pgvector/pgvector:pg16` image or install pgvector in your managed database before running `docker/init-db.sql`.

Paperclip build fails:
Set `PAPERCLIP_CONTEXT` to a valid local Paperclip checkout that contains a Dockerfile.

Managed database initialization fails on `CREATE DATABASE`:
Run `docker/init-db.sql` after removing the first block that creates the `paperclip` database. Managed providers commonly require databases to be created from their console.
