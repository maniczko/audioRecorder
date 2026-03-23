import type { Hono } from "hono";
import type { AppMiddlewares, AppServices } from "../routes/middleware.ts";
import { createAuthRoutes } from "../routes/auth.ts";
import { createDigestRoutes } from "../routes/digest.ts";
import { createWorkspacesRoutes } from "../routes/workspaces.ts";
import { createMediaRoutes, createTranscribeRoutes } from "../routes/media.ts";
import { createAiRoutes } from "../routes/ai.ts";
import { registerHealthRoute } from "./health.ts";

export function registerAppRoutes(app: Hono<any>, services: AppServices, middlewares: AppMiddlewares) {
  registerHealthRoute(app);
  app.route("/auth", createAuthRoutes(services, middlewares));
  app.route("/", createWorkspacesRoutes(services, middlewares));
  app.route("/media", createMediaRoutes(services, middlewares));
  app.route("/transcribe", createTranscribeRoutes(services, middlewares));
  app.route("/digest", createDigestRoutes(services, middlewares));
  app.route("/ai", createAiRoutes(middlewares));
}
