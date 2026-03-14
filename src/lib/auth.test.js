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
});
