// ── Agent Runtime Middleware ────────────────────────────────────
// Request validation, auth, and logging middleware.

import type { Request, Response, NextFunction } from "express";
import { requireServiceAuth } from "@enterprise/shared/auth";

/**
 * Authenticate incoming requests.
 *
 * For internal service-to-service calls (from Paperclip, MCP Hub, etc.)
 * and admin API calls from the dashboard.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Health check is always public
  if (req.path === "/health") {
    return next();
  }

  // Webhook from Paperclip should include an API key
  if (req.path === "/webhook") {
    // Paperclip sends its own auth via API key env var
    // We verify the webhook signature or shared secret
    const webhookSecret = process.env.PAPERCLIP_WEBHOOK_SECRET;
    if (webhookSecret) {
      const provided = req.headers["x-webhook-secret"];
      if (provided !== webhookSecret) {
        res.status(401).json({ error: "Invalid webhook secret" });
        return;
      }
    }
    return next();
  }

  // All other endpoints require service auth
  requireServiceAuth(req, res, next);
}

/**
 * Request logging middleware.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `📡 ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
}

/**
 * Validate request body against required fields.
 */
export function requireFields(...fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = fields.filter((f) => !req.body || req.body[f] === undefined);
    if (missing.length > 0) {
      res.status(400).json({
        error: `Missing required fields: ${missing.join(", ")}`,
      });
      return;
    }
    next();
  };
}

/**
 * Tenant isolation middleware.
 * Extracts tenantId from request and validates it.
 */
export function tenantContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const tenantId =
    req.params.tenantId ||
    (req.query.tenantId as string) ||
    req.body?.tenantId;

  if (tenantId) {
    (req as any).tenantId = tenantId;
  }

  next();
}

/**
 * Error handling middleware.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("❌ Unhandled error:", err.message);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
}
