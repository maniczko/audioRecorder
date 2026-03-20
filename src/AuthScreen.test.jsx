/* eslint-disable testing-library/no-unnecessary-act */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, test, expect, beforeEach } from "vitest";
import AuthScreen from "./AuthScreen";

describe("AuthScreen", () => {
  const defaultProps = {
    authMode: "login",
    authDraft: {
      email: "",
      password: "",
      name: "",
      role: "",
      company: "",
      workspaceMode: "create",
      workspaceName: "",
      workspaceCode: "",
    },
    authError: "",
    setAuthMode: vi.fn(),
    setAuthDraft: vi.fn(),
    submitAuth: vi.fn((event) => event.preventDefault()),
    googleEnabled: true,
    googleButtonRef: { current: null },
    googleAuthMessage: "",
    resetDraft: { email: "", code: "", newPassword: "", confirmPassword: "" },
    setResetDraft: vi.fn(),
    resetMessage: "",
    resetPreviewCode: "",
    resetExpiresAt: "",
    requestResetCode: vi.fn(),
    completeReset: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderAuthScreen(overrides = {}) {
    const props = { ...defaultProps, ...overrides };
    return { ...render(React.createElement(AuthScreen, props)), props };
  }

  test("switches from login to register mode", async () => {
    const { props } = renderAuthScreen();
    
    const registerSwitch = screen.getByRole("button", { name: "Rejestracja" });
    await userEvent.click(registerSwitch);

    expect(props.setAuthMode).toHaveBeenCalledWith("register");
  });

  test("submits the login form", async () => {
    const { props } = renderAuthScreen({
      authDraft: {
        ...defaultProps.authDraft,
        email: "jan@example.com",
        password: "test-password",
      },
    });

    await userEvent.click(screen.getByRole("button", { name: "Zaloguj" }));

    expect(props.submitAuth).toHaveBeenCalled();
  });

  test("shows the join code field during registration", async () => {
    renderAuthScreen({
      authMode: "register",
      authDraft: {
        ...defaultProps.authDraft,
        name: "Jan",
        workspaceMode: "join",
      },
    });

    expect(screen.getByPlaceholderText("np. AB12CD")).toBeInTheDocument();
  });

  test("requests a password reset code in forgot mode", async () => {
    const { props } = renderAuthScreen({ authMode: "forgot" });

    await userEvent.click(screen.getByRole("button", { name: "Wyslij kod resetu" }));

    expect(props.requestResetCode).toHaveBeenCalled();
  });
});
