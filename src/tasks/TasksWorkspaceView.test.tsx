import { render, screen, fireEvent } from '@testing-library/react';
import { RefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TasksWorkspaceView from './TasksWorkspaceView';

vi.mock('./TaskKanbanView', () => ({
  default: () => <div data-testid="task-kanban-view" />,
}));

vi.mock('./TaskListView', () => ({
  default: () => <div data-testid="task-list-view" />,
}));

vi.mock('./TaskScheduleView', () => ({
  default: () => <div data-testid="task-schedule-view" />,
}));

vi.mock('./TaskChartsView', () => ({
  default: () => <div data-testid="task-charts-view" />,
}));

vi.mock('./TaskCreateForm', () => ({
  default: () => <div data-testid="task-create-form" />,
}));

vi.mock('./TaskCreateModal', () => ({
  default: ({ isOpen, onClose, onSubmit }: any) =>
    isOpen ? (
      <div role="dialog" aria-label="Nowe zadanie" data-testid="task-create-modal">
        <button type="button" onClick={onClose}>
          Anuluj
        </button>
        <button
          type="button"
          onClick={() =>
            onSubmit({
              title: 'Nowe zadanie z modala',
              owner: '',
              assignedTo: [],
              group: '',
              priority: 'medium',
              status: 'todo',
              dueDate: '',
              reminderAt: '',
              tags: '',
              important: false,
              description: '',
              notes: '',
            })
          }
        >
          Zapisz
        </button>
      </div>
    ) : null,
}));

function createBaseProps(overrides: Record<string, any> = {}) {
  const boardColumns = [{ id: 'todo', label: 'Todo', color: '#000', isDone: false, system: true }];
  const stats = {
    open: 0,
    dueToday: 0,
    dueThisWeek: 0,
    overdue: 0,
    blocked: 0,
    progress: 50,
  };
  const visibleStats = { open: 1, dueToday: 0, dueThisWeek: 0, overdue: 0, blocked: 0 };
  const quickDraft = {
    title: '',
    owner: '',
    group: '',
    dueDate: '',
    reminderAt: '',
    description: '',
    status: 'todo',
    important: false,
    myDay: false,
    priority: 'medium',
    tags: '',
    notes: '',
  };

  return {
    selectedListLabel: 'Todo',
    viewMode: 'kanban',
    setViewMode: vi.fn(),
    sortBy: 'due:asc',
    setSortBy: vi.fn(),
    groupBy: 'none',
    setGroupBy: vi.fn(),
    shareWorkspace: vi.fn(),
    onExportCsv: vi.fn(),
    submitQuickTask: vi.fn(),
    quickDraft,
    setQuickDraft: vi.fn(),
    showAdvancedCreate: false,
    setShowAdvancedCreate: vi.fn(),
    peopleOptions: [],
    taskGroups: ['Group A'],
    boardColumns,
    query: '',
    setQuery: vi.fn(),
    ownerFilter: 'all',
    setOwnerFilter: vi.fn(),
    tagFilter: 'all',
    setTagFilter: vi.fn(),
    currentUserName: 'Alice',
    tagOptions: [],
    quickAddInputRef: { current: null } as RefObject<HTMLInputElement>,
    searchInputRef: { current: null } as RefObject<HTMLInputElement>,
    groupedTasks: [{ id: 'g1', label: 'Todo', tasks: [] }],
    allVisibleTasks: [],
    selectedTask: null,
    setSelectedTaskId: vi.fn(),
    onUpdateTask: vi.fn(),
    onMoveTaskToColumn: vi.fn(),
    kanbanColumns: [],
    dropColumnId: '',
    setDropColumnId: vi.fn(),
    handleDrop: vi.fn(),
    handleGroupDrop: vi.fn(),
    handleTaskDrop: vi.fn(),
    setDragTaskId: vi.fn(),
    dragTaskId: '',
    onQuickAddToColumn: vi.fn(),
    onReorderColumns: vi.fn(),
    stats,
    visibleStats,
    selectedTaskIds: [],
    toggleTaskSelection: vi.fn(),
    taskNotifications: [],
    showColumnManager: false,
    setShowColumnManager: vi.fn(),
    ...overrides,
  };
}

function visibleTask() {
  return {
    id: 'task-1',
    title: 'Alpha',
    status: 'todo',
    completed: false,
    owner: '',
    tags: [],
    dueDate: '',
    important: false,
    reminderAt: '',
    myDay: false,
  };
}

describe('TasksWorkspaceView', () => {
  it('renders view mode tabs and forwards mode changes', () => {
    const setViewMode = vi.fn();
    render(<TasksWorkspaceView {...createBaseProps({ viewMode: 'kanban', setViewMode })} />);

    fireEvent.click(screen.getByRole('tab', { name: /Lista/i }));
    expect(setViewMode).toHaveBeenCalledWith('list');

    fireEvent.click(screen.getByRole('tab', { name: /Harmonogram/i }));
    expect(setViewMode).toHaveBeenCalledWith('schedule');
    expect(screen.getByRole('heading', { name: 'Zadania' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filtry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kolumny/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sortuj/i })).not.toBeInTheDocument();
  });

  it('filters by query and keeps one add-task control', () => {
    const setQuery = vi.fn();
    const setShowAdvancedCreate = vi.fn();
    render(
      <TasksWorkspaceView
        {...createBaseProps({
          viewMode: 'list',
          setQuery,
          setShowAdvancedCreate,
          allVisibleTasks: [visibleTask()],
          groupedTasks: [{ id: 'todo', label: 'Todo', tasks: [] }],
        })}
      />
    );

    const search = screen.getByPlaceholderText('Szukaj zadań...');
    fireEvent.change(search, { target: { value: 'test' } });
    expect(setQuery).toHaveBeenCalledWith('test');

    const addButtons = screen.getAllByRole('button', { name: /Dodaj zadanie/i });
    expect(addButtons).toHaveLength(1);
    fireEvent.click(addButtons[0]);
    expect(setShowAdvancedCreate).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Ustawienia widoku' })).not.toBeInTheDocument();
  });

  it('renders summary mode stats cards', () => {
    render(<TasksWorkspaceView {...createBaseProps({ viewMode: 'summary' })} />);

    expect(screen.getByText('Otwarte')).toBeInTheDocument();
    expect(screen.getByText('Na dzisiaj')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Szukaj zadań...')).not.toBeInTheDocument();
  });

  it('renders create task modal when enabled instead of inline form', () => {
    render(
      <TasksWorkspaceView {...createBaseProps({ viewMode: 'list', showAdvancedCreate: true })} />
    );
    expect(screen.getByRole('dialog', { name: 'Nowe zadanie' })).toBeInTheDocument();
    expect(screen.queryByTestId('task-create-form')).not.toBeInTheDocument();
  });

  it('does not duplicate advanced create form when parent renders it in the aside', () => {
    render(
      <TasksWorkspaceView
        {...createBaseProps({
          viewMode: 'list',
          showAdvancedCreate: true,
          createPlacement: 'aside',
        })}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Nowe zadanie' })).toBeInTheDocument();
    expect(screen.queryByTestId('task-create-form')).not.toBeInTheDocument();
    expect(screen.getByText('Brak zadań na dziś')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Utwórz z nagrania/i })).toBeInTheDocument();
  });

  it('opens create modal from empty state and submits through the modal', () => {
    const submitQuickTask = vi.fn();
    render(
      <TasksWorkspaceView
        {...createBaseProps({
          viewMode: 'list',
          submitQuickTask,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /\+ Dodaj zadanie/i }));
    expect(screen.getByRole('dialog', { name: 'Nowe zadanie' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));
    expect(submitQuickTask).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ title: 'Nowe zadanie z modala' })
    );
  });

  it('renders schedule view and list view panels', () => {
    const tasks = [visibleTask()];

    const { rerender } = render(
      <TasksWorkspaceView {...createBaseProps({ viewMode: 'list', allVisibleTasks: tasks })} />
    );
    expect(screen.getByTestId('task-list-view')).toBeInTheDocument();

    rerender(
      <TasksWorkspaceView {...createBaseProps({ viewMode: 'schedule', allVisibleTasks: tasks })} />
    );
    expect(screen.getByTestId('task-schedule-view')).toBeInTheDocument();
  });
});
