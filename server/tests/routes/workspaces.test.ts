import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app.ts";

// Import and mock generateRagAnswer
const mockGenerateRagAnswer = vi.fn();
vi.mock("../../lib/ragAnswer.ts", () => ({
  generateRagAnswer: mockGenerateRagAnswer,
}));

describe("Workspace Routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;
  let mockTranscriptionService: any;
  const originalFetch = global.fetch;

  function buildMiddlewares(memberRole = "owner") {
    return {
      authMiddleware: async (c: any, next: any) => {
        c.set("session", { user_id: "u1", workspace_id: "ws1" });
        await next();
      },
      ensureWorkspaceAccess: async (_c: any, workspaceId: string) => {
        if (workspaceId !== "ws1") {
          const err = new Error("Forbidden") as any;
          err.statusCode = 403;
          throw err;
        }
        return { member_role: memberRole };
      },
      applyRateLimit: () => async (_c: any, next: any) => next(),
    };
  }

  beforeEach(() => {
    mockAuthService = {
      updateUserProfile: vi.fn(),
      buildSessionPayload: vi.fn(),
      changeUserPassword: vi.fn(),
      getSession: vi.fn(),
    };
    mockWorkspaceService = {
      saveWorkspaceState: vi.fn(),
      updateWorkspaceMemberRole: vi.fn(),
      getMembership: vi.fn(),
    };
    mockTranscriptionService = {
      queryRAG: vi.fn(),
    };
    global.fetch = vi.fn();
    mockGenerateRagAnswer.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("PUT /users/:userId/profile updates only current user profile", async () => {
    mockAuthService.updateUserProfile.mockResolvedValue({ id: "u1", name: "Anna" });
    mockAuthService.buildSessionPayload.mockResolvedValue({ users: [{ id: "u1", name: "Anna" }] });
    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp", OPENAI_API_KEY: "" },
      },
      buildMiddlewares()
    );

    const res = await app.request("/users/u1/profile?workspaceId=ws1", {
      method: "PUT",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Anna", company: "VoiceLog" }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { id: "u1", name: "Anna" },
      users: [{ id: "u1", name: "Anna" }],
    });
    expect(mockAuthService.updateUserProfile).toHaveBeenCalledWith("u1", { name: "Anna", company: "VoiceLog" });
    expect(mockAuthService.buildSessionPayload).toHaveBeenCalledWith("u1", "ws1");
  });

  it("blocks profile and password changes for other users", async () => {
    app = createApp(
      {
        authService: mockAuthService,
        workspaceService: mockWorkspaceService,
        transcriptionService: mockTranscriptionService,
        config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp", OPENAI_API_KEY: "" },
      },
      buildMiddlewares("member")
    );

    const res = await app.request("/users/u2/profile?workspaceId=ws1", {
      method: "PUT",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Anna", company: "VoiceLog" }),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "Mozesz edytowac tylko swoj profil." });
  });
});