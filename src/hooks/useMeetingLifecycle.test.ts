import { renderHook, act } from "@testing-library/react";
import useMeetingLifecycle from "./useMeetingLifecycle";
import { createEmptyMeetingDraft } from "../lib/meeting";
import { STORAGE_KEYS } from "../lib/storage";
import { vi, describe, test, expect, beforeEach } from "vitest";

describe("useMeetingLifecycle", () => {
  const mockSetMeetings = vi.fn();
  const mockSetWorkspaceMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
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
    const { result } = renderHook((props) => useMeetingLifecycle(props), { initialProps: baseProps as any });
    
    // Automatically selects the first meeting or handles detached drafts
    // In our implementation, it defaults to userMeetings[0] if none is selected
    expect(result.current.selectedMeetingId).toBe("m1");

    act(() => {
      result.current.selectMeeting(baseProps.userMeetings[1] as any);
    });
    
    expect(result.current.selectedMeetingId).toBe("m2");
    expect(result.current.selectedMeeting).toBeDefined();

    act(() => {
      result.current.setMeetingDraft({ title: "Updated title" });
    });
    expect(result.current.meetingDraft.title).toBe("Updated title");
  });

  test("startNewMeetingDraft & saveMeeting", () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));

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
    const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));
    
    act(() => {
      result.current.startNewMeetingDraft();
    });
    
    act(() => {
      result.current.clearMeetingDraft();
    });

    expect(result.current.isDetachedMeetingDraft).toBe(true);
  });

  test("createAdHocMeeting and createMeetingDirect", () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));
    
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

  test("syncing selected meeting to draft", () => {
    const { result } = renderHook((props) => useMeetingLifecycle(props), { initialProps: baseProps as any });
    
    expect(result.current.selectedMeetingId).toBe("m1");
    expect(result.current.meetingDraft.title).toBe("M1");

    // Select different meeting
    act(() => {
      result.current.selectMeeting(baseProps.userMeetings[1] as any);
    });
    expect(result.current.selectedMeetingId).toBe("m2");
    expect(result.current.meetingDraft.title).toBe("M2");
  });

  test("handling detached draft from storage", () => {
    // Mock local storage draft for current workspace
    const storedDraft = {
       "w1": {
          draft: { title: "Cached title", durationMinutes: 120 },
          baselineDraft: { title: "M1" },
          selectedMeetingId: "m1",
          updatedAt: new Date().toISOString()
       }
    };
    localStorage.setItem(STORAGE_KEYS.meetingDrafts, JSON.stringify(storedDraft));

    const { result } = renderHook((props) => useMeetingLifecycle(props), { initialProps: baseProps as any });
    
    // It should RESTORE the cached title instead of M1
    expect(result.current.meetingDraft.title).toBe("Cached title");
    expect(result.current.selectedMeetingId).toBe("m1");
    expect(mockSetWorkspaceMessage).toHaveBeenCalledWith(expect.stringContaining("Przywrocono"));
  });

  test("resetSelectionState", () => {
    const { result } = renderHook(() => useMeetingLifecycle(baseProps as any));
    act(() => {
      result.current.resetSelectionState();
    });
    // It auto-selects m1 if userMeetings is not empty
    expect(result.current.selectedMeetingId).toBe("m1");
    expect(result.current.isDetachedMeetingDraft).toBe(false);
  });
});
