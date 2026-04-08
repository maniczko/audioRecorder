import { createContext, useContext } from 'react';
import { useWorkspaceSelectors, useWorkspaceStore } from '../store/workspaceStore';

const defaultWorkspaceCtx = {
  workspace: {
    users: [],
    setUsers: () => { },
    workspaces: [],
    setWorkspaces: () => { },
    session: null,
    setSession: () => { },
    currentUser: null,
    currentUserId: '',
    currentWorkspace: null,
    currentWorkspaceId: '',
    currentWorkspaceMembers: [],
    currentWorkspaceRole: null,
    currentWorkspacePermissions: null,
    isHydratingSession: false,
    availableWorkspaces: [],
    switchWorkspace: async () => { },
    updateWorkspaceMemberRole: async () => { },
    removeWorkspaceMember: async () => { },
    logout: async () => { },
  },
};

const WorkspaceContext = createContext(defaultWorkspaceCtx);

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

  return <WorkspaceContext.Provider value={value as unknown as typeof defaultWorkspaceCtx}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceCtx() {
  return useContext(WorkspaceContext);
}
