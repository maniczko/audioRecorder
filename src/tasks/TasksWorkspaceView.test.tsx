import { render, screen, fireEvent } from '@testing-library/react';
import { RefObject } from 'react';
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
    sortBy: 'manual',
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

describe('TasksWorkspaceView', () => {
  it('renders view mode controls and forwards mode changes', () => {
    const setViewMode = vi.fn();
    render(<TasksWorkspaceView {...createBaseProps({ viewMode: 'kanban', setViewMode })} />);

    fireEvent.click(screen.getByRole('button', { name: /Lista/i }));
    expect(setViewMode).toHaveBeenCalledWith('list');

    fireEvent.click(screen.getByRole('button', { name: /Harmonogram/i }));
    expect(setViewMode).toHaveBeenCalledWith('schedule');
  });

  it('filters by query and updates quick draft on type', () => {
    const setQuery = vi.fn();
    const setQuickDraft = vi.fn();
    const submitQuickTask = vi.fn();
    render(
      <TasksWorkspaceView
        {...createBaseProps({
          viewMode: 'list',
          setQuery,
          setQuickDraft,
          submitQuickTask,
          allVisibleTasks: [
            {
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
            },
          ],
          groupedTasks: [{ id: 'todo', label: 'Todo', tasks: [] }],
        })}
      />
    );

    const search = screen.getByPlaceholderText('Szukaj w zadaniach...');
    fireEvent.change(search, { target: { value: 'test' } });
    expect(setQuery).toHaveBeenCalledWith('test');

    const quickInput = screen.getByPlaceholderText('Dodaj zadanie (N)...') as HTMLInputElement;
    fireEvent.change(quickInput, { target: { value: 'Nowe zadanie' } });
    fireEvent.keyDown(quickInput, { key: 'Enter' });
    expect(setQuickDraft).toHaveBeenCalledWith(expect.any(Function));
    expect(submitQuickTask).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ title: 'Nowe zadanie' })
    );
  });

  it('passes the live quick-add input value when the toolbar plus is clicked', () => {
    const submitQuickTask = vi.fn();
    render(
      <TasksWorkspaceView
        {...createBaseProps({
          viewMode: 'list',
          submitQuickTask,
          allVisibleTasks: [
            {
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
            },
          ],
          groupedTasks: [{ id: 'todo', label: 'Todo', tasks: [] }],
        })}
      />
    );

    const quickInput = screen.getByPlaceholderText('Dodaj zadanie (N)...') as HTMLInputElement;
    fireEvent.change(quickInput, { target: { value: 'Zadanie z plusa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj zadanie' }));

    expect(submitQuickTask).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ title: 'Zadanie z plusa' })
    );
  });

  it('renders a single quick-add control with one accessible plus action', () => {
    const { container } = render(
      <TasksWorkspaceView
        {...createBaseProps({
          viewMode: 'list',
          allVisibleTasks: [
            {
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
            },
          ],
        })}
      />
    );

    const quickAdd = container.querySelector('.todo-toolbar-quickadd');
    expect(quickAdd).toBeTruthy();
    expect(quickAdd?.querySelectorAll('input')).toHaveLength(1);
    expect(quickAdd?.querySelectorAll('button[aria-label="Dodaj zadanie"]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Ustawienia widoku' })).toBeInTheDocument();
  });

  it('renders summary mode stats cards', () => {
    render(<TasksWorkspaceView {...createBaseProps({ viewMode: 'summary' })} />);

    expect(screen.getByText('Otwarte')).toBeInTheDocument();
    expect(screen.getByText('Na dzisiaj')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Szukaj w zadaniach...')).not.toBeInTheDocument();
  });

  it('renders advanced create form when enabled', () => {
    render(
      <TasksWorkspaceView {...createBaseProps({ viewMode: 'list', showAdvancedCreate: true })} />
    );
    expect(screen.getByTestId('task-create-form')).toBeInTheDocument();
  });

  it('opens settings menu and triggers list actions', () => {
    const onExportCsv = vi.fn();
    const shareWorkspace = vi.fn();
    const setShowColumnManager = vi.fn();
    render(
      <TasksWorkspaceView
        {...createBaseProps({
          onExportCsv,
          shareWorkspace,
          setShowColumnManager,
          showColumnManager: false,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia widoku' }));
    fireEvent.click(screen.getByText(/Eksport CSV/i));
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia widoku' }));
    fireEvent.click(screen.getByText(/Udostepnij workspace/i));
    fireEvent.click(screen.getByRole('button', { name: 'Ustawienia widoku' }));
    fireEvent.click(screen.getByText(/Konfiguracja kolumn/i));

    expect(onExportCsv).toHaveBeenCalled();
    expect(shareWorkspace).toHaveBeenCalled();
    expect(setShowColumnManager).toHaveBeenCalledWith(expect.any(Function));
  });

  it('renders schedule view and list view panels', () => {
    const tasks = [
      {
        id: 'task-1',
        title: 'Plan',
        owner: '',
        status: 'todo',
        completed: false,
        tags: [],
        dueDate: '',
        important: false,
        reminderAt: '',
        myDay: false,
      },
    ];

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
