import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { Hono } from "hono";
import { AppServices, AppMiddlewares } from "./middleware.ts";
import { applyWorkspaceStateDelta, normalizeWorkspaceState } from "../../src/shared/contracts.ts";
import type { VoiceProfileSummary, VoiceProfilesListPayload } from "../../src/shared/types.ts";
import { generateRagAnswer } from "../lib/ragAnswer.js"; // Changed from .ts to .js

export function createWorkspacesRoutes(services: AppServices, middlewares: AppMiddlewares) {
  const router = new Hono<{ Variables: { session: any; user: any } }>();
  const { authService, workspaceService, transcriptionService, config } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;

  // --- Users ---
  router.use("/users/*", authMiddleware);
  router.put("/users/:userId/profile", async (c) => {
    const session = c.get("session") as any;
    const userId = c.req.param("userId");
    if (session.user_id !== userId) return c.json({ message: "Mozesz edytowac tylko swoj profil." }, 403);
    const workspaceId = c.req.query("workspaceId") || session.workspace_id;
    const body = await c.req.json().catch(() => ({}));
    const user = await authService.updateUserProfile(userId, body);
    const payload = await authService.buildSessionPayload(session.user_id, workspaceId);
    return c.json({ user, users: payload.users }, 200);
  });

  router.post("/users/:userId/password", async (c) => {
    const session = c.get("session") as any;
    const userId = c.req.param("userId");
    if (session.user_id !== userId) return c.json({ message: "Mozesz zmienic tylko swoje haslo." }, 403);
    const body = await c.req.json().catch(() => ({}));
    return c.json(await authService.changeUserPassword(userId, body), 200);
  });

  // --- State ---
  router.use("/state/*", authMiddleware);
  router.get("/state/bootstrap", async (c) => {
    const session = c.get("session") as any;
    const workspaceId = c.req.query("workspaceId") || session.workspace_id;
    await ensureWorkspaceAccess(c, workspaceId);
    return c.json(await authService.buildSessionPayload(session.user_id, workspaceId), 200);
  });

  router.put("/state/workspaces/:workspaceId", async (c) => {
    const workspaceId = c.req.param("workspaceId");
    await ensureWorkspaceAccess(c, workspaceId);
    const body = await c.req.json().catch(() => ({}));
    return c.json(
      {
        workspaceId,
        state: await workspaceService.saveWorkspaceState(workspaceId, body),
      },
      200
    );
  });

  router.patch("/state/workspaces/:workspaceId", async (c) => {
    const workspaceId = c.req.param("workspaceId");
    await ensureWorkspaceAccess(c, workspaceId);
    const delta = await c.req.json().catch(() => ({}));
    const currentState = normalizeWorkspaceState(await workspaceService.getWorkspaceState(workspaceId));
    const mergedState = applyWorkspaceStateDelta(currentState, delta);
    return c.json(
      {
        // Additional logic here...
      },
      200
    );
  });

  return router;
}