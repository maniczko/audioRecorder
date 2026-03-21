import type { Hono } from "hono";
import type { AppMiddlewares, AppServices } from "../routes/middleware.ts";
import { createAuthRoutes } from "../routes/auth.ts";
import { createWorkspacesRoutes } from "../routes/workspaces.ts";
import { createMediaRoutes, createTranscribeRoutes } from "../routes/media.ts";
import { resolveBuildMetadata } from "../runtime.ts";

export function registerAppRoutes(app: Hono<any>, services: AppServices, middlewares: AppMiddlewares) {
  app.get("/health", (c) => {
    const build = resolveBuildMetadata(process.env, "0.1.0");
    return c.json({
      ok: true,
      status: "ok",
      uptime: process.uptime(),
      gitSha: build.gitSha,
      buildTime: build.buildTime,
      appVersion: build.appVersion,
      runtime: build.runtime,
    });
  });
  app.route("/auth", createAuthRoutes(services, middlewares));
  app.route("/", createWorkspacesRoutes(services, middlewares));
  app.route("/media", createMediaRoutes(services, middlewares));
  app.route("/transcribe", createTranscribeRoutes(services, middlewares));
}
