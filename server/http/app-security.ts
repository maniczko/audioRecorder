import crypto from "node:crypto";
import { cors } from "hono/cors";
import type { Hono } from "hono";
import { z } from "zod";
import { logger } from "../logger.ts";



export function applyAppCors(app: Hono<any>, _allowedOrigins: string) {
  app.use(
    "*",
    cors({
      origin: (origin) => {
        // Always allow the requesting origin.
        // The app uses Bearer token auth so CORS origin restrictions are redundant.
        // Railway (backend) and Vercel (frontend) deploy independently, making
        // strict origin matching fragile and error-prone.
        return origin || "*";
      },
      allowHeaders: ["Content-Type", "Authorization", "X-Workspace-Id", "X-Meeting-Id", "X-Speaker-Name"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

export function registerNotFoundHandler(app: Hono<any>) {
  app.notFound((c) => {
    const requestOrigin = c.req.header("origin");
    if (requestOrigin) {
      c.header("Access-Control-Allow-Origin", requestOrigin);
      c.header("Access-Control-Allow-Credentials", "true");
    }
    return c.json({ message: "Not found." }, 404);
  });
}

export function registerAppErrorHandler(app: Hono<any>) {
  app.onError((err: any, c) => {
    console.error("APP ERROR STACK", err.stack);

    // Ensure CORS headers are always present on error responses.
    // app.onError creates a new response that may bypass the cors middleware's
    // post-next() header injection, so we set them explicitly here.
    const requestOrigin = c.req.header("origin");
    if (requestOrigin) {
      c.header("Access-Control-Allow-Origin", requestOrigin);
      c.header("Access-Control-Allow-Credentials", "true");
    }

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
