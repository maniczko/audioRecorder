/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useStoredState from "./useStoredState";
import { STORAGE_KEYS } from "../lib/storage";
import { createStateService } from "../services/stateService";
import { migrateWorkspaceData } from "../lib/workspace";

function serializeWorkspaceState(payload) {
  return JSON.stringify(payload || {});
}

export default function useWorkspaceData({
  users,
  setUsers,
  workspaces,
  setWorkspaces,
  session,
  setSession,
  currentWorkspaceId,
}) {
  const [meetings, setMeetings] = useStoredState(STORAGE_KEYS.meetings, []);
  const [manualTasks, setManualTasks] = useStoredState(STORAGE_KEYS.manualTasks, []);
  const [taskState, setTaskState] = useStoredState(STORAGE_KEYS.taskState, {});
  const [taskBoards, setTaskBoards] = useStoredState(STORAGE_KEYS.taskBoards, {});
  const [calendarMeta, setCalendarMeta] = useStoredState(STORAGE_KEYS.calendarMeta, {});
  const [vocabulary, setVocabulary] = useStoredState(STORAGE_KEYS.vocabulary, []);
  const [workspaceMessage, setWorkspaceMessage] = useState("");

  const stateService = useMemo(() => createStateService(), []);
  const syncTimerRef = useRef(null);
  const remotePollTimerRef = useRef(null);
  const hydratedWorkspaceIdRef = useRef("");
  const remoteSnapshotRef = useRef("");

  const [isHydratingRemoteState, setIsHydratingRemoteState] = useState(
    stateService.mode === "remote" && Boolean(session?.token)
  );

  const applyRemoteWorkspaceState = useCallback(
    (result) => {
      if (!result) return;

      if (Array.isArray(result.users)) {
        setUsers(result.users);
      }
      if (Array.isArray(result.workspaces)) {
        setWorkspaces(result.workspaces);
      }

      const nextState = result.state || {};
      const normalizedState = {
        meetings: Array.isArray(nextState.meetings) ? nextState.meetings : [],
        manualTasks: Array.isArray(nextState.manualTasks) ? nextState.manualTasks : [],
        taskState: nextState.taskState && typeof nextState.taskState === "object" ? nextState.taskState : {},
        taskBoards: nextState.taskBoards && typeof nextState.taskBoards === "object" ? nextState.taskBoards : {},
        calendarMeta:
          nextState.calendarMeta && typeof nextState.calendarMeta === "object" ? nextState.calendarMeta : {},
        vocabulary: Array.isArray(nextState.vocabulary) ? nextState.vocabulary : [],
      };
      const nextSnapshot = serializeWorkspaceState(normalizedState);
      if (nextSnapshot === remoteSnapshotRef.current) {
        return;
      }

      setMeetings(normalizedState.meetings);
      setManualTasks(normalizedState.manualTasks);
      setTaskState(normalizedState.taskState);
      setTaskBoards(normalizedState.taskBoards);
      setCalendarMeta(normalizedState.calendarMeta);
      setVocabulary(normalizedState.vocabulary);
      remoteSnapshotRef.current = nextSnapshot;

      hydratedWorkspaceIdRef.current = result.workspaceId || session?.workspaceId || "";
      if (result.workspaceId && result.workspaceId !== session?.workspaceId) {
        setSession((previous) =>
          previous
            ? {
                ...previous,
                workspaceId: result.workspaceId,
              }
            : previous
        );
      }
    },
    [session?.workspaceId, setCalendarMeta, setManualTasks, setMeetings, setSession, setTaskBoards, setTaskState, setUsers, setWorkspaces, setVocabulary]
  );

  // Migration Effect
  useEffect(() => {
    const migration = migrateWorkspaceData({
      users,
      workspaces,
      meetings,
      manualTasks,
      taskBoards,
      session,
    });

    if (!migration.changed) {
      return;
    }

    setUsers(migration.users);
    setWorkspaces(migration.workspaces);
    setMeetings(migration.meetings);
    setManualTasks(migration.manualTasks);
    setTaskBoards(migration.taskBoards);
    setSession(migration.session);
  }, [manualTasks, meetings, session, setManualTasks, setMeetings, setSession, setTaskBoards, setUsers, setWorkspaces, taskBoards, users, workspaces]);

  // Bootstrap Effect
  useEffect(() => {
    if (stateService.mode !== "remote") {
      hydratedWorkspaceIdRef.current = currentWorkspaceId || "";
      setIsHydratingRemoteState(false);
      return undefined;
    }

    if (!session?.token || !session?.userId) {
      hydratedWorkspaceIdRef.current = "";
      setIsHydratingRemoteState(false);
      return undefined;
    }

    let cancelled = false;
    setIsHydratingRemoteState(true);

    stateService
      .bootstrap(session.workspaceId)
      .then((result) => {
        if (cancelled || !result) {
          return;
        }
        applyRemoteWorkspaceState(result);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Remote workspace bootstrap failed.", error);
        setWorkspaceMessage(error.message || "Nie udalo sie pobrac danych workspace z backendu.");
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingRemoteState(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, applyRemoteWorkspaceState, session?.token, session?.userId, session?.workspaceId, stateService]);

  // Sync Effect (outbound)
  useEffect(() => {
    if (stateService.mode !== "remote") {
      return undefined;
    }

    if (!session?.token || !currentWorkspaceId || isHydratingRemoteState) {
      return undefined;
    }

    if (hydratedWorkspaceIdRef.current !== currentWorkspaceId) {
      return undefined;
    }

    const payload = {
      meetings,
      manualTasks,
      taskState,
      taskBoards,
      calendarMeta,
      vocabulary,
    };
    const nextSnapshot = serializeWorkspaceState(payload);
    if (nextSnapshot === remoteSnapshotRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      stateService
        .syncWorkspaceState(currentWorkspaceId, payload)
        .then(() => {
          remoteSnapshotRef.current = nextSnapshot;
        })
        .catch((error) => {
          console.error("Remote workspace sync failed.", error);
          setWorkspaceMessage(error.message || "Nie udalo sie zapisac workspace na backendzie.");
        });
    }, 350);

    syncTimerRef.current = timeout;

    return () => {
      window.clearTimeout(timeout);
    };
  }, [calendarMeta, vocabulary, currentWorkspaceId, isHydratingRemoteState, manualTasks, meetings, session?.token, stateService, taskBoards, taskState]);

  // Polling Effect (inbound)
  useEffect(() => {
    if (stateService.mode !== "remote") {
      return undefined;
    }

    if (!session?.token || !currentWorkspaceId || isHydratingRemoteState) {
      return undefined;
    }

    const pullRemoteWorkspaceState = () => {
      stateService
        .bootstrap(currentWorkspaceId)
        .then((result) => {
          if (!result?.state) {
            return;
          }

          const normalizedState = {
            meetings: Array.isArray(result.state.meetings) ? result.state.meetings : [],
            manualTasks: Array.isArray(result.state.manualTasks) ? result.state.manualTasks : [],
            taskState: result.state.taskState && typeof result.state.taskState === "object" ? result.state.taskState : {},
            taskBoards: result.state.taskBoards && typeof result.state.taskBoards === "object" ? result.state.taskBoards : {},
            calendarMeta:
              result.state.calendarMeta && typeof result.state.calendarMeta === "object" ? result.state.calendarMeta : {},
            vocabulary: Array.isArray(result.state.vocabulary) ? result.state.vocabulary : [],
          };
          const incomingSnapshot = serializeWorkspaceState(normalizedState);
          if (incomingSnapshot === remoteSnapshotRef.current) {
            return;
          }

          applyRemoteWorkspaceState(result);
        })
        .catch((error) => {
          console.error("Remote workspace pull failed.", error);
        });
    };

    remotePollTimerRef.current = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      pullRemoteWorkspaceState();
    }, 5000);

    return () => {
      window.clearInterval(remotePollTimerRef.current);
    };
  }, [applyRemoteWorkspaceState, currentWorkspaceId, isHydratingRemoteState, session?.token, stateService]);

  const userMeetings = useMemo(
    () =>
      currentWorkspaceId
        ? [...meetings]
            .filter((meeting) => meeting.workspaceId === currentWorkspaceId)
            .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
        : [],
    [currentWorkspaceId, meetings]
  );

  return {
    meetings,
    setMeetings,
    manualTasks,
    setManualTasks,
    taskState,
    setTaskState,
    taskBoards,
    setTaskBoards,
    calendarMeta,
    setCalendarMeta,
    vocabulary,
    setVocabulary,
    workspaceMessage,
    setWorkspaceMessage,
    userMeetings,
    isHydratingRemoteState,
    applyRemoteWorkspaceState,
  };
}
