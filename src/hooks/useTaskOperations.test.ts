import { renderHook, act } from '@testing-library/react';
import useTaskOperations from './useTaskOperations';

describe('useTaskOperations', () => {
  const mockSetManualTasks = vi.fn();
  const mockSetTaskState = vi.fn();
  const mockSetTaskBoards = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    currentUser: { id: 'u1', name: 'User' },
    currentWorkspaceId: 'w1',
    taskColumns: [
      { id: 'c1', label: 'To Do', isDone: false },
      { id: 'c2', label: 'Done', isDone: true },
    ],
    meetingTasks: [
      {
        id: 't1',
        title: 'Task 1',
        status: 'c1',
        sourceType: 'manual',
        history: [],
        completed: false,
        tags: [],
        assignedTo: [],
      },
      {
        id: 't2',
        title: 'Task 2',
        status: 'c1',
        sourceType: 'auto',
        history: [],
        completed: false,
        tags: [],
        assignedTo: [],
      },
    ],
    setManualTasks: mockSetManualTasks,
    setTaskState: mockSetTaskState,
    setTaskBoards: mockSetTaskBoards,
  };

  test('createTaskFromComposer prepends task to manual list', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    let created: any;
    act(() => {
      created = result.current.createTaskFromComposer({ title: 'New Task' });
    });

    expect(created).toEqual(expect.objectContaining({ title: 'New Task' }));
    expect(mockSetManualTasks).toHaveBeenCalledTimes(1);

    const updater = mockSetManualTasks.mock.calls[0][0];
    const next = updater([{ id: 'old', title: 'Old' }]);
    expect(next[0]).toEqual(expect.objectContaining({ title: 'New Task' }));
    expect(next[1]).toEqual({ id: 'old', title: 'Old' });
  });

  test('createTaskFromComposer returns null without user', () => {
    const { result } = renderHook(() => useTaskOperations({ ...baseProps, currentUser: null }));
    let created: any;
    act(() => {
      created = result.current.createTaskFromComposer({ title: 'No user' });
    });
    expect(created).toBeNull();
    expect(mockSetManualTasks).not.toHaveBeenCalled();
  });

  test('updateTask manual applies payload to matching task', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.updateTask('t1', { title: 'Updated T1' });
    });

    expect(mockSetManualTasks).toHaveBeenCalledTimes(1);
    const updater = mockSetManualTasks.mock.calls[0][0];
    const prev = [
      { id: 't1', title: 'Task 1', status: 'c1', sourceType: 'manual' },
      { id: 'other', title: 'Other' },
    ];
    const next = updater(prev);
    expect(next.find((t: any) => t.id === 't1').title).toBe('Updated T1');
    expect(next.find((t: any) => t.id === 'other').title).toBe('Other');
  });

  test('updateTask auto merges payload into taskState', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.updateTask('t2', { title: 'Updated T2' });
    });

    expect(mockSetTaskState).toHaveBeenCalledTimes(1);
    const updater = mockSetTaskState.mock.calls[0][0];
    const next = updater({});
    expect(next.t2.title).toBe('Updated T2');
  });

  test('moveTaskToColumn, rescheduleTask, reorderTask', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.moveTaskToColumn('t1', 'c2');
    });
    expect(mockSetManualTasks).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.rescheduleTask('t1', '2026-04-01T00:00:00Z');
    });
    expect(mockSetManualTasks).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.reorderTask('t2', { status: 'c1' });
    });
    expect(mockSetTaskState).toHaveBeenCalledTimes(1);
  });

  test('bulkUpdateTasks invokes correct updaters with payload', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.bulkUpdateTasks(['t1', 't2'], { completed: true });
    });

    expect(mockSetManualTasks).toHaveBeenCalled();
    const manualUpdater = mockSetManualTasks.mock.calls[0][0];
    const manualNext = manualUpdater([{ id: 't1', title: 'Task 1', sourceType: 'manual' }]);
    expect(manualNext.find((t: any) => t.id === 't1').completed).toBe(true);

    expect(mockSetTaskState).toHaveBeenCalled();
    const stateUpdater = mockSetTaskState.mock.calls[0][0];
    const stateNext = stateUpdater({});
    expect(stateNext.t2.completed).toBe(true);
  });

  test('completing the same recurring task twice creates one follow-up', () => {
    const recurringTask = {
      id: 'recurring-source',
      title: 'Recurring check-in',
      dueDate: '2026-03-01T00:00:00.000Z',
      recurrence: { frequency: 'daily', interval: 1 },
      status: 'c1',
      sourceType: 'manual',
      history: [],
      completed: false,
      tags: [],
      assignedTo: [],
    };
    const { result } = renderHook(() =>
      useTaskOperations({ ...baseProps, meetingTasks: [recurringTask] })
    );

    act(() => {
      result.current.updateTask('recurring-source', { completed: true });
      result.current.updateTask('recurring-source', { completed: true });
    });

    const firstUpdater = mockSetManualTasks.mock.calls[0][0];
    const secondUpdater = mockSetManualTasks.mock.calls[1][0];
    const firstNext = firstUpdater([recurringTask]);
    const secondNext = secondUpdater(firstNext);
    const generated = secondNext.filter(
      (task: any) => task.id !== 'recurring-source' && task.dueDate === '2026-03-02T00:00:00.000Z'
    );

    expect(generated).toHaveLength(1);
  });

  test('bulk completing recurring tasks creates one follow-up per source task', () => {
    const recurringTasks = [
      {
        id: 'recurring-source-1',
        title: 'Daily one',
        dueDate: '2026-03-01T00:00:00.000Z',
        recurrence: { frequency: 'daily', interval: 1 },
        status: 'c1',
        sourceType: 'manual',
        history: [],
        completed: false,
        tags: [],
        assignedTo: [],
      },
      {
        id: 'recurring-source-2',
        title: 'Daily two',
        dueDate: '2026-03-01T00:00:00.000Z',
        recurrence: { frequency: 'daily', interval: 1 },
        status: 'c1',
        sourceType: 'manual',
        history: [],
        completed: false,
        tags: [],
        assignedTo: [],
      },
    ];
    const { result } = renderHook(() =>
      useTaskOperations({ ...baseProps, meetingTasks: recurringTasks })
    );

    act(() => {
      result.current.bulkUpdateTasks(['recurring-source-1', 'recurring-source-2'], {
        completed: true,
      });
    });

    const updater = mockSetManualTasks.mock.calls[0][0];
    const next = updater(recurringTasks);
    const generated = next.filter(
      (task: any) =>
        !task.id.startsWith('recurring-source-') && task.dueDate === '2026-03-02T00:00:00.000Z'
    );

    expect(generated).toHaveLength(2);
    expect(new Set(generated.map((task: any) => task.recurrenceGeneratedFromTaskId))).toEqual(
      new Set(['recurring-source-1', 'recurring-source-2'])
    );
  });

  test('sync retry skips an already generated recurring occurrence', () => {
    const recurringTask = {
      id: 'recurring-source',
      title: 'Retry-safe recurring task',
      dueDate: '2026-03-01T00:00:00.000Z',
      recurrence: { frequency: 'daily', interval: 1 },
      status: 'c1',
      sourceType: 'manual',
      history: [],
      completed: false,
      tags: [],
      assignedTo: [],
    };
    const existingOccurrence = {
      id: 'existing-occurrence',
      title: recurringTask.title,
      dueDate: '2026-03-02T00:00:00.000Z',
      recurrence: recurringTask.recurrence,
      recurrenceParentId: 'recurring-source',
      recurrenceGeneratedFromTaskId: 'recurring-source',
      recurrenceOccurrenceDate: '2026-03-02T00:00:00.000Z',
      status: 'c1',
      sourceType: 'manual',
      completed: false,
    };
    const { result } = renderHook(() =>
      useTaskOperations({ ...baseProps, meetingTasks: [recurringTask, existingOccurrence] })
    );

    act(() => {
      result.current.updateTask('recurring-source', { completed: true });
    });

    const updater = mockSetManualTasks.mock.calls[0][0];
    const next = updater([existingOccurrence, recurringTask]);
    const generated = next.filter(
      (task: any) =>
        task.id !== 'recurring-source' &&
        task.title === recurringTask.title &&
        task.dueDate === '2026-03-02T00:00:00.000Z'
    );

    expect(generated).toHaveLength(1);
  });

  test('addTaskColumn, changeTaskColumn, removeTaskColumn', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.addTaskColumn({ label: 'New Column' });
    });
    expect(mockSetTaskBoards).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.changeTaskColumn('c1', { label: 'To Do New' });
    });
    expect(mockSetTaskBoards).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.removeTaskColumn('c1');
    });
    // removeTaskColumn calls updateTask on affected tasks + setTaskBoards
    expect(mockSetTaskBoards).toHaveBeenCalledTimes(3);
  });

  test('deleteTask manual filters out from array', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.deleteTask('t1');
    });

    expect(mockSetManualTasks).toHaveBeenCalledTimes(1);
    const updater = mockSetManualTasks.mock.calls[0][0];
    const prev = [{ id: 't1' }, { id: 't3' }];
    const next = updater(prev);
    expect(next).toEqual([{ id: 't3' }]);
  });

  test('deleteTask auto archives via taskState', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.deleteTask('t2');
    });

    expect(mockSetTaskState).toHaveBeenCalledTimes(1);
    const updater = mockSetTaskState.mock.calls[0][0];
    const next = updater({});
    expect(next.t2.archived).toBe(true);
    expect(next.t2.updatedAt).toBeDefined();
  });

  test('bulkDeleteTasks calls deleteTask for each unique id', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.bulkDeleteTasks(['t1', 't2']);
    });

    // t1 is manual → setManualTasks, t2 is auto → setTaskState
    expect(mockSetManualTasks).toHaveBeenCalled();
    expect(mockSetTaskState).toHaveBeenCalled();

    const manualUpdater = mockSetManualTasks.mock.calls[0][0];
    expect(manualUpdater([{ id: 't1' }, { id: 'x' }])).toEqual([{ id: 'x' }]);

    const stateUpdater = mockSetTaskState.mock.calls[0][0];
    expect(stateUpdater({}).t2.archived).toBe(true);
  });

  test('removeTaskColumn reassigns tasks to fallback column', () => {
    const propsWithTasksInColumn = {
      ...baseProps,
      meetingTasks: [
        {
          id: 't1',
          title: 'In c1',
          status: 'c1',
          sourceType: 'manual',
          history: [],
          completed: false,
          tags: [],
          assignedTo: [],
        },
      ],
      taskColumns: [
        { id: 'c1', label: 'To Do', isDone: false },
        { id: 'c2', label: 'Done', isDone: true },
        { id: 'c3', label: 'In Progress', isDone: false },
      ],
    };
    const { result } = renderHook(() => useTaskOperations(propsWithTasksInColumn));

    act(() => {
      result.current.removeTaskColumn('c1');
    });

    // First call: updateTask for the task in c1 (moves to fallback c3, a non-done column)
    // Last call: setTaskBoards to remove column
    expect(mockSetManualTasks).toHaveBeenCalled();
    const updater = mockSetManualTasks.mock.calls[0][0];
    const next = updater([{ id: 't1', title: 'In c1', status: 'c1' }]);
    const movedTask = next.find((t: any) => t.id === 't1');
    expect(movedTask.status).toBe('c3');

    expect(mockSetTaskBoards).toHaveBeenCalled();
  });
});
