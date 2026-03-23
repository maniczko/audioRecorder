import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import useGoogleIntegrations from "./useGoogleIntegrations";

const {
  updateGoogleTaskMock,
  updateGoogleCalendarEventMock,
  requestGoogleTasksAccessMock,
  requestGoogleCalendarAccessMock,
  fetchGoogleTaskListsMock,
  fetchPrimaryCalendarEventsMock,
  meetingsStoreState,
  setManualTasksMock,
} = vi.hoisted(() => ({
  updateGoogleTaskMock: vi.fn().mockResolvedValue({ updated: "2026-03-24T12:00:00.000Z" }),
  updateGoogleCalendarEventMock: vi.fn().mockResolvedValue({
    id: "g1",
    updated: "2026-03-24T12:00:00.000Z",
    summary: "Brief",
    start: { dateTime: "2026-03-24T10:00:00.000Z" },
    end: { dateTime: "2026-03-24T11:00:00.000Z" },
  }),
  requestGoogleTasksAccessMock: vi.fn().mockResolvedValue({ access_token: "tasks-token" }),
  requestGoogleCalendarAccessMock: vi.fn().mockResolvedValue({ access_token: "calendar-token" }),
  fetchGoogleTaskListsMock: vi.fn().mockResolvedValue({ items: [{ id: "list1", title: "Work" }] }),
  fetchPrimaryCalendarEventsMock: vi.fn().mockResolvedValue({
    items: [],
    nextPageToken: null,
  }),
  meetingsStoreState: {
    meetings: [],
    calendarMeta: {},
    setCalendarMeta: vi.fn(),
  },
  setManualTasksMock: vi.fn(),
}));

vi.mock("../lib/google", async () => {
  const actual = await vi.importActual<any>("../lib/google");
  return {
    ...actual,
    GOOGLE_CLIENT_ID: "demo",
    IS_GOOGLE_DEMO_MODE: true,
    renderGoogleSignInButton: vi.fn(),
    requestGoogleTasksAccess: requestGoogleTasksAccessMock,
    requestGoogleCalendarAccess: requestGoogleCalendarAccessMock,
    fetchGoogleTaskLists: fetchGoogleTaskListsMock,
    fetchPrimaryCalendarEvents: fetchPrimaryCalendarEventsMock,
    createGoogleTask: vi.fn(),
    updateGoogleTask: updateGoogleTaskMock,
    createGoogleCalendarEvent: vi.fn(),
    updateGoogleCalendarEvent: updateGoogleCalendarEventMock,
    signOutGoogleSession: vi.fn(),
  };
});

vi.mock("../store/meetingsStore", () => ({
  useMeetingsStore: () => meetingsStoreState,
}));

describe("useGoogleIntegrations autosync", () => {
  beforeEach(() => {
    updateGoogleTaskMock.mockClear();
    updateGoogleCalendarEventMock.mockClear();
    requestGoogleTasksAccessMock.mockClear();
    requestGoogleCalendarAccessMock.mockClear();
    fetchGoogleTaskListsMock.mockClear();
    fetchPrimaryCalendarEventsMock.mockClear();
    meetingsStoreState.meetings = [];
    meetingsStoreState.calendarMeta = {};
    meetingsStoreState.setCalendarMeta.mockReset();
    setManualTasksMock.mockReset();
  });

  test("pushes linked task edits to Google Tasks after local update", async () => {
    let manualTasks = [
      {
        id: "t1",
        title: "Updated task",
        notes: "Nowe notatki",
        dueDate: "2026-03-25T10:00:00.000Z",
        completed: false,
        sourceType: "google",
        googleTaskId: "gt1",
        googleTaskListId: "list1",
        googleSyncStatus: "local_changes",
        googleSyncConflict: null,
      },
    ];
    setManualTasksMock.mockImplementation((updater) => {
      manualTasks = typeof updater === "function" ? updater(manualTasks) : updater;
    });

    const { result } = renderHook(() =>
      useGoogleIntegrations({
        currentUser: { id: "u1", email: "user@example.com" },
        currentWorkspaceId: "ws1",
        calendarMonth: new Date("2026-03-24T00:00:00.000Z"),
        taskColumns: [
          { id: "todo", title: "To Do", isDone: false },
          { id: "done", title: "Done", isDone: true },
        ],
        meetingTasks: [],
        manualTasks,
        setManualTasks: setManualTasksMock,
        onGoogleProfile: vi.fn(),
        onGoogleError: vi.fn(),
      } as any)
    );

    await act(async () => {
      await result.current.connectGoogleTasks();
    });

    await waitFor(() => {
      expect(updateGoogleTaskMock).toHaveBeenCalled();
    });
    expect(updateGoogleTaskMock).toHaveBeenCalledWith(
      "tasks-token",
      "list1",
      "gt1",
      expect.objectContaining({
        title: "Updated task",
        notes: "Nowe notatki",
        status: "needsAction",
      })
    );
    expect(setManualTasksMock).toHaveBeenCalled();
  });

  test("syncCalendarEntryToGoogle updates linked meeting on demand", async () => {
    meetingsStoreState.meetings = [
      {
        id: "m1",
        workspaceId: "ws1",
        title: "Brief",
        startsAt: "2026-03-24T10:00:00.000Z",
        endsAt: "2026-03-24T11:00:00.000Z",
        createdAt: "2026-03-24T09:00:00.000Z",
        updatedAt: "2026-03-24T12:00:00.000Z",
      },
    ];
    meetingsStoreState.calendarMeta = {
      "meeting:m1": {
        googleEventId: "g1",
        googleSyncedAt: "2026-03-24T12:30:00.000Z",
        googlePulledAt: "2026-03-24T12:30:00.000Z",
        googleSyncConflict: null,
      },
    };

    const { result } = renderHook(() =>
      useGoogleIntegrations({
        currentUser: { id: "u1", email: "user@example.com" },
        currentWorkspaceId: "ws1",
        calendarMonth: new Date("2026-03-24T00:00:00.000Z"),
        taskColumns: [
          { id: "todo", title: "To Do", isDone: false },
          { id: "done", title: "Done", isDone: true },
        ],
        meetingTasks: [],
        manualTasks: [],
        setManualTasks: setManualTasksMock,
        onGoogleProfile: vi.fn(),
        onGoogleError: vi.fn(),
      } as any)
    );

    await act(async () => {
      await result.current.connectGoogleCalendar();
    });

    await act(async () => {
      await result.current.syncCalendarEntryToGoogle(meetingsStoreState.meetings[0], {
        googleEventId: "g1",
      });
    });
    expect(updateGoogleCalendarEventMock).toHaveBeenCalledWith(
      "calendar-token",
      "g1",
      expect.objectContaining({
        summary: "Brief",
        start: { dateTime: "2026-03-24T10:00:00.000Z" },
        end: { dateTime: "2026-03-24T11:00:00.000Z" },
      })
    );
  });
});
