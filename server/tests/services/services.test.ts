import { describe, expect, it, vi } from "vitest";
import AuthService from "../../services/AuthService.ts";
import WorkspaceService from "../../services/WorkspaceService.ts";

describe("Server Services", () => {
  it("AuthService delegates database operations", async () => {
    const db = {
      registerUser: vi.fn().mockResolvedValue("register"),
      loginUser: vi.fn().mockResolvedValue("login"),
      requestPasswordReset: vi.fn().mockResolvedValue("reset-request"),
      resetPasswordWithCode: vi.fn().mockResolvedValue("reset-confirm"),
      upsertGoogleUser: vi.fn().mockResolvedValue("google"),
      getSession: vi.fn().mockResolvedValue("session"),
      updateUserProfile: vi.fn().mockResolvedValue("profile"),
      changeUserPassword: vi.fn().mockResolvedValue("password"),
      buildSessionPayload: vi.fn().mockResolvedValue("payload"),
    };
    const service = new AuthService(db);

    await expect(service.registerUser({ email: "a" } as any)).resolves.toBe("register");
    await expect(service.loginUser({ email: "a" } as any)).resolves.toBe("login");
    await expect(service.requestPasswordReset({ email: "a" })).resolves.toBe("reset-request");
    await expect(service.resetPasswordWithCode({ email: "a", code: "1" })).resolves.toBe("reset-confirm");
    await expect(service.upsertGoogleUser({ email: "a" } as any)).resolves.toBe("google");
    await expect(service.getSession("token")).resolves.toBe("session");
    await expect(service.updateUserProfile("u1", { name: "Anna" } as any)).resolves.toBe("profile");
    await expect(service.changeUserPassword("u1", { currentPassword: "a" })).resolves.toBe("password");
    await expect(service.buildSessionPayload("u1", "ws1")).resolves.toBe("payload");
  });

  it("WorkspaceService delegates workspace and voice-profile operations", async () => {
    const db = {
      getWorkspaceState: vi.fn().mockResolvedValue("state"),
      saveWorkspaceState: vi.fn().mockResolvedValue("saved"),
      updateWorkspaceMemberRole: vi.fn().mockResolvedValue("role"),
      getMembership: vi.fn().mockResolvedValue("membership"),
      getWorkspaceVoiceProfiles: vi.fn().mockResolvedValue("profiles"),
      workspaceMembers: vi.fn().mockResolvedValue([{ name: "Anna" }, { name: "Jan" }]),
      saveVoiceProfile: vi.fn().mockResolvedValue("saved-profile"),
      deleteVoiceProfile: vi.fn().mockResolvedValue("deleted"),
    };
    const service = new WorkspaceService(db);

    await expect(service.getWorkspaceState("ws1")).resolves.toBe("state");
    await expect(service.saveWorkspaceState("ws1", {})).resolves.toBe("saved");
    await expect(service.updateWorkspaceMemberRole("ws1", "u2", "admin")).resolves.toBe("role");
    await expect(service.getMembership("ws1", "u1")).resolves.toBe("membership");
    await expect(service.getWorkspaceVoiceProfiles("ws1")).resolves.toBe("profiles");
    await expect(service.getWorkspaceMemberNames("ws1")).resolves.toEqual(["Anna", "Jan"]);
    await expect(service.saveVoiceProfile({ id: "vp1" })).resolves.toBe("saved-profile");
    await expect(service.deleteVoiceProfile("vp1", "ws1")).resolves.toBe("deleted");
  });
});
