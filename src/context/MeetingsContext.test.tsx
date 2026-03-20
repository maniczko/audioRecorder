import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { MeetingsProvider, useMeetingsCtx } from './MeetingsContext';
import { useWorkspaceCtx } from './WorkspaceContext';
import { vi, describe, it, expect } from 'vitest';

// Mock WorkspaceContext
vi.mock('./WorkspaceContext', () => ({
  useWorkspaceCtx: vi.fn(),
}));

describe('MeetingsContext', () => {
  const mockWorkspace = {
    workspace: {
      users: [],
      setUsers: vi.fn(),
      workspaces: [{ id: 'w1', name: 'W1' }],
      setWorkspaces: vi.fn(),
      session: { userId: 'u1', workspaceId: 'w1' },
      setSession: vi.fn(),
      currentUser: { id: 'u1', name: 'User 1' },
      currentUserId: 'u1',
      currentWorkspace: { id: 'w1', name: 'W1' },
      currentWorkspaceId: 'w1',
      currentWorkspaceMembers: [],
      isHydratingRemoteState: false,
      switchWorkspace: vi.fn(),
    },
  };

  it('provides meetings context and allows creating an ad hoc meeting', async () => {
    (useWorkspaceCtx as any).mockReturnValue(mockWorkspace);

    const wrapper = ({ children }) => <MeetingsProvider>{children}</MeetingsProvider>;
    const { result } = renderHook(() => useMeetingsCtx(), { wrapper });

    expect(result.current.meetings.userMeetings).toEqual([]);

    let m1;
    await act(async () => {
      m1 = result.current.meetings.createAdHocMeeting();
    });

    expect(m1).toBeDefined();
    expect(result.current.meetings.userMeetings).toHaveLength(1);

    // Test selection logic
    await act(async () => {
      result.current.meetings.setSelectedMeetingId(m1.id);
    });
    expect(result.current.meetings.selectedMeetingId).toBe(m1.id);

    // Test update logic
    await act(async () => {
      result.current.meetings.updateMeeting(m1.id, { title: "Updated Title", context: "Updated Context" });
    });
    expect(result.current.meetings.userMeetings[0].title).toBe("Updated Title");
    expect(result.current.meetings.userMeetings[0].context).toBe("Updated Context");

    // Test deletion logic
    await act(async () => {
      result.current.meetings.deleteMeeting(m1.id);
    });
    expect(result.current.meetings.userMeetings).toHaveLength(0);
    expect(result.current.meetings.selectedMeetingId).toBeNull();
  });
});
