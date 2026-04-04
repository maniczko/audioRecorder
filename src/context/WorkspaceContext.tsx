import { createContext, useContext } from 'react';
import { useWorkspaceSelectors, useWorkspaceStore } from '../store/workspaceStore';

const WorkspaceContext = createContext<any>(null);

export function WorkspaceProvider({ children }) {
  const selectors = useWorkspaceSelectors();
  const workspaceStore = useWorkspaceStore();

  const value = {
    workspace: {
      users: workspaceStore.users,
      setUsers: workspaceStore.setUsers,
      workspaces: workspaceStore.workspaces,
      setWorkspaces: workspaceStore.setWorkspaces,
      session: workspaceStore.session,
      setSession: workspaceStore.setSession,
      currentUser: selectors.currentUser,
      currentUserId: selectors.currentUserId,
      currentWorkspace: selectors.currentWorkspace,
      currentWorkspaceId: selectors.currentWorkspaceId,
      currentWorkspaceMembers: selectors.currentWorkspaceMembers,
      currentWorkspaceRole: selectors.currentWorkspaceRole,
      currentWorkspacePermissions: selectors.currentWorkspacePermissions,
      isHydratingSession: selectors.isHydratingSession,
      availableWorkspaces: selectors.availableWorkspaces,
      switchWorkspace: workspaceStore.switchWorkspace,
      updateWorkspaceMemberRole: workspaceStore.updateWorkspaceMemberRole,
      removeWorkspaceMember: workspaceStore.removeWorkspaceMember,
      logout: workspaceStore.logout,
    },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceCtx() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceCtx must be used within WorkspaceProvider');
  }
  return ctx;
}
