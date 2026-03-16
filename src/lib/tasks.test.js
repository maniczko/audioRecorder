import {
  buildTaskReorderUpdate,
  createManualTask,
  nextRecurringDueDate,
  upsertGoogleImportedTasks,
} from "./tasks";

const columns = [
  { id: "todo", label: "Do zrobienia", color: "#5a92ff", isDone: false, system: true },
  { id: "done", label: "Zakonczone", color: "#67d59f", isDone: true, system: true },
];

describe("tasks helpers", () => {
  test("creates a manual task with advanced task metadata", () => {
    const task = createManualTask(
      "user_1",
      {
        title: "przygotuj demo",
        assignedTo: ["Anna", "Bartek"],
        comments: [{ text: "Potwierdzic zakres", author: "Anna" }],
        dependencies: ["task_dep"],
        recurrence: { frequency: "weekly", interval: 2 },
        subtasks: [{ title: "Slide deck" }],
      },
      columns,
      "workspace_1"
    );

    expect(task.title).toBe("Przygotuj demo");
    expect(task.owner).toBe("Anna");
    expect(task.assignedTo).toEqual(["Anna", "Bartek"]);
    expect(task.comments).toHaveLength(1);
    expect(task.dependencies).toEqual(["task_dep"]);
    expect(task.recurrence).toEqual({ frequency: "weekly", interval: 2 });
    expect(task.subtasks).toHaveLength(1);
    expect(task.history).not.toHaveLength(0);
  });

  test("builds reorder payload between neighboring tasks", () => {
    const placement = buildTaskReorderUpdate(
      [
        { id: "task_1", order: 1000 },
        { id: "task_2", order: 2000 },
        { id: "task_3", order: 3000 },
      ],
      {
        previousTaskId: "task_1",
        nextTaskId: "task_2",
        status: "done",
      }
    );

    expect(placement.status).toBe("done");
    expect(placement.order).toBeGreaterThan(1000);
    expect(placement.order).toBeLessThan(2000);
  });

  test("calculates the next recurring due date", () => {
    expect(nextRecurringDueDate("2026-03-14T09:00:00.000Z", { frequency: "weekly", interval: 1 })).toBe(
      "2026-03-21T09:00:00.000Z"
    );
  });

  test("upsertGoogleImportedTasks returns merged array and conflictCount=0 when no conflicts", () => {
    const userId = "user_1";
    const incoming = [
      {
        id: "gtask_1",
        googleTaskId: "gtask_1",
        googleTaskListId: "list_1",
        userId,
        sourceType: "google",
        title: "Zaimportowane zadanie",
        status: "todo",
        completed: false,
        googleUpdatedAt: "2026-03-10T08:00:00.000Z",
        googleSyncStatus: "synced",
        googleSyncConflict: null,
      },
    ];

    const { merged, conflictCount } = upsertGoogleImportedTasks([], incoming, userId);

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Zaimportowane zadanie");
    expect(conflictCount).toBe(0);
  });

  test("upsertGoogleImportedTasks returns conflictCount>0 when local and remote diverge", () => {
    const userId = "user_1";
    const now = new Date().toISOString();
    const localTask = {
      id: "task_local",
      googleTaskId: "gtask_1",
      googleTaskListId: "list_1",
      userId,
      sourceType: "google",
      title: "Lokalna wersja",
      status: "todo",
      completed: false,
      googleUpdatedAt: "2026-03-01T08:00:00.000Z",
      googleLocalUpdatedAt: now, // edited locally after last sync
      googleSyncedAt: "2026-03-01T08:00:00.000Z",
      googleSyncStatus: "synced",
      googleSyncConflict: null,
    };

    const remoteTask = {
      googleTaskId: "gtask_1",
      googleTaskListId: "list_1",
      userId,
      sourceType: "google",
      title: "Zdalna wersja",
      status: "todo",
      completed: false,
      googleUpdatedAt: "2026-03-15T08:00:00.000Z", // remote also changed after last sync
      googleSyncStatus: "synced",
      googleSyncConflict: null,
    };

    const { merged, conflictCount } = upsertGoogleImportedTasks([localTask], [remoteTask], userId);

    expect(merged).toHaveLength(1);
    expect(conflictCount).toBe(1);
    expect(merged[0].googleSyncStatus).toBe("conflict");
  });
});
