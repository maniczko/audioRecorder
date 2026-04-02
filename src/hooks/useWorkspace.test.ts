/**
 * @vitest-environment jsdom
 * useWorkspace Hook Tests
 *
 * Tests for workspace state management and selectors
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import useWorkspace from './useWorkspace';

// ── Mock setup ─────────────────────────────────────────────────

const mockSetUsers = vi.fn();
const mockSetSession = vi.fn();
const mockSetWorkspaces = vi.fn();

// useStoredState returns [value, setter] — we control the value per-test
let storedUsers: any[] = [];
let storedSession: any = null;
let storedWorkspaces: any[] = [];

vi.mock('./useStoredState', () => ({
  default: (key: string, fallback: any) => {
    if (key.includes('users')) return [storedUsers, mockSetUsers];
    if (key.includes('session')) return [storedSession, mockSetSession];
    if (key.includes('workspace')) return [storedWorkspaces, mockSetWorkspaces];
    return [fallback, vi.fn()];
  },
}));

const mockResolveWorkspace = vi.hoisted(() => vi.fn(() => 'ws1'));
const mockWorkspaceMembers = vi.hoisted(() => vi.fn(() => []));

vi.mock('../lib/workspace', () => ({
  resolveWorkspaceForUser: mockResolveWorkspace,
  workspaceMembers: mockWorkspaceMembers,
}));

const mockGetPermissions = vi.hoisted(() =>
  vi.fn(() => ({ canRecordAudio: true, canInviteMembers: false }))
);

vi.mock('../lib/permissions', () => ({
  getWorkspacePermissions: mockGetPermissions,
}));

vi.mock('../services/stateService', () => ({
  createStateService: () => ({ mode: 'local', bootstrap: vi.fn() }),
}));

vi.mock('../services/workspaceService', () => ({
  createWorkspaceService: () => ({ updateMemberRole: vi.fn() }),
}));

vi.mock('../services/httpClient', () => ({
  onUnauthorized: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────

function seedDefaults() {
  storedUsers = [
    { id: 'u1', name: 'Test User', email: 'test@example.com' },
    { id: 'u2', name: 'Other', email: 'other@example.com' },
  ];
  storedSession = { userId: 'u1', token: 'tok', workspaceId: 'ws1' };
  storedWorkspaces = [
    { id: 'ws1', name: 'Workspace 1', memberIds: ['u1', 'u2'] },
    { id: 'ws2', name: 'Workspace 2', memberIds: ['u2'] },
  ];
  mockResolveWorkspace.mockReturnValue('ws1');
  mockWorkspaceMembers.mockReturnValue([
    { id: 'u1', name: 'Test User', workspaceMemberRole: 'owner' },
  ]);
}

describe('useWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedDefaults();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    storedUsers = [];
    storedSession = null;
    storedWorkspaces = [];
  });

  it('returns current user derived from session', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentUser).toEqual({
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(result.current.currentUserId).toBe('u1');
  });

  it('returns null user when no session', () => {
    storedSession = null;

    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentUser).toBeNull();
    expect(result.current.currentUserId).toBeNull();
  });

  it('returns current workspace from workspaces array', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentWorkspace).toEqual({
      id: 'ws1',
      name: 'Workspace 1',
      memberIds: ['u1', 'u2'],
    });
    expect(result.current.currentWorkspaceId).toBe('ws1');
  });

  it('returns null workspace when resolveWorkspaceForUser returns null', () => {
    mockResolveWorkspace.mockReturnValue(null);

    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentWorkspace).toBeNull();
    expect(result.current.currentWorkspaceId).toBeNull();
  });

  it('returns workspace members from workspaceMembers helper', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentWorkspaceMembers).toEqual([
      { id: 'u1', name: 'Test User', workspaceMemberRole: 'owner' },
    ]);
    expect(mockWorkspaceMembers).toHaveBeenCalledWith(storedUsers, storedWorkspaces[0]);
  });

  it('returns workspace permissions from getWorkspacePermissions', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentWorkspacePermissions).toEqual({
      canRecordAudio: true,
      canInviteMembers: false,
    });
  });

  it('filters available workspaces by current user membership', () => {
    const { result } = renderHook(() => useWorkspace());

    // u1 is member of ws1 only
    expect(result.current.availableWorkspaces).toEqual([
      { id: 'ws1', name: 'Workspace 1', memberIds: ['u1', 'u2'] },
    ]);
  });

  it('returns empty available workspaces when no user', () => {
    storedSession = null;

    const { result } = renderHook(() => useWorkspace());

    expect(result.current.availableWorkspaces).toEqual([]);
  });

  it('returns users list', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.users).toHaveLength(2);
  });

  it('returns session and state setters', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.setUsers).toBeDefined();
    expect(result.current.setSession).toBeDefined();
    expect(result.current.setWorkspaces).toBeDefined();
  });

  it('returns switchWorkspace function', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(typeof result.current.switchWorkspace).toBe('function');
  });

  it('returns updateWorkspaceMemberRole function', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(typeof result.current.updateWorkspaceMemberRole).toBe('function');
  });

  it('returns hydration status', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(typeof result.current.isHydratingSession).toBe('boolean');
    expect(typeof result.current.sessionError).toBe('string');
  });

  describe('when no workspace data', () => {
    it('returns empty arrays and null values', () => {
      storedUsers = [];
      storedSession = null;
      storedWorkspaces = [];
      mockResolveWorkspace.mockReturnValue(null);
      mockWorkspaceMembers.mockReturnValue([]);

      const { result } = renderHook(() => useWorkspace());

      expect(result.current.users).toEqual([]);
      expect(result.current.currentUser).toBeNull();
      expect(result.current.currentWorkspace).toBeNull();
      expect(result.current.currentWorkspaceMembers).toEqual([]);
      expect(result.current.availableWorkspaces).toEqual([]);
    });
  });

  describe('when workspace is hydrated', () => {
    it('returns full workspace data', () => {
      const { result } = renderHook(() => useWorkspace());

      expect(result.current.currentWorkspace).toBeDefined();
      expect(result.current.currentWorkspaceId).toBe('ws1');
      expect(result.current.currentUser).toBeDefined();
      expect(result.current.users).toHaveLength(2);
    });
  });
});
