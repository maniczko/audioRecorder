import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { STORAGE_KEYS } from "../lib/storage";

const mocks = vi.hoisted(() => ({
  updateMemberRoleMock: vi.fn(),
  bootstrapMock: vi.fn(),
}));

async function loadWorkspaceStore(mode = "local") {
  vi.resetModules();
  vi.doMock("../services/workspaceService", () => ({
    createWorkspaceService: () => ({
      updateMemberRole: mocks.updateMemberRoleMock,
    }),
  }));
  vi.doMock("../services/stateService", () => ({
    createStateService: () => ({
      mode,
      bootstrap: mocks.bootstrapMock,
    }),
  }));

  return import("./workspaceStore");
}

describe("workspaceStore", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.updateMemberRoleMock.mockReset();
    mocks.bootstrapMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  test("supports updater functions for users and workspaces", async () => {
    const { useWorkspaceStore } = await loadWorkspaceStore();
    useWorkspaceStore.setState({
      users: [{ id: "u1" }],
      workspaces: [{ id: "ws1" }],
      session: null,
      isHydratingSession: false,
      sessionError: "",
    });

    const store = useWorkspaceStore.getState();
    store.setUsers((previous) => [...previous, { id: "u2" }]);
    store.setWorkspaces((previous) => [...previous, { id: "ws2" }]);

    expect(useWorkspaceStore.getState().users).toEqual([{ id: "u1" }, { id: "u2" }]);
    expect(useWorkspaceStore.getState().workspaces).toEqual([{ id: "ws1" }, { id: "ws2" }]);
  });

  test("persists session token into the legacy auth storage key used by httpClient", async () => {
    const { useWorkspaceStore } = await loadWorkspaceStore();

    useWorkspaceStore.getState().setSession({ userId: "u1", workspaceId: "ws1", token: "token-1" });

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")).toEqual({
      userId: "u1",
      workspaceId: "ws1",
      token: "token-1",
    });

    useWorkspaceStore.getState().logout();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")).toBeNull();
  });

  test("rehydrates persisted workspace session into legacy auth storage", async () => {
    localStorage.setItem(
      "voicelog_workspace_store",
      JSON.stringify({
        state: {
          users: [],
          workspaces: [],
          session: { userId: "u1", workspaceId: "ws1", token: "token-from-workspace" },
        },
        version: 0,
      })
    );
    const { useWorkspaceStore } = await loadWorkspaceStore();

    await useWorkspaceStore.persist.rehydrate();

    expect(useWorkspaceStore.getState().session).toEqual({
      userId: "u1",
      workspaceId: "ws1",
      token: "token-from-workspace",
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")).toEqual({
      userId: "u1",
      workspaceId: "ws1",
      token: "token-from-workspace",
    });
  });

  test("clears legacy session when rehydrated workspace store has no session", async () => {
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ userId: "u1", workspaceId: "ws1", token: "stale" }));
    localStorage.setItem(
      "voicelog_workspace_store",
      JSON.stringify({
        state: {
          users: [],
          workspaces: [],
          session: null,
        },
        version: 0,
      })
    );
    const { useWorkspaceStore } = await loadWorkspaceStore();

    await useWorkspaceStore.persist.rehydrate();

    expect(useWorkspaceStore.getState().session).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")).toBeNull();
  });

  test("switches workspace and updates member role locally", async () => {
    const { useWorkspaceStore } = await loadWorkspaceStore();
    useWorkspaceStore.setState({
      users: [
        { id: "u1", workspaceIds: ["ws1"], defaultWorkspaceId: "ws1", workspaceMemberRole: "owner" },
        { id: "u2", workspaceIds: ["ws1"], defaultWorkspaceId: "ws1", workspaceMemberRole: "member" },
      ],
      workspaces: [{ id: "ws1", memberIds: ["u1", "u2"], memberRoles: { u1: "owner", u2: "member" } }],
      session: { userId: "u1", workspaceId: "ws1", token: "token-1" },
      isHydratingSession: false,
      sessionError: "",
    });
    mocks.updateMemberRoleMock.mockResolvedValue({ membership: { memberRole: "admin" } });

    useWorkspaceStore.getState().switchWorkspace("ws2");
    await useWorkspaceStore.getState().updateWorkspaceMemberRole("u2", "admin");

    expect(useWorkspaceStore.getState().session?.workspaceId).toBe("ws2");
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")).toEqual({
      userId: "u1",
      workspaceId: "ws2",
      token: "token-1",
    });
    expect(mocks.updateMemberRoleMock).toHaveBeenCalledWith({
      workspaces: [{ id: "ws1", memberIds: ["u1", "u2"], memberRoles: { u1: "owner", u2: "member" } }],
      workspaceId: "ws1",
      targetUserId: "u2",
      memberRole: "admin",
    });
    expect(useWorkspaceStore.getState().users[1].workspaceMemberRole).toBe("admin");
  });

  test("bootstraps remote session and clears session on unauthorized", async () => {
    const { useWorkspaceStore } = await loadWorkspaceStore("remote");
    useWorkspaceStore.setState({
      users: [{ id: "u1" }],
      workspaces: [{ id: "ws1" }],
      session: { userId: "u1", workspaceId: "ws1", token: "token-1" },
      isHydratingSession: false,
      sessionError: "",
    });
    mocks.bootstrapMock
      .mockResolvedValueOnce({
        workspaceId: "ws2",
        users: [{ id: "u1", workspaceIds: ["ws2"], defaultWorkspaceId: "ws2" }],
        workspaces: [{ id: "ws2", memberIds: ["u1"] }],
      })
      .mockRejectedValueOnce(Object.assign(new Error("Unauthorized"), { status: 401 }));

    await useWorkspaceStore.getState().bootstrapSession();

    expect(useWorkspaceStore.getState().session?.workspaceId).toBe("ws2");
    expect(useWorkspaceStore.getState().users).toEqual([
      { id: "u1", workspaceIds: ["ws2"], defaultWorkspaceId: "ws2" },
    ]);

    await useWorkspaceStore.getState().bootstrapSession();

    expect(useWorkspaceStore.getState().session).toBeNull();
    expect(useWorkspaceStore.getState().users).toEqual([]);
    expect(useWorkspaceStore.getState().workspaces).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")).toBeNull();
  });
});
