/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createStateService } from "../services/stateService";
import { probeRemoteApiHealth, setPreviewRuntimeStatus } from "../services/httpClient";
import { migrateWorkspaceData } from "../lib/workspace";
import { useWorkspaceStore, useWorkspaceSelectors } from "../store/workspaceStore";
import { useMeetingsStore } from "../store/meetingsStore";
import { isHostedPreviewHost } from "../runtime/browserRuntime";
import { buildWorkspaceStateDelta, normalizeWorkspaceState, serializeWorkspaceState } from "../shared/contracts";

const REMOTE_PULL_COOLDOWN_MS = 25000;
const HOSTED_PREVIEW_RUNTIME_MESSAGE =
  "Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.";
const HOSTED_PREVIEW_STALE_MESSAGE =
  "Hostowany preview jest nieaktualny wzgledem backendu. Odswiez strone lub otworz najnowszy deploy.";

function isBackendUnavailableMessage(message = "") {
  const normalized = String(message || "").toLowerCase();
  return (
    normalized.includes("nieaktualny wzgledem backendu") ||
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
  const remoteStateRef = useRef(normalizeWorkspaceState());
  const remotePullCooldownUntilRef = useRef(0);
  const lastWorkspaceMessageRef = useRef("");
  const lastLoggedRemoteErrorRef = useRef("");
  const isProbingRef = useRef(false);
  const isBootstrappingRef = useRef(false);

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

      const normalizedState = normalizeWorkspaceState(result.state || {});
      const nextSnapshot = serializeWorkspaceState(normalizedState);
      if (nextSnapshot === remoteSnapshotRef.current) {
        return;
      }

      setMeetings(normalizedState.meetings as any[]);
      setManualTasks(normalizedState.manualTasks as any[]);
      setTaskState(normalizedState.taskState as any);
      setTaskBoards(normalizedState.taskBoards as any);
      setCalendarMeta(normalizedState.calendarMeta as any);
      setVocabulary(normalizedState.vocabulary);
      remoteStateRef.current = normalizedState;
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
    console.warn(scope, error);
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

    // Prevent concurrent probes and respect active cooldown
    if (isProbingRef.current || Date.now() < remotePullCooldownUntilRef.current) {
      return false;
    }

    isProbingRef.current = true;
    try {
      await probeRemoteApiHealth();
      isProbingRef.current = false;
      return true;
    } catch (error) {
      isProbingRef.current = false;
      remotePullCooldownUntilRef.current = Date.now() + REMOTE_PULL_COOLDOWN_MS;
      logRemoteErrorOnce("Hosted preview health probe failed.", error);
      pushWorkspaceMessage(
        String(error?.message || "").includes("nieaktualny wzgledem backendu")
          ? HOSTED_PREVIEW_STALE_MESSAGE
          : HOSTED_PREVIEW_RUNTIME_MESSAGE
      );
      return false;
    }
  }, [logRemoteErrorOnce, pushWorkspaceMessage]);

  // Migration effect - run when source data changes
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
  }, [users, workspaces, meetings, manualTasks, taskBoards, session]);

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

      if (isBootstrappingRef.current) {
        setIsHydratingRemoteState(false);
        return;
      }

      isBootstrappingRef.current = true;
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
          isBootstrappingRef.current = false;
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
    const nextState = normalizeWorkspaceState(payload);
    const nextSnapshot = serializeWorkspaceState(nextState);
    if (nextSnapshot === remoteSnapshotRef.current) {
      return undefined;
    }

    const delta = buildWorkspaceStateDelta(remoteStateRef.current, nextState);
    if (!Object.keys(delta).length) {
      remoteSnapshotRef.current = nextSnapshot;
      remoteStateRef.current = nextState;
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      stateService
        .syncWorkspaceState(currentWorkspaceId, delta)
        .then(() => {
          remoteSnapshotRef.current = nextSnapshot;
          remoteStateRef.current = nextState;
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

        if (isBootstrappingRef.current) {
          return;
        }

        isBootstrappingRef.current = true;
        stateService
          .bootstrap(currentWorkspaceId)
          .then((result) => {
            if (!result?.state) {
              return;
            }

            const normalizedState = normalizeWorkspaceState(result.state || {});
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
          })
          .finally(() => {
            isBootstrappingRef.current = false;
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

  const pauseRemotePull = useCallback((durationMs = 3000) => {
    remotePullCooldownUntilRef.current = Date.now() + durationMs;
  }, []);

  return {
    userMeetings,
    isHydratingRemoteState,
    applyRemoteWorkspaceState,
    pauseRemotePull,
  };
}
