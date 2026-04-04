import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Hoisted mocks that survive vi.resetModules()
const mocks = vi.hoisted(() => ({
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  bootstrap: vi.fn(),
  clearPersistedSession: vi.fn(),
  syncLegacySession: vi.fn((s) => s),
  createStateService: vi.fn(),
}));

vi.mock('../services/workspaceService', () => ({
  createWorkspaceService: () => ({
    updateMemberRole: mocks.updateMemberRole,
    removeMember: mocks.removeMember,
  }),
}));

vi.mock('../services/stateService', () => ({
  createStateService: mocks.createStateService,
}));

vi.mock('../lib/sessionStorage', () => ({
  clearPersistedSession: mocks.clearPersistedSession,
  syncLegacySessionFromWorkspaceSession: mocks.syncLegacySession,
}));

describe('workspaceStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.updateMemberRole.mockReset();
    mocks.removeMember.mockReset();
    mocks.bootstrap.mockReset();
    mocks.clearPersistedSession.mockReset();
    mocks.syncLegacySession.mockImplementation((s) => s);
    mocks.createStateService.mockReturnValue({
      mode: 'remote',
      bootstrap: mocks.bootstrap,
    });
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

  test('switchWorkspace is a no-op for empty workspaceId', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
    });

    useWorkspaceStore.getState().switchWorkspace('');

    expect(useWorkspaceStore.getState().session).toMatchObject({ workspaceId: 'ws1' });
  });

  test('updates member role through workspace service', async () => {
    mocks.updateMemberRole.mockResolvedValue({
      membership: { memberRole: 'admin' },
    });

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

  test('updateWorkspaceMemberRole is a no-op without workspace', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: null,
      users: [],
      workspaces: [],
    });

    await useWorkspaceStore.getState().updateWorkspaceMemberRole('u2', 'admin');

    expect(mocks.updateMemberRole).not.toHaveBeenCalled();
  });

  test('bootstrapSession clears session on 401 unauthorized', async () => {
    mocks.bootstrap.mockRejectedValue({ status: 401, message: 'Unauthorized' });

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
    mocks.bootstrap.mockResolvedValue({
      users: [{ id: 'u1', name: 'Alice' }],
      workspaces: [{ id: 'ws1', name: 'Team' }],
    });

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

  test('bootstrapSession sets sessionError on non-401 error', async () => {
    mocks.bootstrap.mockRejectedValue({ status: 500, message: 'Server error' });

    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
      users: [{ id: 'u1' }],
      workspaces: [{ id: 'ws1' }],
    });

    await useWorkspaceStore.getState().bootstrapSession();

    expect(useWorkspaceStore.getState().sessionError).toBe('Server error');
    expect(useWorkspaceStore.getState().isHydratingSession).toBe(false);
  });

  test('bootstrapSession is a no-op when stateService mode is not remote', async () => {
    // Override the mock to return local mode
    mocks.createStateService.mockReturnValue({
      mode: 'local',
      bootstrap: mocks.bootstrap,
    });

    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
      isHydratingSession: false,
    });

    await useWorkspaceStore.getState().bootstrapSession();

    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().isHydratingSession).toBe(false);
  });

  test('bootstrapSession is a no-op when session has no token', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: '' },
      isHydratingSession: false,
    });

    await useWorkspaceStore.getState().bootstrapSession();

    expect(mocks.bootstrap).not.toHaveBeenCalled();
  });

  test('logout clears session', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
    });

    useWorkspaceStore.getState().logout();

    expect(useWorkspaceStore.getState().session).toBeNull();
  });

  test('setUsers accepts array updater', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({ users: [] });

    useWorkspaceStore.getState().setUsers([{ id: 'u1' }]);

    expect(useWorkspaceStore.getState().users).toEqual([{ id: 'u1' }]);
  });

  test('setUsers accepts function updater', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({ users: [{ id: 'u1' }] });

    useWorkspaceStore.getState().setUsers((prev) => [...prev, { id: 'u2' }]);

    expect(useWorkspaceStore.getState().users).toHaveLength(2);
  });

  test('setWorkspaces accepts array updater', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({ workspaces: [] });

    useWorkspaceStore.getState().setWorkspaces([{ id: 'ws1' }]);

    expect(useWorkspaceStore.getState().workspaces).toEqual([{ id: 'ws1' }]);
  });

  test('setSession persists snapshot and updates session', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({ session: null });

    const newSession = { userId: 'u1', workspaceId: 'ws1', token: 'tok' };
    useWorkspaceStore.getState().setSession(newSession);

    expect(useWorkspaceStore.getState().session).toEqual(newSession);
    expect(mocks.syncLegacySession).toHaveBeenCalledWith(newSession);
  });

  test('removeWorkspaceMember removes user from workspace and users list', async () => {
    mocks.removeMember.mockResolvedValue(undefined);

    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws1', token: 'tok' },
      users: [
        { id: 'u1', workspaceIds: ['ws1'] },
        { id: 'u2', workspaceMemberRole: 'member' },
      ],
      workspaces: [
        { id: 'ws1', ownerUserId: 'u1', memberIds: ['u1', 'u2'], memberRoles: { u2: 'member' } },
      ],
    });

    await useWorkspaceStore.getState().removeWorkspaceMember('u2');

    expect(useWorkspaceStore.getState().users).toEqual([{ id: 'u1', workspaceIds: ['ws1'] }]);
  });

  test('removeWorkspaceMember is a no-op without workspace', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: null,
      users: [],
      workspaces: [],
    });

    await useWorkspaceStore.getState().removeWorkspaceMember('u2');

    expect(mocks.removeMember).not.toHaveBeenCalled();
  });
});
