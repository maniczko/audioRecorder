import {
  parseTagInput,
  normalizeTaskPeopleList,
  normalizeTaskDependencies,
  normalizeTaskComments,
  normalizeTaskHistory,
  normalizeTaskSubtasks,
  normalizeTaskLinks,
  normalizeTaskRecurrence,
  createTaskComment,
  createTaskSubtask,
  createTaskHistoryEntry,
  getTaskDependencyDetails,
  validateTaskDependencies,
  validateTaskCompletion,
  getTaskSlaState,
  buildTaskNotifications,
  getTaskOrder,
  getNextTaskOrderTop,
  buildTaskChangeHistory,
  getTaskAssigneeSummary,
  buildTaskColumns,
  createTaskColumn,
  DEFAULT_TASK_COLUMNS
} from "./tasks";

describe("extended tasks functions", () => {
  test("normalization functions", () => {
    expect(parseTagInput("a, b#c\nd")).toEqual(["a", "b", "c", "d"]);
    expect(normalizeTaskPeopleList("a, b\nc")).toEqual(["a", "b", "c"]);
    expect(normalizeTaskDependencies(["1", "2", "2"])).toEqual(["1", "2"]);
    expect(normalizeTaskComments(["test", { text: "test2", id: "1", author: "Bob", createdAt: "now" }])).toHaveLength(2);
    expect(normalizeTaskHistory([{ message: "test msg", type: "status" }])).toHaveLength(1);
    expect(normalizeTaskSubtasks(["sub1", { title: "sub2", completed: true }])).toHaveLength(2);
    expect(normalizeTaskLinks(["http://test.com", { url: "http://test2.com", label: "t2" }])).toHaveLength(2);
    expect(normalizeTaskRecurrence("daily")).toEqual({ frequency: "daily", interval: 1 });
  });

  test("creation functions", () => {
    expect(createTaskComment("hello").text).toBe("hello");
    expect(createTaskSubtask("todo").title).toBe("todo");
    expect(createTaskHistoryEntry("done").message).toBe("done");
  });

  test("dependency details", () => {
    const tasks = [{ id: "t1", completed: false }, { id: "t2", completed: true }];
    const targetTask = { id: "tt", dependencies: ["t1", "t2", "nonexistent"] };
    const details = getTaskDependencyDetails(targetTask, tasks);
    expect(details.dependencies).toHaveLength(2);
    expect(details.unresolved).toHaveLength(1);
    expect(details.blocking).toBe(true);
  });

  test("validation functions", () => {
    expect(() => validateTaskDependencies("t1", ["t1"], [])).toThrow();
    const tasks = [{ id: "t1", dependencies: ["t2"] }, { id: "t2", dependencies: ["t1"] }];
    expect(() => validateTaskDependencies("t3", ["t1"], tasks)).toThrow(); // cyclic

    expect(() => validateTaskCompletion(
      { id: "t1", dependencies: ["t2"] },
      { completed: true },
      [{ id: "t2", completed: false, title: "Blocked By t2" }]
    )).toThrow();
  });

  test("sla and notifications", () => {
    const past = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    expect(getTaskSlaState({ dueDate: past }).tone).toBe("danger");
    expect(buildTaskNotifications([{ id: "t1", dueDate: past, completed: false }])).toHaveLength(1);
  });

  test("order functions", () => {
    expect(getTaskOrder({ order: 10 })).toBe(10);
    expect(getNextTaskOrderTop([{ order: 10 }])).toBeLessThan(10);
  });

  test("change history build", () => {
    const h = buildTaskChangeHistory({ title: "A", tags: ["a"] }, { title: "B", tags: ["a", "b"] }, "User", DEFAULT_TASK_COLUMNS);
    expect(h.length).toBeGreaterThan(1);
  });

  test("assignee summary", () => {
    expect(getTaskAssigneeSummary({})).toBe("Nieprzypisane");
    expect(getTaskAssigneeSummary({ assignedTo: ["a", "b"] })).toBe("a +1");
  });

  test("columns", () => {
    expect(buildTaskColumns({}, "workspace_1").length).toBe(DEFAULT_TASK_COLUMNS.length);
    const newBoard = createTaskColumn({}, "workspace_1", { label: "Nowa kolumna" });
    expect(newBoard["workspace_1"].columns.length).toBeGreaterThan(DEFAULT_TASK_COLUMNS.length);
  });
});
