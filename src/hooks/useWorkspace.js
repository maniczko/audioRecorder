import { useEffect, useMemo, useState } from "react";
import useStoredState from "./useStoredState";
import { STORAGE_KEYS } from "../lib/storage";
import { resolveWorkspaceForUser, workspaceMembers } from "../lib/workspace";
import { createStateService } from "../services/stateService";

export default function useWorkspace() {
  const [users, setUsers] = useStoredState(STORAGE_KEYS.users, []);
  const [session, setSession] = useStoredState(STORAGE_KEYS.session, null);
  const [workspaces, setWorkspaces] = useStoredState(STORAGE_KEYS.workspaces, []);
  const stateService = useMemo(() => createStateService(), []);
  const [isHydratingSession, setIsHydratingSession] = useState(stateService.mode === "remote" && Boolean(session?.token));
  const [sessionError, setSessionError] = useState("");

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

  useEffect(() => {
    if (stateService.mode !== "remote") {
      setIsHydratingSession(false);
      return;
    }

    if (!session?.token || !session?.userId) {
      setIsHydratingSession(false);
      setSessionError("");
      return;
    }

    let cancelled = false;
    setIsHydratingSession(true);
    setSessionError("");

    stateService
      .bootstrap(session.workspaceId)
      .then((result) => {
        if (cancelled || !result) {
          return;
        }

        if (Array.isArray(result.users)) {
          setUsers(result.users);
        }
        if (Array.isArray(result.workspaces)) {
          setWorkspaces(result.workspaces);
        }
        if (result.workspaceId && result.workspaceId !== session.workspaceId) {
          setSession((previous) =>
            previous
              ? {
                  ...previous,
                  workspaceId: result.workspaceId,
                }
              : previous
          );
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        if (error.status === 401) {
          setSession(null);
          setUsers([]);
          setWorkspaces([]);
        } else {
          setSessionError(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.userId, session?.workspaceId, setSession, setUsers, setWorkspaces, stateService]);

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
    isHydratingSession,
    sessionError,
  };
}
