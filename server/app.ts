import { Hono } from "hono";
import { cors } from "hono/cors";
import crypto from "node:crypto";
import { z } from "zod";

import { createMiddlewares, AppServices, AppMiddlewares } from "./routes/middleware.ts";
import { createAuthRoutes } from "./routes/auth.ts";
import { createWorkspacesRoutes } from "./routes/workspaces.ts";
import { createMediaRoutes, createTranscribeRoutes } from "./routes/media.ts";
import { logger } from "./logger.ts";

export function createApp(services: AppServices, mockedMiddlewares?: AppMiddlewares) {
  const { config } = services;
  const app = new Hono<{ Variables: { session: any; user: any; reqId: string } }>();

  const ALLOWED_ORIGINS = (config.allowedOrigins || "http://localhost:3000").split(",").map((s: string) => s.trim());
  const allowAny = ALLOWED_ORIGINS.includes("*");

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return "*";
        if (allowAny) return origin;
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
        if (/^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(origin)) return origin;
        if (ALLOWED_ORIGINS.includes(origin)) return origin;
        return ALLOWED_ORIGINS[0];
      },
      allowHeaders: ["Content-Type", "Authorization", "X-Workspace-Id", "X-Meeting-Id", "X-Speaker-Name"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    })
  );

  app.use("*", async (c, next) => {
    const reqId = crypto.randomUUID();
    c.set("reqId", reqId);
    c.res.headers.set("X-Request-Id", reqId);
    
    const start = performance.now();
    await next();
    const ms = performance.now() - start;
    
    logger.info(`[REQ] ${c.req.method} ${c.req.path} - ${c.res.status} [${ms.toFixed(1)}ms]`, {
      requestId: reqId,
      method: c.req.method,
      route: c.req.path,
      status: c.res.status,
      durationMs: ms.toFixed(2),
    });
  });  app.use("*", async (c, next) => {
    c.header("Content-Security-Policy", "default-src 'none'");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    await next();
  });

  app.onError((err: any, c) => {
    console.error("APP ERROR STACK", err.stack);
    if (err.name === "ContextError" || err instanceof z.ZodError || (err as any).statusCode === 422) {
      return c.json({ message: "Invalid payload.", errors: (err as any).errors || err.message }, 422);
    }
    const statusCode = (err as any).statusCode || (err as any).status || 500;
    if (statusCode === 429 && (err as any).retryAfter) {
      c.header("Retry-After", String((err as any).retryAfter));
    }
    return c.json({ message: err.message || "Unexpected server error." }, statusCode as any);
  });

  app.get("/health", (c) => c.json({ ok: true, status: "ok", uptime: process.uptime() }));

  const middlewares = mockedMiddlewares || createMiddlewares(services);

  app.route("/auth", createAuthRoutes(services, middlewares));
  app.route("/", createWorkspacesRoutes(services, middlewares));
  app.route("/media", createMediaRoutes(services, middlewares));
  app.route("/transcribe", createTranscribeRoutes(services, middlewares));

  return app;
}
