import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskKanbanView from './TaskKanbanView';

describe('TaskKanbanView', () => {
  const defaultProps = {
    kanbanColumns: [
      {
        id: 'c1',
        label: 'To Do',
        color: 'blue',
        tasks: [
          {
            id: 't1',
            title: 'Task 1',
            status: 'c1',
            completed: false,
            tags: ['tagA'],
            priority: 'high',
            owner: 'Ala',
          },
          {
            id: 't2',
            title: 'Task 2',
            status: 'c1',
            completed: true,
            coverColor: 'red',
            dueDate: '2026-10-10',
          },
        ],
      },
      {
        id: 'c2',
        label: 'Done',
        color: 'green',
        tasks: [],
      },
    ],
    allTasks: [
      {
        id: 't1',
        title: 'Task 1',
        status: 'c1',
        completed: false,
        tags: ['tagA'],
        priority: 'high',
        owner: 'Ala',
      },
      {
        id: 't2',
        title: 'Task 2',
        status: 'c1',
        completed: true,
        coverColor: 'red',
        dueDate: '2026-10-10',
      },
    ],
    dropColumnId: '',
    setDropColumnId: vi.fn(),
    handleDrop: vi.fn(),
    handleTaskDrop: vi.fn(),
    selectedTask: null,
    selectedTaskIds: [],
    toggleTaskSelection: vi.fn(),
    setSelectedTaskId: vi.fn(),
    setDragTaskId: vi.fn(),
    onUpdateTask: vi.fn(),
    onMoveTaskToColumn: vi.fn(),
    swimlaneGroupBy: 'none',
    onQuickAddToColumn: vi.fn(),
    onReorderColumns: vi.fn(),
    sortBy: 'manual',
    setSortBy: vi.fn(),
  };

  test('renders columns and tasks', () => {
    render(<TaskKanbanView {...defaultProps} />);

    expect(screen.getAllByText('To Do')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Done')[0]).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
  });

  test('interactions with KanbanCard', async () => {
    render(<TaskKanbanView {...defaultProps} />);

    const checkBtn = screen.getAllByRole('button', { name: /Zakoncz zadanie|Otworz ponownie/i })[0];
    await userEvent.click(checkBtn);
    expect(defaultProps.onUpdateTask).toHaveBeenCalled();

    const starBtn = screen.getAllByRole('button', { name: /Oznacz jako wazne/i })[0];
    await userEvent.click(starBtn);
    expect(defaultProps.onUpdateTask).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText('Task 1'));
    expect(defaultProps.setSelectedTaskId).toHaveBeenCalledWith('t1');
  });

  test('quick add task', async () => {
    render(<TaskKanbanView {...defaultProps} />);

    const addBtns = screen.getAllByRole('button', { name: '+ Dodaj zadanie' });
    await userEvent.click(addBtns[1]);

    const input = screen.getByPlaceholderText('Tytul zadania, Enter aby dodac...');
    await userEvent.type(input, 'New Quick Task');
    await userEvent.keyboard('{Enter}');

    expect(defaultProps.onQuickAddToColumn).toHaveBeenCalledWith('c2', 'New Quick Task');
  });
});

// ─────────────────────────────────────────────────────────────────
// Regression: Issue #0 — Kanban visual drag-and-drop delay
// Date: 2026-03-29
// Bug: TaskKanbanView had a broken React.memo comparison that
//      ignored dropColumnId and dragTaskId props, causing the
//      highlight (.drop CSS class) to only apply with massive delay.
// Fix: Added dropColumnId and dragTaskId to the memo comparison logic.
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #0 — TaskKanbanView responsive to dropColumnId', () => {
  it('re-renders and applies drop class when dropColumnId changes', () => {
    const dummyColumns = [
      { id: 'todo', label: 'Do zrobienia', tasks: [] },
      { id: 'in_progress', label: 'W toku', tasks: [] },
    ];

    const { container, rerender } = render(
      <TaskKanbanView
        kanbanColumns={dummyColumns}
        allTasks={[]}
        dropColumnId=""
        setDropColumnId={() => {}}
        handleDrop={() => {}}
        handleTaskDrop={() => {}}
        selectedTask={null}
        selectedTaskIds={[]}
        toggleTaskSelection={() => {}}
        setSelectedTaskId={() => {}}
        setDragTaskId={() => {}}
        dragTaskId=""
        onUpdateTask={() => {}}
        onMoveTaskToColumn={() => {}}
      />
    );

    const todoCol = container.querySelector('[data-testid="column-todo"]');
    expect(todoCol).not.toHaveClass('drop');

    rerender(
      <TaskKanbanView
        kanbanColumns={dummyColumns}
        allTasks={[]}
        dropColumnId="todo" // Trigger change
        setDropColumnId={() => {}}
        handleDrop={() => {}}
        handleTaskDrop={() => {}}
        selectedTask={null}
        selectedTaskIds={[]}
        toggleTaskSelection={() => {}}
        setSelectedTaskId={() => {}}
        setDragTaskId={() => {}}
        dragTaskId="drag-123"
        onUpdateTask={() => {}}
        onMoveTaskToColumn={() => {}}
      />
    );

    const updatedTodoCol = container.querySelector('[data-testid="column-todo"]');
    expect(updatedTodoCol).toHaveClass('drop');
  });
});
