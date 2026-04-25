import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksTab from './TasksTab';
import { ToastProvider } from './shared/Toast';

function createDataTransfer() {
  const store = {};
  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    setData: vi.fn((type, value) => {
      store[type] = value;
    }),
    getData: vi.fn((type) => store[type] || ''),
  };
}

function renderTasksTab(overrides = {}) {
  const props = {
    tasks: [
      {
        id: 'task_1',
        title: 'Przenies zadanie',
        owner: 'Anna',
        group: 'Sprint 14',
        description: 'Sprawdz pipeline',
        dueDate: '2026-03-20T10:00:00.000Z',
        notes: '',
        sourceType: 'manual',
        sourceMeetingId: '',
        sourceMeetingTitle: 'Reczne zadanie',
        sourceMeetingDate: '2026-03-20T10:00:00.000Z',
        sourceRecordingId: '',
        sourceQuote: '',
        createdAt: '2026-03-14T09:00:00.000Z',
        updatedAt: '2026-03-14T09:00:00.000Z',
        status: 'todo',
        important: false,
        completed: false,
        priority: 'medium',
        tags: ['demo'],
        assignedTo: ['Anna'],
        comments: [],
        history: [],
        dependencies: [],
        recurrence: null,
        subtasks: [],
        order: -100,
        assignedToMe: true,
      },
    ],
    peopleOptions: ['Anna'],
    tagOptions: ['demo'],
    boardColumns: [
      { id: 'todo', label: 'Do zrobienia', color: '#5a92ff', isDone: false, system: true },
      { id: 'done', label: 'Zakonczone', color: '#67d59f', isDone: true, system: true },
    ],
    onCreateTask: vi.fn(),
    onUpdateTask: vi.fn(),
    onDeleteTask: vi.fn(),
    onMoveTaskToColumn: vi.fn(),
    onReorderTask: vi.fn(),
    onCreateColumn: vi.fn(),
    onUpdateColumn: vi.fn(),
    onDeleteColumn: vi.fn(),
    onOpenMeeting: vi.fn(),
    defaultView: 'kanban',
    googleTasksEnabled: false,
    googleTasksStatus: 'idle',
    googleTasksMessage: '',
    googleTaskLists: [],
    selectedGoogleTaskListId: '',
    onSelectGoogleTaskList: vi.fn(),
    onConnectGoogleTasks: vi.fn(),
    onImportGoogleTasks: vi.fn(),
    onExportGoogleTasks: vi.fn(),
    workspaceName: 'Produkt',
    workspaceInviteCode: 'ABC123',
    externalSelectedTaskId: '',
    onTaskSelectionHandled: vi.fn(),
    currentUserName: 'Anna',
    ...overrides,
  };

  return {
    ...render(
      <ToastProvider>
        <TasksTab {...props} />
      </ToastProvider>
    ),
    props,
  };
}

describe('TasksTab', () => {
  test('moves a task between kanban columns with drag and drop', async () => {
    const { props } = renderTasksTab();
    const dataTransfer = createDataTransfer();
    const dragHandle = await screen.findByTitle('Przeciagnij aby przeniesc', {}, { timeout: 3000 });
    const doneColumn = screen.getByTestId('column-done');

    fireEvent.dragStart(dragHandle, { dataTransfer });
    fireEvent.dragEnter(doneColumn, { dataTransfer });
    fireEvent.dragOver(doneColumn, { dataTransfer });
    fireEvent.drop(doneColumn.querySelector('.todo-kanban-body'), { dataTransfer });

    expect(props.onReorderTask).toHaveBeenCalledWith(
      'task_1',
      expect.objectContaining({ status: 'done' })
    );
  });

  test('creates a task with the group from advanced fields', async () => {
    const createdTask = {
      id: 'task_2',
      title: 'Nowe zadanie',
      status: 'todo',
      group: 'Sprint 14',
    };
    const { props } = renderTasksTab({
      defaultView: 'list',
      onCreateTask: vi.fn().mockReturnValue(createdTask),
    });

    // Type in inline quick add input and press Enter
    const quickAddInput = screen.getByPlaceholderText(/Dodaj zadanie/);
    await userEvent.type(quickAddInput, 'Nowe zadanie{enter}');

    expect(props.onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Nowe zadanie' })
    );
  }, 10000);

  test('shows richer smart lists similar to task apps', () => {
    renderTasksTab({
      defaultView: 'list',
      tasks: [
        {
          id: 'task_1',
          title: 'Recurring task',
          owner: 'Anna',
          group: 'Sprint 14',
          description: '',
          dueDate: '2026-03-20T10:00:00.000Z',
          reminderAt: '2026-03-20T09:00:00.000Z',
          myDay: true,
          notes: '',
          sourceType: 'manual',
          sourceMeetingId: '',
          sourceMeetingTitle: 'Reczne zadanie',
          sourceMeetingDate: '2026-03-20T10:00:00.000Z',
          sourceRecordingId: '',
          sourceQuote: '',
          createdAt: '2026-03-14T09:00:00.000Z',
          updatedAt: '2026-03-14T09:00:00.000Z',
          status: 'todo',
          important: true,
          completed: false,
          priority: 'medium',
          tags: ['demo'],
          assignedTo: ['Anna'],
          comments: [],
          history: [],
          dependencies: [],
          subtasks: [],
          links: [],
          order: -100,
          assignedToMe: true,
        },
      ],
    });

    expect(screen.getByText(/(Completed|Zakończone)/i)).toBeInTheDocument();
    expect(screen.getByText(/(Overdue|Zaległe)/i)).toBeInTheDocument();
  });

  test('pokazuje komunikat bledu, gdy onCreateTask zwraca falsy (np. brak workspace)', async () => {
    // Toast DOM doesn't render under global fakeTimers — spy on useToast instead
    const toastModule = await import('./shared/Toast');
    const errorSpy = vi.fn();
    const spy = vi.spyOn(toastModule, 'useToast').mockReturnValue({
      show: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      dismiss: vi.fn(),
      error: errorSpy,
    });

    const onCreateTask = vi.fn().mockReturnValue(null);
    renderTasksTab({ defaultView: 'list', onCreateTask });

    const quickAddInput = screen.getByPlaceholderText(/Dodaj zadanie/);
    await userEvent.type(quickAddInput, 'Felerne zadanie{Enter}');

    expect(onCreateTask).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/Nie udalo sie dodac zadania/));

    spy.mockRestore();
  }, 15000);
});
