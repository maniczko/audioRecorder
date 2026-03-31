/**
 * @vitest-environment jsdom
 * useWorkspace Hook Tests
 *
 * Tests for workspace state management and selectors
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import useWorkspace from './useWorkspace';

// Mock store
const mockWorkspaceStore = vi.hoisted(() => ({
  users: [{ id: 'u1', name: 'User 1' }],
  workspaces: [{ id: 'ws1', name: 'Workspace 1' }],
  currentUser: null,
  currentWorkspace: null,
  currentWorkspaceId: null,
  availableWorkspaces: [],
  currentWorkspaceMembers: [],
  currentWorkspacePermissions: null,
  selectedWorkspaceState: null,
  isWorkspaceStateHydrated: false,
  isHydratingWorkspaceState: false,
  workspaceMessage: '',
  usersHydrated: false,
  isHydratingUsers: false,
}));

const mockWorkspaceSelectors = vi.hoisted(() => ({
  currentUser: { id: 'u1', name: 'Test User', email: 'test@example.com' },
  currentUserId: 'u1',
  currentWorkspaceId: 'ws1',
  currentWorkspace: { id: 'ws1', name: 'Test Workspace' },
  currentWorkspaceMembers: [{ userId: 'u1', role: 'owner' }],
  currentWorkspacePermissions: { canRecordAudio: true, canInviteMembers: true },
  availableWorkspaces: [
    { id: 'ws1', name: 'Workspace 1' },
    { id: 'ws2', name: 'Workspace 2' },
  ],
  users: [{ id: 'u1', name: 'User 1' }],
  selectedWorkspaceState: { meetings: [], tasks: [] },
  isWorkspaceStateHydrated: true,
  isHydratingWorkspaceState: false,
  workspaceMessage: '',
  usersHydrated: true,
  isHydratingUsers: false,
}));

vi.mock('../store/workspaceStore', () => ({
  useWorkspaceStore: () => mockWorkspaceStore,
  useWorkspaceSelectors: () => mockWorkspaceSelectors,
}));

describe('useWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns current user from selectors', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentUser).toEqual({
      id: 'u1',
      name: 'Test User',
      email: 'test@example.com',
    });
  });

  it('returns current user ID', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentUserId).toBe('u1');
  });

  it('returns current workspace', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentWorkspace).toEqual({
      id: 'ws1',
      name: 'Test Workspace',
    });
  });

  it('returns current workspace ID', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentWorkspaceId).toBe('ws1');
  });

  it('returns current workspace members', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentWorkspaceMembers).toEqual([{ userId: 'u1', role: 'owner' }]);
  });

  it('returns current workspace permissions', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.currentWorkspacePermissions).toEqual({
      canRecordAudio: true,
      canInviteMembers: true,
    });
  });

  it('returns available workspaces', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.availableWorkspaces).toEqual([
      { id: 'ws1', name: 'Workspace 1' },
      { id: 'ws2', name: 'Workspace 2' },
    ]);
  });

  it('returns users list', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.users).toEqual([{ id: 'u1', name: 'User 1' }]);
  });

  it('returns selected workspace state', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.selectedWorkspaceState).toEqual({
      meetings: [],
      tasks: [],
    });
  });

  it('returns workspace state hydration status', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.isWorkspaceStateHydrated).toBe(true);
    expect(result.current.isHydratingWorkspaceState).toBe(false);
  });

  it('returns workspace message', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.workspaceMessage).toBe('');
  });

  it('returns users hydration status', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.usersHydrated).toBe(true);
    expect(result.current.isHydratingUsers).toBe(false);
  });

  it('returns all store methods', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.setUsers).toBeDefined();
    expect(result.current.setWorkspaces).toBeDefined();
    expect(result.current.setCurrentUser).toBeDefined();
    expect(result.current.setCurrentWorkspace).toBeDefined();
    expect(result.current.setAvailableWorkspaces).toBeDefined();
    expect(result.current.setWorkspaceMembers).toBeDefined();
    expect(result.current.setWorkspacePermissions).toBeDefined();
    expect(result.current.setSelectedWorkspaceState).toBeDefined();
    expect(result.current.setWorkspaceStateHydrated).toBeDefined();
    expect(result.current.setWorkspaceMessage).toBeDefined();
  });

  it('returns all selector methods', () => {
    const { result } = renderHook(() => useWorkspace());

    expect(result.current.getCurrentUser).toBeDefined();
    expect(result.current.getCurrentWorkspace).toBeDefined();
    expect(result.current.getCurrentWorkspaceMembers).toBeDefined();
    expect(result.current.getCurrentWorkspacePermissions).toBeDefined();
    expect(result.current.getAvailableWorkspaces).toBeDefined();
    expect(result.current.getUsers).toBeDefined();
    expect(result.current.getSelectedWorkspaceState).toBeDefined();
  });

  describe('when workspace is not hydrated', () => {
    it('returns null currentWorkspace when not hydrated', () => {
      mockWorkspaceSelectors.currentWorkspace = null;
      mockWorkspaceSelectors.currentWorkspaceId = null;

      const { result } = renderHook(() => useWorkspace());

      expect(result.current.currentWorkspace).toBeNull();
      expect(result.current.currentWorkspaceId).toBeNull();
    });

    it('returns empty arrays when no data', () => {
      mockWorkspaceSelectors.availableWorkspaces = [];
      mockWorkspaceSelectors.currentWorkspaceMembers = [];
      mockWorkspaceSelectors.users = [];

      const { result } = renderHook(() => useWorkspace());

      expect(result.current.availableWorkspaces).toEqual([]);
      expect(result.current.currentWorkspaceMembers).toEqual([]);
      expect(result.current.users).toEqual([]);
    });
  });

  describe('when workspace is hydrated', () => {
    it('returns full workspace data', () => {
      mockWorkspaceSelectors.currentWorkspace = { id: 'ws1', name: 'Workspace' };
      mockWorkspaceSelectors.currentWorkspaceId = 'ws1';
      mockWorkspaceSelectors.availableWorkspaces = [{ id: 'ws1', name: 'Workspace' }];
      mockWorkspaceSelectors.currentWorkspaceMembers = [{ userId: 'u1', role: 'admin' }];
      mockWorkspaceSelectors.users = [{ id: 'u1', name: 'User' }];

      const { result } = renderHook(() => useWorkspace());

      expect(result.current.currentWorkspace).toEqual({ id: 'ws1', name: 'Workspace' });
      expect(result.current.currentWorkspaceId).toBe('ws1');
      expect(result.current.availableWorkspaces).toHaveLength(1);
      expect(result.current.currentWorkspaceMembers).toHaveLength(1);
      expect(result.current.users).toHaveLength(1);
    });
  });
});
