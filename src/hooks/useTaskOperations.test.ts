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
      { id: 't1', title: 'Task 1', status: 'c1', sourceType: 'manual' },
      { id: 't2', title: 'Task 2', status: 'c1', sourceType: 'auto' },
    ],
    setManualTasks: mockSetManualTasks,
    setTaskState: mockSetTaskState,
    setTaskBoards: mockSetTaskBoards,
  };

  test('createTaskFromComposer', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.createTaskFromComposer({ title: 'New Task' });
    });

    expect(mockSetManualTasks).toHaveBeenCalled();
  });

  test('updateTask manual', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.updateTask('t1', { title: 'Updated T1' });
    });

    expect(mockSetManualTasks).toHaveBeenCalled();
  });

  test('updateTask auto', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.updateTask('t2', { title: 'Updated T2' });
    });

    expect(mockSetTaskState).toHaveBeenCalled();
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

  test('bulkUpdateTasks', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.bulkUpdateTasks(['t1', 't2'], { completed: true });
    });

    expect(mockSetManualTasks).toHaveBeenCalled();
    expect(mockSetTaskState).toHaveBeenCalled();
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
    expect(mockSetTaskBoards).toHaveBeenCalledTimes(3);
  });

  test('deleteTask, bulkDeleteTasks', () => {
    const { result } = renderHook(() => useTaskOperations(baseProps));

    act(() => {
      result.current.deleteTask('t1');
    });
    expect(mockSetManualTasks).toHaveBeenCalled();

    act(() => {
      result.current.deleteTask('t2');
    });
    expect(mockSetTaskState).toHaveBeenCalled();

    act(() => {
      result.current.bulkDeleteTasks(['t1', 't2']);
    });
    // This will hit both mockSetManualTasks and mockSetTaskState again
  });
});
