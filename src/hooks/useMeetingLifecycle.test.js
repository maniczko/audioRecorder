import { renderHook, act } from "@testing-library/react";
import useMeetingLifecycle from "./useMeetingLifecycle";
import { createEmptyMeetingDraft } from "../lib/meeting";

describe("useMeetingLifecycle", () => {
  const mockSetMeetings = jest.fn();
  const mockSetWorkspaceMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  const baseProps = {
    currentUser: { id: "u1", name: "User" },
    currentUserId: "u1",
    currentWorkspaceId: "w1",
    currentWorkspaceMembers: [{ id: "u1", name: "User" }],
    userMeetings: [
      { id: "m1", title: "M1", recordings: [{ id: "r1" }], latestRecordingId: "r1" },
      { id: "m2", title: "M2", recordings: [] },
    ],
    setMeetings: mockSetMeetings,
    setWorkspaceMessage: mockSetWorkspaceMessage,
  };

  test("initialization and selecting meeting via derived state", () => {
    const { result } = renderHook((props) => useMeetingLifecycle(props), { initialProps: baseProps });
    
    // Automatically selects the first meeting or handles detached drafts
    expect(result.current.selectedMeetingId).toBeNull(); // wait, unless selectMeeting is called or it had a draft

    act(() => {
      result.current.selectMeeting(baseProps.userMeetings[1]);
    });
    
    expect(result.current.selectedMeetingId).toBe("m2");
    expect(result.current.selectedMeeting).toBeDefined();

    act(() => {
      result.current.setMeetingDraft({ title: "Updated title" });
    });
    expect(result.current.meetingDraft.title).toBe("Updated title");
  });

  test("startNewMeetingDraft & saveMeeting", () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps));

    act(() => {
      result.current.startNewMeetingDraft({ title: "Pre-filled" });
    });

    expect(result.current.isDetachedMeetingDraft).toBe(true);
    expect(result.current.meetingDraft.title).toBe("Pre-filled");

    act(() => {
      result.current.saveMeeting();
    });

    expect(mockSetMeetings).toHaveBeenCalled();
  });

  test("clearMeetingDraft", () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps));
    
    act(() => {
      result.current.startNewMeetingDraft();
    });
    
    act(() => {
      result.current.clearMeetingDraft();
    });

    expect(result.current.isDetachedMeetingDraft).toBe(true);
  });

  test("createAdHocMeeting and createMeetingDirect", () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps));
    
    let m1;
    act(() => {
      m1 = result.current.createAdHocMeeting();
    });
    expect(m1.title).toMatch(/Ad hoc/);
    expect(mockSetMeetings).toHaveBeenCalled();

    let m2;
    act(() => {
      m2 = result.current.createMeetingDirect(createEmptyMeetingDraft());
    });
    expect(m2).toBeDefined();
  });

  test("resetSelectionState", () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps));
    act(() => {
      result.current.resetSelectionState();
    });
    expect(result.current.selectedMeetingId).toBeNull();
  });

  test("handles empty props gracefully and rejects ad hoc meeting", () => {
    const { result } = renderHook(() => useMeetingLifecycle({
      ...baseProps,
      currentUserId: null,
      currentWorkspaceId: null,
    }));
    expect(result.current.selectedMeetingId).toBeNull();
    
    let m1;
    act(() => {
      m1 = result.current.createAdHocMeeting();
    });
    expect(m1).toBeNull();
  });
});
