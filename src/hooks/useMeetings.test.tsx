import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import useMeetings from "./useMeetings";

const {
  meetingsState,
  lifecycleState,
  taskOpsState,
} = vi.hoisted(() => ({
  meetingsState: {
    meetings: [{ id: "m1", title: "Spotkanie", startsAt: "2026-03-20T10:00:00.000Z", durationMinutes: 30, workspaceId: "ws1", updatedAt: "2026-03-20T10:00:00.000Z" }],
    manualTasks: [{ id: "t1", title: "Task", workspaceId: "ws1", dueDate: "2026-03-20T10:00:00.000Z" }],
    taskState: {},
    taskBoards: { ws1: [{ id: "todo", label: "Do zrobienia" }] },
    calendarMeta: {},
    workspaceMessage: "",
  },
  lifecycleState: {
    selectedMeeting: { id: "m1", title: "Spotkanie" },
    selectedRecording: null,
    selectedMeetingId: "m1",
    selectedRecordingId: null,
    createMeetingDirect: vi.fn(),
    resetSelectionState: vi.fn(),
    setSelectedMeetingId: vi.fn(),
    setSelectedRecordingId: vi.fn(),
  },
  taskOpsState: {
    updateTask: vi.fn(),
  },
}));

vi.mock("./useWorkspaceData", () => ({
  default: () => ({
    userMeetings: meetingsState.meetings,
    isHydratingRemoteState: false,
  }),
}));

vi.mock("./useMeetingLifecycle", () => ({
  default: () => lifecycleState,
}));

vi.mock("./useTaskOperations", () => ({
  default: () => taskOpsState,
}));

vi.mock("./usePeopleProfiles", () => ({
  default: () => ({
    peopleProfiles: ["Anna Nowak"],
  }),
}));

vi.mock("./useRecordingActions", () => ({
  default: () => ({
    attachRecordingToMeeting: vi.fn(),
  }),
}));

vi.mock("../store/workspaceStore", () => ({
  useWorkspaceStore: () => ({ users: [{ id: "u1", name: "Anna" }] }),
  useWorkspaceSelectors: () => ({
    currentUser: { id: "u1", name: "Anna" },
    currentUserId: "u1",
    currentWorkspaceId: "ws1",
    currentWorkspaceMembers: [{ id: "u1", name: "Anna" }],
  }),
}));

vi.mock("../store/meetingsStore", () => ({
  useMeetingsStore: () => ({
    manualTasks: meetingsState.manualTasks,
    taskState: meetingsState.taskState,
    taskBoards: meetingsState.taskBoards,
    calendarMeta: meetingsState.calendarMeta,
    setMeetings: (updater: any) => {
      meetingsState.meetings = typeof updater === "function" ? updater(meetingsState.meetings) : updater;
    },
    setManualTasks: (updater: any) => {
      meetingsState.manualTasks = typeof updater === "function" ? updater(meetingsState.manualTasks) : updater;
    },
    setTaskState: vi.fn(),
    setTaskBoards: vi.fn(),
    setCalendarMeta: (updater: any) => {
      meetingsState.calendarMeta = typeof updater === "function" ? updater(meetingsState.calendarMeta) : updater;
    },
    setWorkspaceMessage: (message: string) => {
      meetingsState.workspaceMessage = message;
    },
  }),
}));

vi.mock("../lib/tasks", () => ({
  buildTaskColumns: vi.fn(() => [{ id: "todo", label: "Do zrobienia" }]),
  buildTasksFromMeetings: vi.fn(() => meetingsState.manualTasks),
  buildTaskPeople: vi.fn(() => ["Anna"]),
  buildTaskTags: vi.fn(() => ["pilne"]),
  buildTaskNotifications: vi.fn(() => []),
}));

vi.mock("../lib/activityFeed", () => ({
  buildWorkspaceActivityFeed: vi.fn(() => []),
}));

vi.mock("../lib/googleSync", () => ({
  areCalendarSyncSnapshotsEqual: vi.fn(() => false),
  buildCalendarSyncSnapshot: vi.fn((source: any) => source),
  createGoogleCalendarConflictState: vi.fn(() => null),
}));

describe("useMeetings", () => {
  beforeEach(() => {
    meetingsState.meetings = [{ id: "m1", title: "Spotkanie", startsAt: "2026-03-20T10:00:00.000Z", durationMinutes: 30, workspaceId: "ws1", updatedAt: "2026-03-20T10:00:00.000Z" }];
    meetingsState.manualTasks = [{ id: "t1", title: "Task", workspaceId: "ws1", dueDate: "2026-03-20T10:00:00.000Z" }];
    meetingsState.calendarMeta = {};
    meetingsState.workspaceMessage = "";
    lifecycleState.createMeetingDirect.mockReset();
    lifecycleState.resetSelectionState.mockReset();
    taskOpsState.updateTask.mockReset();
  });

  test("updates calendar entry metadata and applies meeting snapshot", () => {
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.updateCalendarEntryMeta("meeting", "m1", { googleEventId: "g1" });
      result.current.applyCalendarSyncSnapshot("meeting", "m1", {
        title: "Spotkanie po syncu",
        startsAt: "2026-03-21T12:00:00.000Z",
        durationMinutes: 45,
        location: "Warszawa",
      });
    });

    expect(meetingsState.calendarMeta["meeting:m1"]).toMatchObject({ googleEventId: "g1" });
    expect(meetingsState.meetings[0]).toMatchObject({
      title: "Spotkanie po syncu",
      startsAt: "2026-03-21T12:00:00.000Z",
      durationMinutes: 45,
      location: "Warszawa",
    });
  });

  test("delegates task snapshot application to task operations", () => {
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.applyCalendarSyncSnapshot("task", "t1", {
        title: "Task po syncu",
        startsAt: "2026-03-22T09:30:00.000Z",
      });
    });

    expect(taskOpsState.updateTask).toHaveBeenCalledWith("t1", {
      title: "Task po syncu",
      dueDate: "2026-03-22T09:30:00.000Z",
    });
  });

  test("creates manual note through lifecycle helper and updates workspace message", () => {
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.createManualNote({
        title: "Notatka z calla",
        context: "Szybki follow-up",
        tags: ["notatka", "follow-up"],
      });
    });

    expect(lifecycleState.createMeetingDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Notatka z calla",
        context: "Szybki follow-up",
        tags: "notatka\nfollow-up",
      })
    );
    expect(meetingsState.workspaceMessage).toBe("Notatka zapisana.");
  });

  test("deletes selected meeting and resets selection state", () => {
    const { result } = renderHook(() => useMeetings());

    act(() => {
      result.current.deleteMeeting("m1");
    });

    expect(meetingsState.meetings).toEqual([]);
    expect(lifecycleState.resetSelectionState).toHaveBeenCalledTimes(1);
  });
});
