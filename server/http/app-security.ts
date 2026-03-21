import crypto from "node:crypto";
import { cors } from "hono/cors";
import type { Hono } from "hono";
import { z } from "zod";
import { logger } from "../logger.ts";

function getAllowedOrigins(allowedOrigins = "http://localhost:3000") {
  return allowedOrigins
    .split(",")
    .map((value: string) => value.trim())
    .filter(Boolean);
}

export function applyAppCors(app: Hono<any>, allowedOrigins: string) {
  const normalizedOrigins = getAllowedOrigins(allowedOrigins);
  const allowAny = normalizedOrigins.includes("*");

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        if (allowAny) return origin;
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
        if (/^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(origin)) return origin;
        if (normalizedOrigins.includes(origin)) return origin;
        return normalizedOrigins[0] || "*";
      },
      allowHeaders: ["Content-Type", "Authorization", "X-Workspace-Id", "X-Meeting-Id", "X-Speaker-Name"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );
}

export function applyRequestMetadata(app: Hono<any>) {
  app.use("*", async (c, next) => {
    const reqId = crypto.randomUUID();
    c.set("reqId", reqId);

    const start = performance.now();
    await next();
    c.res.headers.set("X-Request-Id", reqId);

    const durationMs = performance.now() - start;
    logger.info(`[REQ] ${c.req.method} ${c.req.path} - ${c.res.status} [${durationMs.toFixed(1)}ms]`, {
      requestId: reqId,
      method: c.req.method,
      route: c.req.path,
      status: c.res.status,
      durationMs: durationMs.toFixed(2),
    });
  });
}

export function applySecurityHeaders(app: Hono<any>) {
  app.use("*", async (c, next) => {
    c.header("Content-Security-Policy", "default-src 'none'");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    await next();
  });
}

export function registerAppErrorHandler(app: Hono<any>) {
  app.onError((err: any, c) => {
    console.error("APP ERROR STACK", err.stack);
    if (err.name === "ContextError" || err instanceof z.ZodError || err?.statusCode === 422) {
      return c.json({ message: "Invalid payload.", errors: err?.errors || err.message }, 422);
    }
    const statusCode = err?.statusCode || err?.status || 500;
    if (statusCode === 429 && err?.retryAfter) {
      c.header("Retry-After", String(err.retryAfter));
    }
    return c.json({ message: err.message || "Unexpected server error." }, statusCode as any);
  });
}
