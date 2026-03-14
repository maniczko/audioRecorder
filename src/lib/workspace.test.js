import { migrateWorkspaceData, resolveWorkspaceForUser, workspaceMembers } from "./workspace";

describe("workspace helpers", () => {
  test("migrates legacy data to workspace-based storage", () => {
    const migration = migrateWorkspaceData({
      users: [
        {
          id: "user_1",
          email: "anna@example.com",
          name: "Anna",
        },
      ],
      workspaces: [],
      meetings: [
        {
          id: "meeting_1",
          userId: "user_1",
          title: "Retro",
          updatedAt: "2026-03-14T09:00:00.000Z",
        },
      ],
      manualTasks: [
        {
          id: "task_1",
          userId: "user_1",
          title: "Follow up",
        },
      ],
      taskBoards: {
        user_1: {
          columns: [{ id: "todo", label: "Todo", color: "#5a92ff", isDone: false }],
        },
      },
      session: {
        userId: "user_1",
      },
    });

    expect(migration.changed).toBe(true);
    expect(migration.workspaces).toHaveLength(1);
    expect(migration.users[0].defaultWorkspaceId).toBe(migration.workspaces[0].id);
    expect(migration.meetings[0].workspaceId).toBe(migration.workspaces[0].id);
    expect(migration.manualTasks[0].workspaceId).toBe(migration.workspaces[0].id);
    expect(migration.taskBoards[migration.workspaces[0].id]).toBeTruthy();
    expect(migration.session.workspaceId).toBe(migration.workspaces[0].id);
  });

  test("resolves preferred workspace only when the user belongs to it", () => {
    const user = {
      id: "user_1",
      email: "anna@example.com",
      defaultWorkspaceId: "workspace_1",
      workspaceIds: ["workspace_1", "workspace_2"],
    };
    const workspaces = [
      { id: "workspace_1", memberIds: ["user_1"] },
      { id: "workspace_2", memberIds: ["user_1"] },
      { id: "workspace_3", memberIds: [] },
    ];

    expect(resolveWorkspaceForUser(user, workspaces, "workspace_2")).toBe("workspace_2");
    expect(resolveWorkspaceForUser(user, workspaces, "workspace_3")).toBe("workspace_1");
  });

  test("lists workspace members", () => {
    const users = [
      { id: "user_1", name: "Anna" },
      { id: "user_2", name: "Jan" },
      { id: "user_3", name: "Marta" },
    ];
    const workspace = {
      id: "workspace_1",
      memberIds: ["user_1", "user_3"],
    };

    expect(workspaceMembers(users, workspace).map((user) => user.name)).toEqual(["Anna", "Marta"]);
  });
});
