/* eslint-disable testing-library/no-unnecessary-act */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthScreen from "./AuthScreen";
import { vi, describe, test, expect, beforeEach } from "vitest";

describe("AuthScreen", () => {
  const defaultProps = {
    authMode: "login",
    authDraft: { email: "", password: "", name: "", workspaceName: "", workspaceMode: "create" },
    authError: "",
    setAuthMode: vi.fn(),
    setAuthDraft: vi.fn(),
    submitAuth: vi.fn(e => e.preventDefault()),
    googleEnabled: true,
    googleButtonRef: { current: null },
    googleAuthMessage: "",
    resetDraft: { email: "", code: "", newPassword: "", confirmPassword: "" },
    setResetDraft: vi.fn(),
    resetMessage: "",
    resetPreviewCode: "",
    resetExpiresAt: null,
    requestResetCode: vi.fn(),
    completeReset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderAuthScreen(overrides = {}) {
    const props = { ...defaultProps, ...overrides };
    return { ...render(<AuthScreen {...props} />), props };
  }

  test("renders login form correctly and switches to register mode", async () => {
    const { props } = renderAuthScreen();
    expect(screen.getByPlaceholderText("name@company.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("minimum 6 znakow")).toBeInTheDocument();
    
    const registerSwitch = screen.getByRole("button", { name: "Rejestracja" });
    await userEvent.click(registerSwitch);

    expect(props.setAuthMode).toHaveBeenCalledWith("register");
  });

  test("submits login form with correct credentials", async () => {
    const { props } = renderAuthScreen({
      authDraft: { email: "jan@example.com", password: "test-password" }
    });

    const submitBtn = screen.getByRole("button", { name: "Zaloguj" });
    await userEvent.click(submitBtn);

    expect(props.submitAuth).toHaveBeenCalled();
  });

  test("displays validation errors for weak password during registration", async () => {
    const { props } = renderAuthScreen({
      authMode: "register",
      authDraft: { email: "jan@example.com", password: "123", name: "Jan", workspaceName: "Work", workspaceMode: "create" }
    });

    const submitBtn = screen.getByRole("button", { name: "Wejdz do workspace" });
    await userEvent.click(submitBtn);

    // Should not submit if password is less than 6 chars. 
    // AuthScreen internal validation intercepts it.
    expect(props.submitAuth).not.toHaveBeenCalled();
    expect(screen.getByText("Haslo musi miec co najmniej 6 znakow")).toBeInTheDocument();
  });

  test("handles password reset request directly", async () => {
    const { props } = renderAuthScreen({ authMode: "forgot" });

    const resetBtn = screen.getByRole("button", { name: "Wyslij kod resetu" });
    await userEvent.click(resetBtn);

    expect(props.requestResetCode).toHaveBeenCalled();
  });
});
