import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskListView from './TaskListView';

function createBaseProps(overrides: Record<string, any> = {}) {
  const groupedTasks = [
    {
      id: 'todo',
      label: 'Todo',
      tasks: [
        {
          id: 'task-1',
          title: 'Alpha task',
          status: 'todo',
          completed: false,
          owner: 'Ala',
          dueDate: '2026-01-01T10:00:00Z',
          myDay: false,
          important: true,
          priority: 'high',
          assignedTo: ['Ala'],
          reminderAt: '',
          tags: ['sales'],
          order: 0,
        },
      ],
    },
  ];

  return {
    groupedTasks,
    allTasks: groupedTasks[0].tasks,
    groupBy: 'status',
    sortBy: 'due:asc',
    setSortBy: vi.fn(),
    selectedTask: null,
    selectedTaskIds: [],
    toggleTaskSelection: vi.fn(),
    setSelectedTaskId: vi.fn(),
    onUpdateTask: vi.fn(),
    onMoveTaskToColumn: vi.fn(),
    peopleOptions: [],
    taskGroups: [],
    boardColumns: [{ id: 'todo', label: 'Todo' }],
    handleGroupDrop: vi.fn(),
    handleTaskDrop: vi.fn(),
    setDragTaskId: vi.fn(),
    dragTaskId: '',
    ...overrides,
  };
}

describe('TaskListView', () => {
  it('renders Microsoft To Do style columns and task row without the onboarding banner', () => {
    render(<TaskListView {...createBaseProps()} />);

    expect(
      screen.getByText((content, node) => node?.tagName === 'STRONG' && content === 'Todo')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tytuł zadania/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Status/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Priorytet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Osoba/i })).toBeInTheDocument();
    expect(screen.getByText('1 sty 2026')).toBeInTheDocument();
    expect(screen.getByText('Wysoki')).toBeInTheDocument();
    expect(screen.getByText('1 zadanie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Odśwież/i })).toBeInTheDocument();
    expect(screen.queryByText('Wskazówka')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dowiedz się więcej/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zakończ zadanie Alpha task/i })).toBeInTheDocument();
  });

  it('keeps row tools and task title in separate layout cells', () => {
    const { container } = render(<TaskListView {...createBaseProps()} />);

    const row = container.querySelector('.todo-table-row');
    const tools = row?.querySelector('.todo-row-tools');
    const title = row?.querySelector('.todo-title-cell');
    const completion = tools?.querySelector('.todo-task-circle');

    expect(row).toBeTruthy();
    expect(tools).toBeTruthy();
    expect(title).toBeTruthy();
    expect(completion).toBeTruthy();
    expect(Array.from(row?.children || [])).toEqual(
      expect.arrayContaining([tools as Element, title as Element])
    );
    expect(title?.contains(completion as Element)).toBe(false);
  });

  it('selects task row on click', () => {
    const setSelectedTaskId = vi.fn();
    const { container } = render(<TaskListView {...createBaseProps({ setSelectedTaskId })} />);

    const taskRow = container.querySelector('.todo-table-row');
    expect(taskRow).toBeTruthy();
    fireEvent.click(taskRow as Element);
    expect(setSelectedTaskId).toHaveBeenCalledWith('task-1');
  });

  it('toggles completion for selected task', () => {
    const onUpdateTask = vi.fn();
    render(<TaskListView {...createBaseProps({ onUpdateTask })} />);

    fireEvent.click(screen.getByRole('button', { name: /Zakończ zadanie Alpha task/i }));
    expect(onUpdateTask).toHaveBeenCalledWith('task-1', { completed: true });
  });

  it('toggles important flag from the last row column', () => {
    const onUpdateTask = vi.fn();
    render(<TaskListView {...createBaseProps({ onUpdateTask })} />);

    fireEvent.click(screen.getByTitle('Oznacz jako ważne'));
    expect(onUpdateTask).toHaveBeenCalledWith('task-1', { important: false });
  });

  it('sorts from table headers with accessible state', () => {
    const setSortBy = vi.fn();
    render(<TaskListView {...createBaseProps({ sortBy: 'due:asc', setSortBy })} />);

    expect(screen.getByRole('columnheader', { name: /Termin/i })).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
    expect(screen.getByRole('button', { name: /^Termin/i })).toHaveTextContent('↑');

    fireEvent.click(screen.getByRole('button', { name: /^Termin/i }));
    expect(setSortBy).toHaveBeenCalledWith('due:desc');
  });

  it('cycles a table sort header back to the default due sort', () => {
    const setSortBy = vi.fn();
    render(<TaskListView {...createBaseProps({ sortBy: 'title:desc', setSortBy })} />);

    fireEvent.click(screen.getByRole('button', { name: /^Tytuł zadania/i }));
    expect(setSortBy).toHaveBeenCalledWith('due:asc');
  });

  it('resets drag state on Escape key', () => {
    const setDragTaskId = vi.fn();
    render(<TaskListView {...createBaseProps({ dragTaskId: 'task-1', setDragTaskId })} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(setDragTaskId).toHaveBeenCalledWith('');
  });

  it('renders placeholder when group has no tasks', () => {
    const groupedTasks = [{ id: 'todo', label: 'Todo', tasks: [] }];
    render(<TaskListView {...createBaseProps({ groupedTasks, allTasks: [] })} />);

    expect(screen.getByText('Brak zadań w tej sekcji.')).toBeInTheDocument();
  });
});
