import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';

const bootstrapMock = vi.fn();
const updateMemberRoleMock = vi.fn();
let onUnauthorizedCb: (() => void) | null = null;

vi.mock('../services/stateService', () => ({
  createStateService: vi.fn(() => ({
    mode: 'remote',
    bootstrap: bootstrapMock,
  })),
}));

vi.mock('../services/workspaceService', () => ({
  createWorkspaceService: vi.fn(() => ({
    updateMemberRole: updateMemberRoleMock,
  })),
}));

vi.mock('../services/httpClient', () => ({
  onUnauthorized: vi.fn((cb: () => void) => {
    onUnauthorizedCb = cb;
  }),
  httpClient: vi.fn().mockResolvedValue({}),
}));

vi.mock('../lib/storage', () => ({
  STORAGE_KEYS: {
    users: 'voicelog.users',
    session: 'voicelog.session',
    workspaces: 'voicelog.workspaces',
  },
  readStorage: vi.fn((_key: string, init: unknown) => init),
  writeStorage: vi.fn(),
  readStorageAsync: vi.fn().mockResolvedValue(undefined),
  writeStorageAsync: vi.fn().mockResolvedValue(undefined),
}));

import useWorkspace from './useWorkspace';
import { readStorage } from '../lib/storage';

describe('useWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onUnauthorizedCb = null;
  });

  test('hydrates remote session and updates persisted state', async () => {
    (readStorage as ReturnType<typeof vi.fn>).mockImplementation((key: string, init: unknown) => {
      if (key === 'voicelog.session') return { userId: 'u1', workspaceId: 'ws1', token: 'tok' };
      if (key === 'voicelog.users') return [{ id: 'u1', workspaceIds: ['ws1'] }];
      if (key === 'voicelog.workspaces') return [{ id: 'ws1', memberIds: ['u1'] }];
      return init;
    });

    bootstrapMock.mockResolvedValue({
      users: [{ id: 'u1', name: 'Hydrated' }],
      workspaces: [{ id: 'ws1', name: 'Remote WS' }],
    });

    const { result } = renderHook(() => useWorkspace());

    expect(result.current.isHydratingSession).toBe(true);

    await waitFor(() => {
      expect(result.current.isHydratingSession).toBe(false);
    });

    expect(bootstrapMock).toHaveBeenCalledWith('ws1');
    expect(result.current.users).toEqual([{ id: 'u1', name: 'Hydrated' }]);
    expect(result.current.workspaces).toEqual([{ id: 'ws1', name: 'Remote WS' }]);
  });

  test('logs out on 401 unauthorized from bootstrap', async () => {
    (readStorage as ReturnType<typeof vi.fn>).mockImplementation((key: string, init: unknown) => {
      if (key === 'voicelog.session') return { userId: 'u1', workspaceId: 'ws1', token: 'tok' };
      if (key === 'voicelog.users') return [{ id: 'u1' }];
      if (key === 'voicelog.workspaces') return [{ id: 'ws1' }];
      return init;
    });

    bootstrapMock.mockRejectedValue({ status: 401, message: 'Unauthorized' });

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => {
      expect(result.current.isHydratingSession).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.users).toEqual([]);
    expect(result.current.workspaces).toEqual([]);
  });

  test('updates member role through workspace service', async () => {
    (readStorage as ReturnType<typeof vi.fn>).mockImplementation((key: string, init: unknown) => {
      if (key === 'voicelog.session') return { userId: 'u1', workspaceId: 'ws1', token: 'tok' };
      if (key === 'voicelog.users')
        return [
          { id: 'u1', workspaceIds: ['ws1'] },
          { id: 'u2', workspaceMemberRole: 'member' },
        ];
      if (key === 'voicelog.workspaces')
        return [{ id: 'ws1', ownerUserId: 'u1', memberIds: ['u1', 'u2'] }];
      return init;
    });

    bootstrapMock.mockResolvedValue(null);

    updateMemberRoleMock.mockResolvedValue({
      membership: { memberRole: 'admin' },
    });

    const { result } = renderHook(() => useWorkspace());

    await waitFor(() => {
      expect(result.current.isHydratingSession).toBe(false);
    });

    await act(async () => {
      await result.current.updateWorkspaceMemberRole('u2', 'admin');
    });

    const updatedUser = result.current.users.find((u: any) => u.id === 'u2');
    expect(updatedUser.workspaceMemberRole).toBe('admin');
    expect(updateMemberRoleMock).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      targetUserId: 'u2',
      memberRole: 'admin',
    });
  });
});
