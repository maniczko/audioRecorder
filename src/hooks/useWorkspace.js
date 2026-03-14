import { useEffect, useMemo } from "react";
import useStoredState from "./useStoredState";
import { STORAGE_KEYS } from "../lib/storage";
import { resolveWorkspaceForUser, workspaceMembers } from "../lib/workspace";

export default function useWorkspace() {
  const [users, setUsers] = useStoredState(STORAGE_KEYS.users, []);
  const [session, setSession] = useStoredState(STORAGE_KEYS.session, null);
  const [workspaces, setWorkspaces] = useStoredState(STORAGE_KEYS.workspaces, []);

  const currentUser = users.find((user) => user.id === session?.userId) || null;
  const currentUserId = currentUser?.id || null;
  const currentWorkspaceId = currentUser
    ? resolveWorkspaceForUser(currentUser, workspaces, session?.workspaceId)
    : null;
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId) || null;
  const currentWorkspaceMembers = workspaceMembers(users, currentWorkspace);
  const availableWorkspaces = useMemo(
    () =>
      currentUser ? workspaces.filter((workspace) => (workspace.memberIds || []).includes(currentUser.id)) : [],
    [currentUser, workspaces]
  );

  useEffect(() => {
    if (!currentUser || !currentWorkspaceId || session?.workspaceId === currentWorkspaceId) {
      return;
    }

    setSession((previous) =>
      previous
        ? {
            ...previous,
            workspaceId: currentWorkspaceId,
          }
        : previous
    );
  }, [currentUser, currentWorkspaceId, session?.workspaceId, setSession]);

  function switchWorkspace(workspaceId) {
    if (!workspaceId || workspaceId === currentWorkspaceId) {
      return;
    }

    setSession((previous) =>
      previous
        ? {
            ...previous,
            workspaceId,
          }
        : previous
    );
  }

  return {
    users,
    setUsers,
    session,
    setSession,
    workspaces,
    setWorkspaces,
    currentUser,
    currentUserId,
    currentWorkspaceId,
    currentWorkspace,
    currentWorkspaceMembers,
    availableWorkspaces,
    switchWorkspace,
  };
}
