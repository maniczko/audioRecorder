import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.unmock('./workspaceStore');

import { isWorkspaceSessionUsable, useWorkspaceStore } from './workspaceStore';

const mocks = vi.hoisted(() => ({
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  clearPersistedSession: vi.fn(),
  syncLegacySession: vi.fn((session) => session),
  bootstrap: vi.fn(),
}));

vi.mock('../services/workspaceService', () => ({
  createWorkspaceService: () => ({
    updateMemberRole: mocks.updateMemberRole,
    removeMember: mocks.removeMember,
  }),
}));

vi.mock('../services/stateService', () => ({
  createStateService: () => ({
    mode: 'remote',
    bootstrap: mocks.bootstrap,
    syncWorkspaceState: vi.fn(),
  }),
}));

vi.mock('../lib/sessionStorage', () => ({
  clearPersistedSession: mocks.clearPersistedSession,
  syncLegacySessionFromWorkspaceSession: mocks.syncLegacySession,
}));

vi.mock('../services/config', () => ({
  APP_DATA_PROVIDER: 'remote',
}));

describe('workspaceStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useWorkspaceStore.setState({
      users: [],
      workspaces: [],
      session: null,
      isHydratingSession: false,
      sessionError: '',
    });
  });

  test('setSession persists a legacy-compatible snapshot', () => {
    const session = { userId: 'u1', workspaceId: 'ws1', token: 'token' };

    useWorkspaceStore.getState().setSession(session);

    expect(mocks.syncLegacySession).toHaveBeenCalledWith(session);
    expect(useWorkspaceStore.getState().session).toEqual(session);
  });

  test('switchWorkspace ignores empty or unchanged workspace ids', () => {
    const session = { userId: 'u1', workspaceId: 'ws1', token: 'token' };
    useWorkspaceStore.setState({ session });

    useWorkspaceStore.getState().switchWorkspace('');
    useWorkspaceStore.getState().switchWorkspace('ws1');

    expect(useWorkspaceStore.getState().session).toEqual(session);
  });

  test('switchWorkspace updates the active workspace when session is valid', () => {
    useWorkspaceStore.setState({ session: { userId: 'u1', workspaceId: 'ws1', token: 'token' } });

    useWorkspaceStore.getState().switchWorkspace('ws2');

    expect(useWorkspaceStore.getState().session).toMatchObject({ workspaceId: 'ws2' });
  });

  test('updateWorkspaceMemberRole updates local workspace and user role fallback', async () => {
    mocks.updateMemberRole.mockResolvedValue({ membership: { memberRole: 'admin' } });
    useWorkspaceStore.setState({
      users: [
        { id: 'owner', defaultWorkspaceId: 'ws1', workspaceIds: ['ws1'] },
        { id: 'member', defaultWorkspaceId: 'ws1', workspaceIds: ['ws1'] },
      ],
      workspaces: [{ id: 'ws1', memberIds: ['owner', 'member'], memberRoles: { owner: 'owner' } }],
      session: { userId: 'owner', workspaceId: 'ws1', token: 'token' },
    });

    await useWorkspaceStore.getState().updateWorkspaceMemberRole('member', 'admin');

    expect(mocks.updateMemberRole).toHaveBeenCalled();
    expect(useWorkspaceStore.getState().workspaces[0].memberRoles.member).toBe('admin');
    expect(useWorkspaceStore.getState().users[1].workspaceMemberRole).toBe('admin');
  });

  test('logout clears session and persisted session snapshot', () => {
    useWorkspaceStore.setState({
      users: [{ id: 'u1' }],
      workspaces: [{ id: 'ws1' }],
      session: { userId: 'u1', workspaceId: 'ws1', token: 'token' },
    });

    useWorkspaceStore.getState().logout();

    expect(mocks.clearPersistedSession).toHaveBeenCalled();
    expect(useWorkspaceStore.getState().session).toBeNull();
    expect(useWorkspaceStore.getState().users).toEqual([]);
    expect(useWorkspaceStore.getState().workspaces).toEqual([]);
  });

  test('treats a persisted remote session without token as unusable', () => {
    expect(isWorkspaceSessionUsable({ userId: 'u1', workspaceId: 'ws1', token: '' })).toBe(false);
    expect(isWorkspaceSessionUsable({ userId: 'u1', workspaceId: 'ws1', token: 'token' })).toBe(
      true
    );
  });

  test('bootstrap clears remote session data when token is missing', async () => {
    useWorkspaceStore.setState({
      users: [{ id: 'u1' }],
      workspaces: [{ id: 'ws1' }],
      session: { userId: 'u1', workspaceId: 'ws1', token: '' },
    });

    await useWorkspaceStore.getState().bootstrapSession();

    expect(mocks.clearPersistedSession).toHaveBeenCalled();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().session).toBeNull();
    expect(useWorkspaceStore.getState().users).toEqual([]);
    expect(useWorkspaceStore.getState().workspaces).toEqual([]);
  });
});
