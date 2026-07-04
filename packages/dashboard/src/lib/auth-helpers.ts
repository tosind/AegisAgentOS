// Re-export from the shared package to avoid duplication.
// The dashboard now uses the same auth logic as all other services.

export type UserSession = {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  roles: string[];
  exp: number;
};

// Simple inline JWT for client-side use (no Node crypto in browser).
// Server-side routes use the shared package directly.

export function getStoredSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("user");
  document.cookie = "session=; Max-Age=0; path=/";
}

// ── Server-side auth helpers (used by API routes) ─────────────
// These are kept for backwards compatibility with the login API route.
// In production, replace with the shared @enterprise/shared package.

import { createHmac, pbkdf2Sync } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "enterprise-dev-secret-change-in-production";

export function createSessionToken(user: Omit<UserSession, "exp">): string {
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const payload: UserSession = { ...user, exp };

  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): UserSession | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");
    if (signature !== expected) return null;

    const session = JSON.parse(Buffer.from(body, "base64url").toString()) as UserSession;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const derived = pbkdf2Sync(password, salt, 100000, 64, "sha512");
  return derived.toString("hex") === key;
}
