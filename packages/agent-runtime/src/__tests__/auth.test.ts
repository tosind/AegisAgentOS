import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { authMiddleware } from "../middleware.js";
import { createSessionToken, verifySessionToken } from "../../../shared/src/auth.js";

afterEach(() => vi.unstubAllEnvs());

function request(path: string, headers: Record<string, string> = {}) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  authMiddleware({ path, headers } as any, res as any, next);
  return { res, next };
}

describe("authentication boundaries", () => {
  it("permits health but rejects unauthenticated read endpoints", () => {
    expect(request("/health").next).toHaveBeenCalledOnce();
    const { res, next } = request("/agents");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it("disables webhook ingestion when its secret is missing", () => {
    vi.stubEnv("PAPERCLIP_WEBHOOK_SECRET", "");
    const { res, next } = request("/webhook");
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
  it("rejects incorrect webhook credentials and accepts configured credentials", () => {
    vi.stubEnv("PAPERCLIP_WEBHOOK_SECRET", "test-webhook-secret");
    expect(request("/webhook", { "x-webhook-secret": "wrong" }).res.status).toHaveBeenCalledWith(401);
    expect(request("/webhook", { "x-webhook-secret": "test-webhook-secret" }).next).toHaveBeenCalledOnce();
  });
});

describe("session validation", () => {
  const user = { userId: "u1", tenantId: "t1", email: "u@example.com", name: "User", roles: ["admin"] };
  it("accepts a issued token and rejects tampering", () => {
    const token = createSessionToken(user);
    expect(verifySessionToken(token)?.userId).toBe("u1");
    expect(verifySessionToken(token + "tampered")).toBeNull();
  });
  it("rejects a signed token without an expiration", () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(user)).toString("base64url");
    const signature = crypto.createHmac("sha256", process.env.JWT_SECRET || "enterprise-dev-secret-change-in-production")
      .update(header + "." + body).digest("base64url");
    expect(verifySessionToken(header + "." + body + "." + signature)).toBeNull();
  });
});
