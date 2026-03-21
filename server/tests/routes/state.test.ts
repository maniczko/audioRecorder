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

  it("OPTIONS /state/bootstrap - returns preview CORS headers for vercel origins", async () => {
    const previewOrigin = "https://preview-app.vercel.app";
    const res = await app.request("/state/bootstrap?workspaceId=w123", {
      method: "OPTIONS",
      headers: {
        Origin: previewOrigin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization,Content-Type,X-Workspace-Id,X-Meeting-Id",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(previewOrigin);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-Workspace-Id");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-Meeting-Id");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("GET /state/bootstrap - unauthorized response still keeps preview CORS headers", async () => {
    const previewOrigin = "https://preview-app.vercel.app";
    const res = await app.request("/state/bootstrap?workspaceId=w123", {
      method: "GET",
      headers: {
        Origin: previewOrigin,
      },
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(previewOrigin);
    expect(res.headers.get("Vary")).toContain("Origin");
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
