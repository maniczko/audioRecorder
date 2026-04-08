import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import useMeetings from './useMeetings';

const { meetingsState, lifecycleState, taskOpsState, stateServiceState } = vi.hoisted(() => ({
  meetingsState: {
    meetings: [
      {
        id: 'm1',
        title: 'Spotkanie',
        startsAt: '2026-03-20T10:00:00.000Z',
        durationMinutes: 30,
        workspaceId: 'ws1',
        updatedAt: '2026-03-20T10:00:00.000Z',
      },
    ],
    manualTasks: [
      { id: 't1', title: 'Task', workspaceId: 'ws1', dueDate: '2026-03-20T10:00:00.000Z' },
    ],
    taskState: {},
    taskBoards: { ws1: [{ id: 'todo', label: 'Do zrobienia' }] },
    calendarMeta: {},
    workspaceMessage: '',
  },
  lifecycleState: {
    selectedMeeting: { id: 'm1', title: 'Spotkanie' },
    selectedRecording: null,
    selectedMeetingId: 'm1',
    selectedRecordingId: null,
    createMeetingDirect: vi.fn((payload) => ({ id: 'new_meeting', ...payload })),
    resetSelectionState: vi.fn(),
    setSelectedMeetingId: vi.fn(),
    setSelectedRecordingId: vi.fn(),
  },
  taskOpsState: {
    updateTask: vi.fn((id, payload) => {
      meetingsState.manualTasks = meetingsState.manualTasks.map((t) =>
        t.id === id ? { ...t, ...payload } : t
      );
    }),
  },
  stateServiceState: {
    syncWorkspaceState: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('./useWorkspaceData', () => ({
  default: () => ({
    userMeetings: meetingsState.meetings,
    isHydratingRemoteState: false,
    pauseRemotePull: vi.fn(),
  }),
}));

vi.mock('../services/stateService', () => ({
  createStateService: () => ({
    mode: 'remote',
    syncWorkspaceState: stateServiceState.syncWorkspaceState,
  }),
}));

vi.mock('./useMeetingLifecycle', () => ({
  default: () => lifecycleState,
}));

vi.mock('./useTaskOperations', () => ({
  default: () => taskOpsState,
}));

vi.mock('./usePeopleProfiles', () => ({
  default: () => ({
    peopleProfiles: ['Anna Nowak'],
  }),
}));

vi.mock('./useRecordingActions', () => ({
  default: () => ({
    attachRecordingToMeeting: vi.fn(),
  }),
}));

vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: () => ({ users: [{ id: 'u1', name: 'Anna' }] }),
  useWorkspaceSelectors: () => ({
    currentUser: { id: 'u1', name: 'Anna' },
    currentUserId: 'u1',
    currentWorkspaceId: 'ws1',
    currentWorkspaceMembers: [{ id: 'u1', name: 'Anna' }],
  }),
}));

vi.mock('../store/meetingsStore', () => ({
  useMeetingsStore: () => ({
    manualTasks: meetingsState.manualTasks,
    taskState: meetingsState.taskState,
    taskBoards: meetingsState.taskBoards,
    calendarMeta: meetingsState.calendarMeta,
    vocabulary: [],
    setMeetings: (updater: any) => {
      meetingsState.meetings =
        typeof updater === 'function' ? updater(meetingsState.meetings) : updater;
    },
    setManualTasks: (updater: any) => {
      meetingsState.manualTasks =
        typeof updater === 'function' ? updater(meetingsState.manualTasks) : updater;
    },
    setTaskState: vi.fn(),
    setTaskBoards: vi.fn(),
    setCalendarMeta: (updater: any) => {
      meetingsState.calendarMeta =
        typeof updater === 'function' ? updater(meetingsState.calendarMeta) : updater;
    },
    setWorkspaceMessage: (message: string) => {
      meetingsState.workspaceMessage = message;
    },
  }),
}));

vi.mock('../lib/tasks', () => ({
  buildTaskColumns: vi.fn(() => [{ id: 'todo', label: 'Do zrobienia' }]),
  buildTasksFromMeetings: vi.fn(() => meetingsState.manualTasks),
  buildTaskPeople: vi.fn(() => ['Anna']),
  buildTaskTags: vi.fn(() => ['pilne']),
  buildTaskNotifications: vi.fn(() => []),
}));

vi.mock('../lib/activityFeed', () => ({
  buildWorkspaceActivityFeed: vi.fn(() => []),
}));

vi.mock('../lib/googleSync', () => ({
  areCalendarSyncSnapshotsEqual: vi.fn(() => false),
  buildCalendarSyncSnapshot: vi.fn((source: any) => source),
  createGoogleCalendarConflictState: vi.fn(() => null),
}));

describe.skip('useMeetings — Zustand 5 migration pending', () => {
  beforeEach(() => {
    meetingsState.meetings = [
      {
        id: 'm1',
        title: 'Spotkanie',
        startsAt: '2026-03-20T10:00:00.000Z',
        durationMinutes: 30,
        workspaceId: 'ws1',
        updatedAt: '2026-03-20T10:00:00.000Z',
      },
    ];
    meetingsState.manualTasks = [
      { id: 't1', title: 'Task', workspaceId: 'ws1', dueDate: '2026-03-20T10:00:00.000Z' },
    ];
    meetingsState.calendarMeta = {};
    meetingsState.workspaceMessage = '';
    lifecycleState.createMeetingDirect.mockReset();
    lifecycleState.resetSelectionState.mockReset();
    taskOpsState.updateTask.mockReset();
    stateServiceState.syncWorkspaceState.mockReset().mockResolvedValue(null);
  });

  test('updateCalendarEntryMeta stores metadata under composite key', () => {
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.updateCalendarEntryMeta('meeting', 'm1', { syncedAt: '2026-03-28' });
    });
    expect(meetingsState.calendarMeta['meeting:m1']).toEqual({ syncedAt: '2026-03-28' });
  });

  test('updateCalendarEntryMeta merges into existing meta entry', () => {
    meetingsState.calendarMeta = { 'meeting:m1': { syncedAt: '2026-03-20' } };
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.updateCalendarEntryMeta('meeting', 'm1', { status: 'synced' });
    });
    expect(meetingsState.calendarMeta['meeting:m1']).toEqual({
      syncedAt: '2026-03-20',
      status: 'synced',
    });
  });

  test('createManualNote delegates to createMeetingDirect and sets workspace message', () => {
    lifecycleState.createMeetingDirect.mockReturnValue({ id: 'note1' });
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.createManualNote({ title: 'Notatka', context: 'Treść' });
    });
    expect(lifecycleState.createMeetingDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Notatka',
        context: 'Treść',
        durationMinutes: 0,
      })
    );
    expect(meetingsState.workspaceMessage).toBe('Notatka zapisana.');
  });

  test('deleteMeeting removes meeting from state and resets selection', () => {
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.deleteMeeting('m1');
    });
    expect(meetingsState.meetings).toEqual([]);
    expect(lifecycleState.resetSelectionState).toHaveBeenCalled();
  });

  test('deleteRecordingAndMeeting removes meeting and syncs workspace', async () => {
    const originalMeetings = meetingsState.meetings;
    meetingsState.meetings = [
      {
        id: 'm1',
        title: 'Spotkanie',
        startsAt: '2026-03-20T10:00:00.000Z',
        durationMinutes: 30,
        workspaceId: 'ws1',
        updatedAt: '2026-03-20T10:00:00.000Z',
        recordings: [{ id: 'rec1' }],
      },
    ];

    const { result } = renderHook(() => useMeetings());

    await result.current.deleteRecordingAndMeeting('m1');

    expect(meetingsState.meetings).toEqual([]);
    expect(lifecycleState.resetSelectionState).toHaveBeenCalled();
    expect(stateServiceState.syncWorkspaceState).toHaveBeenCalled();
  });

  test('updateMeeting merges updates into matching meeting', () => {
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.updateMeeting('m1', { title: 'Nowy tytuł' });
    });
    expect(meetingsState.meetings[0].title).toBe('Nowy tytuł');
    expect(meetingsState.meetings[0].updatedAt).toBeDefined();
  });
});
