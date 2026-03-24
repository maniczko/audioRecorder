import { describe, expect, it } from "vitest";
import {
  addUserToWorkspace,
  createWorkspace,
  getWorkspaceMemberRole,
  migrateWorkspaceData,
  normalizeWorkspaceCode,
  resolveWorkspaceForUser,
  userWorkspaceIds,
  workspaceMembers,
} from "./workspace";

describe("workspace helpers", () => {
  it("normalizes invite codes and creates owner workspaces", () => {
    expect(normalizeWorkspaceCode(" ab c-12 ")).toBe("ABC-12");

    const workspace = createWorkspace("  ", "user_1");
    expect(workspace.name).toBe("Shared workspace");
    expect(workspace.ownerUserId).toBe("user_1");
    expect(workspace.memberIds).toEqual(["user_1"]);
    expect(workspace.memberRoles.user_1).toBe("owner");
  });

  it("adds users and resolves member roles", () => {
    const workspace = createWorkspace("Sales", "owner_1");
    const nextWorkspaces = addUserToWorkspace([workspace], workspace.id, "user_2");

    expect(nextWorkspaces[0].memberIds).toContain("user_2");
    expect(getWorkspaceMemberRole(nextWorkspaces[0], "owner_1")).toBe("owner");
    expect(getWorkspaceMemberRole(nextWorkspaces[0], "user_2")).toBe("member");
    expect(getWorkspaceMemberRole(nextWorkspaces[0], "missing")).toBe("member");
  });

  it("collects members and workspace ids", () => {
    const workspace = createWorkspace("Sales", "owner_1");
    const joined = addUserToWorkspace([workspace], workspace.id, "user_2")[0];
    const members = workspaceMembers(
      [
        { id: "owner_1", name: "Ola", email: "ola@example.com" },
        { id: "user_2", name: "Jan", email: "jan@example.com" },
        { id: "other", name: "Inny" },
      ],
      joined
    );

    expect(members).toHaveLength(2);
    expect(members[0].workspaceMemberRole).toBe("owner");
    expect(userWorkspaceIds({ id: "user_2", workspaceIds: ["extra"] }, [joined])).toEqual(["extra", joined.id]);
  });

  it("resolves preferred and default workspace ids", () => {
    const workspaces = [
      createWorkspace("One", "user_1"),
      createWorkspace("Two", "user_1"),
    ];
    const user = {
      id: "user_1",
      workspaceIds: [workspaces[0].id, workspaces[1].id],
      defaultWorkspaceId: workspaces[1].id,
    };

    expect(resolveWorkspaceForUser(user, workspaces, workspaces[0].id)).toBe(workspaces[0].id);
    expect(resolveWorkspaceForUser(user, workspaces, "missing")).toBe(workspaces[1].id);
    expect(resolveWorkspaceForUser({ id: "user_9" }, [], null)).toBeNull();
  });

  it("migrates workspace data for users and sessions", () => {
    const existingWorkspace = createWorkspace("  Team  ", "user_2");
    const result = migrateWorkspaceData({
      users: [
        { id: "user_1", name: "Anna", email: "anna@example.com", workspaceIds: [], defaultWorkspaceId: "" },
        { id: "user_2", name: "Bartek", email: "bartek@example.com", workspaceIds: [existingWorkspace.id], defaultWorkspaceId: existingWorkspace.id },
      ],
      workspaces: [
        {
          ...existingWorkspace,
          memberIds: ["user_2", "user_2"],
          memberRoles: { user_2: "owner" },
          inviteCode: " ab cd ",
        },
      ],
      meetings: [{ id: "meeting_1", userId: "user_1", title: "Spotkanie" }],
      manualTasks: [{ id: "task_1", userId: "user_1", title: "Zadanie" }],
      taskBoards: {
        user_2: { columns: [{ id: "todo", label: "To do" }] },
      },
      session: { userId: "user_1" },
    });

    const user1 = result.users.find((user) => user.id === "user_1");
    expect(result.changed).toBe(true);
    expect(user1.workspaceIds).toHaveLength(1);
    expect(user1.defaultWorkspaceId).toBeTruthy();
    expect(result.meetings[0].workspaceId).toBe(user1.defaultWorkspaceId);
    expect(result.manualTasks[0].workspaceId).toBe(user1.defaultWorkspaceId);
    expect(result.manualTasks[0].createdByUserId).toBe("user_1");
    expect(result.taskBoards[existingWorkspace.id]).toEqual({ columns: [{ id: "todo", label: "To do" }] });
    expect(result.session.workspaceId).toBe(user1.defaultWorkspaceId);
    expect(result.workspaces[0].memberIds).toEqual(["user_2"]);
    expect(result.workspaces[0].inviteCode).toBe("ABCD");
  });
});
