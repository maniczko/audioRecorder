import { fireEvent, render, screen } from "@testing-library/react";
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
    const taskCardLabel = screen
      .getAllByText("Przenies zadanie")
      .find((element) => element.closest(".todo-kanban-card"));
    const doneColumnLabel = screen
      .getAllByText("Zakonczone")
      .find((element) => element.closest(".todo-kanban-column"));

    fireEvent.dragStart(taskCardLabel.closest(".todo-kanban-card"), { dataTransfer });
    fireEvent.dragOver(doneColumnLabel.closest(".todo-kanban-column"), { dataTransfer });
    fireEvent.drop(doneColumnLabel.closest(".todo-kanban-column"), { dataTransfer });

    expect(props.onMoveTaskToColumn).toHaveBeenCalledWith("task_1", "done");
  });
});
