import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { AppServices, AppMiddlewares } from "./middleware.ts";
import { corsHeaders } from "../lib/serverUtils.ts";

export function createAuthRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any } }>();
  const { authService } = services;
  const { applyRateLimit, authMiddleware, ensureWorkspaceAccess } = middlewares;
  const allowedOrigins = services.config?.allowedOrigins || "http://localhost:3000";

  router.use("*", async (c, next) => {
    if (c.req.method !== "OPTIONS") {
      await next();
      return;
    }

    const requestOrigin = c.req.header("origin") || "";
    const headers = corsHeaders(requestOrigin, allowedOrigins);
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": headers["Access-Control-Allow-Origin"],
        "Access-Control-Allow-Headers": headers["Access-Control-Allow-Headers"],
        "Access-Control-Allow-Methods": headers["Access-Control-Allow-Methods"],
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
        Vary: headers["Vary"],
      },
    });
  });

  const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    workspaceName: z.string().optional(),
    workspaceMode: z.string().optional(),
    workspaceCode: z.string().optional()
  });

  router.post("/register", applyRateLimit("auth"), zValidator("json", registerSchema), async (c) => {
    const data = c.req.valid("json");
    const result = await authService.registerUser(data);
    return c.json(result, 201);
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    workspaceId: z.string().optional()
  });

  router.post("/login", applyRateLimit("auth"), zValidator("json", loginSchema), async (c) => {
    const data = c.req.valid("json");
    const result = await authService.loginUser(data);
    return c.json(result, 200);
  });

  const resetReqSchema = z.object({ email: z.string().email() });
  router.post("/password/reset/request", applyRateLimit("auth"), zValidator("json", resetReqSchema), async (c) => {
    const data = c.req.valid("json");
    const result = await authService.requestPasswordReset(data);
    return c.json(result, 200);
  });

  const resetConfirmSchema = z.object({
    email: z.string().email(),
    code: z.string().min(1),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6)
  });
  router.post("/password/reset/confirm", applyRateLimit("auth"), zValidator("json", resetConfirmSchema), async (c) => {
    const data = c.req.valid("json");
    const result = await authService.resetPasswordWithCode(data);
    return c.json(result, 200);
  });

  const googleSchema = z.object({
    email: z.string().email(),
    sub: z.string(),
    name: z.string().optional(),
    given_name: z.string().optional(),
    picture: z.string().optional()
  });
  router.post("/google", applyRateLimit("auth"), zValidator("json", googleSchema), async (c) => {
    const data = c.req.valid("json");
    const result = await authService.upsertGoogleUser(data);
    return c.json(result, 200);
  });

  router.get("/session", authMiddleware, async (c) => {
    const session = c.get("session") as any;
    const workspaceId = c.req.query("workspaceId") || session.workspace_id;
    await ensureWorkspaceAccess(c, workspaceId);
    return c.json(await authService.buildSessionPayload(session.user_id, workspaceId), 200);
  });

  return router;
}
