import { beforeEach, describe, expect, test } from "vitest";
import { useAuthStore } from "./authStore";

const initialState = useAuthStore.getState();

describe("authStore", () => {
  beforeEach(() => {
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
  });

  test("setAuthDraft supports updater functions without losing previous fields", () => {
    const { setAuthDraft } = useAuthStore.getState();

    setAuthDraft((previous) => ({ ...previous, email: "anna@example.com" }));
    setAuthDraft((previous) => ({ ...previous, password: "secret-123" }));

    expect(useAuthStore.getState().authDraft).toMatchObject({
      email: "anna@example.com",
      password: "secret-123",
      workspaceMode: "create",
    });
  });

  test("setResetDraft supports updater functions", () => {
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
});
