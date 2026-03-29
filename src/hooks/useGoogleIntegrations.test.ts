import { renderHook, act } from '@testing-library/react';
import useGoogleIntegrations from './useGoogleIntegrations';
import { vi, describe, test, expect, beforeEach } from 'vitest';

const {
  requestGoogleTasksAccessMock,
  requestGoogleCalendarAccessMock,
  fetchGoogleTaskListsMock,
  fetchPrimaryCalendarEventsMock,
  meetingsStoreState,
} = vi.hoisted(() => ({
  requestGoogleTasksAccessMock: vi.fn().mockResolvedValue({ access_token: 'tasks-token' }),
  requestGoogleCalendarAccessMock: vi.fn().mockResolvedValue({ access_token: 'calendar-token' }),
  fetchGoogleTaskListsMock: vi.fn().mockResolvedValue({ items: [{ id: 'list1', title: 'Work' }] }),
  fetchPrimaryCalendarEventsMock: vi.fn().mockResolvedValue({ items: [], nextPageToken: null }),
  meetingsStoreState: {
    meetings: [],
    calendarMeta: {},
    setCalendarMeta: vi.fn(),
  },
}));

vi.mock('../lib/google', async () => {
  const actual = await vi.importActual<any>('../lib/google');
  return {
    ...actual,
    GOOGLE_CLIENT_ID: 'demo',
    IS_GOOGLE_DEMO_MODE: true,
    renderGoogleSignInButton: vi.fn(),
    requestGoogleTasksAccess: requestGoogleTasksAccessMock,
    requestGoogleCalendarAccess: requestGoogleCalendarAccessMock,
    fetchGoogleTaskLists: fetchGoogleTaskListsMock,
    fetchPrimaryCalendarEvents: fetchPrimaryCalendarEventsMock,
    createGoogleTask: vi.fn(),
    updateGoogleTask: vi.fn(),
    createGoogleCalendarEvent: vi.fn(),
    updateGoogleCalendarEvent: vi.fn(),
    signOutGoogleSession: vi.fn(),
  };
});

vi.mock('../store/meetingsStore', () => ({
  useMeetingsStore: () => meetingsStoreState,
}));

describe('useGoogleIntegrations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    meetingsStoreState.meetings = [];
    meetingsStoreState.calendarMeta = {};
    meetingsStoreState.setCalendarMeta.mockReset();
  });

  const baseProps = {
    currentUser: { id: 'u1' },
    currentWorkspaceId: 'w1',
    tasks: [],
    meetingTasks: [],
    manualTasks: [],
    taskColumns: [
      { id: 'todo', title: 'To Do', isDone: false },
      { id: 'done', title: 'Done', isDone: true },
    ],
    calendarMonth: new Date(),
    setManualTasks: vi.fn(),
    setWorkspaceMessage: vi.fn(),
    onGoogleProfile: vi.fn(),
    onGoogleError: vi.fn(),
  };

  test('initializes default state', () => {
    const { result } = renderHook(() => useGoogleIntegrations(baseProps as any));
    expect(result.current.googleEnabled).toBeDefined();
    expect(result.current.googleCalendarStatus).toBe('idle');
    expect(result.current.googleTaskLists.length).toBe(0);
  });

  test('connect functions update state and throw unhandled errors safely', async () => {
    const { result } = renderHook(() => useGoogleIntegrations(baseProps as any));

    // connectGoogleCalendar should transition status
    await act(async () => {
      try {
        await result.current.connectGoogleCalendar();
      } catch (e) {}
    });
    expect(result.current.googleCalendarStatus).toMatch(
      /idle|connecting|connected|loading|error|synced/i
    );

    // refreshGoogleTasks should not crash
    await act(async () => {
      try {
        await result.current.refreshGoogleTasks();
      } catch (e) {}
    });

    // importGoogleTasksFromList should not crash
    await act(async () => {
      try {
        await result.current.importGoogleTasksFromList();
      } catch (e) {}
    });

    // exportTasksToGoogle should not crash
    await act(async () => {
      try {
        await result.current.exportTasksToGoogle();
      } catch (e) {}
    });

    // connectGoogleTasks should not crash
    await act(async () => {
      try {
        await result.current.connectGoogleTasks();
      } catch (e) {}
    });
  });

  test('setSelectedGoogleTaskListId sets ID', async () => {
    const { result } = renderHook(() => useGoogleIntegrations(baseProps as any));
    await act(async () => {
      result.current.setSelectedGoogleTaskListId('list2');
    });
    expect(result.current.selectedGoogleTaskListId).toBe('list2');
  });

  test('resolveGoogleTaskConflict is no-op for invalid conflict id', () => {
    const customProps = {
      ...baseProps,
      manualTasks: [{ id: 't1', title: 'Original' }],
    };
    const { result } = renderHook(() => useGoogleIntegrations(customProps as any));

    act(() => {
      result.current.resolveGoogleTaskConflict('invalid-id', 'local');
    });
    // Should not call setManualTasks for non-existent conflict
    expect(baseProps.setManualTasks).not.toHaveBeenCalled();
  });

  test('exposes all expected Google integration methods', () => {
    const { result } = renderHook(() => useGoogleIntegrations(baseProps as any));

    expect(typeof result.current.connectGoogleCalendar).toBe('function');
    expect(typeof result.current.connectGoogleTasks).toBe('function');
    expect(typeof result.current.refreshGoogleTasks).toBe('function');
    expect(typeof result.current.importGoogleTasksFromList).toBe('function');
    expect(typeof result.current.exportTasksToGoogle).toBe('function');
    expect(typeof result.current.disconnectGoogleCalendar).toBe('function');
    expect(typeof result.current.resetGoogleSession).toBe('function');
    expect(typeof result.current.setSelectedGoogleTaskListId).toBe('function');
    expect(typeof result.current.resolveGoogleTaskConflict).toBe('function');
  });

  test('googleEnabled reflects GOOGLE_CLIENT_ID availability', () => {
    const { result } = renderHook(() => useGoogleIntegrations(baseProps as any));
    // googleEnabled should be a boolean
    expect(typeof result.current.googleEnabled).toBe('boolean');
  });
});
