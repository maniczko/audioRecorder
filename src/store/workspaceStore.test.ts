import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../services/workspaceService', () => ({
  createWorkspaceService: vi.fn(() => ({
    updateMemberRole: vi.fn(),
  })),
}));

vi.mock('../services/stateService', () => ({
  createStateService: vi.fn(() => ({
    mode: 'remote',
    bootstrap: vi.fn(),
  })),
}));

vi.mock('../lib/sessionStorage', () => ({
  clearPersistedSession: vi.fn(),
  syncLegacySessionFromWorkspaceSession: vi.fn((s) => s),
}));

describe('workspaceStore', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('switches workspace and updates session workspaceId', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws_old', token: 'tok' },
      users: [{ id: 'u1', workspaceIds: ['ws_old', 'ws_new'] }],
      workspaces: [{ id: 'ws_old' }, { id: 'ws_new' }],
    });

    useWorkspaceStore.getState().switchWorkspace('ws_new');

    expect(useWorkspaceStore.getState().session).toMatchObject({
      workspaceId: 'ws_new',
    });
  });

  test('switchWorkspace is a no-op for same workspace', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
    });

    useWorkspaceStore.getState().switchWorkspace('ws1');

    expect(useWorkspaceStore.getState().session).toMatchObject({ workspaceId: 'ws1' });
  });

  test('updates member role through workspace service', async () => {
    const { createWorkspaceService } = await import('../services/workspaceService');
    const updateMemberRoleMock = vi.fn().mockResolvedValue({
      membership: { memberRole: 'admin' },
    });
    (createWorkspaceService as any).mockReturnValue({ updateMemberRole: updateMemberRoleMock });

    vi.resetModules();
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
      users: [
        { id: 'u1', workspaceIds: ['ws1'] },
        { id: 'u2', workspaceMemberRole: 'member' },
      ],
      workspaces: [{ id: 'ws1', ownerUserId: 'u1', memberIds: ['u1', 'u2'] }],
    });

    await useWorkspaceStore.getState().updateWorkspaceMemberRole('u2', 'admin');

    const updatedUser = useWorkspaceStore.getState().users.find((u) => u.id === 'u2');
    expect(updatedUser.workspaceMemberRole).toBe('admin');
  });

  test('bootstrapSession clears session on 401 unauthorized', async () => {
    const { createStateService } = await import('../services/stateService');
    const bootstrapMock = vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' });
    (createStateService as any).mockReturnValue({ mode: 'remote', bootstrap: bootstrapMock });

    vi.resetModules();
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
      users: [{ id: 'u1' }],
      workspaces: [{ id: 'ws1' }],
    });

    await useWorkspaceStore.getState().bootstrapSession();

    expect(useWorkspaceStore.getState().session).toBeNull();
    expect(useWorkspaceStore.getState().users).toEqual([]);
  });

  test('bootstrapSession hydrates users and workspaces from remote', async () => {
    const { createStateService } = await import('../services/stateService');
    const bootstrapMock = vi.fn().mockResolvedValue({
      users: [{ id: 'u1', name: 'Alice' }],
      workspaces: [{ id: 'ws1', name: 'Team' }],
    });
    (createStateService as any).mockReturnValue({ mode: 'remote', bootstrap: bootstrapMock });

    vi.resetModules();
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
      users: [],
      workspaces: [],
    });

    await useWorkspaceStore.getState().bootstrapSession();

    expect(useWorkspaceStore.getState().users).toEqual([{ id: 'u1', name: 'Alice' }]);
    expect(useWorkspaceStore.getState().workspaces).toEqual([{ id: 'ws1', name: 'Team' }]);
    expect(useWorkspaceStore.getState().isHydratingSession).toBe(false);
  });

  test('logout clears session', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
    });

    useWorkspaceStore.getState().logout();

    expect(useWorkspaceStore.getState().session).toBeNull();
  });
});
