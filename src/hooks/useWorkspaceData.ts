/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createStateService } from "../services/stateService";
import { probeRemoteApiHealth, setPreviewRuntimeStatus } from "../services/httpClient";
import { migrateWorkspaceData } from "../lib/workspace";
import { useWorkspaceStore, useWorkspaceSelectors } from "../store/workspaceStore";
import { useMeetingsStore } from "../store/meetingsStore";
import { isHostedPreviewHost } from "../runtime/browserRuntime";

function serializeWorkspaceState(payload: any) {
  return JSON.stringify(payload || {});
}

const REMOTE_PULL_COOLDOWN_MS = 25000;
const HOSTED_PREVIEW_RUNTIME_MESSAGE =
  "Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.";

function isBackendUnavailableMessage(message = "") {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("backend jest chwilowo niedostepny") ||
    normalized.includes("application failed to respond") ||
    normalized.includes("router_external_target_connection_error") ||
    normalized.includes("bad gateway") ||
    normalized.includes("target connection error") ||
    normalized.includes("upstream") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("networkerror") ||
    normalized.includes("load failed") ||
    normalized.includes("http 502")
  );
}

export default function useWorkspaceData() {
  const { currentWorkspaceId } = useWorkspaceSelectors();
  const { users, setUsers, workspaces, setWorkspaces, session, setSession } = useWorkspaceStore();
  const {
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
    setWorkspaceMessage,
  } = useMeetingsStore();

  const stateService = useMemo(() => createStateService(), []);
  const syncTimerRef = useRef<number | null>(null);
  const remotePollTimerRef = useRef<number | null>(null);
  const hydratedWorkspaceIdRef = useRef("");
  const remoteSnapshotRef = useRef("");
  const remotePullCooldownUntilRef = useRef(0);
  const lastWorkspaceMessageRef = useRef("");
  const lastLoggedRemoteErrorRef = useRef("");

  const [isHydratingRemoteState, setIsHydratingRemoteState] = useState(
    stateService?.mode === "remote" && Boolean(session?.token)
  );

  const applyRemoteWorkspaceState = useCallback(
    (result: any) => {
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
      remotePullCooldownUntilRef.current = 0;
      lastWorkspaceMessageRef.current = "";
      lastLoggedRemoteErrorRef.current = "";

      hydratedWorkspaceIdRef.current = result.workspaceId || session?.workspaceId || "";
      if (result.workspaceId && result.workspaceId !== session?.workspaceId) {
        setSession((previous: any) =>
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

  const pushWorkspaceMessage = useCallback(
    (message: string) => {
      const normalizedMessage = String(message || "").trim();
      if (!normalizedMessage || normalizedMessage === lastWorkspaceMessageRef.current) {
        return;
      }
      lastWorkspaceMessageRef.current = normalizedMessage;
      setWorkspaceMessage(normalizedMessage);
    },
    [setWorkspaceMessage]
  );

  const logRemoteErrorOnce = useCallback((scope: string, error: any) => {
    const message = String(error?.message || "Unknown remote error");
    const key = `${scope}:${message}`;
    if (key === lastLoggedRemoteErrorRef.current) {
      return;
    }
    lastLoggedRemoteErrorRef.current = key;
    console.error(scope, error);
  }, []);

  const applyRemoteTransportCooldown = useCallback((error: any) => {
    if (!isBackendUnavailableMessage(error?.message || "")) {
      return;
    }
    remotePullCooldownUntilRef.current = Date.now() + REMOTE_PULL_COOLDOWN_MS;
  }, []);

  const ensureHostedPreviewConnectivity = useCallback(async () => {
    if (typeof window === "undefined" || !isHostedPreviewHost(window.location.hostname)) {
      return true;
    }

    try {
      await probeRemoteApiHealth();
      return true;
    } catch (error) {
      remotePullCooldownUntilRef.current = Date.now() + REMOTE_PULL_COOLDOWN_MS;
      logRemoteErrorOnce("Hosted preview health probe failed.", error);
      pushWorkspaceMessage(HOSTED_PREVIEW_RUNTIME_MESSAGE);
      return false;
    }
  }, [logRemoteErrorOnce, pushWorkspaceMessage]);

  useEffect(() => {
    const migration = migrateWorkspaceData({
      users,
      workspaces,
      meetings,
      manualTasks,
      taskBoards,
      session,
    });

    if (!migration?.changed) {
      return;
    }

    setUsers(migration.users);
    setWorkspaces(migration.workspaces);
    setMeetings(migration.meetings);
    setManualTasks(migration.manualTasks);
    setTaskBoards(migration.taskBoards);
    setSession(migration.session);
  }, [manualTasks, meetings, session, setManualTasks, setMeetings, setSession, setTaskBoards, setUsers, setWorkspaces, taskBoards, users, workspaces]);

  useEffect(() => {
    if (stateService?.mode !== "remote") {
      setPreviewRuntimeStatus("unknown");
      hydratedWorkspaceIdRef.current = currentWorkspaceId || "";
      setIsHydratingRemoteState(false);
      return undefined;
    }

    if (!session?.token || !session?.userId) {
      setPreviewRuntimeStatus("unknown");
      hydratedWorkspaceIdRef.current = "";
      setIsHydratingRemoteState(false);
      return undefined;
    }

    let cancelled = false;
    setIsHydratingRemoteState(true);

    (async () => {
      const canConnect = await ensureHostedPreviewConnectivity();
      if (cancelled || !canConnect) {
        if (!cancelled) {
          setIsHydratingRemoteState(false);
        }
        return;
      }

      stateService
        .bootstrap(session.workspaceId)
        .then((result) => {
          if (cancelled || !result) {
            return;
          }
          applyRemoteWorkspaceState(result);
        })
        .catch((error: any) => {
          if (cancelled) {
            return;
          }
          applyRemoteTransportCooldown(error);
          logRemoteErrorOnce("Remote workspace bootstrap failed.", error);
          pushWorkspaceMessage(error?.message || "Nie udalo sie pobrac danych workspace z backendu.");
        })
        .finally(() => {
          if (!cancelled) {
            setIsHydratingRemoteState(false);
          }
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, applyRemoteTransportCooldown, applyRemoteWorkspaceState, ensureHostedPreviewConnectivity, logRemoteErrorOnce, pushWorkspaceMessage, session?.token, session?.userId, session?.workspaceId, stateService]);

  useEffect(() => {
    if (stateService?.mode !== "remote") {
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
        .catch((error: any) => {
          applyRemoteTransportCooldown(error);
          logRemoteErrorOnce("Remote workspace sync failed.", error);
          pushWorkspaceMessage(error?.message || "Nie udalo sie zapisac workspace na backendzie.");
        });
    }, 350);

    syncTimerRef.current = timeout;

    return () => {
      window.clearTimeout(timeout);
    };
  }, [applyRemoteTransportCooldown, calendarMeta, vocabulary, currentWorkspaceId, isHydratingRemoteState, logRemoteErrorOnce, manualTasks, meetings, pushWorkspaceMessage, session?.token, stateService, taskBoards, taskState]);

  useEffect(() => {
    if (stateService?.mode !== "remote") {
      return undefined;
    }

    if (!session?.token || !currentWorkspaceId || isHydratingRemoteState) {
      return undefined;
    }

    const pullRemoteWorkspaceState = () => {
      if (Date.now() < remotePullCooldownUntilRef.current) {
        return;
      }

      void (async () => {
        const canConnect = await ensureHostedPreviewConnectivity();
        if (!canConnect) {
          return;
        }

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
            applyRemoteTransportCooldown(error);
            logRemoteErrorOnce("Remote workspace pull failed.", error);
            pushWorkspaceMessage(error?.message || "Nie udalo sie pobrac danych workspace z backendu.");
          });
      })();
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
  }, [applyRemoteTransportCooldown, applyRemoteWorkspaceState, currentWorkspaceId, ensureHostedPreviewConnectivity, isHydratingRemoteState, logRemoteErrorOnce, pushWorkspaceMessage, session?.token, stateService]);

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
    userMeetings,
    isHydratingRemoteState,
    applyRemoteWorkspaceState,
  };
}
