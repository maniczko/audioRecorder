import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../../app.ts";

describe("State Routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;

  beforeEach(() => {
    mockAuthService = {
      getSession: vi.fn(),
      buildSessionPayload: vi.fn(),
    };
    mockWorkspaceService = {
      getMembership: vi.fn(),
      saveWorkspaceState: vi.fn(),
    };

    // Replace the default auth middleware for testing
    const testMiddlewares = {
      authMiddleware: async (c: any, next: any) => {
        const authHeader = c.req.header("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return c.json({ message: "Brak tokenu" }, 401);
        }
        if (authHeader === "Bearer invalid") {
            return c.json({ message: "Nieprawidłowy token" }, 401);
        }
        c.set("session", { user_id: "u123", workspace_id: "w123" });
        await next();
      },
      ensureWorkspaceAccess: async (c: any, workspaceId: string) => {
        if (workspaceId !== "w123") {
            return c.json({ message: "Brak dostepu" }, 403);
        }
        return { member_role: "admin" };
      },
      applyRateLimit: () => async (c: any, next: any) => next(),
    };

    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: {},
      config: { allowedOrigins: "http://localhost:3000", trustProxy: false, uploadDir: "/tmp" }
    }, testMiddlewares);
  });

  it("GET /state/bootstrap - unauthorized without token", async () => {
    const res = await app.request("/state/bootstrap", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("GET /state/bootstrap - success with valid token", async () => {
    mockAuthService.buildSessionPayload.mockResolvedValue({ user: { id: "u123" }, workspaces: [] });

    const res = await app.request("/state/bootstrap?workspaceId=w123", {
      method: "GET",
      headers: { "Authorization": "Bearer valid_test_token" }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.id).toBe("u123");
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledWith("u123", "w123");
  });

  it("PUT /state/workspaces/:workspaceId - state update", async () => {
    mockWorkspaceService.saveWorkspaceState.mockResolvedValue({ meetings: [] });

    const res = await app.request("/state/workspaces/w123", {
      method: "PUT",
      headers: {
        "Authorization": "Bearer valid_test_token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ meetings: [], manualTasks: [] })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.workspaceId).toBe("w123");
    expect(data.state.meetings).toEqual([]);
    expect(mockWorkspaceService.saveWorkspaceState).toHaveBeenCalledWith("w123", expect.any(Object));
  });
});
