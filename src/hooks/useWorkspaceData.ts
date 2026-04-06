/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createStateService } from '../services/stateService';
import {
  probeRemoteApiHealth,
  setPreviewRuntimeStatus,
  isCircuitBreakerOpen,
} from '../services/httpClient';
import { migrateWorkspaceData } from '../lib/workspace';
import { useWorkspaceStore, useWorkspaceSelectors } from '../store/workspaceStore';
import { useMeetingsStore } from '../store/meetingsStore';
import { isHostedPreviewHost } from '../runtime/browserRuntime';
import {
  buildWorkspaceStateDelta,
  normalizeWorkspaceState,
  serializeWorkspaceState,
} from '../shared/contracts';
import { isConnectionTimeoutErrorMessage, isTransportErrorMessage } from '../lib/transportErrors';

const REMOTE_PULL_COOLDOWN_MS = 25000;
const BOOTSTRAP_RECOVERY_DELAY_MS = 10000;
const BOOTSTRAP_RECOVERY_MAX_ATTEMPTS = 3;
const REMOTE_POLL_BASE_MS = 5000;
const REMOTE_POLL_MAX_MS = 60000;
const HOSTED_PREVIEW_RUNTIME_MESSAGE =
  'Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.';
const HOSTED_PREVIEW_STALE_MESSAGE =
  'Hostowany preview jest nieaktualny wzgledem backendu. Odswiez strone lub otworz najnowszy deploy.';

function isBackendUnavailableMessage(message = '') {
  return (
    String(message || '')
      .toLowerCase()
      .includes('nieaktualny wzgledem backendu') ||
    String(message || '')
      .toLowerCase()
      .includes('http 502') ||
    String(message || '')
      .toLowerCase()
      .includes('browser offline') ||
    isTransportErrorMessage(message)
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

  const safeUsers = Array.isArray(users) ? users : [];
  const safeWorkspaces = Array.isArray(workspaces) ? workspaces : [];
  const safeMeetings = Array.isArray(meetings) ? meetings : [];
  const safeManualTasks = Array.isArray(manualTasks) ? manualTasks : [];
  const safeTaskBoards =
    taskBoards && typeof taskBoards === 'object' && !Array.isArray(taskBoards) ? taskBoards : {};
  const safeCalendarMeta =
    calendarMeta && typeof calendarMeta === 'object' && !Array.isArray(calendarMeta)
      ? calendarMeta
      : {};
  const safeVocabulary = Array.isArray(vocabulary) ? vocabulary : [];

  const stateService = useMemo(() => createStateService(), []);
  const syncTimerRef = useRef<number | null>(null);
  const remotePollTimerRef = useRef<number | null>(null);
  const hydratedWorkspaceIdRef = useRef('');
  const remoteSnapshotRef = useRef('');
  const remoteStateRef = useRef(normalizeWorkspaceState());
  const remotePullCooldownUntilRef = useRef(0);
  const lastWorkspaceMessageRef = useRef('');
  const lastLoggedRemoteErrorRef = useRef('');
  const isProbingRef = useRef(false);
  const isBootstrappingRef = useRef(false);
  const migrationAppliedRef = useRef<string | null>(null);

  const [isHydratingRemoteState, setIsHydratingRemoteState] = useState(
    stateService?.mode === 'remote' && Boolean(session?.token)
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
      lastWorkspaceMessageRef.current = '';
      lastLoggedRemoteErrorRef.current = '';

      hydratedWorkspaceIdRef.current = result.workspaceId || session?.workspaceId || '';
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
    [
      session?.workspaceId,
      setCalendarMeta,
      setManualTasks,
      setMeetings,
      setSession,
      setTaskBoards,
      setTaskState,
      setUsers,
      setWorkspaces,
      setVocabulary,
    ]
  );

  const pushWorkspaceMessage = useCallback(
    (message: string) => {
      const normalizedMessage = String(message || '').trim();
      if (!normalizedMessage || normalizedMessage === lastWorkspaceMessageRef.current) {
        return;
      }
      lastWorkspaceMessageRef.current = normalizedMessage;
      setWorkspaceMessage(normalizedMessage);
    },
    [setWorkspaceMessage]
  );

  const logRemoteErrorOnce = useCallback((scope: string, error: any) => {
    const message = String(error?.message || 'Unknown remote error');
    const key = `${scope}:${message}`;
    if (key === lastLoggedRemoteErrorRef.current) {
      return;
    }
    lastLoggedRemoteErrorRef.current = key;
    console.warn(scope, error);
  }, []);

  const applyRemoteTransportCooldown = useCallback((error: any) => {
    if (!isBackendUnavailableMessage(error?.message || '')) {
      return;
    }
    remotePullCooldownUntilRef.current = Date.now() + REMOTE_PULL_COOLDOWN_MS;
  }, []);

  const ensureHostedPreviewConnectivity = useCallback(async () => {
    if (typeof window === 'undefined' || !isHostedPreviewHost(window.location.hostname)) {
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
      const errorName = String((error as any)?.name || '').toLowerCase();
      const rawMessage = String((error as any)?.message || '');
      const errorMessage = rawMessage.toLowerCase();
      const isAbortError = errorName.includes('abort') || errorMessage.includes('aborted');
      const isExpectedTransportFailure =
        isBackendUnavailableMessage(rawMessage) || isConnectionTimeoutErrorMessage(rawMessage);
      if (!isAbortError && !isExpectedTransportFailure) {
        logRemoteErrorOnce('Hosted preview health probe failed.', error);
      }
      pushWorkspaceMessage(
        rawMessage.includes('nieaktualny wzgledem backendu')
          ? HOSTED_PREVIEW_STALE_MESSAGE
          : HOSTED_PREVIEW_RUNTIME_MESSAGE
      );
      return false;
    }
  }, [logRemoteErrorOnce, pushWorkspaceMessage]);

  // Migration effect - run when source data changes
  useEffect(() => {
    // Create a unique key for this migration state to avoid re-applying
    const migrationKey = `${safeUsers.length}-${safeWorkspaces.length}-${safeMeetings.length}-${safeManualTasks.length}-${Object.keys(safeTaskBoards).length}-${session?.token || ''}`;

    // Skip if we already applied this exact migration
    if (migrationAppliedRef.current === migrationKey) {
      return;
    }

    const migration = migrateWorkspaceData({
      users: safeUsers,
      workspaces: safeWorkspaces,
      meetings: safeMeetings,
      manualTasks: safeManualTasks,
      taskBoards: safeTaskBoards,
      session,
    });

    // Only apply migration if something actually changed
    if (!migration?.changed) {
      // Mark as checked to avoid re-checking same state
      migrationAppliedRef.current = migrationKey;
      return;
    }

    // Mark as applied before setting to avoid race conditions
    migrationAppliedRef.current = migrationKey;

    setUsers(migration.users);
    setWorkspaces(migration.workspaces);
    setMeetings(migration.meetings);
    setManualTasks(migration.manualTasks);
    setTaskBoards(migration.taskBoards);
    setSession(migration.session);
  }, [safeUsers, safeWorkspaces, safeMeetings, safeManualTasks, safeTaskBoards, session]);

  useEffect(() => {
    if (stateService?.mode !== 'remote') {
      setPreviewRuntimeStatus('unknown');
      hydratedWorkspaceIdRef.current = currentWorkspaceId || '';
      setIsHydratingRemoteState(false);
      return undefined;
    }

    if (!session?.token || !session?.userId) {
      setPreviewRuntimeStatus('unknown');
      hydratedWorkspaceIdRef.current = '';
      setIsHydratingRemoteState(false);
      return undefined;
    }

    let cancelled = false;
    setIsHydratingRemoteState(true);

    const attemptBootstrap = async (recoveryAttempt = 0) => {
      const canConnect = await ensureHostedPreviewConnectivity();
      if (cancelled || !canConnect) {
        if (!cancelled) {
          setIsHydratingRemoteState(false);
        }
        return;
      }

      if (isBootstrappingRef.current) {
        return;
      }

      isBootstrappingRef.current = true;
      try {
        const result = await stateService.bootstrap(session.workspaceId);
        if (cancelled || !result) {
          return;
        }
        applyRemoteWorkspaceState(result);
      } catch (error: any) {
        if (cancelled) {
          return;
        }
        applyRemoteTransportCooldown(error);

        const isTransport = isBackendUnavailableMessage(error?.message || '');
        if (isTransport && recoveryAttempt < BOOTSTRAP_RECOVERY_MAX_ATTEMPTS) {
          console.warn(
            `[useWorkspaceData] Bootstrap failed (transport), recovery attempt ${recoveryAttempt + 1}/${BOOTSTRAP_RECOVERY_MAX_ATTEMPTS} in ${BOOTSTRAP_RECOVERY_DELAY_MS / 1000}s`
          );
          await new Promise((r) => setTimeout(r, BOOTSTRAP_RECOVERY_DELAY_MS));
          if (cancelled) return;
          isBootstrappingRef.current = false;
          remotePullCooldownUntilRef.current = 0;
          return attemptBootstrap(recoveryAttempt + 1);
        }

        logRemoteErrorOnce('Remote workspace bootstrap failed.', error);
        pushWorkspaceMessage(error?.message || 'Nie udalo sie pobrac danych workspace z backendu.');
      } finally {
        isBootstrappingRef.current = false;
        setIsHydratingRemoteState(false);
      }
    };

    attemptBootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    currentWorkspaceId,
    applyRemoteTransportCooldown,
    applyRemoteWorkspaceState,
    ensureHostedPreviewConnectivity,
    logRemoteErrorOnce,
    pushWorkspaceMessage,
    session?.token,
    session?.userId,
    session?.workspaceId,
    stateService,
  ]);

  useEffect(() => {
    if (stateService?.mode !== 'remote') {
      return undefined;
    }

    if (!session?.token || !currentWorkspaceId || isHydratingRemoteState) {
      return undefined;
    }

    if (hydratedWorkspaceIdRef.current !== currentWorkspaceId) {
      return undefined;
    }

    const payload = {
      meetings: safeMeetings,
      manualTasks: safeManualTasks,
      taskState,
      taskBoards: safeTaskBoards,
      calendarMeta: safeCalendarMeta,
      vocabulary: safeVocabulary,
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
          logRemoteErrorOnce('Remote workspace sync failed.', error);
          pushWorkspaceMessage(error?.message || 'Nie udalo sie zapisac workspace na backendzie.');
        });
    }, 350);

    syncTimerRef.current = timeout;

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    applyRemoteTransportCooldown,
    safeCalendarMeta,
    safeVocabulary,
    currentWorkspaceId,
    isHydratingRemoteState,
    logRemoteErrorOnce,
    safeManualTasks,
    safeMeetings,
    pushWorkspaceMessage,
    session?.token,
    stateService,
    safeTaskBoards,
    taskState,
  ]);

  useEffect(() => {
    if (stateService?.mode !== 'remote') {
      return undefined;
    }

    if (!session?.token || !currentWorkspaceId || isHydratingRemoteState) {
      return undefined;
    }

    let cancelled = false;
    let consecutivePollFailures = 0;

    const scheduleNextPoll = () => {
      if (cancelled) return;
      // Adaptive interval: 5s on success, exponential backoff on consecutive failures (max 60s)
      const intervalMs =
        consecutivePollFailures === 0
          ? REMOTE_POLL_BASE_MS
          : Math.min(
              REMOTE_POLL_BASE_MS * Math.pow(2, consecutivePollFailures),
              REMOTE_POLL_MAX_MS
            );
      remotePollTimerRef.current = window.setTimeout(pullRemoteWorkspaceState, intervalMs);
    };

    const pullRemoteWorkspaceState = () => {
      if (cancelled) return;

      // Skip when hidden, offline, or circuit breaker is open
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        scheduleNextPoll();
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        consecutivePollFailures += 1;
        scheduleNextPoll();
        return;
      }
      if (isCircuitBreakerOpen()) {
        consecutivePollFailures += 1;
        scheduleNextPoll();
        return;
      }
      if (Date.now() < remotePullCooldownUntilRef.current) {
        scheduleNextPoll();
        return;
      }
      if (isBootstrappingRef.current) {
        scheduleNextPoll();
        return;
      }

      isBootstrappingRef.current = true;

      void (async () => {
        try {
          const canConnect = await ensureHostedPreviewConnectivity();
          if (cancelled || !canConnect) {
            consecutivePollFailures += 1;
            return;
          }

          const result = await stateService.bootstrap(currentWorkspaceId);
          if (cancelled || !result?.state) {
            consecutivePollFailures = 0;
            return;
          }

          const normalizedState = normalizeWorkspaceState(result.state || {});
          const incomingSnapshot = serializeWorkspaceState(normalizedState);
          if (incomingSnapshot !== remoteSnapshotRef.current) {
            applyRemoteWorkspaceState(result);
          }

          consecutivePollFailures = 0;
        } catch (error) {
          consecutivePollFailures += 1;
          applyRemoteTransportCooldown(error);
          logRemoteErrorOnce('Remote workspace pull failed.', error);
          pushWorkspaceMessage(
            (error as any)?.message || 'Nie udalo sie pobrac danych workspace z backendu.'
          );
        } finally {
          isBootstrappingRef.current = false;
          if (!cancelled) {
            scheduleNextPoll();
          }
        }
      })();
    };

    // Kick off the first poll
    scheduleNextPoll();

    return () => {
      cancelled = true;
      if (remotePollTimerRef.current !== null) {
        window.clearTimeout(remotePollTimerRef.current);
        remotePollTimerRef.current = null;
      }
    };
  }, [
    applyRemoteTransportCooldown,
    applyRemoteWorkspaceState,
    currentWorkspaceId,
    ensureHostedPreviewConnectivity,
    isHydratingRemoteState,
    logRemoteErrorOnce,
    pushWorkspaceMessage,
    session?.token,
    stateService,
  ]);

  const userMeetings = useMemo(
    () =>
      currentWorkspaceId
        ? [...safeMeetings]
            .filter((meeting) => meeting.workspaceId === currentWorkspaceId)
            .sort(
              (left, right) =>
                new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
            )
        : [],
    [currentWorkspaceId, safeMeetings]
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
