import { act, fireEvent, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import useUI from "./useUI";
import { AppProviders } from "../AppProviders";

const state = vi.hoisted(() => ({
  uiState: {
    activeTab: "studio",
    notificationState: { dismissedIds: ["dismissed-1"], deliveredIds: [] },
    notificationPermission: "granted",
    setCommandPaletteOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setPendingTaskId: vi.fn(),
    setPendingPersonId: vi.fn(),
    setNotificationCenterOpen: vi.fn(),
    dismissNotification: vi.fn(),
    deliverBrowserNotifications: vi.fn(),
  },
  workspace: {
    switchWorkspace: vi.fn(),
    logout: vi.fn(),
  },
  meetings: {
    userMeetings: [
      { id: "m1", title: "Weekly", speakerNames: { "0": "Anna" }, analysis: { summary: "ok" } },
    ],
    meetingTasks: [{ id: "t1", title: "Follow-up", dueDate: "2026-03-25T10:00:00.000Z" }],
    peopleProfiles: [{ id: "p1", name: "Anna" }],
    selectedMeeting: { id: "m1", title: "Weekly", speakerNames: { "0": "Anna" }, analysis: { summary: "meeting" } },
    selectedRecording: {
      id: "r1",
      transcript: [{ timestamp: 65, speakerId: 0, text: "Hello" }],
      speakerNames: { "0": "Anna" },
      analysis: { summary: "recording" },
    },
    taskNotifications: [{ id: "task-1", action: { type: "task", id: "t1" } }],
    calendarMeta: { foo: "bar" },
    syncLinkedGoogleCalendarEvents: vi.fn(),
    selectMeeting: vi.fn(),
    createTaskFromComposer: vi.fn(() => ({ id: "task-created" })),
    startNewMeetingDraft: vi.fn(),
    resetSelectionState: vi.fn(),
  },
  recorder: {
    isRecording: false,
    recordingMeetingId: "",
    currentSegments: [],
    audioUrls: { r1: "/audio/r1.mp3" },
    audioHydrationErrors: { r1: "" },
    stopRecording: vi.fn(),
    resetRecorderState: vi.fn(),
  },
  google: {
    googleCalendarEvents: [{ id: "g1" }],
    resetGoogleSession: vi.fn(),
  },
  downloadTextFile: vi.fn(),
  printMeetingPdf: vi.fn(),
  windowOpen: vi.fn(),
}));

vi.mock("../store/uiStore", () => ({
  useUIStore: () => state.uiState,
}));

vi.mock("../store/workspaceStore", () => ({
  useWorkspaceStore: () => state.workspace,
  useWorkspaceSelectors: () => ({ currentWorkspaceId: "ws1" }),
}));

vi.mock("../context/RecorderContext", () => ({
  useRecorderCtx: () => state.recorder,
}));

vi.mock("../context/GoogleContext", () => ({
  useGoogleCtx: () => state.google,
}));

vi.mock("./useMeetings", () => ({
  default: () => state.meetings,
}));

vi.mock("../lib/calendarView", () => ({
  buildCalendarEntries: vi.fn(() => [{ id: "calendar-meeting" }]),
  buildUpcomingReminders: vi.fn(() => [{ id: "meeting-1", action: { type: "meeting", id: "m1" } }]),
}));

vi.mock("../lib/commandPalette", () => ({
  buildCommandPaletteItems: vi.fn(() => [{ id: "meeting-item", type: "meeting", payload: { meetingId: "m1" } }]),
}));

vi.mock("../lib/notifications", () => ({
  buildWorkspaceNotifications: vi.fn(() => [
    { id: "dismissed-1", action: { type: "meeting", id: "m1" } },
    { id: "task-1", action: { type: "task", id: "t1" } },
  ]),
}));

vi.mock("../lib/storage", () => ({
  downloadTextFile: (...args: any[]) => state.downloadTextFile(...args),
  formatDateTime: (value: string) => `DATE:${value}`,
  formatDuration: (value: number) => `DUR:${value}`,
}));

vi.mock("../lib/export", () => ({
  buildMeetingNotesText: vi.fn(() => "Meeting notes"),
  printMeetingPdf: (...args: any[]) => state.printMeetingPdf(...args),
  slugifyExportTitle: vi.fn(() => "weekly"),
}));

vi.mock("../lib/calendar", () => ({
  buildGoogleCalendarUrl: vi.fn(() => "https://calendar.google.com/test"),
}));

describe("useUI", () => {
  beforeEach(() => {
    state.uiState.setCommandPaletteOpen.mockReset();
    state.uiState.setActiveTab.mockReset();
    state.uiState.setPendingTaskId.mockReset();
    state.uiState.setPendingPersonId.mockReset();
    state.uiState.setNotificationCenterOpen.mockReset();
    state.uiState.dismissNotification.mockReset();
    state.uiState.deliverBrowserNotifications.mockReset();
    state.workspace.switchWorkspace.mockReset();
    state.workspace.logout.mockReset();
    state.meetings.syncLinkedGoogleCalendarEvents.mockReset();
    state.meetings.selectMeeting.mockReset();
    state.meetings.createTaskFromComposer.mockReset().mockReturnValue({ id: "task-created" });
    state.meetings.startNewMeetingDraft.mockReset();
    state.meetings.resetSelectionState.mockReset();
    state.recorder.isRecording = false;
    state.recorder.stopRecording.mockReset();
    state.recorder.resetRecorderState.mockReset();
    state.google.resetGoogleSession.mockReset();
    state.downloadTextFile.mockReset();
    state.printMeetingPdf.mockReset();
    state.windowOpen.mockReset();
    vi.stubGlobal("open", state.windowOpen);
  });

  test("opens command palette on keyboard shortcut and delivers notifications", () => {
    renderHook(() => useUI(), { wrapper: AppProviders });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(state.uiState.setCommandPaletteOpen).toHaveBeenCalledWith(true);
    expect(state.uiState.deliverBrowserNotifications).toHaveBeenCalledWith([
      { id: "task-1", action: { type: "task", id: "t1" } },
    ]);
    expect(state.meetings.syncLinkedGoogleCalendarEvents).toHaveBeenCalledWith([{ id: "g1" }]);
  });

  test("exports transcript and opens meeting from calendar", () => {
    const { result } = renderHook(() => useUI(), { wrapper: AppProviders });

    act(() => {
      result.current.exportTranscript();
      result.current.openMeetingFromCalendar("m1");
    });

    expect(state.downloadTextFile).toHaveBeenCalledWith("weekly-transcript.txt", "[DUR:65] Anna: Hello");
    expect(state.meetings.selectMeeting).toHaveBeenCalledWith(state.meetings.userMeetings[0]);
    expect(state.uiState.setActiveTab).toHaveBeenCalledWith("studio");
  });

  test("opens a fresh studio draft when requested", () => {
    const { result } = renderHook(() => useUI(), { wrapper: AppProviders });

    act(() => {
      result.current.openStudio();
    });

    expect(state.meetings.startNewMeetingDraft).toHaveBeenCalledTimes(1);
    expect(state.uiState.setActiveTab).toHaveBeenCalledWith("studio");
  });

  test("routes task, person and workspace actions through shared UI state", () => {
    const { result } = renderHook(() => useUI(), { wrapper: AppProviders });

    act(() => {
      result.current.createTaskForPerson({ title: "For Anna" });
      result.current.createMeetingForPerson("Anna");
      result.current.openPersonFromPalette("p1");
      result.current.switchWorkspace("ws2");
    });

    expect(state.meetings.createTaskFromComposer).toHaveBeenCalledWith({ title: "For Anna" });
    expect(state.uiState.setPendingTaskId).toHaveBeenCalledWith("task-created");
    expect(state.meetings.startNewMeetingDraft).toHaveBeenCalledWith({ attendees: "Anna" });
    expect(state.uiState.setPendingPersonId).toHaveBeenCalledWith("p1");
    expect(state.workspace.switchWorkspace).toHaveBeenCalledWith("ws2");
    expect(state.google.resetGoogleSession).toHaveBeenCalledTimes(1);
    expect(state.meetings.resetSelectionState).toHaveBeenCalledTimes(1);
  });

  test("cleans up recorder and shell state on logout", () => {
    state.recorder.isRecording = true;
    const { result } = renderHook(() => useUI(), { wrapper: AppProviders });

    act(() => {
      result.current.logout();
    });

    expect(state.recorder.stopRecording).toHaveBeenCalledTimes(1);
    expect(state.workspace.logout).toHaveBeenCalledTimes(1);
    expect(state.recorder.resetRecorderState).toHaveBeenCalledTimes(1);
    expect(state.uiState.setActiveTab).toHaveBeenCalledWith("studio");
    expect(state.uiState.setCommandPaletteOpen).toHaveBeenCalledWith(false);
    expect(state.uiState.setNotificationCenterOpen).toHaveBeenCalledWith(false);
  });
});
