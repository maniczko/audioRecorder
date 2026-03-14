import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TasksTab from "./TasksTab";

function createDataTransfer() {
  const store = {};
  return {
    dropEffect: "move",
    effectAllowed: "move",
    setData: jest.fn((type, value) => {
      store[type] = value;
    }),
    getData: jest.fn((type) => store[type] || ""),
  };
}

function renderTasksTab(overrides = {}) {
  const props = {
    tasks: [
      {
        id: "task_1",
        title: "Przenies zadanie",
        owner: "Anna",
        group: "Sprint 14",
        description: "Sprawdz pipeline",
        dueDate: "2026-03-20T10:00:00.000Z",
        notes: "",
        sourceType: "manual",
        sourceMeetingId: "",
        sourceMeetingTitle: "Reczne zadanie",
        sourceMeetingDate: "2026-03-20T10:00:00.000Z",
        sourceRecordingId: "",
        sourceQuote: "",
        createdAt: "2026-03-14T09:00:00.000Z",
        updatedAt: "2026-03-14T09:00:00.000Z",
        status: "todo",
        important: false,
        completed: false,
        priority: "medium",
        tags: ["demo"],
        assignedTo: ["Anna"],
        comments: [],
        history: [],
        dependencies: [],
        recurrence: null,
        subtasks: [],
        order: -100,
        assignedToMe: true,
      },
    ],
    peopleOptions: ["Anna"],
    tagOptions: ["demo"],
    boardColumns: [
      { id: "todo", label: "Do zrobienia", color: "#5a92ff", isDone: false, system: true },
      { id: "done", label: "Zakonczone", color: "#67d59f", isDone: true, system: true },
    ],
    onCreateTask: jest.fn(),
    onUpdateTask: jest.fn(),
    onDeleteTask: jest.fn(),
    onMoveTaskToColumn: jest.fn(),
    onReorderTask: jest.fn(),
    onCreateColumn: jest.fn(),
    onUpdateColumn: jest.fn(),
    onDeleteColumn: jest.fn(),
    onOpenMeeting: jest.fn(),
    defaultView: "kanban",
    googleTasksEnabled: false,
    googleTasksStatus: "idle",
    googleTasksMessage: "",
    googleTaskLists: [],
    selectedGoogleTaskListId: "",
    onSelectGoogleTaskList: jest.fn(),
    onConnectGoogleTasks: jest.fn(),
    onImportGoogleTasks: jest.fn(),
    onExportGoogleTasks: jest.fn(),
    workspaceName: "Produkt",
    workspaceInviteCode: "ABC123",
    externalSelectedTaskId: "",
    onTaskSelectionHandled: jest.fn(),
    currentUserName: "Anna",
    ...overrides,
  };

  return {
    ...render(<TasksTab {...props} />),
    props,
  };
}

describe("TasksTab", () => {
  test("moves a task between kanban columns with drag and drop", () => {
    const { props } = renderTasksTab();
    const dataTransfer = createDataTransfer();
    const dragHandle = screen.getByTitle("Przeciagnij zadanie");
    const doneColumn = screen
      .getAllByText("Zakonczone")
      .find((element) => element.closest(".todo-kanban-column"))
      .closest(".todo-kanban-column");

    fireEvent.dragStart(dragHandle, { dataTransfer });
    fireEvent.dragEnter(doneColumn, { dataTransfer });
    fireEvent.dragOver(doneColumn, { dataTransfer });
    fireEvent.drop(doneColumn.querySelector(".todo-kanban-body"), { dataTransfer });

    expect(props.onReorderTask).toHaveBeenCalledWith("task_1", expect.objectContaining({ status: "done" }));
  });

  test("creates a task inside the selected custom group", async () => {
    const createdTask = {
      id: "task_2",
      title: "Nowe zadanie",
      status: "todo",
      group: "Sprint 14",
    };
    const { props } = renderTasksTab({
      defaultView: "list",
      onCreateTask: jest.fn().mockReturnValue(createdTask),
    });

    await userEvent.click(
      screen
        .getAllByText("Sprint 14")
        .find((element) => element.closest(".todo-side-link"))
        .closest(".todo-side-link")
    );
    await userEvent.type(screen.getByPlaceholderText("Dodaj zadanie"), "Nowe zadanie");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj zadanie" }));

    expect(props.onCreateTask).toHaveBeenCalledWith(expect.objectContaining({ title: "Nowe zadanie", group: "Sprint 14" }));
  });
});
