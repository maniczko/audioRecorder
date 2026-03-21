import { describe, expect, it, vi } from "vitest";
import { createMiddlewares } from "../routes/middleware.ts";

describe("route middleware", () => {
  it("authMiddleware rejects missing or invalid bearer token and stores valid session", async () => {
    const services = {
      authService: {
        getSession: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ user_id: "u1", workspace_id: "ws1" }),
      },
      workspaceService: {
        getMembership: vi.fn().mockResolvedValue({ member_role: "owner" }),
      },
      config: { trustProxy: false },
    } as any;
    const { authMiddleware } = createMiddlewares(services);

    const missingCtx: any = {
      req: { header: vi.fn().mockReturnValue("") },
      json: vi.fn((body, status) => ({ body, status })),
    };
    const missingResult = await authMiddleware(missingCtx, vi.fn());
    expect(missingResult.status).toBe(401);

    const invalidCtx: any = {
      req: { header: vi.fn().mockReturnValue("Bearer token") },
      json: vi.fn((body, status) => ({ body, status })),
      set: vi.fn(),
    };
    const invalidResult = await authMiddleware(invalidCtx, vi.fn());
    expect(invalidResult.status).toBe(401);

    const validNext = vi.fn();
    const validCtx: any = {
      req: { header: vi.fn().mockReturnValue("Bearer token") },
      json: vi.fn(),
      set: vi.fn(),
    };
    await authMiddleware(validCtx, validNext);
    expect(validCtx.set).toHaveBeenCalledWith("session", { user_id: "u1", workspace_id: "ws1" });
    expect(validNext).toHaveBeenCalledTimes(1);
  });

  it("authMiddleware accepts token from query string for SSE-style requests", async () => {
    const services = {
      authService: {
        getSession: vi.fn().mockResolvedValue({ user_id: "u1", workspace_id: "ws1" }),
      },
      workspaceService: {
        getMembership: vi.fn().mockResolvedValue({ member_role: "owner" }),
      },
      config: { trustProxy: false },
    } as any;
    const { authMiddleware } = createMiddlewares(services);
    const next = vi.fn();
    const ctx: any = {
      req: {
        header: vi.fn().mockReturnValue(""),
        query: vi.fn().mockImplementation((key: string) => (key === "token" ? "query-token" : "")),
      },
      json: vi.fn(),
      set: vi.fn(),
    };

    await authMiddleware(ctx, next);

    expect(services.authService.getSession).toHaveBeenCalledWith("query-token");
    expect(ctx.set).toHaveBeenCalledWith("session", { user_id: "u1", workspace_id: "ws1" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("ensureWorkspaceAccess throws 403 when membership is missing", async () => {
    const { ensureWorkspaceAccess } = createMiddlewares({
      authService: {},
      workspaceService: {
        getMembership: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ member_role: "admin" }),
      },
      config: { trustProxy: true },
    } as any);

    await expect(
      ensureWorkspaceAccess({ get: vi.fn().mockReturnValue({ user_id: "u1" }) } as any, "ws1")
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      ensureWorkspaceAccess({ get: vi.fn().mockReturnValue({ user_id: "u1" }) } as any, "ws1")
    ).resolves.toEqual({ member_role: "admin" });
  });
});
