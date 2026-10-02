// ── Connector Utilities ───────────────────────────────────────
// Shared helpers for all MCP connectors.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(): Buffer | null {
  const raw = process.env.CONNECTOR_ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") throw new Error("Production requires CONNECTOR_ENCRYPTION_KEY");
    return null;
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("CONNECTOR_ENCRYPTION_KEY must encode 32 random bytes in base64");
  return key;
}

/**
 * Decode authenticated AES-GCM values. Legacy base64 is development-only.
 *
 * Keep the encryption key in a secret manager, separate from the database.
 * Legacy base64 values are accepted only outside production.
 */
export function decodeConfigValue(value: string): string {
  if (value.startsWith("aesgcm:v1:")) {
    const key = encryptionKey();
    if (!key) throw new Error("Connector decryption key is missing");
    const [, , iv, tag, ciphertext] = value.split(":");
    if (!iv || !tag || ciphertext === undefined) throw new Error("Invalid encrypted connector value");
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  }
  if (process.env.NODE_ENV === "production") throw new Error("Legacy connector secrets must be re-saved with authenticated encryption before production use");
  if (value.startsWith("encrypted:")) {
    return Buffer.from(value.slice(10), "base64").toString();
  }
  return value;
}

/**
 * Encrypt secrets when a key is configured; preserve legacy local demo support.
 *
 * Production deployments must configure a real encryption key.
 */
export function encodeConfigValue(value: string): string {
  const key = encryptionKey();
  if (key) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return `aesgcm:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
  }
  return `encrypted:${Buffer.from(value).toString("base64")}`;
}
