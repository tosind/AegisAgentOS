# Production readiness work

This branch fixes verified build and security gaps. It does not establish that Aegis is already a production deployment.

## Changes

- Typecheck builds shared exports before consumers; the security-layer unit test no longer requires a live database.
- Runtime read endpoints, MCP endpoints and security-layer endpoints require service credentials; `/health` remains public. Runtime tool calls propagate the MCP credential. Webhook ingestion fails closed when its secret is absent.
- Dashboard API requests require a valid session. Mutation requests reject cross-origin browser calls. JWT validation checks signatures, expiry, algorithm and session shape. Production token operations reject the default or undersized signing secret.
- MCP secrets use AES-256-GCM when `CONNECTOR_ENCRYPTION_KEY` is set. Production reads refuse plaintext or legacy base64 values. Re-save old connection credentials while configured with the new key, before switching to production.
- Dependency updates and removal of unused Next/Vite runtime dependencies reduce the attack surface of backend services.

## Configuration and first pilot

Use a private, single-tenant administrative pilot. Set independent random API keys of at least 32 characters for every configured service (`AGENT_RUNTIME_API_KEY`, `SECURITY_LAYER_API_KEY`, `MCP_HUB_API_KEY`, `DASHBOARD_API_KEY`, `PAPERCLIP_API_KEY`). Production refuses `esk_dev_` keys. Set `JWT_SECRET` to at least 32 random characters, a strong dashboard admin password, and `PAPERCLIP_WEBHOOK_SECRET`. Set `CONNECTOR_ENCRYPTION_KEY` to base64-encoded 32 random bytes, keep it separately from the database backup, and establish recovery/rotation procedures. Never commit any generated credentials.

The default Compose file still exposes development ports and includes development defaults. Do not expose it directly to the internet. A production host needs a reviewed override that removes backend/database/model port publication, terminates TLS, injects secret-store values, limits resources and restricts outbound integrations. Paperclip must be pinned and reviewed with the same release.

## Outstanding release gates

1. Choose target host/domain, users, allowed integrations and model capacity. Container builds are unverified until the Docker daemon is available.
2. Run clean CI and full-stack tests with PostgreSQL, Paperclip and a real model; verify credentials work across all service boundaries and unauthenticated reads/mutations fail.
3. Complete tenant scoping and authorization review. Service identities currently have broad trusted access; this is not ready for untrusted multi-tenant hosting.
4. Review connector SSRF, filesystem access, sensitive configuration coverage and egress restrictions. Add production rate limits and abuse controls to login and service APIs.
5. Complete image hardening/non-root runtime, TLS/proxy configuration, health/readiness checks, resource limits, observability/alerts, load tests and controlled migrations.
6. Back up PostgreSQL and encryption keys, verify restore, and exercise immutable release rollback before launch. Record a real pilot incident and permanent fix only after it happens.

Call it production only after these checks pass on the actual host and the service is used and monitored. GitHub code and passing unit tests alone do not prove production operations or an incident history.
