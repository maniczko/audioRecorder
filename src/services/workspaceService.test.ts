import { afterEach, describe, expect, test, vi } from "vitest";

async function loadWorkspaceService(provider = "local") {
  const apiRequest = vi.fn().mockResolvedValue({ workspaceId: "ws1", userId: "u2", memberRole: "admin" });
  vi.resetModules();
  vi.doMock("./config", () => ({
    APP_DATA_PROVIDER: provider,
  }));
  vi.doMock("./httpClient", () => ({
    apiRequest,
  }));

  const module = await import("./workspaceService");
  return { ...module, apiRequest };
}

describe("workspaceService", () => {
  afterEach(() => {
    vi.resetModules();
  });

  test("updates member role locally with normalized role", async () => {
    const { createWorkspaceService, apiRequest } = await loadWorkspaceService("local");
    const service = createWorkspaceService();

    const result = await service.updateMemberRole({
      workspaces: [{ id: "ws1", memberRoles: { u2: "member" } }],
      workspaceId: "ws1",
      targetUserId: "u2",
      memberRole: "admin",
    });

    expect(apiRequest).not.toHaveBeenCalled();
    expect(result.membership).toMatchObject({
      workspaceId: "ws1",
      userId: "u2",
      memberRole: "admin",
    });
    expect(result.workspaces[0].memberRoles.u2).toBe("admin");
  });

  test("calls remote endpoint with normalized member role", async () => {
    const { createWorkspaceService, apiRequest } = await loadWorkspaceService("remote");
    const service = createWorkspaceService();

    await service.updateMemberRole({
      workspaceId: "ws1",
      targetUserId: "u2",
      memberRole: "owner",
    });

    expect(apiRequest).toHaveBeenCalledWith("/workspaces/ws1/members/u2/role", {
      method: "PUT",
      body: { memberRole: "owner" },
    });
  });
});
