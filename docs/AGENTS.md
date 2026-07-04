# Deploying Agents

Aegis agents are Paperclip-managed workers with Aegis runtime configuration, database-backed memory, MCP tools, and policy enforcement.

## Agent Data Model

Agent configuration lives in `agent_configs`:

- `tenant_id`: the customer, company, department, or environment boundary.
- `paperclip_agent_id`: the Paperclip agent identity that wakes up and receives tasks.
- `name` and `role`: display and routing metadata.
- `llm_preferences`: default model, fallback model, token limits, and temperature.
- `tool_permissions`: allowed and denied MCP tool names.
- `external_api_allowed`: whether the agent may use external LLM APIs after PII checks.
- `skill_learning_enabled`: whether successful task patterns can become reusable skills.
- `memory_enabled`: whether the agent writes to `agent_memory`.
- `heartbeat_interval_sec`: expected Paperclip wake interval.

Agent memory lives in `agent_memory` and requires pgvector. Keep embeddings tenant-scoped and agent-scoped.

## Register an Agent

1. Create the agent in Paperclip.
2. Copy its Paperclip agent ID.
3. Insert or upsert the Aegis runtime configuration.

```sql
INSERT INTO agent_configs (
  tenant_id,
  paperclip_agent_id,
  name,
  role,
  llm_preferences,
  tool_permissions,
  external_api_allowed,
  heartbeat_interval_sec
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '<paperclip-agent-uuid>',
  'Revenue Analyst',
  'analytics',
  '{"defaultModel":"ollama","fallbackModel":"vllm","maxTokens":8192,"temperature":0.2}',
  '{"allowedTools":["postgres.query","github.search","slack.send"],"deniedTools":["filesystem.write","shell.exec"]}',
  false,
  300
);
```

4. Add at least one security policy for the tenant.
5. Add MCP connections for the tools the agent can use.
6. Send tasks through Paperclip or the agent runtime.

## Connect Tools

MCP connections live in `mcp_connections`. Start narrow and add write permissions only after audit logs look correct.

```sql
INSERT INTO mcp_connections (
  tenant_id,
  name,
  server_type,
  connection_config,
  tools_enabled,
  status
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Analytics Warehouse',
  'postgres',
  '{"connectionString":"postgresql://readonly:password@warehouse:5432/analytics"}',
  ARRAY['postgres.query'],
  'connected'
);
```

For production, do not store plaintext credentials in `connection_config`. Replace the placeholder storage with KMS, Vault, Doppler, 1Password, AWS Secrets Manager, GCP Secret Manager, or your preferred secret backend.

## Execute a Task

When the runtime is online, internal services can submit work to `POST /execute`.

```bash
curl -X POST http://localhost:8421/execute \
  -H "Authorization: Bearer $AGENT_RUNTIME_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-001",
    "tenantId": "00000000-0000-0000-0000-000000000000",
    "agentId": "<agent-config-or-paperclip-id>",
    "prompt": "Summarize open enterprise sales risks from the analytics database."
  }'
```

The runtime routes the task through the security layer, checks policy, calls the selected LLM backend, uses permitted MCP tools, writes audit rows, and stores memory when enabled.

## Policy Defaults

Use conservative defaults for new agents:

```json
{
  "allowExternalAPI": false,
  "allowedExternalModels": [],
  "scrubPII": true,
  "piiPatterns": ["email", "phone", "ssn", "credit_card", "api_key"],
  "requireApprovalFor": ["deploy", "financial", "external_api_call"],
  "auditLevel": "all"
}
```

Only enable external LLMs for agents that have a business reason and a reviewed PII policy.

## Database Isolation

Use one of these patterns:

- Single database, tenant-scoped rows: simplest for one organization or internal deployment.
- Separate databases per customer: stronger isolation for hosted multi-tenant deployments.
- Separate schemas per customer: a middle ground if your operations team already manages schema-level access.

Whichever pattern you choose, keep `tenant_id` on every agent, memory, connection, policy, approval, and audit row.

## Operational Checks

Before enabling an agent for real users:

- Confirm its row exists in `agent_configs`.
- Confirm its Paperclip heartbeat is active.
- Confirm `/agents/:id/status` returns a useful status.
- Confirm its allowed MCP tools are minimal.
- Run a harmless task and inspect `audit_logs`.
- Confirm PII is scrubbed before any external API route.
- Confirm memory is written to `agent_memory` only for the expected tenant.
