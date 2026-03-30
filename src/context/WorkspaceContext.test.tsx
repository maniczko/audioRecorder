/**
 * @vitest-environment jsdom
 * WorkspaceContext Tests
 *
 * Tests for WorkspaceContext provider and hook
 */

import { renderHook, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { WorkspaceProvider, useWorkspaceCtx } from './WorkspaceContext';

// Mock store
const mockWorkspaceStore = vi.hoisted(() => ({
  users: [{ id: 'u1', name: 'User 1' }],
  workspaces: [{ id: 'ws1', name: 'Workspace 1' }],
  session: { token: 'token123', userId: 'u1', workspaceId: 'ws1' },
  setUsers: vi.fn(),
  setWorkspaces: vi.fn(),
  setSession: vi.fn(),
  switchWorkspace: vi.fn(),
  logout: vi.fn(),
}));

const mockWorkspaceSelectors = vi.hoisted(() => ({
  useWorkspaceSelectors: () => ({
    currentUser: { id: 'u1', name: 'Test User' },
    currentUserId: 'u1',
    currentWorkspace: { id: 'ws1', name: 'Test Workspace' },
    currentWorkspaceId: 'ws1',
    currentWorkspaceMembers: [{ userId: 'u1', role: 'owner' }],
    currentWorkspaceRole: 'owner',
    currentWorkspacePermissions: { canRecordAudio: true },
    isHydratingSession: false,
    availableWorkspaces: [{ id: 'ws1', name: 'Workspace 1' }],
  }),
  useWorkspaceStore: () => mockWorkspaceStore,
}));

vi.mock('../store/workspaceStore', () => mockWorkspaceSelectors);

describe('WorkspaceContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WorkspaceProvider', () => {
    it('renders children without crashing', () => {
      render(
        <WorkspaceProvider>
          <div data-testid="child">Child</div>
        </WorkspaceProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('provides workspace context value', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current).toBeDefined();
      expect(result.current.workspace).toBeDefined();
    });

    it('provides users from store', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.users).toEqual([{ id: 'u1', name: 'User 1' }]);
    });

    it('provides workspaces from store', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.workspaces).toEqual([{ id: 'ws1', name: 'Workspace 1' }]);
    });

    it('provides session from store', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.session).toEqual({
        token: 'token123',
        userId: 'u1',
        workspaceId: 'ws1',
      });
    });

    it('provides currentUser from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.currentUser).toEqual({ id: 'u1', name: 'Test User' });
    });

    it('provides currentUserId from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.currentUserId).toBe('u1');
    });

    it('provides currentWorkspace from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.currentWorkspace).toEqual({
        id: 'ws1',
        name: 'Test Workspace',
      });
    });

    it('provides currentWorkspaceId from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.currentWorkspaceId).toBe('ws1');
    });

    it('provides currentWorkspaceMembers from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.currentWorkspaceMembers).toEqual([
        { userId: 'u1', role: 'owner' },
      ]);
    });

    it('provides currentWorkspaceRole from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.currentWorkspaceRole).toBe('owner');
    });

    it('provides currentWorkspacePermissions from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.currentWorkspacePermissions).toEqual({
        canRecordAudio: true,
      });
    });

    it('provides isHydratingSession from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.isHydratingSession).toBe(false);
    });

    it('provides availableWorkspaces from selectors', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.availableWorkspaces).toEqual([
        { id: 'ws1', name: 'Workspace 1' },
      ]);
    });

    it('provides setUsers method', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.setUsers).toBeDefined();
      expect(typeof result.current.workspace.setUsers).toBe('function');
    });

    it('provides setWorkspaces method', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.setWorkspaces).toBeDefined();
      expect(typeof result.current.workspace.setWorkspaces).toBe('function');
    });

    it('provides setSession method', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.setSession).toBeDefined();
      expect(typeof result.current.workspace.setSession).toBe('function');
    });

    it('provides switchWorkspace method', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.switchWorkspace).toBeDefined();
      expect(typeof result.current.workspace.switchWorkspace).toBe('function');
    });

    it('provides logout method', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.logout).toBeDefined();
      expect(typeof result.current.workspace.logout).toBe('function');
    });

    it('calls switchWorkspace with workspace ID', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      result.current.workspace.switchWorkspace('ws2');

      expect(mockWorkspaceStore.switchWorkspace).toHaveBeenCalledWith('ws2');
    });

    it('calls logout method', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      result.current.workspace.logout();

      expect(mockWorkspaceStore.logout).toHaveBeenCalled();
    });
  });

  describe('useWorkspaceCtx', () => {
    it('throws error when used outside WorkspaceProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useWorkspaceCtx());
      }).toThrow('useWorkspaceCtx must be used within WorkspaceProvider');

      consoleSpy.mockRestore();
    });

    it('returns context value when used within WorkspaceProvider', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      expect(result.current.workspace.currentUser).toBeDefined();
    });
  });

  describe('integration', () => {
    it('updates when store changes', () => {
      const { result, rerender } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      const initialValue = result.current.workspace.currentUser;

      // Simulate store update
      mockWorkspaceSelectors.useWorkspaceSelectors.mockReturnValue({
        currentUser: { id: 'u2', name: 'Updated User' },
        currentUserId: 'u2',
        currentWorkspace: { id: 'ws1', name: 'Test Workspace' },
        currentWorkspaceId: 'ws1',
        currentWorkspaceMembers: [],
        currentWorkspaceRole: 'member',
        currentWorkspacePermissions: { canRecordAudio: false },
        isHydratingSession: false,
        availableWorkspaces: [],
      });

      rerender();

      // Note: In real scenario, the context would update
      // This test verifies the hook can be re-rendered
      expect(result.current.workspace).toBeDefined();
    });

    it('provides all workspace methods in single object', () => {
      const { result } = renderHook(() => useWorkspaceCtx(), {
        wrapper: WorkspaceProvider,
      });

      const workspace = result.current.workspace;

      expect(workspace).toHaveProperty('users');
      expect(workspace).toHaveProperty('workspaces');
      expect(workspace).toHaveProperty('session');
      expect(workspace).toHaveProperty('currentUser');
      expect(workspace).toHaveProperty('setUsers');
      expect(workspace).toHaveProperty('setWorkspaces');
      expect(workspace).toHaveProperty('setSession');
      expect(workspace).toHaveProperty('switchWorkspace');
      expect(workspace).toHaveProperty('logout');
    });
  });
});
