import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import useWorkspaceData from "./useWorkspaceData";

const {
  workspaceState,
  meetingsState,
  stateServiceMock,
  httpClientMock,
} = vi.hoisted(() => ({
  workspaceState: {
    currentWorkspaceId: "ws1",
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
    mode: "local",
    bootstrap: vi.fn(),
    syncWorkspaceState: vi.fn(),
  },
  httpClientMock: {
    probeRemoteApiHealth: vi.fn(),
    setPreviewRuntimeStatus: vi.fn(),
  },
}));

vi.mock("../services/stateService", () => ({
  createStateService: () => stateServiceMock,
}));

vi.mock("../services/httpClient", () => ({
  probeRemoteApiHealth: (...args: any[]) => httpClientMock.probeRemoteApiHealth(...args),
  setPreviewRuntimeStatus: (...args: any[]) => httpClientMock.setPreviewRuntimeStatus(...args),
}));

vi.mock("../lib/workspace", () => ({
  migrateWorkspaceData: vi.fn(() => ({ changed: false })),
}));

vi.mock("../store/workspaceStore", () => ({
  useWorkspaceSelectors: () => ({ currentWorkspaceId: workspaceState.currentWorkspaceId }),
  useWorkspaceStore: () => workspaceState,
}));

vi.mock("../store/meetingsStore", () => ({
  useMeetingsStore: () => meetingsState,
}));

describe("useWorkspaceData", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    workspaceState.currentWorkspaceId = "ws1";
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

    stateServiceMock.mode = "local";
    stateServiceMock.bootstrap.mockReset().mockResolvedValue({
      workspaceId: "ws1",
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
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "localhost" },
    });
  });

  test("returns workspace-filtered meetings in local mode", () => {
    meetingsState.meetings = [
      { id: "m1", workspaceId: "ws1", updatedAt: "2026-03-21T10:00:00.000Z" },
      { id: "m2", workspaceId: "ws2", updatedAt: "2026-03-20T10:00:00.000Z" },
    ];

    const { result } = renderHook(() => useWorkspaceData());

    expect(result.current.userMeetings).toEqual([
      { id: "m1", workspaceId: "ws1", updatedAt: "2026-03-21T10:00:00.000Z" },
    ]);
    expect(result.current.isHydratingRemoteState).toBe(false);
  });

  test("applies remote workspace state through store setters", () => {
    workspaceState.session = { token: "token-1", userId: "u1", workspaceId: "ws1" };

    const { result } = renderHook(() => useWorkspaceData());

    act(() => {
      result.current.applyRemoteWorkspaceState({
        workspaceId: "ws2",
        users: [{ id: "u1" }],
        workspaces: [{ id: "ws2" }],
        state: {
          meetings: [{ id: "m1" }],
          manualTasks: [{ id: "t1" }],
          taskState: { t1: "done" },
          taskBoards: { ws2: [] },
          calendarMeta: { "meeting:m1": { googleEventId: "g1" } },
          vocabulary: ["AI"],
        },
      });
    });

    expect(workspaceState.setUsers).toHaveBeenCalledWith([{ id: "u1" }]);
    expect(workspaceState.setWorkspaces).toHaveBeenCalledWith([{ id: "ws2" }]);
    expect(meetingsState.setMeetings).toHaveBeenCalledWith([{ id: "m1" }]);
    expect(meetingsState.setManualTasks).toHaveBeenCalledWith([{ id: "t1" }]);
    expect(meetingsState.setTaskState).toHaveBeenCalledWith({ t1: "done" });
    expect(meetingsState.setTaskBoards).toHaveBeenCalledWith({ ws2: [] });
    expect(meetingsState.setCalendarMeta).toHaveBeenCalledWith({ "meeting:m1": { googleEventId: "g1" } });
    expect(meetingsState.setVocabulary).toHaveBeenCalledWith(["AI"]);
    expect(workspaceState.setSession).toHaveBeenCalledWith(expect.any(Function));
  });

  test("bootstraps remote state and syncs changed snapshots in remote mode", async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = "remote";
    workspaceState.session = { token: "token-1", userId: "u1", workspaceId: "ws1" };
    workspaceState.currentWorkspaceId = "ws1";
    stateServiceMock.bootstrap
      .mockResolvedValueOnce({
        workspaceId: "ws1",
        users: [{ id: "u1" }],
        workspaces: [{ id: "ws1" }],
        state: {
          meetings: [{ id: "m1", workspaceId: "ws1", updatedAt: "2026-03-21T10:00:00.000Z" }],
          manualTasks: [],
          taskState: {},
          taskBoards: {},
          calendarMeta: {},
          vocabulary: ["AI"],
        },
      })
      .mockResolvedValueOnce({
        workspaceId: "ws1",
        state: {
          meetings: [{ id: "m2", workspaceId: "ws1", updatedAt: "2026-03-22T10:00:00.000Z" }],
          manualTasks: [],
          taskState: {},
          taskBoards: {},
          calendarMeta: {},
          vocabulary: ["AI"],
        },
      });

    const { result, unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledWith("ws1");
    await waitFor(() => {
      expect(result.current.isHydratingRemoteState).toBe(false);
    });

    meetingsState.meetings = [{ id: "m1", workspaceId: "ws1", updatedAt: "2026-03-21T10:00:00.000Z" }];
    meetingsState.manualTasks = [{ id: "t1" }];
    const { rerender } = renderHook(() => useWorkspaceData());
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(stateServiceMock.syncWorkspaceState).toHaveBeenCalledWith(
      "ws1",
      expect.any(Object)
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(stateServiceMock.bootstrap.mock.calls.length).toBeGreaterThanOrEqual(2);
    unmount();
  });

  test("reports bootstrap error message in remote mode", async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = "remote";
    workspaceState.session = { token: "token-1", userId: "u1", workspaceId: "ws1" };
    stateServiceMock.bootstrap.mockRejectedValueOnce(new Error("Remote boom"));

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
    });

    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledWith("Remote boom");
    unmount();
  });

  test("blocks first remote bootstrap on hosted preview when health probe fails", async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = "remote";
    workspaceState.session = { token: "token-1", userId: "u1", workspaceId: "ws1" };
    httpClientMock.probeRemoteApiHealth.mockRejectedValue(new TypeError("Failed to fetch"));
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "preview-deployment.vercel.app" },
    });

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(httpClientMock.probeRemoteApiHealth).toHaveBeenCalledTimes(1);
    expect(stateServiceMock.bootstrap).not.toHaveBeenCalled();
    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledWith(
      "Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy."
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(httpClientMock.probeRemoteApiHealth).toHaveBeenCalledTimes(1);
    unmount();
  });

  test("probes health first on hosted preview and resumes normal bootstrap after probe success", async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = "remote";
    workspaceState.session = { token: "token-1", userId: "u1", workspaceId: "ws1" };
    httpClientMock.probeRemoteApiHealth.mockResolvedValue(true);
    stateServiceMock.bootstrap.mockResolvedValueOnce({
      workspaceId: "ws1",
      state: {
        meetings: [{ id: "m1", workspaceId: "ws1", updatedAt: "2026-03-21T10:00:00.000Z" }],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      },
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { hostname: "preview-deployment.vercel.app" },
    });

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(httpClientMock.probeRemoteApiHealth).toHaveBeenCalledTimes(1);
    expect(stateServiceMock.bootstrap).toHaveBeenCalledWith("ws1");
    unmount();
  });

  test("applies cooldown after transport bootstrap errors and avoids poll spam", async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = "remote";
    workspaceState.session = { token: "token-1", userId: "u1", workspaceId: "ws1" };
    stateServiceMock.bootstrap.mockRejectedValue(new Error("Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile."));

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(1);
    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(1);
    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25000);
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(2);
    expect(meetingsState.setWorkspaceMessage).toHaveBeenCalledTimes(1);
    unmount();
  });

  test("resets transport cooldown after a successful remote pull", async () => {
    vi.useFakeTimers();
    stateServiceMock.mode = "remote";
    workspaceState.session = { token: "token-1", userId: "u1", workspaceId: "ws1" };
    stateServiceMock.bootstrap
      .mockRejectedValueOnce(new Error("Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile."))
      .mockResolvedValueOnce({
        workspaceId: "ws1",
        state: {
          meetings: [{ id: "m2", workspaceId: "ws1", updatedAt: "2026-03-22T10:00:00.000Z" }],
          manualTasks: [],
          taskState: {},
          taskBoards: {},
          calendarMeta: {},
          vocabulary: [],
        },
      })
      .mockResolvedValue({
        workspaceId: "ws1",
        state: {
          meetings: [{ id: "m3", workspaceId: "ws1", updatedAt: "2026-03-23T10:00:00.000Z" }],
          manualTasks: [],
          taskState: {},
          taskBoards: {},
          calendarMeta: {},
          vocabulary: [],
        },
      });

    const { unmount } = renderHook(() => useWorkspaceData());

    await act(async () => {
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25000);
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(stateServiceMock.bootstrap).toHaveBeenCalledTimes(3);
    unmount();
  });
});
