// ── Connector Utilities ───────────────────────────────────────
// Shared helpers for all MCP connectors.

/**
 * Decode a value that was encoded using the placeholder "encryption" scheme.
 *
 * ⚠️ IMPORTANT: This is base64 ENCODING, not encryption. In production,
 * replace with a proper secret manager (HashiCorp Vault, AWS Secrets Manager,
 * Azure Key Vault, etc.). Never store plaintext secrets in the database.
 */
export function decodeConfigValue(value: string): string {
  if (value.startsWith("encrypted:")) {
    return Buffer.from(value.slice(10), "base64").toString();
  }
  return value;
}

/**
 * Mark a value as "encrypted" for storage.
 *
 * ⚠️ This is a placeholder. Production deployments MUST use a real
 * encryption key or secret management service.
 */
export function encodeConfigValue(value: string): string {
  return `encrypted:${Buffer.from(value).toString("base64")}`;
}
