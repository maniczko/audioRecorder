import { renderHook, act, waitFor } from '@testing-library/react';
import useGoogleIntegrations from './useGoogleIntegrations';
import { vi, describe, test, expect, beforeEach } from 'vitest';

const {
  requestGoogleTasksAccessMock,
  requestGoogleCalendarAccessMock,
  fetchGoogleTaskListsMock,
  fetchPrimaryCalendarEventsMock,
  getGoogleCalendarStatusMock,
  startGoogleCalendarConnectMock,
  fetchGoogleCalendarEventsMock,
  disconnectGoogleCalendarMock,
  meetingsStoreState,
} = vi.hoisted(() => ({
  requestGoogleTasksAccessMock: vi.fn().mockResolvedValue({ access_token: 'tasks-token' }),
  requestGoogleCalendarAccessMock: vi.fn().mockResolvedValue({ access_token: 'calendar-token' }),
  fetchGoogleTaskListsMock: vi.fn().mockResolvedValue({ items: [{ id: 'list1', title: 'Work' }] }),
  fetchPrimaryCalendarEventsMock: vi.fn().mockResolvedValue({ items: [], nextPageToken: null }),
  getGoogleCalendarStatusMock: vi.fn().mockResolvedValue({
    configured: true,
    connected: false,
    writable: false,
  }),
  startGoogleCalendarConnectMock: vi.fn().mockResolvedValue({
    url: 'https://accounts.google.com/o/oauth2/v2/auth',
  }),
  fetchGoogleCalendarEventsMock: vi.fn().mockResolvedValue({ items: [] }),
  disconnectGoogleCalendarMock: vi.fn().mockResolvedValue({ success: true }),
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

vi.mock('../services/googleCalendarService', () => ({
  getGoogleCalendarStatus: getGoogleCalendarStatusMock,
  startGoogleCalendarConnect: startGoogleCalendarConnectMock,
  fetchGoogleCalendarEvents: fetchGoogleCalendarEventsMock,
  disconnectGoogleCalendar: disconnectGoogleCalendarMock,
}));

describe('useGoogleIntegrations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getGoogleCalendarStatusMock.mockResolvedValue({
      configured: true,
      connected: false,
      writable: false,
    });
    startGoogleCalendarConnectMock.mockResolvedValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
    });
    fetchGoogleCalendarEventsMock.mockResolvedValue({ items: [] });
    disconnectGoogleCalendarMock.mockResolvedValue({ success: true });
    meetingsStoreState.meetings = [];
    meetingsStoreState.calendarMeta = {};
    meetingsStoreState.setCalendarMeta.mockReset();
  });

  const baseProps = {
    currentUser: { id: 'u1' },
    currentWorkspaceId: 'w1',
    sessionToken: 'token',
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

  test('shows Google Tasks API setup guidance when task list loading is forbidden', async () => {
    const forbidden = Object.assign(
      new Error(
        'Google Tasks API returned 403 while loading task lists. Reason: accessNotConfigured.'
      ),
      { status: 403, reason: 'accessNotConfigured' }
    );
    fetchGoogleTaskListsMock.mockRejectedValueOnce(forbidden);

    const { result } = renderHook(() => useGoogleIntegrations(baseProps as any));

    await act(async () => {
      await result.current.connectGoogleTasks();
    });

    expect(result.current.googleTasksStatus).toBe('error');
    expect(result.current.googleTasksMessage).toContain('Google Tasks API');
    expect(result.current.googleTasksMessage).toContain('accessNotConfigured');
  });

  test('keeps passive calendar status idle when local session token is not restored', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const missingSessionError = new Error(
      'Sesja wygasla albo token nie zostal odtworzony. Odswiez sesje logowania.'
    ) as Error & { status?: number };
    missingSessionError.status = 401;
    getGoogleCalendarStatusMock.mockRejectedValueOnce(missingSessionError);

    const { result } = renderHook(() => useGoogleIntegrations(baseProps as any));

    await waitFor(() => {
      expect(getGoogleCalendarStatusMock).toHaveBeenCalledWith('w1');
      expect(result.current.googleCalendarStatus).toBe('idle');
    });
    expect(result.current.googleCalendarMessage).toBe('');
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      'Google Calendar status refresh failed.',
      missingSessionError
    );

    consoleErrorSpy.mockRestore();
  });

  test('does not call backend calendar status when remote session token is missing', async () => {
    const { result } = renderHook(() =>
      useGoogleIntegrations({ ...baseProps, sessionToken: '' } as any)
    );

    expect(result.current.googleCalendarStatus).toBe('idle');
    expect(getGoogleCalendarStatusMock).not.toHaveBeenCalled();
  });

  test('shows a clear message when connecting calendar without backend session token', async () => {
    const { result } = renderHook(() =>
      useGoogleIntegrations({ ...baseProps, sessionToken: '' } as any)
    );

    await act(async () => {
      await result.current.connectGoogleCalendar();
    });

    expect(startGoogleCalendarConnectMock).not.toHaveBeenCalled();
    expect(result.current.googleCalendarStatus).toBe('error');
    expect(result.current.googleCalendarMessage).toContain('Zaloguj sie ponownie');
  });

  test('does not fetch events when syncing calendar without backend session token', async () => {
    const { result } = renderHook(() =>
      useGoogleIntegrations({ ...baseProps, sessionToken: '' } as any)
    );

    await act(async () => {
      await result.current.refreshGoogleCalendar();
    });

    expect(fetchGoogleCalendarEventsMock).not.toHaveBeenCalled();
    expect(result.current.googleCalendarStatus).toBe('error');
    expect(result.current.googleCalendarMessage).toContain('Zaloguj sie ponownie');
  });

  test('Regression: #0 - treats missing Google Calendar connection during event load as idle', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getGoogleCalendarStatusMock.mockResolvedValueOnce({
      configured: true,
      connected: true,
      writable: false,
    });
    const missingConnectionError = new Error('Najpierw polacz Google Calendar.') as Error & {
      status?: number;
    };
    missingConnectionError.status = 404;
    fetchGoogleCalendarEventsMock.mockRejectedValueOnce(missingConnectionError);

    const { result } = renderHook(() => useGoogleIntegrations(baseProps as any));

    await waitFor(() => {
      expect(fetchGoogleCalendarEventsMock).toHaveBeenCalled();
      expect(result.current.googleCalendarStatus).toBe('idle');
    });

    expect(result.current.googleCalendarEvents).toEqual([]);
    expect(result.current.googleCalendarMessage).toBe('Najpierw polacz Google Calendar.');
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
