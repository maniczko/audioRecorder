import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildTaskChangeHistory,
  buildTaskColumns,
  buildTaskGroups,
  buildTaskPeople,
  buildTaskReorderUpdate,
  buildTaskTags,
  buildTasksFromMeetings,
  createManualTask,
  createRecurringTaskFromTask,
  createTaskFromGoogle,
  DEFAULT_TASK_COLUMNS,
  extractMeetingTasks,
  nextRecurringDueDate,
  taskListStats,
  updateTaskColumns,
  upsertGoogleImportedTasks,
} from "./tasks";

describe("tasks extra coverage", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("buildTaskReorderUpdate uses neighbors and placement fields", () => {
    const tasks = [
      { id: "t1", order: 0 },
      { id: "t2", order: 1024 },
      { id: "t3", order: 2048 },
    ];

    expect(buildTaskReorderUpdate(tasks, { previousTaskId: "t1", nextTaskId: "t2" }).order).toBe(512);
    expect(buildTaskReorderUpdate(tasks, { previousTaskId: "t2", status: "waiting", group: "Ops" })).toEqual(
      expect.objectContaining({ order: 2048, status: "waiting", group: "Ops" })
    );
    expect(buildTaskReorderUpdate(tasks, { nextTaskId: "t2" }).order).toBe(0);
  });

  test("buildTaskReorderUpdate uses top order when no neighbors", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));

    const update = buildTaskReorderUpdate([], {});
    expect(update.order).toBe(-new Date("2026-03-01T00:00:00.000Z").getTime());
  });

  test("nextRecurringDueDate advances based on recurrence", () => {
    expect(nextRecurringDueDate("", null)).toBe("");
    expect(nextRecurringDueDate("invalid", { frequency: "daily" })).toBe("");
    expect(nextRecurringDueDate("2026-03-10T00:00:00.000Z", { frequency: "daily", interval: 2 })).toBe(
      "2026-03-12T00:00:00.000Z"
    );
    expect(nextRecurringDueDate("2026-03-10T00:00:00.000Z", { frequency: "weekly", interval: 1 })).toBe(
      "2026-03-17T00:00:00.000Z"
    );
    const expectedMonthly = new Date("2026-03-10T00:00:00.000Z");
    expectedMonthly.setMonth(expectedMonthly.getMonth() + 1);
    expect(nextRecurringDueDate("2026-03-10T00:00:00.000Z", { frequency: "monthly", interval: 1 })).toBe(
      expectedMonthly.toISOString()
    );
  });

  test("createManualTask builds a normalized manual task", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00.000Z"));

    const columns = [
      { id: "todo", label: "Todo", isDone: false },
      { id: "done", label: "Done", isDone: true },
    ];

    const task = createManualTask(
      "user_1",
      {
        title: "  raport kwartalny ",
        status: "done",
        owner: "Ola",
        tags: "finanse, raport",
        group: "  sprzedaz ",
        comments: ["Start"],
      },
      columns,
      "ws_1"
    );

    expect(task.completed).toBe(true);
    expect(task.status).toBe("done");
    expect(task.tags).toEqual(["finanse", "raport"]);
    expect(task.group).toBe("Sprzedaz");
    expect(task.assignedTo).toEqual(["Ola"]);
    expect(task.history[0].type).toBe("created");
    expect(task.comments).toHaveLength(1);
  });

  test("createManualTask throws without title and sanitizes status", () => {
    const columns = [
      { id: "todo", label: "Todo", isDone: false },
      { id: "done", label: "Done", isDone: true },
    ];

    expect(() => createManualTask("user_1", { title: "   " }, columns, "ws_1")).toThrow("Dodaj tytul zadania.");

    const task = createManualTask("user_1", { title: "OK", status: "missing" }, columns, "ws_1");
    expect(task.status).toBe("todo");
  });

  test("createTaskFromGoogle sets google fields and completion", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T09:00:00.000Z"));

    const task = createTaskFromGoogle(
      "user_2",
      {
        id: "google_1",
        title: "podsumowanie",
        status: "completed",
        updated: "2026-03-09T10:00:00.000Z",
        notes: "Notatka",
      },
      { id: "list_1", title: "moj list" },
      DEFAULT_TASK_COLUMNS,
      { name: "Anna" },
      "ws_1"
    );

    expect(task.status).toBe("done");
    expect(task.completed).toBe(true);
    expect(task.group).toBe("Moj list");
    expect(task.googleSyncedAt).toBe("2026-03-10T09:00:00.000Z");
    expect(task.googleSyncStatus).toBe("synced");
  });

  test("createRecurringTaskFromTask creates a new cycle task", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T10:00:00.000Z"));

    const baseTask = {
      title: "Przygotuj demo",
      owner: "Ola",
      assignedTo: ["Ola"],
      description: "Opis",
      dueDate: "2026-03-10T00:00:00.000Z",
      important: true,
      priority: "high",
      tags: ["demo"],
      notes: "Notatki",
      reminderAt: "",
      group: "Sprint",
      recurrence: { frequency: "weekly", interval: 1 },
      dependencies: ["t2"],
      subtasks: [{ id: "s1", title: "Sub", completed: true, completedAt: "2026-03-09T00:00:00.000Z" }],
      links: [{ id: "l1", url: "https://example.com" }],
    };

    expect(createRecurringTaskFromTask({ ...baseTask, recurrence: null }, "user_3", "ws_1", DEFAULT_TASK_COLUMNS)).toBeNull();

    const recurring = createRecurringTaskFromTask(
      baseTask,
      "user_3",
      "ws_1",
      DEFAULT_TASK_COLUMNS,
      [{ id: "existing", order: 0 }]
    );

    expect(recurring).not.toBeNull();
    expect(recurring.dueDate).toBe("2026-03-17T00:00:00.000Z");
    expect(recurring.history[0].type).toBe("recurrence");
    expect(recurring.subtasks[0].completed).toBe(false);
    expect(recurring.subtasks[0].completedAt).toBe("");
  });

  test("upsertGoogleImportedTasks merges synced tasks and detects conflicts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-12T08:00:00.000Z"));

    const existingTasks = [
      {
        id: "task_1",
        userId: "user_1",
        sourceType: "google",
        googleTaskId: "g1",
        googleTaskListId: "l1",
        title: "Old",
        description: "Old",
        dueDate: "2026-03-10T00:00:00.000Z",
        sourceMeetingDate: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-10T00:00:00.000Z",
        status: "todo",
        completed: false,
        notes: "Old",
        group: "OldGroup",
        owner: "Ola",
        assignedTo: ["Ola"],
        googleUpdatedAt: "2026-03-10T00:00:00.000Z",
        googleSyncedAt: "2026-03-10T00:00:00.000Z",
        googlePulledAt: "2026-03-10T00:00:00.000Z",
        googleSyncStatus: "synced",
      },
    ];

    const importedTasks = [
      {
        googleTaskId: "g1",
        googleTaskListId: "l1",
        title: "New",
        description: "New",
        dueDate: "2026-03-12T00:00:00.000Z",
        sourceMeetingDate: "2026-03-12T00:00:00.000Z",
        updatedAt: "2026-03-12T00:00:00.000Z",
        status: "done",
        completed: true,
        notes: "New",
        group: "Group",
        owner: "",
        assignedTo: [],
        googleUpdatedAt: "2026-03-12T00:00:00.000Z",
      },
    ];

    const mergedResult = upsertGoogleImportedTasks(existingTasks, importedTasks, "user_1");
    expect(mergedResult.conflictCount).toBe(0);
    expect(mergedResult.merged[0].id).toBe("task_1");
    expect(mergedResult.merged[0].title).toBe("New");
    expect(mergedResult.merged[0].googleSyncStatus).toBe("synced");
    expect(mergedResult.merged[0].googleSyncedAt).toBe("2026-03-12T08:00:00.000Z");

    const conflictExisting = [
      {
        ...existingTasks[0],
        googleSyncedAt: "2026-03-10T00:00:00.000Z",
        updatedAt: "2026-03-11T00:00:00.000Z",
        googleSyncStatus: "local_changes",
      },
    ];
    const conflictImported = [
      {
        ...importedTasks[0],
        title: "Remote change",
        updatedAt: "2026-03-11T01:00:00.000Z",
        googleUpdatedAt: "2026-03-11T01:00:00.000Z",
      },
    ];

    const conflictResult = upsertGoogleImportedTasks(conflictExisting, conflictImported, "user_1");
    expect(conflictResult.conflictCount).toBe(1);
    expect(conflictResult.merged[0].googleSyncStatus).toBe("conflict");
    expect(conflictResult.merged[0].googleSyncConflict).not.toBeNull();
  });

  test("extractMeetingTasks uses analysis tasks or action items", () => {
    const meeting = {
      id: "m1",
      title: "Daily",
      startsAt: "2026-03-10T10:00:00.000Z",
      updatedAt: "2026-03-10T11:00:00.000Z",
      createdAt: "2026-03-10T09:00:00.000Z",
      latestRecordingId: "r1",
      attendees: ["Anna"],
      analysis: {
        tasks: [
          {
            title: "Anna: przygotuj raport",
            tags: ["finanse"],
            group: "sprzedaz",
            sourceQuote: "Anna: przygotuj raport",
          },
        ],
      },
      tags: ["call"],
    };

    const tasks = extractMeetingTasks(meeting, DEFAULT_TASK_COLUMNS);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].owner).toBe("Anna");
    expect(tasks[0].assignedTo).toEqual(["Anna"]);
    expect(tasks[0].title).toBe("Przygotuj raport");
    expect(tasks[0].group).toBe("Sprzedaz");
    expect(tasks[0].tags).toEqual(expect.arrayContaining(["call", "finanse"]));

    const fallback = extractMeetingTasks(
      {
        ...meeting,
        analysis: { tasks: [], actionItems: ["Zamknij temat"] },
      },
      DEFAULT_TASK_COLUMNS
    );
    expect(fallback).toHaveLength(1);
    expect(fallback[0].title).toBe("Zamknij temat");
  });

  test("buildTasksFromMeetings merges tasks and respects workspace filter", () => {
    const meeting = {
      id: "m2",
      title: "Sync",
      startsAt: "2026-03-10T10:00:00.000Z",
      updatedAt: "2026-03-10T11:00:00.000Z",
      createdAt: "2026-03-10T09:00:00.000Z",
      analysis: { tasks: [{ title: "Anna: follow up" }] },
      attendees: ["Anna"],
    };

    const manualTasks = [
      createManualTask(
        "user_1",
        { title: "Manual", owner: "Anna", workspaceId: "ws_1" },
        DEFAULT_TASK_COLUMNS,
        "ws_1"
      ),
      createManualTask(
        "user_1",
        { title: "Manual 2", owner: "Anna", workspaceId: "ws_2" },
        DEFAULT_TASK_COLUMNS,
        "ws_2"
      ),
    ];

    const taskState = {
      "m2::task::0": { archived: true },
    };

    const result = buildTasksFromMeetings(
      [meeting],
      manualTasks,
      taskState,
      { id: "user_1", name: "Anna" },
      DEFAULT_TASK_COLUMNS,
      "ws_1"
    );

    expect(result).toHaveLength(1);
    expect(result[0].workspaceId).toBe("ws_1");
    expect(result[0].assignedToMe).toBe(true);
  });

  test("taskListStats aggregates counts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T10:00:00.000Z"));

    const tasks = [
      {
        id: "t1",
        completed: true,
        dueDate: "2026-03-09T10:00:00.000Z",
        priority: "low",
        status: "done",
        sourceType: "manual",
        assignedToMe: true,
        important: false,
        assignedTo: ["A"],
        owner: "A",
        group: "",
        recurrence: null,
        comments: [],
        subtasks: [],
      },
      {
        id: "t2",
        completed: false,
        dueDate: "2026-03-09T10:00:00.000Z",
        priority: "high",
        status: "waiting",
        sourceType: "manual",
        assignedToMe: false,
        important: true,
        assignedTo: [],
        owner: "Nieprzypisane",
        group: "",
        recurrence: null,
        comments: [{ id: "c1" }],
        subtasks: [{ completed: false }, { completed: true }],
      },
      {
        id: "t3",
        completed: false,
        dueDate: "2026-03-10T12:00:00.000Z",
        priority: "medium",
        status: "in_progress",
        sourceType: "google",
        assignedToMe: true,
        important: false,
        assignedTo: ["Anna"],
        owner: "Anna",
        group: "Group",
        recurrence: { frequency: "daily", interval: 1 },
        dependencies: ["t2"],
        comments: [],
        subtasks: [],
      },
      {
        id: "t4",
        completed: false,
        dueDate: "2026-03-13T12:00:00.000Z",
        priority: "urgent",
        status: "todo",
        sourceType: "manual",
        assignedToMe: false,
        important: false,
        assignedTo: ["Bob"],
        owner: "Bob",
        group: "",
        recurrence: null,
        comments: [],
        subtasks: [],
      },
      {
        id: "t5",
        completed: false,
        dueDate: "",
        priority: "low",
        status: "todo",
        sourceType: "manual",
        assignedToMe: false,
        important: false,
        assignedTo: [],
        owner: "Nieprzypisane",
        group: "",
        recurrence: null,
        comments: [],
        subtasks: [],
      },
    ];

    const stats = taskListStats(tasks);
    expect(stats.all).toBe(5);
    expect(stats.completed).toBe(1);
    expect(stats.open).toBe(4);
    expect(stats.overdue).toBe(1);
    expect(stats.dueToday).toBe(1);
    expect(stats.dueThisWeek).toBe(2);
    expect(stats.scheduled).toBe(4);
    expect(stats.unassigned).toBe(2);
    expect(stats.waiting).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.grouped).toBe(1);
    expect(stats.recurring).toBe(1);
    expect(stats.blocked).toBe(1);
    expect(stats.commented).toBe(1);
    expect(stats.subtasksOpen).toBe(1);
    expect(stats.subtasksCompleted).toBe(1);
    expect(stats.progress).toBe(20);
    expect(stats.byPriority.low).toBe(2);
    expect(stats.byPriority.high).toBe(1);
    expect(stats.byPriority.urgent).toBe(1);
    expect(stats.byPriority.medium).toBe(1);
    expect(stats.slaBreached).toBe(1);
  });

  test("buildTaskPeople/tags/groups and updateTaskColumns", () => {
    const people = buildTaskPeople(
      [
        {
          attendees: ["Anna"],
          speakerNames: { s1: "Ola" },
          analysis: { speakerLabels: { s2: "Marek" } },
          recordings: [{ speakerNames: { s3: "Bartek" } }],
        },
      ],
      { name: "Jan", email: "jan@example.com", googleEmail: "jan@google.com" },
      [{ name: "Kasia", email: "kasia@example.com", googleEmail: "" }],
      [{ owner: "Ola", assignedTo: ["Anna"] }]
    );

    expect(people).toEqual(expect.arrayContaining(["Anna", "Ola", "Marek", "Bartek", "Jan", "Kasia"]));
    expect(buildTaskTags([{ tags: ["a", "b"] }], [{ tags: ["b", "c"] }])).toEqual(["a", "b", "c"]);
    expect(buildTaskGroups([{ group: "Group" }, { group: "Group 2" }, { group: "Group" }])).toEqual([
      "Group",
      "Group 2",
    ]);

    const updated = updateTaskColumns({}, "ws_1", [
      { id: "col_1", label: "Nowe", isDone: false },
      { id: "col_2", label: "Koniec", isDone: false },
    ]);
    expect(updated["ws_1"].columns.slice(-1)[0].isDone).toBe(true);
  });

  test("buildTaskChangeHistory records comment and recurrence changes", () => {
    const previousTask = {
      title: "A",
      tags: ["a"],
      dependencies: ["t1"],
      comments: [],
      subtasks: [],
      recurrence: null,
      order: 1,
    };
    const nextTask = {
      title: "A",
      tags: ["b"],
      dependencies: [],
      comments: [{ id: "c1" }],
      subtasks: [{ id: "s1" }],
      recurrence: { frequency: "daily", interval: 1 },
      order: 2,
    };

    const entries = buildTaskChangeHistory(previousTask, nextTask, "User", buildTaskColumns({}, "ws_1"));
    const entryTypes = entries.map((entry) => entry.type);

    expect(entryTypes).toEqual(expect.arrayContaining(["tags", "dependencies", "comment", "subtasks", "recurrence", "order"]));
  });
});
