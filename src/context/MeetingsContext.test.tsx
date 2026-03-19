import React from "react";
import { renderHook, act } from "@testing-library/react";
import { MeetingsProvider, useMeetingsCtx } from "./MeetingsContext";
import { useWorkspaceCtx } from "./WorkspaceContext";

vi.mock("./WorkspaceContext", () => ({
  useWorkspaceCtx: vi.fn(),
}));

describe("MeetingsContext", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceCtx.mockReturnValue({
      workspace: {
        users: [{ id: "u1" }],
        setUsers: vi.fn(),
        workspaces: [{ id: "w1" }],
        setWorkspaces: vi.fn(),
        session: { userId: "u1", workspaceId: "w1" },
        setSession: vi.fn(),
        currentUser: { id: "u1" },
        currentUserId: "u1",
        currentWorkspaceId: "w1",
        currentWorkspaceMembers: [{ id: "u1" }],
        isHydratingRemoteState: false,
      },
    });
  });

  test("passes currentWorkspaceId correctly to useMeetings which allows creating ad-hoc meetings", () => {
    const wrapper = ({ children }) => <MeetingsProvider>{children}</MeetingsProvider>;
    const { result } = renderHook(() => useMeetingsCtx(), { wrapper });

    expect(result.current.meetings.currentWorkspaceId).toBe("w1");

    let m1;
    act(() => {
      m1 = result.current.meetings.createAdHocMeeting();
    });
    
    expect(m1).not.toBeNull();
    expect(m1.workspaceId).toBe("w1");
    expect(m1.createdByUserId).toBe("u1");
  });
});
