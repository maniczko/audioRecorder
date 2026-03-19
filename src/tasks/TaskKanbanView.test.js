import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaskKanbanView from "./TaskKanbanView";

describe("TaskKanbanView", () => {
  const defaultProps = {
    kanbanColumns: [
      {
        id: "c1", label: "To Do", color: "blue",
        tasks: [
          { id: "t1", title: "Task 1", status: "c1", completed: false, tags: ["tagA"], priority: "high", owner: "Ala" },
          { id: "t2", title: "Task 2", status: "c1", completed: true, coverColor: "red", dueDate: "2026-10-10" }
        ]
      },
      {
        id: "c2", label: "Done", color: "green",
        tasks: []
      }
    ],
    allTasks: [
      { id: "t1", title: "Task 1", status: "c1", completed: false, tags: ["tagA"], priority: "high", owner: "Ala" },
      { id: "t2", title: "Task 2", status: "c1", completed: true, coverColor: "red", dueDate: "2026-10-10" }
    ],
    dropColumnId: "",
    setDropColumnId: jest.fn(),
    handleDrop: jest.fn(),
    handleTaskDrop: jest.fn(),
    selectedTask: null,
    selectedTaskIds: [],
    toggleTaskSelection: jest.fn(),
    setSelectedTaskId: jest.fn(),
    setDragTaskId: jest.fn(),
    onUpdateTask: jest.fn(),
    onMoveTaskToColumn: jest.fn(),
    swimlaneGroupBy: "none",
    onQuickAddToColumn: jest.fn(),
    onReorderColumns: jest.fn(),
    sortBy: "manual",
    setSortBy: jest.fn(),
  };

  test("renders columns and tasks", () => {
    render(<TaskKanbanView {...defaultProps} />);
    
    expect(screen.getAllByText("To Do")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Done")[0]).toBeInTheDocument();
    expect(screen.getByText("Task 1")).toBeInTheDocument();
  });

  test("interactions with KanbanCard", async () => {
    render(<TaskKanbanView {...defaultProps} />);
    
    // Toggle completion
    const checkBtn = screen.getAllByRole("button", { name: /Zakoncz zadanie|Otworz ponownie/i })[0];
    await userEvent.click(checkBtn);
    expect(defaultProps.onUpdateTask).toHaveBeenCalled();

    // Toggle star
    const starBtn = screen.getAllByRole("button", { name: /Oznacz jako wazne/i })[0];
    await userEvent.click(starBtn);
    expect(defaultProps.onUpdateTask).toHaveBeenCalledTimes(2);

    // Click card
    fireEvent.click(screen.getByText("Task 1"));
    expect(defaultProps.setSelectedTaskId).toHaveBeenCalledWith("t1");
  });

  test("quick add task", async () => {
    render(<TaskKanbanView {...defaultProps} />);
    
    // Click quick add on column c2 (Done)
    const addBtns = screen.getAllByRole("button", { name: "+ Dodaj zadanie" });
    await userEvent.click(addBtns[1]); // second column
    
    const input = screen.getByPlaceholderText("Tytul zadania, Enter aby dodac...");
    await userEvent.type(input, "New Quick Task");
    await userEvent.keyboard("{Enter}");

    expect(defaultProps.onQuickAddToColumn).toHaveBeenCalledWith("c2", "New Quick Task");
  });

  test("move task via select dropdown", async () => {
    render(<TaskKanbanView {...defaultProps} />);
    
    const selects = screen.getAllByTitle("Przenieś do kolumny");
    await userEvent.selectOptions(selects[0], "c2");
    
    expect(defaultProps.onMoveTaskToColumn).toHaveBeenCalledWith("t1", "c2");
  });
});
