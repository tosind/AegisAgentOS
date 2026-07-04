# Aegis Agent OS — Deployment Guide

## Quick Start

### Prerequisites
- Docker & Docker Compose v2+
- (Optional) NVIDIA GPU + drivers for vLLM
- (Optional) HuggingFace token for gated models

### 1. Clone and Setup

```bash
cd enterprise

# Build all images
docker compose -f docker/docker-compose.yml build

# Start the stack (without GPU)
docker compose -f docker/docker-compose.yml up -d

# Or with GPU support
docker compose -f docker/docker-compose.yml --profile gpu up -d
```

### 2. Verify Services

```bash
# Check all services are running
docker compose ps

# Dashboard
open http://localhost:3000

# Paperclip UI
open http://localhost:9123

# Agent Runtime health
curl http://localhost:8421/health

# MCP Hub health
curl http://localhost:8422/health
```

### 3. Pull Default Model (Ollama)

```bash
docker compose exec ollama ollama pull llama3.1:70b
docker compose exec ollama ollama pull nomic-embed-text
```

### 4. Create Your First Agent

1. Open the Paperclip UI at http://localhost:9123
2. Create a company and an agent
3. Register the agent in the enterprise platform
4. Configure security policies
5. Start assigning tasks!

## Architecture

```
  Dashboard (:3000)     Paperclip (:9123)     vLLM (:8000)
        │                      │                    │
        └──────────────────────┼────────────────────┘
                               │
                    Agent Runtime (:8421)
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              Security Layer  MCP Hub   PostgreSQL
                (:8423)      (:8422)    (:5432)
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_PASSWORD` | `enterprise_secret` | PostgreSQL password |
| `PAPERCLIP_API_KEY` | — | Paperclip API key for agents |
| `VLLM_MODEL` | `meta-llama/Llama-3.1-70B-Instruct` | Default vLLM model |
| `VLLM_GPU_COUNT` | `1` | Number of GPUs for vLLM |
| `HF_TOKEN` | — | HuggingFace token (for gated models) |
| `DEFAULT_LLM` | `ollama` | Default LLM backend (`vllm` or `ollama`) |
| `LOG_LEVEL` | `info` | Logging level |

## Production Deployment

For production, use the `--profile production` flag to enable Nginx reverse proxy:

```bash
docker compose -f docker/docker-compose.yml --profile production up -d
```

### Production Checklist
- [ ] Change `DB_PASSWORD` to a strong password
- [ ] Configure SSL certificates in `docker/nginx.conf`
- [ ] Set up proper firewall rules (only expose :80/:443)
- [ ] Configure regular database backups
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Review and customize security policies
- [ ] Test failover for vLLM → Ollama fallback

## Development

```bash
# Install dependencies
cd packages/shared && npm install
cd packages/security-layer && npm install
cd packages/agent-runtime && npm install
cd packages/mcp-hub && npm install
cd packages/dashboard && npm install

# Build all packages
npm run build

# Run individual services in development
npm run dev -w @enterprise/dashboard
```
