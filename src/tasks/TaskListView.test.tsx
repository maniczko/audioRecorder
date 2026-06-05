import { render, screen, fireEvent } from '@testing-library/react';
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
          assignedTo: ['Ala'],
          reminderAt: '',
          tags: [],
          order: 0,
        },
      ],
    },
  ];

  return {
    groupedTasks,
    allTasks: groupedTasks[0].tasks,
    groupBy: 'status',
    sortBy: 'manual',
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
  it('renders group, controls and task row', () => {
    render(<TaskListView {...createBaseProps()} />);

    expect(
      screen.getByText((content, node) => node?.tagName === 'STRONG' && content === 'Todo')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tytul i osoby/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Termin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zakoncz zadanie Alpha task/i })).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /Zakoncz zadanie Alpha task/i }));
    expect(onUpdateTask).toHaveBeenCalledWith('task-1', { completed: true });
  });

  it('toggles my day and important flags', () => {
    const onUpdateTask = vi.fn();
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
            important: false,
            assignedTo: ['Ala'],
            reminderAt: '',
            tags: [],
            order: 0,
          },
        ],
      },
    ];

    render(
      <TaskListView
        {...createBaseProps({ onUpdateTask, groupedTasks, allTasks: groupedTasks[0].tasks })}
      />
    );

    fireEvent.click(screen.getByTitle('Dodaj do My Day'));
    expect(onUpdateTask).toHaveBeenCalledWith('task-1', { myDay: true });

    fireEvent.click(screen.getByTitle('Oznacz jako wazne'));
    expect(onUpdateTask).toHaveBeenCalledWith('task-1', { important: true });
  });

  it('reorders sorting mode when header is clicked', () => {
    const setSortBy = vi.fn();
    render(<TaskListView {...createBaseProps({ sortBy: 'title', setSortBy })} />);

    fireEvent.click(screen.getByRole('button', { name: /Tytul i osoby/i }));
    expect(setSortBy).toHaveBeenCalledWith('owner');
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

    expect(screen.getByText('Brak zadan w tej sekcji.')).toBeInTheDocument();
  });
});
