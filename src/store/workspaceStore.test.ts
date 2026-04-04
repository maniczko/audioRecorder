import { describe, expect, test, vi } from 'vitest';

// Hoisted mocks for services
const mocks = vi.hoisted(() => ({
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  clearPersistedSession: vi.fn(),
  syncLegacySession: vi.fn((s) => s),
  bootstrap: vi.fn().mockResolvedValue(null),
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
    syncWorkspaceState: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('../lib/sessionStorage', () => ({
  clearPersistedSession: mocks.clearPersistedSession,
  syncLegacySessionFromWorkspaceSession: mocks.syncLegacySession,
}));

describe('workspaceStore — actions that use mocked services', () => {
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

describe('workspaceStore — pure state operations', () => {
  test('switches workspace and updates session workspaceId', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({
      session: { userId: 'u1', workspaceId: 'ws_old', token: 'tok' },
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

  test('setSession updates session', async () => {
    const { useWorkspaceStore } = await import('./workspaceStore');
    useWorkspaceStore.setState({ session: null });

    const newSession = { userId: 'u1', workspaceId: 'ws1', token: 'tok' };
    useWorkspaceStore.getState().setSession(newSession);

    expect(useWorkspaceStore.getState().session).toEqual(newSession);
  });
});
