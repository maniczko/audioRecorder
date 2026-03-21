import { Hono } from "hono";
import { createMiddlewares, AppServices, AppMiddlewares } from "./routes/middleware.ts";
import {
  applyAppCors,
  applyRequestMetadata,
  applySecurityHeaders,
  registerAppErrorHandler,
} from "./http/app-security.ts";
import { registerAppRoutes } from "./http/app-routes.ts";

export function createApp(services: AppServices, mockedMiddlewares?: AppMiddlewares) {
  const { config } = services;
  const app = new Hono<{ Variables: { session: any; user: any; reqId: string } }>();

  applyAppCors(app, config.allowedOrigins || "http://localhost:3000");
  applyRequestMetadata(app);
  applySecurityHeaders(app);
  registerAppErrorHandler(app);

  const middlewares = mockedMiddlewares || createMiddlewares(services);
  registerAppRoutes(app, services, middlewares);

  return app;
}
