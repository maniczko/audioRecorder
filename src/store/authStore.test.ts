import { beforeEach, describe, expect, test, vi } from "vitest";
import { STORAGE_KEYS } from "../lib/storage";

const mocks = vi.hoisted(() => ({
  registerMock: vi.fn(),
  loginMock: vi.fn(),
}));

async function loadStores() {
  vi.resetModules();
  vi.doMock("../services/authService", () => ({
    createAuthService: () => ({
      register: mocks.registerMock,
      login: mocks.loginMock,
      requestPasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      signInWithGoogle: vi.fn(),
    }),
  }));

  const [{ useAuthStore }, { useWorkspaceStore }] = await Promise.all([
    import("./authStore"),
    import("./workspaceStore"),
  ]);

  return { useAuthStore, useWorkspaceStore };
}

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.registerMock.mockReset();
    mocks.loginMock.mockReset();
  });

  test("setAuthDraft supports updater functions without losing previous fields", async () => {
    const { useAuthStore } = await loadStores();
    const initialState = useAuthStore.getState();
    useAuthStore.setState({
      ...initialState,
      authDraft: {
        name: "",
        role: "",
        company: "",
        email: "",
        password: "",
        workspaceMode: "create",
        workspaceName: "",
        workspaceCode: "",
      },
      resetDraft: {
        email: "",
        code: "",
        newPassword: "",
        confirmPassword: "",
      },
    });
    const { setAuthDraft } = useAuthStore.getState();

    setAuthDraft((previous) => ({ ...previous, email: "anna@example.com" }));
    setAuthDraft((previous) => ({ ...previous, password: "secret-123" }));

    expect(useAuthStore.getState().authDraft).toMatchObject({
      email: "anna@example.com",
      password: "secret-123",
      workspaceMode: "create",
    });
  });

  test("setResetDraft supports updater functions", async () => {
    const { useAuthStore } = await loadStores();
    const initialState = useAuthStore.getState();
    useAuthStore.setState({
      ...initialState,
      authDraft: {
        name: "",
        role: "",
        company: "",
        email: "",
        password: "",
        workspaceMode: "create",
        workspaceName: "",
        workspaceCode: "",
      },
      resetDraft: {
        email: "",
        code: "",
        newPassword: "",
        confirmPassword: "",
      },
    });
    const { setResetDraft } = useAuthStore.getState();

    setResetDraft((previous) => ({ ...previous, email: "anna@example.com" }));
    setResetDraft((previous) => ({ ...previous, code: "123456" }));

    expect(useAuthStore.getState().resetDraft).toMatchObject({
      email: "anna@example.com",
      code: "123456",
      newPassword: "",
      confirmPassword: "",
    });
  });

  test("submitAuth persists the remote session token for follow-up api requests", async () => {
    const { useAuthStore, useWorkspaceStore } = await loadStores();
    const initialState = useAuthStore.getState();
    useAuthStore.setState({
      ...initialState,
      authMode: "login",
      authDraft: {
        name: "",
        role: "",
        company: "",
        email: "iwo@example.com",
        password: "secret-123",
        workspaceMode: "create",
        workspaceName: "",
        workspaceCode: "",
      },
      resetDraft: {
        email: "",
        code: "",
        newPassword: "",
        confirmPassword: "",
      },
    });
    useWorkspaceStore.setState({
      users: [],
      workspaces: [],
      session: null,
      isHydratingSession: false,
      sessionError: "",
    });
    mocks.loginMock.mockResolvedValue({
      user: { id: "u1", email: "iwo@example.com" },
      workspaceId: "ws1",
      token: "token-remote-1",
    });

    await useAuthStore.getState().submitAuth();

    expect(useWorkspaceStore.getState().session).toEqual({
      userId: "u1",
      workspaceId: "ws1",
      token: "token-remote-1",
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")).toEqual({
      userId: "u1",
      workspaceId: "ws1",
      token: "token-remote-1",
    });
  });

  test("subsequent login overwrites stale legacy token", async () => {
    localStorage.setItem(
      STORAGE_KEYS.session,
      JSON.stringify({ userId: "legacy", workspaceId: "legacy-ws", token: "stale-token" })
    );
    const { useAuthStore, useWorkspaceStore } = await loadStores();
    const initialState = useAuthStore.getState();
    useAuthStore.setState({
      ...initialState,
      authMode: "login",
      authDraft: {
        name: "",
        role: "",
        company: "",
        email: "next@example.com",
        password: "secret-456",
        workspaceMode: "create",
        workspaceName: "",
        workspaceCode: "",
      },
      resetDraft: {
        email: "",
        code: "",
        newPassword: "",
        confirmPassword: "",
      },
    });
    useWorkspaceStore.setState({
      users: [],
      workspaces: [],
      session: null,
      isHydratingSession: false,
      sessionError: "",
    });
    mocks.loginMock.mockResolvedValue({
      user: { id: "u2", email: "next@example.com" },
      workspaceId: "ws2",
      token: "token-remote-2",
    });

    await useAuthStore.getState().submitAuth();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session) || "null")).toEqual({
      userId: "u2",
      workspaceId: "ws2",
      token: "token-remote-2",
    });
  });
});
