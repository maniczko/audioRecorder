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
          description: 'Opracowac liste uzgodnionych celow oraz kolejnych krokow.',
          dueDate: '2026-01-01T10:00:00Z',
          myDay: false,
          important: true,
          priority: 'high',
          assignedTo: ['Ala'],
          sourceType: 'meeting',
          sourceMeetingId: 'meeting-1',
          aiConfidence: 0.92,
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
    allVisibleSelected: false,
    someVisibleSelected: false,
    onToggleAllVisibleTasks: vi.fn(),
    onBulkStatusChange: vi.fn(),
    onBulkAssignToMe: vi.fn(),
    onBulkDelete: vi.fn(),
    ...overrides,
  };
}

describe('TaskListView', () => {
  it('renders Microsoft To Do style columns and task row without the onboarding banner', () => {
    render(<TaskListView {...createBaseProps()} />);

    expect(
      screen.getByText((content, node) => node?.tagName === 'STRONG' && content === 'Todo')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Sortuj po kolumnie Zadanie/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Status/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Priorytet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sortuj po kolumnie Osoba/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Sortuj po kolumnie Źródło/i })).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('Akcje')).toBeInTheDocument();
    expect(screen.getByText('1 sty 2026')).toBeInTheDocument();
    expect(screen.getByText('Wysoki')).toBeInTheDocument();
    expect(screen.getByText('Spotkanie')).toBeInTheDocument();
    expect(screen.getByText('AI 92%')).toBeInTheDocument();
    expect(screen.getByText('1 zadanie')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Więcej akcji dla zadania Alpha task/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Wskazówka')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dowiedz się więcej/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Akcje zaznaczonych zadań')).not.toBeInTheDocument();
  });

  it('keeps row tools and task title in separate layout cells', () => {
    const { container } = render(<TaskListView {...createBaseProps()} />);

    const row = container.querySelector('.todo-table-row');
    const tools = row?.querySelector('.todo-row-tools');
    const title = row?.querySelector('.todo-title-cell');
    const checkbox = tools?.querySelector('.todo-row-checkbox');

    expect(row).toBeTruthy();
    expect(tools).toBeTruthy();
    expect(title).toBeTruthy();
    expect(checkbox).toBeTruthy();
    expect(Array.from(row?.children || [])).toEqual(
      expect.arrayContaining([tools as Element, title as Element])
    );
    expect(title?.contains(checkbox as Element)).toBe(false);
  });

  it('selects task row on click', () => {
    const setSelectedTaskId = vi.fn();
    const { container } = render(<TaskListView {...createBaseProps({ setSelectedTaskId })} />);

    const taskRow = container.querySelector('.todo-table-row');
    expect(taskRow).toBeTruthy();
    fireEvent.click(taskRow as Element);
    expect(setSelectedTaskId).toHaveBeenCalledWith('task-1');
  });

  it('selects a row from the checkbox without opening task preview', () => {
    const toggleTaskSelection = vi.fn();
    const setSelectedTaskId = vi.fn();
    render(<TaskListView {...createBaseProps({ toggleTaskSelection, setSelectedTaskId })} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Zaznacz zadanie: Alpha task/i }));

    expect(toggleTaskSelection).toHaveBeenCalledWith('task-1');
    expect(setSelectedTaskId).not.toHaveBeenCalled();
  });

  it('marks partially selected visible tasks with an indeterminate select-all checkbox', () => {
    const onToggleAllVisibleTasks = vi.fn();
    render(
      <TaskListView
        {...createBaseProps({
          selectedTaskIds: ['task-1'],
          someVisibleSelected: true,
          allVisibleSelected: false,
          onToggleAllVisibleTasks,
        })}
      />
    );

    const checkbox = screen.getByRole('checkbox', {
      name: /Zaznacz wszystkie widoczne zadania/i,
    }) as HTMLInputElement;

    expect(checkbox.indeterminate).toBe(true);
    fireEvent.click(checkbox);
    expect(onToggleAllVisibleTasks).toHaveBeenCalledWith(true);
  });

  it('renders selected-row state and bulk actions for selected tasks', () => {
    const onBulkStatusChange = vi.fn();
    const onBulkAssignToMe = vi.fn();
    const onBulkDelete = vi.fn();
    const { container } = render(
      <TaskListView
        {...createBaseProps({
          selectedTaskIds: ['task-1'],
          allVisibleSelected: true,
          onBulkStatusChange,
          onBulkAssignToMe,
          onBulkDelete,
        })}
      />
    );

    expect(container.querySelector('.todo-table-row')?.getAttribute('data-selected')).toBe('true');
    expect(screen.getByText('1 wybranych')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Zmień status zaznaczonych zadań'), {
      target: { value: 'todo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Przypisz/i }));
    fireEvent.click(screen.getByRole('button', { name: /Usuń zaznaczone zadania/i }));

    expect(onBulkStatusChange).toHaveBeenCalledWith('todo');
    expect(onBulkAssignToMe).toHaveBeenCalled();
    expect(onBulkDelete).toHaveBeenCalled();
  });

  it('uses Nieprzypisane instead of raw speaker labels for assignees', () => {
    const groupedTasks = [
      {
        id: 'todo',
        label: 'Todo',
        tasks: [
          {
            ...createBaseProps().groupedTasks[0].tasks[0],
            id: 'task-speaker',
            title: 'Speaker task',
            owner: 'Speaker 1',
            assignedTo: ['Speaker 1'],
          },
        ],
      },
    ];

    render(
      <TaskListView {...createBaseProps({ groupedTasks, allTasks: groupedTasks[0].tasks })} />
    );

    expect(screen.getByText('Nieprzypisane')).toBeInTheDocument();
    expect(screen.queryByText('Speaker 1')).not.toBeInTheDocument();
  });

  it('opens row actions and toggles completion from the menu', () => {
    const onUpdateTask = vi.fn();
    render(<TaskListView {...createBaseProps({ onUpdateTask })} />);

    fireEvent.click(screen.getByRole('button', { name: /Więcej akcji dla zadania Alpha task/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Oznacz jako gotowe/i }));
    expect(onUpdateTask).toHaveBeenCalledWith('task-1', { completed: true });
  });

  it('opens task details from the row actions menu', () => {
    const setSelectedTaskId = vi.fn();
    render(<TaskListView {...createBaseProps({ setSelectedTaskId })} />);

    fireEvent.click(screen.getByRole('button', { name: /Więcej akcji dla zadania Alpha task/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Otwórz szczegóły/i }));
    expect(setSelectedTaskId).toHaveBeenCalledWith('task-1');
  });

  it('sorts from table headers with accessible state', () => {
    const setSortBy = vi.fn();
    render(<TaskListView {...createBaseProps({ sortBy: 'due:asc', setSortBy })} />);

    expect(screen.getByRole('columnheader', { name: /Termin/i })).toHaveAttribute(
      'aria-sort',
      'ascending'
    );
    expect(screen.getByRole('button', { name: /^Sortuj po kolumnie Termin/i })).toHaveTextContent(
      '↑'
    );

    fireEvent.click(screen.getByRole('button', { name: /^Sortuj po kolumnie Termin/i }));
    expect(setSortBy).toHaveBeenCalledWith('due:desc');
  });

  it('cycles a table sort header back to the default due sort', () => {
    const setSortBy = vi.fn();
    render(<TaskListView {...createBaseProps({ sortBy: 'title:desc', setSortBy })} />);

    fireEvent.click(screen.getByRole('button', { name: /^Sortuj po kolumnie Zadanie/i }));
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
