import { createContext, useContext } from "react";
import useWorkspace from "../hooks/useWorkspace";
import useAuth from "../hooks/useAuth";

export const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const workspace = useWorkspace();
  const auth = useAuth({
    currentUser: workspace.currentUser,
    users: workspace.users,
    setUsers: workspace.setUsers,
    workspaces: workspace.workspaces,
    setWorkspaces: workspace.setWorkspaces,
    setSession: workspace.setSession,
  });

  const value = { workspace, auth };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceCtx() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspaceCtx must be used within WorkspaceProvider");
  }
  return ctx;
}
