// ── Authentication & Authorization ─────────────────────────────
// Shared auth middleware for all Enterprise Agent OS services.
//
// Two authentication modes:
// 1. API Key — for inter-service communication (internal Docker network)
// 2. JWT — for dashboard users (SSO/OIDC integration)

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// ── API Key Auth (Service-to-Service) ──────────────────────────

const SERVICE_API_KEYS: Map<string, { name: string; roles: string[] }> = new Map();

/**
 * Register a service API key.
 */
export function registerServiceKey(
  key: string,
  name: string,
  roles: string[] = ["service"],
): void {
  SERVICE_API_KEYS.set(key, { name, roles });
}

/**
 * Middleware: require a valid service API key.
 */
export function requireServiceAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const key = authHeader.slice(7);
  const service = SERVICE_API_KEYS.get(key);

  if (!service) {
    res.status(403).json({ error: "Invalid service API key" });
    return;
  }

  // Attach service identity to request
  (req as any).serviceIdentity = service;
  next();
}

/**
 * Generate a secure random API key for a new service.
 */
export function generateServiceKey(): string {
  return `esk_${crypto.randomBytes(32).toString("base64url")}`;
}

// ── JWT Auth (Dashboard Users) ─────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "enterprise-dev-secret-change-in-production";

export interface UserSession {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  roles: string[];
  exp: number;
}

/**
 * Create a JWT token for a user session.
 */
export function createSessionToken(user: Omit<UserSession, "exp">): string {
  const exp = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours
  const payload: UserSession = { ...user, exp };

  // In production, use a proper JWT library (jsonwebtoken).
  // For now, use base64 encoding with HMAC signature.
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");

  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode a JWT session token.
 */
export function verifySessionToken(token: string): UserSession | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as UserSession;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Middleware: require a valid user JWT session.
 */
export function requireUserAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const token = authHeader.slice(7);
  const session = verifySessionToken(token);

  if (!session) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  (req as any).userSession = session;
  next();
}

/**
 * Middleware: require a specific role.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as any).userSession as UserSession | undefined;
    if (!session) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const hasRole = roles.some((r) => session.roles.includes(r));
    if (!hasRole) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

/**
 * Middleware: verify tenant access.
 * Ensures the authenticated user belongs to the requested tenant.
 */
export function requireTenantAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const session = (req as any).userSession as UserSession | undefined;
  const requestedTenant =
    req.params.tenantId ||
    (req.query.tenantId as string) ||
    (req.body?.tenantId as string);

  if (!session) {
    // No user session — might be a service call
    const serviceIdentity = (req as any).serviceIdentity;
    if (serviceIdentity) {
      // Services bypass tenant checks (they're internal)
      return next();
    }
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (requestedTenant && session.tenantId !== requestedTenant) {
    // User is trying to access another tenant's data
    // Admins can cross tenant boundaries
    if (!session.roles.includes("admin")) {
      res.status(403).json({ error: "Access denied to this tenant" });
      return;
    }
  }

  next();
}

// ── OIDC / SSO Configuration ───────────────────────────────────

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Build OIDC authorization URL for SSO providers.
 */
export function buildOIDCAuthUrl(config: OIDCConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state,
  });

  return `${config.issuer}/authorize?${params.toString()}`;
}

// ── Password Hashing ───────────────────────────────────────────

/**
 * Hash a password using PBKDF2.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [salt, key] = hash.split(":");
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, "sha512", (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString("hex") === key);
    });
  });
}

// ── Initialize Default Service Keys ────────────────────────────

// Register default inter-service API keys.
// In production, these should be generated and stored in a vault.
const defaultKeys = [
  { name: "agent-runtime", roles: ["service", "agent"] },
  { name: "security-layer", roles: ["service", "security"] },
  { name: "mcp-hub", roles: ["service", "integration"] },
  { name: "dashboard", roles: ["service", "ui"] },
  { name: "paperclip", roles: ["service", "orchestration"] },
];

for (const { name, roles } of defaultKeys) {
  const envKey = process.env[`${name.toUpperCase().replace(/-/g, "_")}_API_KEY`];
  if (envKey) {
    registerServiceKey(envKey, name, roles);
  }
}
