import { renderHook, act } from "@testing-library/react";
import { UIProvider, useUICtx } from "./UIContext";
import * as WorkspaceContext from "./WorkspaceContext";
import * as MeetingsContext from "./MeetingsContext";
import * as RecorderContext from "./RecorderContext";
import * as GoogleContext from "./GoogleContext";


describe("UIContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(WorkspaceContext, "useWorkspaceCtx").mockReturnValue({
      workspace: { switchWorkspace: jest.fn(), setSession: jest.fn() }
    });
    jest.spyOn(MeetingsContext, "useMeetingsCtx").mockReturnValue({
      meetings: {
        userMeetings: [{ id: "m1", title: "M1", attendees: [] }],
        meetingTasks: [{ id: "t1", title: "T1", dueDate: "2026-12-10" }],
        peopleProfiles: [{ name: "Ania" }],
        selectedMeeting: { id: "m1", title: "M1", speakerNames: {} },
        calendarMeta: {},
        taskNotifications: [],
        syncLinkedGoogleCalendarEvents: jest.fn(),
        selectMeeting: jest.fn(),
        resetSelectionState: jest.fn(),
        createTaskFromComposer: jest.fn(() => "t2"),
        startNewMeetingDraft: jest.fn(),
      }
    });
    jest.spyOn(RecorderContext, "useRecorderCtx").mockReturnValue({
      isRecording: false,
      recordingMeetingId: null,
      currentSegments: [],
      audioUrls: {},
      audioHydrationErrors: {},
      stopRecording: jest.fn(),
      resetRecorderState: jest.fn(),
    });
    jest.spyOn(GoogleContext, "useGoogleCtx").mockReturnValue({
      googleCalendarEvents: [],
      resetGoogleSession: jest.fn(),
    });
  });

  function setup() {
    return renderHook(() => useUICtx(), { wrapper: UIProvider });
  }

  test("tab navigation", () => {
    const { result } = setup();

    expect(result.current.activeTab).toBe("studio");
    expect(result.current.canGoBack).toBe(true);

    act(() => {
      result.current.setActiveTab("tasks");
    });
    expect(result.current.activeTab).toBe("tasks");

    act(() => {
      result.current.navigateBack();
    });
    expect(result.current.activeTab).toBe("studio");
  });

  test("cross cutting actions work", () => {
    const { result } = setup();

    act(() => {
      result.current.openMeetingFromCalendar("m1");
    });
    expect(result.current.activeTab).toBe("studio");

    act(() => {
      result.current.openTaskFromCalendar("t1");
    });
    expect(result.current.activeTab).toBe("tasks");
    expect(result.current.pendingTaskId).toBe("t1");

    act(() => {
      result.current.createTaskForPerson({ title: "New Task" });
    });
    expect(result.current.pendingTaskId).toBe("t2");

    act(() => {
      result.current.createMeetingForPerson("Ania");
    });
    expect(result.current.activeTab).toBe("studio");

    act(() => {
      result.current.openPersonFromPalette("p1");
    });
    expect(result.current.activeTab).toBe("people");
    expect(result.current.pendingPersonId).toBe("p1");
  });

  test("handleCommandPaletteSelect", () => {
    const { result } = setup();

    act(() => {
        result.current.setCommandPaletteOpen(true);
    });

    act(() => {
      result.current.handleCommandPaletteSelect({ type: "tab", payload: { tabId: "calendar" } });
    });
    expect(result.current.activeTab).toBe("calendar");
    expect(result.current.commandPaletteOpen).toBe(false);

    act(() => {
      result.current.handleCommandPaletteSelect({ type: "meeting", payload: { meetingId: "m1" } });
    });
    
    act(() => {
      result.current.handleCommandPaletteSelect({ type: "task", payload: { taskId: "t1" } });
    });
  });

  test("switchWorkspace and logout", () => {
    const { result } = setup();

    act(() => {
      result.current.switchWorkspace("w2");
    });

    act(() => {
      result.current.logout();
    });
  });
});
