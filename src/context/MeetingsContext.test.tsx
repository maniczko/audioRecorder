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

    // Initial meetings should be empty
    expect(result.current.meetings.userMeetings).toEqual([]);

    let m1;
    // We use await act for potentially async state updates
    await act(async () => {
      m1 = result.current.meetings.createAdHocMeeting();
    });

    expect(m1).toBeDefined();
    expect(m1.title).toContain('Ad hoc');
    expect(result.current.meetings.userMeetings).toHaveLength(1);
    expect(result.current.meetings.userMeetings[0].id).toBe(m1.id);
  });
});
