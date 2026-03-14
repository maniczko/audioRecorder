import {
  buildTaskReorderUpdate,
  createManualTask,
  nextRecurringDueDate,
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
});
