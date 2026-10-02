import { afterEach, expect, it, vi } from "vitest";
import { decodeConfigValue, encodeConfigValue } from "../connectors/utils.js";
afterEach(() => vi.unstubAllEnvs());
it("encrypts connector secrets with a random nonce and detects tampering", () => {
  vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  const first = encodeConfigValue("private-token");
  expect(first).not.toContain("private-token");
  expect(encodeConfigValue("private-token")).not.toBe(first);
  expect(decodeConfigValue(first)).toBe("private-token");
  const parts = first.split(":");
  const ciphertext = Buffer.from(parts[4], "base64url");
  ciphertext[0] ^= 1;
  parts[4] = ciphertext.toString("base64url");
  expect(() => decodeConfigValue(parts.join(":"))).toThrow();
});
it("fails closed for production without a key or with legacy secrets", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CONNECTOR_ENCRYPTION_KEY", "");
  expect(() => encodeConfigValue("secret")).toThrow();
  expect(() => decodeConfigValue("encrypted:c2VjcmV0")).toThrow();
});
