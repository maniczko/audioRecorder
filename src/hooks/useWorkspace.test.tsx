import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import useWorkspace from "./useWorkspace";

const {
  storageSeed,
  bootstrapMock,
  updateMemberRoleMock,
  stateServiceMode,
  unauthorizedCallbackRef,
  unsubscribeUnauthorizedMock,
} = vi.hoisted(() => ({
  storageSeed: {} as Record<string, any>,
  bootstrapMock: vi.fn(),
  updateMemberRoleMock: vi.fn(),
  stateServiceMode: { current: "local" },
  unauthorizedCallbackRef: { current: null as null | (() => void) },
  unsubscribeUnauthorizedMock: vi.fn(),
}));

vi.mock("./useStoredState", async () => {
  const ReactModule = await import("react");
  function useStoredStateMock(key: string, initialValue: any) {
    return ReactModule.useState(
      Object.prototype.hasOwnProperty.call(storageSeed, key) ? storageSeed[key] : initialValue
    );
  }
  return {
    default: useStoredStateMock,
  };
});

vi.mock("../services/stateService", () => ({
  createStateService: () => ({
    mode: stateServiceMode.current,
    bootstrap: bootstrapMock,
  }),
}));

vi.mock("../services/workspaceService", () => ({
  createWorkspaceService: () => ({
    updateMemberRole: updateMemberRoleMock,
  }),
}));

vi.mock("../services/httpClient", () => ({
  onUnauthorized: (handler: () => void) => {
    unauthorizedCallbackRef.current = handler;
    return unsubscribeUnauthorizedMock;
  },
}));

describe("useWorkspace", () => {
  beforeEach(() => {
    Object.keys(storageSeed).forEach((key) => delete storageSeed[key]);
    bootstrapMock.mockReset();
    updateMemberRoleMock.mockReset();
    unsubscribeUnauthorizedMock.mockReset();
    unauthorizedCallbackRef.current = null;
    stateServiceMode.current = "local";
  });

  test("hydrates remote session and updates persisted state", async () => {
    stateServiceMode.current = "remote";
    storageSeed["voicelog.users.v3"] = [{ id: "u1", name: "Anna", workspaceIds: ["ws1"], defaultWorkspaceId: "ws1" }];
    storageSeed["voicelog.workspaces.v1"] = [{ id: "ws1", memberIds: ["u1"] }];
    storageSeed["voicelog.session.v3"] = { userId: "u1", workspaceId: "ws1", token: "token-1" };
    bootstrapMock.mockResolvedValue({
      workspaceId: "ws2",
      users: [{ id: "u1", name: "Anna", workspaceIds: ["ws2"], defaultWorkspaceId: "ws2" }],
      workspaces: [{ id: "ws2", memberIds: ["u1"] }],
    });

    const { result } = renderHook(() => useWorkspace());

    expect(result.current.isHydratingSession).toBe(true);

    await waitFor(() => {
      expect(result.current.currentWorkspaceId).toBe("ws2");
    });

    expect(result.current.users).toEqual([{ id: "u1", name: "Anna", workspaceIds: ["ws2"], defaultWorkspaceId: "ws2" }]);
    expect(result.current.workspaces).toEqual([{ id: "ws2", memberIds: ["u1"] }]);
    expect(result.current.session?.workspaceId).toBe("ws2");
    expect(result.current.isHydratingSession).toBe(false);
  });

  test("logs out on unauthorized callback and unsubscribes on cleanup", async () => {
    storageSeed["voicelog.users.v3"] = [{ id: "u1", name: "Anna", workspaceIds: ["ws1"], defaultWorkspaceId: "ws1" }];
    storageSeed["voicelog.workspaces.v1"] = [{ id: "ws1", memberIds: ["u1"] }];
    storageSeed["voicelog.session.v3"] = { userId: "u1", workspaceId: "ws1", token: "token-1" };

    const { result, unmount } = renderHook(() => useWorkspace());

    expect(result.current.session?.userId).toBe("u1");

    act(() => {
      unauthorizedCallbackRef.current?.();
    });

    await waitFor(() => {
      expect(result.current.session).toBeNull();
    });

    unmount();
    expect(unsubscribeUnauthorizedMock).toHaveBeenCalledTimes(1);
  });

  test("updates member role through workspace service", async () => {
    storageSeed["voicelog.users.v3"] = [
      { id: "u1", name: "Anna", workspaceIds: ["ws1"], defaultWorkspaceId: "ws1", workspaceMemberRole: "owner" },
      { id: "u2", name: "Jan", workspaceIds: ["ws1"], defaultWorkspaceId: "ws1", workspaceMemberRole: "member" },
    ];
    storageSeed["voicelog.workspaces.v1"] = [{ id: "ws1", memberIds: ["u1", "u2"], memberRoles: { u1: "owner", u2: "member" } }];
    storageSeed["voicelog.session.v3"] = { userId: "u1", workspaceId: "ws1", token: "token-1" };
    updateMemberRoleMock.mockResolvedValue({ membership: { memberRole: "admin" } });

    const { result } = renderHook(() => useWorkspace());

    await act(async () => {
      await result.current.updateWorkspaceMemberRole("u2", "admin");
    });

    expect(updateMemberRoleMock).toHaveBeenCalledWith({
      workspaces: [{ id: "ws1", memberIds: ["u1", "u2"], memberRoles: { u1: "owner", u2: "member" } }],
      workspaceId: "ws1",
      targetUserId: "u2",
      memberRole: "admin",
    });
    expect(result.current.users.find((user: any) => user.id === "u2")?.workspaceMemberRole).toBe("admin");
  });
});
