import { createContext, useContext } from "react";
import useMeetings from "../hooks/useMeetings";
import { useWorkspaceCtx } from "./WorkspaceContext";

const MeetingsContext = createContext(null);

export function MeetingsProvider({ children }) {
  const { workspace } = useWorkspaceCtx();

  const meetings = useMeetings({
    users: workspace.users,
    setUsers: workspace.setUsers,
    workspaces: workspace.workspaces,
    setWorkspaces: workspace.setWorkspaces,
    session: workspace.session,
    setSession: workspace.setSession,
    currentUser: workspace.currentUser,
    currentUserId: workspace.currentUserId,
    currentWorkspaceId: workspace.currentWorkspaceId,
    currentWorkspaceMembers: workspace.currentWorkspaceMembers,
  });

  return (
    <MeetingsContext.Provider value={{ meetings }}>
      {children}
    </MeetingsContext.Provider>
  );
}

export function useMeetingsCtx() {
  const ctx = useContext(MeetingsContext);
  if (!ctx) {
    throw new Error("useMeetingsCtx must be used within MeetingsProvider");
  }
  return ctx;
}
