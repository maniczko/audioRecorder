import { act, renderHook } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import useWorkspaceData from './useWorkspaceData';

const { workspaceState, meetingsState, stateServiceMock, httpClientMock } = vi.hoisted(() => ({
  workspaceState: {
    currentWorkspaceId: 'ws1',
    users: [],
    setUsers: vi.fn(),
    workspaces: [],
    setWorkspaces: vi.fn(),
    session: null,
    setSession: vi.fn(),
  },
  meetingsState: {
    meetings: [],
    setMeetings: vi.fn(),
    manualTasks: [],
    setManualTasks: vi.fn(),
    taskState: {},
    setTaskState: vi.fn(),
    taskBoards: {},
    setTaskBoards: vi.fn(),
    calendarMeta: {},
    setCalendarMeta: vi.fn(),
    vocabulary: [],
    setVocabulary: vi.fn(),
    setWorkspaceMessage: vi.fn(),
  },
  stateServiceMock: {
    mode: 'local',
    bootstrap: vi.fn(),
    syncWorkspaceState: vi.fn(),
  },
  httpClientMock: {
    probeRemoteApiHealth: vi.fn(),
    setPreviewRuntimeStatus: vi.fn(),
  },
}));

vi.mock('../services/stateService', () => ({
  createStateService: () => stateServiceMock,
}));

vi.mock('../services/httpClient', () => ({
  probeRemoteApiHealth: (...args: any[]) => httpClientMock.probeRemoteApiHealth(...args),
  setPreviewRuntimeStatus: (...args: any[]) => httpClientMock.setPreviewRuntimeStatus(...args),
  isCircuitBreakerOpen: () => false,
}));

vi.mock('../lib/workspace', () => ({
  migrateWorkspaceData: vi.fn(() => ({ changed: false })),
}));

vi.mock('../store/workspaceStore', () => ({
  useWorkspaceSelectors: () => ({ currentWorkspaceId: workspaceState.currentWorkspaceId }),
  useWorkspaceStore: () => workspaceState,
}));

vi.mock('../store/meetingsStore', () => ({
  useMeetingsStore: () => meetingsState,
}));

describe('useWorkspaceData', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  beforeEach(() => {
    warnSpy.mockClear();
    workspaceState.currentWorkspaceId = 'ws1';
    workspaceState.users = [];
    workspaceState.workspaces = [];
    workspaceState.session = null;
    workspaceState.setUsers.mockReset();
    workspaceState.setWorkspaces.mockReset();
    workspaceState.setSession.mockReset();

    meetingsState.meetings = [];
    meetingsState.manualTasks = [];
    meetingsState.taskState = {};
    meetingsState.taskBoards = {};
    meetingsState.calendarMeta = {};
    meetingsState.vocabulary = [];
    meetingsState.setMeetings.mockReset();
    meetingsState.setManualTasks.mockReset();
    meetingsState.setTaskState.mockReset();
    meetingsState.setTaskBoards.mockReset();
    meetingsState.setCalendarMeta.mockReset();
    meetingsState.setVocabulary.mockReset();
    meetingsState.setWorkspaceMessage.mockReset();

    stateServiceMock.mode = 'local';
    stateServiceMock.bootstrap.mockReset().mockResolvedValue({
      workspaceId: 'ws1',
      state: {
        meetings: [],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      },
    });
    stateServiceMock.syncWorkspaceState.mockReset().mockResolvedValue(null);
    httpClientMock.probeRemoteApiHealth.mockReset().mockResolvedValue(true);
    httpClientMock.setPreviewRuntimeStatus.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost' },
    });
  });

  afterEach(async () => {
    await Promise.resolve();
    await Promise.resolve();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test('returns workspace-filtered meetings in local mode', () => {
    meetingsState.meetings = [
      { id: 'm1', workspaceId: 'ws1', updatedAt: '2026-03-21T10:00:00.000Z' },
      { id: 'm2', workspaceId: 'ws2', updatedAt: '2026-03-20T10:00:00.000Z' },
    ];

    const { result } = renderHook(() => useWorkspaceData());

    expect(result.current.userMeetings).toEqual([
      { id: 'm1', workspaceId: 'ws1', updatedAt: '2026-03-21T10:00:00.000Z' },
    ]);
    expect(result.current.isHydratingRemoteState).toBe(false);
  });

  test('applies remote workspace state through store setters', () => {
    workspaceState.session = { token: 'token-1', userId: 'u1', workspaceId: 'ws1' };

    const { result } = renderHook(() => useWorkspaceData());

    act(() => {
      result.current.applyRemoteWorkspaceState({
        workspaceId: 'ws2',
        users: [{ id: 'u1' }],
        workspaces: [{ id: 'ws2' }],
        state: {
          meetings: [{ id: 'm1' }],
          manualTasks: [{ id: 't1' }],
          taskState: { t1: 'done' },
          taskBoards: { ws2: [] },
          calendarMeta: { 'meeting:m1': { googleEventId: 'g1' } },
          vocabulary: ['AI'],
        },
      });
    });

    expect(workspaceState.setUsers).toHaveBeenCalledWith([{ id: 'u1' }]);
    expect(workspaceState.setWorkspaces).toHaveBeenCalledWith([{ id: 'ws2' }]);
    expect(meetingsState.setMeetings).toHaveBeenCalledWith([{ id: 'm1' }]);
    expect(meetingsState.setManualTasks).toHaveBeenCalledWith([{ id: 't1' }]);
    expect(meetingsState.setTaskState).toHaveBeenCalledWith({ t1: 'done' });
    expect(meetingsState.setTaskBoards).toHaveBeenCalledWith({ ws2: [] });
    expect(meetingsState.setCalendarMeta).toHaveBeenCalledWith({
      'meeting:m1': { googleEventId: 'g1' },
    });
    expect(meetingsState.setVocabulary).toHaveBeenCalledWith(['AI']);
    expect(workspaceState.setSession).toHaveBeenCalledWith(expect.any(Function));
  });

  test('bootstraps remote state and applies it to store', async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = 'remote';
    workspaceState.session = { token: 'token-1', userId: 'u1', workspaceId: 'ws1' };
    workspaceState.currentWorkspaceId = 'ws1';
    stateServiceMock.bootstrap.mockResolvedValueOnce({
      workspaceId: 'ws1',
      users: [{ id: 'u1' }],
      workspaces: [{ id: 'ws1' }],
      state: {
        meetings: [{ id: 'm1', workspaceId: 'ws1', updatedAt: '2026-03-21T10:00:00.000Z' }],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: ['AI'],
      },
    });

    const { result, unmount } = renderHook(() => useWorkspaceData());

    // Flush microtasks so the bootstrap IIFE starts
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Advance enough for bootstrap to settle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledWith('ws1');
    expect(result.current.isHydratingRemoteState).toBe(false);
    expect(meetingsState.setMeetings).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'm1' })])
    );
    expect(workspaceState.setUsers).toHaveBeenCalledWith([{ id: 'u1' }]);
    unmount();
  });

  test('deduplicates concurrent bootstrap calls — second call blocked while first is in flight', async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = 'remote';
    workspaceState.session = { token: 't1', userId: 'u1', workspaceId: 'ws1' };
    workspaceState.currentWorkspaceId = 'ws1';

    let resolveFirst!: (v: any) => void;
    stateServiceMock.bootstrap.mockImplementation(
      () =>
        new Promise((res) => {
          resolveFirst = res;
        })
    );

    const { rerender, unmount } = renderHook(() => useWorkspaceData());

    // Let initial async bootstrap effect start
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Simulate a re-render (e.g. session re-hydration) — must NOT fire a second bootstrap
    rerender();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(1);

    resolveFirst({
      workspaceId: 'ws1',
      state: {
        meetings: [],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      },
    });
    unmount();
  });

  test('reports bootstrap error message in remote mode', async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = 'remote';
    workspaceState.session = { token: 'token-1', userId: 'u1', workspaceId: 'ws1' };
    stateServiceMock.bootstrap.mockRejectedValueOnce(new Error('Remote boom'));

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
    });

    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledWith('Remote boom');
    unmount();
  });

  test('blocks first remote bootstrap on hosted preview when health probe fails', async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = 'remote';
    workspaceState.session = { token: 'token-1', userId: 'u1', workspaceId: 'ws1' };
    httpClientMock.probeRemoteApiHealth.mockRejectedValue(new TypeError('Failed to fetch'));
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'preview-deployment.vercel.app' },
    });

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(httpClientMock.probeRemoteApiHealth).toHaveBeenCalledTimes(1);
    expect(stateServiceMock.bootstrap).not.toHaveBeenCalled();
    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledWith(
      'Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.'
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(httpClientMock.probeRemoteApiHealth).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('does not log cooldown-active health probe failures as unexpected errors', async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = 'remote';
    workspaceState.session = { token: 'token-1', userId: 'u1', workspaceId: 'ws1' };
    httpClientMock.probeRemoteApiHealth.mockRejectedValue(
      new Error('Health probe cooldown active')
    );
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'preview-deployment.vercel.app' },
    });

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(warnSpy).not.toHaveBeenCalledWith(
      'Hosted preview health probe failed.',
      expect.anything()
    );
    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledWith(
      'Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.'
    );
    unmount();
  });

  test('probes health first on hosted preview and resumes normal bootstrap after probe success', async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = 'remote';
    workspaceState.session = { token: 'token-1', userId: 'u1', workspaceId: 'ws1' };
    httpClientMock.probeRemoteApiHealth.mockResolvedValue(true);
    stateServiceMock.bootstrap.mockResolvedValueOnce({
      workspaceId: 'ws1',
      state: {
        meetings: [{ id: 'm1', workspaceId: 'ws1', updatedAt: '2026-03-21T10:00:00.000Z' }],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      },
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'preview-deployment.vercel.app' },
    });

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(httpClientMock.probeRemoteApiHealth).toHaveBeenCalledTimes(1);
    expect(stateServiceMock.bootstrap).toHaveBeenCalledWith('ws1');
    unmount();
  });

  test('auto-retries bootstrap on transport errors then applies cooldown', async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = 'remote';
    workspaceState.session = { token: 'token-1', userId: 'u1', workspaceId: 'ws1' };
    stateServiceMock.bootstrap.mockRejectedValue(
      new Error('Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.')
    );

    const { unmount } = renderHook(() => useWorkspaceData());

    // Advance past initial bootstrap + 3 recovery attempts (10s delay each)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31000);
    });

    // 1 initial + 3 recovery = 4 calls; error message shown once after all retries exhausted
    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(4);
    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledTimes(1);

    // After 5s — polling fires but 25s cooldown still active
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(4);
    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledTimes(1);

    unmount();
  });

  test('resets transport cooldown after a successful remote pull', async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = 'remote';
    workspaceState.session = { token: 'token-1', userId: 'u1', workspaceId: 'ws1' };
    stateServiceMock.bootstrap
      .mockRejectedValueOnce(
        new Error('Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.')
      )
      .mockResolvedValueOnce({
        workspaceId: 'ws1',
        state: {
          meetings: [{ id: 'm2', workspaceId: 'ws1', updatedAt: '2026-03-22T10:00:00.000Z' }],
          manualTasks: [],
          taskState: {},
          taskBoards: {},
          calendarMeta: {},
          vocabulary: [],
        },
      })
      .mockResolvedValue({
        workspaceId: 'ws1',
        state: {
          meetings: [{ id: 'm3', workspaceId: 'ws1', updatedAt: '2026-03-23T10:00:00.000Z' }],
          manualTasks: [],
          taskState: {},
          taskBoards: {},
          calendarMeta: {},
          vocabulary: [],
        },
      });

    const { unmount } = renderHook(() => useWorkspaceData());

    // Advance past initial fail + 10s recovery delay → 2nd call succeeds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });

    // 1st fails (transport), auto-recovery after 10s → 2nd succeeds
    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(2);

    // After recovery, cooldown was reset to 0 → polling fires freely
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(3);
    unmount();
  });
});
