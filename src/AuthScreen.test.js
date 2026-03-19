import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthScreen from "./AuthScreen";
import { vi } from "vitest";

describe("AuthScreen", () => {
  const defaultProps = {
    authMode: "login",
    authDraft: { email: "", password: "", name: "", workspaceName: "" },
    authError: "",
    setAuthMode: vi.fn(),
    setAuthDraft: vi.fn(),
    submitAuth: vi.fn(),
    googleEnabled: true,
    googleButtonRef: { current: null },
    googleAuthMessage: "",
    resetDraft: { email: "", code: "", newPassword: "" },
    setResetDraft: vi.fn(),
    resetMessage: "",
    requestResetCode: vi.fn(),
    completeReset: vi.fn(),
  };

  function renderAuthScreen(overrides = {}) {
    const props = { ...defaultProps, ...overrides };
    return { ...render(<AuthScreen {...props} />), props };
  }

  test("renders login form correctly and switches to register mode", async () => {
    const { props } = renderAuthScreen();
    expect(screen.getByPlaceholderText("E-mail")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Haslo")).toBeInTheDocument();
    
    const registerSwitch = screen.getByRole("button", { name: "Dolacz teraz!" });
    await userEvent.click(registerSwitch);

    expect(props.setAuthMode).toHaveBeenCalledWith("register");
  });

  test("submits login form with correct credentials", async () => {
    const { props } = renderAuthScreen({
      authDraft: { email: "jan@example.com", password: "test-password" }
    });

    const submitBtn = screen.getByRole("button", { name: "Zaloguj sie" });
    await userEvent.click(submitBtn);

    expect(props.submitAuth).toHaveBeenCalled();
  });

  test("displays validation errors for weak password during registration", async () => {
    const { props } = renderAuthScreen({
      authMode: "register",
      authDraft: { email: "jan@example.com", password: "123", name: "Jan", workspaceName: "Work" }
    });

    const submitBtn = screen.getByRole("button", { name: "Utworz konto" });
    await userEvent.click(submitBtn);

    // Should not submit if password is less than 6 chars. 
    // AuthScreen internal validation intercepts it.
    expect(props.submitAuth).not.toHaveBeenCalled();
    expect(screen.getByText("Haslo musi miec co najmniej 6 znakow")).toBeInTheDocument();
  });

  test("handles password reset request directly", async () => {
    const { props } = renderAuthScreen({ authMode: "reset_request" });

    // Assuming reset screen shows an email input for request
    const resetBtn = screen.getByRole("button", { name: "Wyslij kod" });
    await userEvent.click(resetBtn);

    expect(props.requestResetCode).toHaveBeenCalled();
  });
});
