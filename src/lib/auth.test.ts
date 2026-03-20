import { loginUser, registerUser, requestPasswordReset, resetPasswordWithCode } from "./auth";
import { createWorkspace } from "./workspace";

describe("auth flows", () => {
  test("registers a user and creates a workspace", async () => {
    const result = await registerUser([], [], {
      name: "Anna Nowak",
      email: "anna@example.com",
      password: "tajne123",
      role: "PM",
      company: "VoiceLog",
      workspaceMode: "create",
      workspaceName: "Produkt",
    });

    expect(result.user.email).toBe("anna@example.com");
    expect(result.workspaceId).toBeTruthy();
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0].ownerUserId).toBe(result.user.id);
    expect(result.workspaces[0].memberIds).toContain(result.user.id);
  });

  test("joins an existing workspace and can log in to it", async () => {
    const workspace = createWorkspace("Sprzedaz", "owner_1");
    const registerResult = await registerUser([], [workspace], {
      name: "Jan Kowalski",
      email: "jan@example.com",
      password: "sekret12",
      workspaceMode: "join",
      workspaceCode: workspace.inviteCode,
    });

    const joinedWorkspace = registerResult.workspaces.find((item) => item.id === workspace.id);
    expect(joinedWorkspace.memberIds).toContain(registerResult.user.id);

    const loginResult = await loginUser(registerResult.users, registerResult.workspaces, {
      email: "jan@example.com",
      password: "sekret12",
      workspaceId: workspace.id,
    });

    expect(loginResult.user.id).toBe(registerResult.user.id);
    expect(loginResult.workspaceId).toBe(workspace.id);
  });

  test("resets password with a recovery code", async () => {
    const registerResult = await registerUser([], [], {
      name: "Marta",
      email: "marta@example.com",
      password: "haslo123",
      workspaceMode: "create",
      workspaceName: "Wsparcie",
    });

    const resetResult = await requestPasswordReset(registerResult.users, {
      email: "marta@example.com",
    });

    expect(resetResult.recoveryCode).toHaveLength(6);

    const usersAfterReset = await resetPasswordWithCode(resetResult.users, {
      email: "marta@example.com",
      code: resetResult.recoveryCode,
      newPassword: "nowehaslo1",
      confirmPassword: "nowehaslo1",
    });

    const loginResult = await loginUser(usersAfterReset, registerResult.workspaces, {
      email: "marta@example.com",
      password: "nowehaslo1",
    });

    expect(loginResult.user.email).toBe("marta@example.com");
  });

  test("rejects login when a specific workspace is requested but user is not a member", async () => {
    const workspace = createWorkspace("Sprzedaz", "owner_1");
    const otherWorkspace = createWorkspace("Marketing", "owner_2");
    const registerResult = await registerUser([], [workspace, otherWorkspace], {
      name: "Jan Kowalski",
      email: "jan@example.com",
      password: "sekret12",
      workspaceMode: "join",
      workspaceCode: workspace.inviteCode,
    });

    await expect(
      loginUser(registerResult.users, registerResult.workspaces, {
        email: "jan@example.com",
        password: "sekret12",
        workspaceId: otherWorkspace.id,
      })
    ).rejects.toThrow("Nie masz dostepu do wybranego workspace.");
  });

  test("shows a dedicated message for Google-managed accounts during password login", async () => {
    await expect(
      loginUser(
        [
          {
            id: "user_google_1",
            email: "google@example.com",
            passwordHash: null,
            provider: "google",
            workspaceIds: ["workspace_1"],
            defaultWorkspaceId: "workspace_1",
          },
        ],
        [{ id: "workspace_1", memberIds: ["user_google_1"] }],
        {
          email: "google@example.com",
          password: "sekret12",
        }
      )
    ).rejects.toThrow("To konto korzysta z logowania Google. Uzyj przycisku Google.");
  });
});
