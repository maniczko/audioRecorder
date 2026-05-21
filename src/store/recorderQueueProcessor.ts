import {
  RECORDING_WORKSPACE_REQUIRED_MESSAGE,
  isWorkspaceMissingErrorMessage,
  normalizeRecordingPipelineStatus,
  type RecordingPipelineStatus,
  type RecordingQueueItem,
} from '../lib/recordingQueue';
import { Sentry } from '../sentry';
import type { TranscriptionStatusPayload } from '../shared/types';
import type { MeetingAnalysis, TranscriptSegment } from '../shared/types';

type QueueSnapshot = {
  progressPercent: number;
  stageLabel: string;
};

type QueueStatePatch = Record<string, unknown>;

export const BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE =
  'Transkrypcja nadal trwa w tle. Odswiezymy status automatycznie.';
export const RECORDING_ATTACH_RECOVERY_MESSAGE =
  'Nagranie jest gotowe, odtwarzamy spotkanie i podpinamy wynik.';
export const REMOTE_RECORDING_MISSING_MESSAGE =
  'Nagranie nie jest juz dostepne na serwerze. Odswiez dane albo zaimportuj plik ponownie.';
export const BACKGROUND_TRANSCRIPTION_RETRY_MS = 60_000;
export const TRANSCRIPTION_SOFT_POLLING_MS = 3 * 60 * 1000;
const TRANSCRIPTION_MIN_HARD_TIMEOUT_MS = 30 * 60 * 1000;
const TRANSCRIPTION_DEFAULT_HARD_TIMEOUT_MS = 45 * 60 * 1000;
const TRANSCRIPTION_MAX_HARD_TIMEOUT_MS = 90 * 60 * 1000;

export interface QueueProcessorContext {
  nextItem: RecordingQueueItem;
  resolveMeetingForQueueItem: (item: RecordingQueueItem) => any;
  attachCompletedRecording: (meetingId: any, recording: any) => boolean | void;
  setCurrentSegments?: (segments: TranscriptionStatusPayload['segments']) => void;
  updateQueueItem: (recordingId: string, updates: Record<string, unknown>) => void;
  removeQueueItem: (recordingId: string) => void;
  setState: (patch: QueueStatePatch) => void;
  getState: () => { lastQueueErrorKey?: string };
  getAudioBlob: (recordingId: string) => Promise<Blob | null | undefined>;
  createMediaService: () => any;
  filterSilence: (blob: Blob) => Promise<{
    blob: Blob;
    originalDurationS: number;
    filteredDurationS: number;
    removedS: number;
  }>;
  enhanceAndReencode: (blob: Blob, options: Record<string, unknown>) => Promise<Blob>;
  analyzeMeeting: (input: {
    meeting: any;
    segments: TranscriptSegment[];
    speakerNames: Record<string, string>;
    diarization: any;
  }) => Promise<MeetingAnalysis>;
  getPipelineSnapshot: (
    status: RecordingPipelineStatus | string | null | undefined,
    upstreamProgress?: number | null,
    upstreamMessage?: string
  ) => QueueSnapshot;
  normalizeTranscriptionResponse: (response: any) => any;
  buildFallbackAnalysis: (message: string, diarization: any) => any;
  emptyTranscriptMessage: string;
  toUserFacingQueueError: (error: any) => string;
  isExpectedDomainFailure: (error: any) => boolean;
  isTransientNetworkError: (error: any) => boolean;
  maxAutoRetries: number;
  retryDelaysMs: number[];
  sleep?: (ms: number) => Promise<void>;
  scheduleBackoffReset?: (recordingId: string, delay: number) => void;
  now?: () => number;
}

type StartedTranscription = TranscriptionStatusPayload & {
  providerId?: string;
  providerLabel?: string;
  reviewSummary?: unknown;
  pipelineGitSha?: string;
  pipelineVersion?: string;
  pipelineBuildTime?: string;
  audioQuality?: unknown;
  transcriptionDiagnostics?: unknown;
  transcriptOutcome?: string;
  emptyReason?: string;
  userMessage?: string;
  speakerNames?: Record<string, string>;
  speakerCount?: number;
  diarization?: Record<string, unknown>;
  confidence?: number;
  errorMessage?: string;
  activeJob?: boolean;
  queuedPosition?: number | null;
  processingAgeMs?: number | null;
  retryAfterMs?: number | null;
};

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function calculateTranscriptionHardTimeoutMs(durationSeconds?: number | null) {
  const durationMs = Math.max(0, Number(durationSeconds) || 0) * 1000;
  if (!durationMs) return TRANSCRIPTION_DEFAULT_HARD_TIMEOUT_MS;
  return Math.max(
    TRANSCRIPTION_MIN_HARD_TIMEOUT_MS,
    Math.min(TRANSCRIPTION_MAX_HARD_TIMEOUT_MS, durationMs * 2)
  );
}

function safeTimestampMs(value: unknown, fallback: number) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeRetryAfterMs(value: unknown) {
  const retryAfterMs = Number(value);
  return Number.isFinite(retryAfterMs) && retryAfterMs > 0
    ? retryAfterMs
    : BACKGROUND_TRANSCRIPTION_RETRY_MS;
}

function getPollingSleepMs(value: unknown) {
  const retryAfterMs = Number(value);
  if (!Number.isFinite(retryAfterMs) || retryAfterMs <= 0) return 1500;
  return Math.max(1500, Math.min(10_000, retryAfterMs));
}

export class BackgroundTranscriptionPendingError extends Error {
  code = 'BACKGROUND_TRANSCRIPTION_PENDING';
  retryAfterMs: number;
  activeJob: boolean;
  queuedPosition: number | null;
  processingAgeMs: number | null;
  pipelineStatus: RecordingPipelineStatus;

  constructor(status: StartedTranscription, processingAgeMs: number | null) {
    super(BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE);
    this.name = 'BackgroundTranscriptionPendingError';
    this.retryAfterMs = normalizeRetryAfterMs(status?.retryAfterMs);
    this.activeJob = Boolean(status?.activeJob);
    this.queuedPosition = typeof status?.queuedPosition === 'number' ? status.queuedPosition : null;
    this.processingAgeMs =
      typeof status?.processingAgeMs === 'number' ? status.processingAgeMs : processingAgeMs;
    this.pipelineStatus = normalizeRecordingPipelineStatus(status?.pipelineStatus);
  }
}

function isBackgroundTranscriptionPendingError(
  error: unknown
): error is BackgroundTranscriptionPendingError {
  return (
    error instanceof BackgroundTranscriptionPendingError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'BACKGROUND_TRANSCRIPTION_PENDING')
  );
}

export class RemoteRecordingMissingError extends Error {
  code = 'REMOTE_RECORDING_MISSING';
  status = 404;
  originalMessage: string;

  constructor(error: unknown) {
    super(REMOTE_RECORDING_MISSING_MESSAGE);
    this.name = 'RemoteRecordingMissingError';
    this.originalMessage = String((error as { message?: string })?.message || '');
  }
}

export function isRemoteRecordingMissingError(
  error: unknown
): error is RemoteRecordingMissingError {
  return (
    error instanceof RemoteRecordingMissingError ||
    (typeof error === 'object' &&
      error !== null &&
      ((error as { code?: string }).code === 'REMOTE_RECORDING_MISSING' ||
        (Number((error as { status?: number }).status) === 404 &&
          String((error as { message?: string }).message || '').includes(
            REMOTE_RECORDING_MISSING_MESSAGE
          ))))
  );
}

export function shouldReportBackgroundTranscriptionPendingToConsole(
  env: Record<string, unknown> = ((import.meta as any).env || {}) as Record<string, unknown>
) {
  return env.VITE_VOICELOG_DEBUG_QUEUE === 'true' || env.PROD !== true;
}

function reportBackgroundTranscriptionPending(data: Record<string, unknown>) {
  if (shouldReportBackgroundTranscriptionPendingToConsole()) {
    console.info('[queue] Transcription still processing in background.', data);
  }
  if (typeof window === 'undefined') return;
  Sentry?.addBreadcrumb?.({
    category: 'recording.queue',
    level: 'warning',
    message: BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE,
    data,
  });
}

export const CLIENT_AUDIO_PREPROCESSING_LIMITS = {
  maxDurationSeconds: 15 * 60,
  maxBlobBytes: 24 * 1024 * 1024,
} as const;

export type AudioPreprocessingPlan = {
  shouldPreprocess: boolean;
  mode: 'client' | 'server';
  reason: 'within_limits' | 'duration' | 'size' | 'duration_and_size';
  stageLabel: string;
  recordingMessage: string;
};

export function buildAudioPreprocessingPlan({
  blob,
  durationSeconds,
}: {
  blob?: Pick<Blob, 'size'> | null;
  durationSeconds?: number | null;
}): AudioPreprocessingPlan {
  const duration = Math.max(0, Number(durationSeconds) || 0);
  const blobSize = Math.max(0, Number(blob?.size) || 0);
  const overDurationLimit =
    duration > 0 && duration > CLIENT_AUDIO_PREPROCESSING_LIMITS.maxDurationSeconds;
  const overSizeLimit = blobSize > CLIENT_AUDIO_PREPROCESSING_LIMITS.maxBlobBytes;

  if (!overDurationLimit && !overSizeLimit) {
    return {
      shouldPreprocess: true,
      mode: 'client',
      reason: 'within_limits',
      stageLabel: 'Optymalizacja audio w przeglądarce...',
      recordingMessage: 'Przygotowanie nagrania...',
    };
  }

  const reason =
    overDurationLimit && overSizeLimit
      ? 'duration_and_size'
      : overDurationLimit
        ? 'duration'
        : 'size';

  return {
    shouldPreprocess: false,
    mode: 'server',
    reason,
    stageLabel: 'Przygotowanie do serwerowego przetwarzania audio...',
    recordingMessage:
      'Długie nagranie - pomijam lokalne ulepszanie audio, żeby UI pozostał responsywny.',
  };
}

export async function attachRecordingWithRetry({
  attachCompletedRecording,
  meetingId,
  recording,
  sleep = defaultSleep,
  retries = 7,
  retryDelayMs = 2000,
}: {
  attachCompletedRecording: (meetingId: any, recording: any) => boolean | void;
  meetingId: any;
  recording: any;
  sleep?: (ms: number) => Promise<void>;
  retries?: number;
  retryDelayMs?: number;
}) {
  let attached = attachCompletedRecording(meetingId, recording);
  if (attached === false) {
    for (let attempt = 0; attempt < retries && !attached; attempt += 1) {
      await sleep(retryDelayMs);
      attached = attachCompletedRecording(meetingId, recording);
    }
  }

  return attached !== false;
}

function getAttachTarget(target: any, nextItem?: RecordingQueueItem) {
  if (target && typeof target === 'object' && target.id) {
    return {
      ...target,
      workspaceId: target.workspaceId || nextItem?.workspaceId || '',
      title: target.title || nextItem?.meetingTitle || 'Spotkanie',
    };
  }

  const snapshot = nextItem?.meetingSnapshot;
  if (snapshot?.id) {
    return {
      ...snapshot,
      workspaceId: snapshot.workspaceId || nextItem?.workspaceId || '',
      title: snapshot.title || nextItem?.meetingTitle || 'Spotkanie',
    };
  }

  return target;
}

function resolveWorkspaceId(target: any, nextItem: RecordingQueueItem) {
  return String(target?.workspaceId || nextItem.workspaceId || '').trim();
}

function hasRecoverableAttachContext(target: any, nextItem: RecordingQueueItem) {
  const attachTarget = getAttachTarget(target, nextItem);
  if (!attachTarget || typeof attachTarget !== 'object' || !attachTarget.id) {
    return false;
  }

  return Boolean(
    attachTarget.workspaceId ||
    nextItem.workspaceId ||
    attachTarget.title ||
    nextItem.meetingTitle ||
    nextItem.meetingSnapshot?.id
  );
}

function scheduleCompletedAttachRecovery({
  nextItem,
  updateQueueItem,
  setState,
  getPipelineSnapshot,
  scheduleBackoffReset,
  now,
}: {
  nextItem: RecordingQueueItem;
  updateQueueItem: QueueProcessorContext['updateQueueItem'];
  setState: QueueProcessorContext['setState'];
  getPipelineSnapshot: QueueProcessorContext['getPipelineSnapshot'];
  scheduleBackoffReset: QueueProcessorContext['scheduleBackoffReset'];
  now: () => number;
}) {
  const retryAfterMs = BACKGROUND_TRANSCRIPTION_RETRY_MS;
  updateQueueItem(nextItem.recordingId, {
    status: 'processing',
    errorMessage: '',
    lastErrorMessage: '',
    backoffUntil: now() + retryAfterMs,
  });
  scheduleBackoffReset?.(nextItem.recordingId, retryAfterMs);
  const recoverySnapshot = getPipelineSnapshot('processing', 96, RECORDING_ATTACH_RECOVERY_MESSAGE);
  setState({
    analysisStatus: 'processing',
    pipelineProgressPercent: recoverySnapshot.progressPercent,
    pipelineStageLabel: recoverySnapshot.stageLabel,
    recordingMessage: RECORDING_ATTACH_RECOVERY_MESSAGE,
  });
}

export async function waitForCompletedTranscription({
  nextItem,
  mediaService,
  started,
  startStatus,
  updateQueueItem,
  setState,
  getPipelineSnapshot,
  normalizeTranscriptionResponse,
  sleep = defaultSleep,
  now = () => Date.now(),
  softPollingMs = TRANSCRIPTION_SOFT_POLLING_MS,
}: {
  nextItem: RecordingQueueItem;
  mediaService: any;
  started: StartedTranscription;
  startStatus: RecordingPipelineStatus;
  updateQueueItem: QueueProcessorContext['updateQueueItem'];
  setState: QueueProcessorContext['setState'];
  getPipelineSnapshot: QueueProcessorContext['getPipelineSnapshot'];
  normalizeTranscriptionResponse: QueueProcessorContext['normalizeTranscriptionResponse'];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  softPollingMs?: number;
}) {
  if (startStatus === 'done') {
    return { ...started, pipelineStatus: 'done' } as StartedTranscription;
  }

  let consecutiveErrors = 0;
  let totalPollErrors = 0;
  const maxConsecutiveErrors = 20;
  const maxTotalPollErrors = 30;
  let finalTranscription: StartedTranscription | null = null;
  let lastStatus = started;
  const pollingStartedAt = now();
  const processingStartedAt = safeTimestampMs(nextItem.processingStartedAt, pollingStartedAt);
  const hardTimeoutMs = calculateTranscriptionHardTimeoutMs(nextItem.duration);

  while (true) {
    const currentTime = now();
    const processingAgeMs = Math.max(0, currentTime - processingStartedAt);
    if (processingAgeMs >= hardTimeoutMs) {
      throw new Error('Transkrypcja przekroczyla bezpieczny limit czasu.');
    }

    if (currentTime - pollingStartedAt >= softPollingMs) {
      throw new BackgroundTranscriptionPendingError(lastStatus, processingAgeMs);
    }

    let result: StartedTranscription;

    try {
      result = normalizeTranscriptionResponse(
        await mediaService.getTranscriptionJobStatus(nextItem.recordingId)
      ) as StartedTranscription;
      lastStatus = result;
      consecutiveErrors = 0;
    } catch (pollError: any) {
      if (Number(pollError?.status) === 404) {
        throw new RemoteRecordingMissingError(pollError);
      }

      consecutiveErrors += 1;
      totalPollErrors += 1;

      if (
        consecutiveErrors === 1 ||
        consecutiveErrors === maxConsecutiveErrors ||
        totalPollErrors === maxTotalPollErrors
      ) {
        console.warn(
          `[Pipeline] Status poll error (${consecutiveErrors}/${maxConsecutiveErrors}, total ${totalPollErrors}/${maxTotalPollErrors}):`,
          pollError?.message
        );
      }

      if (consecutiveErrors >= maxConsecutiveErrors || totalPollErrors >= maxTotalPollErrors) {
        throw new Error('Backend niedostepny przez dluzszy czas. Sprobuj ponownie za chwile.');
      }

      await sleep(consecutiveErrors < 3 ? 2000 : 7000);
      continue;
    }

    updateQueueItem(nextItem.recordingId, {
      pipelineGitSha: result?.pipelineGitSha || '',
      pipelineVersion: result?.pipelineVersion || '',
      pipelineBuildTime: result?.pipelineBuildTime || '',
      audioQuality: result?.audioQuality || nextItem.audioQuality || null,
      transcriptionDiagnostics: result?.transcriptionDiagnostics || null,
    });

    const status = normalizeRecordingPipelineStatus(result?.pipelineStatus);
    if (status === 'done') {
      finalTranscription = { ...result, pipelineStatus: 'done' };
      break;
    }

    if (status === 'failed') {
      updateQueueItem(nextItem.recordingId, {
        audioQuality: result?.audioQuality || nextItem.audioQuality || null,
        transcriptionDiagnostics: result?.transcriptionDiagnostics || null,
      });
      const failedError: any = new Error(
        result?.errorMessage || 'Serwer nie zakonczyl transkrypcji.'
      );
      failedError.audioQuality = result?.audioQuality || null;
      failedError.transcriptionDiagnostics = result?.transcriptionDiagnostics || null;
      throw failedError;
    }

    updateQueueItem(nextItem.recordingId, {
      status,
      errorMessage: '',
      audioQuality: result?.audioQuality || nextItem.audioQuality || null,
      transcriptionDiagnostics: result?.transcriptionDiagnostics || null,
    });

    const pollingSnapshot = getPipelineSnapshot(status);
    setState({
      pipelineProgressPercent: pollingSnapshot.progressPercent,
      pipelineStageLabel: pollingSnapshot.stageLabel,
      recordingMessage:
        status === 'queued'
          ? 'Nagranie czeka na wolny slot przetwarzania...'
          : status === 'diarization'
            ? 'Rozpoznawanie mowcow i porzadkowanie wypowiedzi...'
            : 'Serwer przetwarza nagranie...',
    });
    await sleep(getPollingSleepMs(result?.retryAfterMs));
  }

  if (!finalTranscription) {
    if (totalPollErrors > 0) {
      throw new Error('Backend niedostepny przez dluzszy czas. Sprobuj ponownie za chwile.');
    }
    throw new BackgroundTranscriptionPendingError(
      lastStatus,
      Math.max(0, now() - processingStartedAt)
    );
  }

  return finalTranscription;
}

export async function processRecordingQueueItem(context: QueueProcessorContext) {
  const {
    nextItem,
    resolveMeetingForQueueItem,
    attachCompletedRecording,
    setCurrentSegments,
    updateQueueItem,
    removeQueueItem,
    setState,
    getState,
    getAudioBlob,
    createMediaService,
    filterSilence,
    enhanceAndReencode,
    analyzeMeeting,
    getPipelineSnapshot,
    normalizeTranscriptionResponse,
    buildFallbackAnalysis,
    emptyTranscriptMessage,
    toUserFacingQueueError,
    isExpectedDomainFailure,
    isTransientNetworkError,
    maxAutoRetries,
    retryDelaysMs,
    sleep = defaultSleep,
    scheduleBackoffReset,
    now = () => Date.now(),
  } = context;

  try {
    const target = resolveMeetingForQueueItem(nextItem);
    if (!target?.id) {
      return;
    }

    const mediaService = createMediaService();
    const workspaceId = resolveWorkspaceId(target, nextItem);
    const targetWithWorkspace =
      workspaceId && target.workspaceId !== workspaceId ? { ...target, workspaceId } : target;

    if (mediaService.mode === 'remote' && !workspaceId) {
      updateQueueItem(nextItem.recordingId, {
        status: 'failed_permanent',
        errorMessage: RECORDING_WORKSPACE_REQUIRED_MESSAGE,
      });
      const snapshot = getPipelineSnapshot('failed', 0, RECORDING_WORKSPACE_REQUIRED_MESSAGE);
      setState({
        analysisStatus: 'error',
        pipelineProgressPercent: snapshot.progressPercent,
        pipelineStageLabel: snapshot.stageLabel,
        recordingMessage: RECORDING_WORKSPACE_REQUIRED_MESSAGE,
      });
      return;
    }

    const canReuseRemoteUpload = mediaService.mode === 'remote' && nextItem.uploaded;
    const localBlob = canReuseRemoteUpload ? null : await getAudioBlob(nextItem.recordingId);

    if (!localBlob && !canReuseRemoteUpload) {
      updateQueueItem(nextItem.recordingId, {
        status: 'failed',
        errorMessage: 'Brakuje lokalnego audio.',
      });
      const snapshot = getPipelineSnapshot('failed', 0, 'Brakuje lokalnego audio');
      setState({
        pipelineProgressPercent: snapshot.progressPercent,
        pipelineStageLabel: snapshot.stageLabel,
      });
      return;
    }

    if (!nextItem.uploaded) {
      let uploadBlob: Blob | null = localBlob as Blob;
      let vadRemovedS = 0;
      const preprocessingPlan = buildAudioPreprocessingPlan({
        blob: uploadBlob,
        durationSeconds: nextItem.duration,
      });

      if (preprocessingPlan.shouldPreprocess) {
        try {
          setState({ pipelineStageLabel: 'Optymalizacja audio (VAD)…' });
          const vadResult = await filterSilence(localBlob as Blob);
          if (vadResult.removedS >= 2) {
            uploadBlob = vadResult.blob;
            vadRemovedS = vadResult.removedS;
          }
        } catch {
          // Fallback to original blob.
        }

        try {
          setState({ pipelineStageLabel: 'Poprawa jakości audio…' });
          uploadBlob = await enhanceAndReencode(uploadBlob as Blob, {
            removeNoise: true,
            normalizeVolume: true,
            targetBitrate: 64000,
          });
        } catch {
          // Fallback to pre-enhancement blob.
        }
      } else {
        setState({
          pipelineStageLabel: preprocessingPlan.stageLabel,
          recordingMessage: preprocessingPlan.recordingMessage,
        });
      }

      const uploadSnapshot = getPipelineSnapshot('uploading', 12, 'Wgrywanie audio na serwer');
      setState({
        pipelineProgressPercent: uploadSnapshot.progressPercent,
        pipelineStageLabel:
          vadRemovedS > 0
            ? `Wgrywanie audio (wycięto ${Math.round(vadRemovedS)}s ciszy)…`
            : preprocessingPlan.shouldPreprocess
              ? uploadSnapshot.stageLabel
              : 'Wgrywanie audio bez lokalnego ulepszania...',
        recordingMessage:
          vadRemovedS > 0
            ? `Wgrywanie nagrania (wycięto ${Math.round(vadRemovedS)}s ciszy)…`
            : preprocessingPlan.shouldPreprocess
              ? 'Wgrywanie nagrania na serwer...'
              : preprocessingPlan.recordingMessage,
      });
      updateQueueItem(nextItem.recordingId, {
        status: 'uploading',
        attempts: (nextItem.attempts || 0) + 1,
        errorMessage: '',
      });

      const uploadResult = await mediaService.persistRecordingAudio(
        nextItem.recordingId,
        uploadBlob,
        {
          workspaceId,
          meetingId: targetWithWorkspace.id,
          onProgress: (pct: number) => {
            const mapped = 12 + Math.round((pct / 100) * 10);
            setState({
              pipelineProgressPercent: mapped,
              pipelineStageLabel: `Wgrywanie audio: ${Math.round(pct)}%`,
            });
          },
        }
      );

      updateQueueItem(nextItem.recordingId, {
        audioQuality: uploadResult?.audioQuality || nextItem.audioQuality || null,
      });
    }

    const processingStartedAt = nextItem.processingStartedAt || new Date(now()).toISOString();
    updateQueueItem(nextItem.recordingId, {
      status: 'processing',
      uploaded: true,
      errorMessage: '',
      processingStartedAt,
    });

    const processingSnapshot = getPipelineSnapshot(
      'processing',
      24,
      'Plik zapisany. Oczekiwanie na start transkrypcji'
    );
    setState({
      pipelineProgressPercent: processingSnapshot.progressPercent,
      pipelineStageLabel: processingSnapshot.stageLabel,
      recordingMessage: 'Audio przeslane. Oczekiwanie na przetwarzanie...',
    });

    let startedRaw: unknown;
    if (canReuseRemoteUpload) {
      let currentRaw: unknown;
      try {
        currentRaw = await mediaService.getTranscriptionJobStatus(nextItem.recordingId);
      } catch (statusError: any) {
        if (Number(statusError?.status) === 404) {
          throw new RemoteRecordingMissingError(statusError);
        }
        throw statusError;
      }
      const current = normalizeTranscriptionResponse(currentRaw) as StartedTranscription;
      const currentStatus = normalizeRecordingPipelineStatus(current?.pipelineStatus);
      startedRaw =
        currentStatus === 'done' ||
        nextItem.status === 'processing' ||
        !mediaService.retryTranscriptionJob
          ? currentRaw
          : await mediaService.retryTranscriptionJob(nextItem.recordingId);
    } else {
      startedRaw = await mediaService.startTranscriptionJob({
        recordingId: nextItem.recordingId,
        blob: localBlob,
        meeting: targetWithWorkspace,
        rawSegments: nextItem.rawSegments,
      });
    }

    const started = normalizeTranscriptionResponse(startedRaw) as StartedTranscription;
    const transcriptionProviderId = started.providerId || '';
    const transcriptionProviderLabel = started.providerLabel || transcriptionProviderId;

    updateQueueItem(nextItem.recordingId, {
      pipelineGitSha: started?.pipelineGitSha || '',
      pipelineVersion: started?.pipelineVersion || '',
      pipelineBuildTime: started?.pipelineBuildTime || '',
      audioQuality: started?.audioQuality || nextItem.audioQuality || null,
      transcriptionDiagnostics: started?.transcriptionDiagnostics || null,
    });

    const startStatus = normalizeRecordingPipelineStatus(started?.pipelineStatus);
    const startSnapshot = getPipelineSnapshot(startStatus, startStatus === 'queued' ? 28 : null);
    setState({
      pipelineProgressPercent: startSnapshot.progressPercent,
      pipelineStageLabel: startSnapshot.stageLabel,
    });

    const unsubscribeProgress = mediaService.subscribeToTranscriptionProgress?.(
      nextItem.recordingId,
      (payload: any) => {
        if (!payload || !payload.message) return;
        const progressSnapshot = getPipelineSnapshot(
          payload?.status || 'processing',
          payload?.progress,
          payload?.message
        );
        setState({
          recordingMessage: `⏳ ${Math.max(0, Math.min(100, Math.round(Number(payload.progress) || 0)))}%: ${payload.message}`,
          pipelineProgressPercent: progressSnapshot.progressPercent,
          pipelineStageLabel: progressSnapshot.stageLabel,
        });
      }
    );

    let transcription: StartedTranscription;
    try {
      transcription = await waitForCompletedTranscription({
        nextItem: { ...nextItem, processingStartedAt },
        mediaService,
        started,
        startStatus,
        updateQueueItem,
        setState,
        getPipelineSnapshot,
        normalizeTranscriptionResponse,
        sleep,
        now,
      });
    } finally {
      unsubscribeProgress?.();
    }

    const verifiedSegments = Array.isArray(transcription.segments) ? transcription.segments : [];
    const reviewableSegments = verifiedSegments as Array<
      TranscriptionStatusPayload['segments'][number] & {
        verificationStatus?: 'review' | 'verified' | 'low-confidence';
      }
    >;
    const needsReviewCount = reviewableSegments.filter(
      (segment) =>
        segment.verificationStatus === 'review' || segment.verificationStatus === 'low-confidence'
    ).length;
    const lowConfidenceCount = reviewableSegments.filter(
      (segment) => segment.verificationStatus === 'low-confidence'
    ).length;
    const approvedCount = reviewableSegments.filter(
      (segment) => segment.verificationStatus === 'verified'
    ).length;
    setCurrentSegments?.(verifiedSegments);

    const isEmptyTranscript =
      transcription?.pipelineStatus === 'done' &&
      (transcription?.transcriptOutcome === 'empty' || verifiedSegments.length === 0);

    if (isEmptyTranscript) {
      const recording = {
        id: nextItem.recordingId,
        createdAt: nextItem.createdAt || new Date().toISOString(),
        duration: nextItem.duration || 0,
        transcript: [],
        transcriptOutcome: 'empty',
        emptyReason:
          transcription.emptyReason ||
          (verifiedSegments.length === 0
            ? 'no_segments_returned_by_pipeline'
            : 'no_segments_from_stt'),
        userMessage:
          transcription.userMessage ||
          (verifiedSegments.length === 0
            ? 'Pipeline zakonczyl przetwarzanie, ale nie zwrocil segmentow transkrypcji.'
            : 'Nie wykryto wypowiedzi w nagraniu.'),
        pipelineGitSha: transcription.pipelineGitSha || '',
        pipelineVersion: transcription.pipelineVersion || '',
        pipelineBuildTime: transcription.pipelineBuildTime || '',
        audioQuality: transcription.audioQuality || nextItem.audioQuality || null,
        transcriptionDiagnostics: transcription.transcriptionDiagnostics || null,
        speakerNames: transcription.speakerNames || {},
        speakerCount: transcription.speakerCount || 0,
        diarizationConfidence: transcription.confidence || 0,
        reviewSummary: transcription.reviewSummary || {
          needsReview: 0,
          lowConfidence: 0,
          approved: 0,
        },
        transcriptionProvider: transcriptionProviderId,
        transcriptionProviderLabel: transcriptionProviderLabel,
        pipelineStatus: 'done',
        storageMode: mediaService.mode === 'remote' ? 'remote' : 'indexeddb',
        analysis: buildFallbackAnalysis('Nie wykryto wypowiedzi w nagraniu.', {
          speakerNames: transcription.speakerNames || {},
          speakerCount: transcription.speakerCount || 0,
        }),
        processingStartedAt: nextItem.processingStartedAt || null,
        processingEndedAt: new Date().toISOString(),
      };

      const attached = await attachRecordingWithRetry({
        attachCompletedRecording,
        meetingId: getAttachTarget(targetWithWorkspace, nextItem),
        recording,
        sleep,
      });

      if (!attached) {
        if (hasRecoverableAttachContext(targetWithWorkspace, nextItem)) {
          console.warn(
            '[queue] Completed empty transcript attach deferred until meeting state is hydrated',
            nextItem.recordingId,
            targetWithWorkspace.id
          );
          scheduleCompletedAttachRecovery({
            nextItem,
            updateQueueItem,
            setState,
            getPipelineSnapshot,
            scheduleBackoffReset,
            now,
          });
          return;
        }
        console.warn(
          '[queue] Meeting not found when attaching empty-transcript recording after retries',
          nextItem.recordingId,
          targetWithWorkspace.id
        );
        updateQueueItem(nextItem.recordingId, {
          status: 'failed',
          errorMessage: 'Nie znaleziono spotkania do przypisania nagrania. Sprobuj ponownie.',
        });
        return;
      }

      removeQueueItem(nextItem.recordingId);
      const doneSnapshot = getPipelineSnapshot('done');
      setState({
        lastQueueErrorKey: '',
        analysisStatus: 'done',
        pipelineProgressPercent: doneSnapshot.progressPercent,
        pipelineStageLabel: doneSnapshot.stageLabel,
        recordingMessage: emptyTranscriptMessage,
      });
      return;
    }

    const reviewSnapshot = getPipelineSnapshot(
      'review',
      92,
      'Tworzenie podsumowania i finalizacja wyniku'
    );
    setState({
      analysisStatus: 'processing',
      pipelineProgressPercent: reviewSnapshot.progressPercent,
      pipelineStageLabel: reviewSnapshot.stageLabel,
      recordingMessage: 'Tworzenie podsumowania spotkania...',
    });

    let analysis;
    try {
      analysis = await analyzeMeeting({
        meeting: targetWithWorkspace,
        segments: verifiedSegments,
        speakerNames: transcription.speakerNames || {},
        diarization: transcription.diarization || {},
      });
    } catch (error) {
      console.error('Meeting analysis failed.', error);
      analysis = buildFallbackAnalysis(
        'Analiza AI nie powiodla sie. Zachowalismy transkrypcje i segmenty.',
        {
          speakerNames: transcription.speakerNames || {},
          speakerCount: transcription.speakerCount || 0,
        }
      );
    }

    const recording = {
      id: nextItem.recordingId,
      createdAt: nextItem.createdAt || new Date().toISOString(),
      duration: nextItem.duration || 0,
      transcript: verifiedSegments,
      speakerNames: analysis.speakerLabels || transcription.speakerNames || {},
      speakerCount: analysis.speakerCount || transcription.speakerCount || 0,
      diarizationConfidence: transcription.confidence || 0,
      reviewSummary: transcription.reviewSummary || {
        needsReview: needsReviewCount,
        lowConfidence: lowConfidenceCount,
        approved: approvedCount,
      },
      transcriptionProvider: transcriptionProviderId,
      transcriptionProviderLabel: transcriptionProviderLabel,
      pipelineStatus: 'done',
      pipelineGitSha: transcription.pipelineGitSha || '',
      pipelineVersion: transcription.pipelineVersion || '',
      pipelineBuildTime: transcription.pipelineBuildTime || '',
      audioQuality: transcription.audioQuality || nextItem.audioQuality || null,
      transcriptionDiagnostics: transcription.transcriptionDiagnostics || null,
      storageMode: mediaService.mode === 'remote' ? 'remote' : 'indexeddb',
      analysis,
      processingStartedAt: nextItem.processingStartedAt || null,
      processingEndedAt: new Date().toISOString(),
    };

    const attached = await attachRecordingWithRetry({
      attachCompletedRecording,
      meetingId: getAttachTarget(targetWithWorkspace, nextItem),
      recording,
      sleep,
    });

    if (!attached) {
      if (hasRecoverableAttachContext(targetWithWorkspace, nextItem)) {
        console.warn(
          '[queue] Completed recording attach deferred until meeting state is hydrated',
          nextItem.recordingId,
          targetWithWorkspace.id
        );
        scheduleCompletedAttachRecovery({
          nextItem,
          updateQueueItem,
          setState,
          getPipelineSnapshot,
          scheduleBackoffReset,
          now,
        });
        return;
      }
      console.warn(
        '[queue] Meeting not found when attaching recording after retries',
        nextItem.recordingId,
        targetWithWorkspace.id
      );
      updateQueueItem(nextItem.recordingId, {
        status: 'failed',
        errorMessage: 'Nie znaleziono spotkania do przypisania nagrania. Sprobuj ponownie.',
      });
      return;
    }

    removeQueueItem(nextItem.recordingId);
    const doneSnapshot = getPipelineSnapshot('done');
    setState({
      lastQueueErrorKey: '',
      analysisStatus: 'done',
      pipelineProgressPercent: doneSnapshot.progressPercent,
      pipelineStageLabel: doneSnapshot.stageLabel,
      recordingMessage:
        needsReviewCount > 0
          ? 'Nagranie czeka czesciowo na review.'
          : 'Nagranie zostalo przetworzone.',
    });
  } catch (error: any) {
    if (isBackgroundTranscriptionPendingError(error)) {
      const retryAfterMs = normalizeRetryAfterMs(error.retryAfterMs);
      const status = normalizeRecordingPipelineStatus(error.pipelineStatus || nextItem.status);
      const diagnostics = {
        recordingId: nextItem.recordingId,
        workspaceId: nextItem.workspaceId,
        duration: nextItem.duration,
        status,
        attempts: nextItem.attempts,
        processingAgeMs: error.processingAgeMs,
        activeJob: error.activeJob,
        queuedPosition: error.queuedPosition,
      };
      reportBackgroundTranscriptionPending(diagnostics);
      updateQueueItem(nextItem.recordingId, {
        status,
        errorMessage: '',
        lastErrorMessage: '',
        backoffUntil: now() + retryAfterMs,
        activeJob: error.activeJob,
        queuedPosition: error.queuedPosition,
        processingAgeMs: error.processingAgeMs,
        retryAfterMs,
      });
      scheduleBackoffReset?.(nextItem.recordingId, retryAfterMs);
      const pendingSnapshot = getPipelineSnapshot(
        status,
        null,
        BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE
      );
      setState({
        analysisStatus: 'processing',
        pipelineProgressPercent: pendingSnapshot.progressPercent,
        pipelineStageLabel: pendingSnapshot.stageLabel,
        recordingMessage: BACKGROUND_TRANSCRIPTION_PENDING_MESSAGE,
      });
      return;
    }

    const retryCount = nextItem.retryCount || 0;
    if (isTransientNetworkError(error) && retryCount < maxAutoRetries) {
      const delay = retryDelaysMs[retryCount] ?? retryDelaysMs[retryDelaysMs.length - 1];
      console.warn(
        `[queue] Transient network error (retry ${retryCount + 1}/${maxAutoRetries}), backoff ${delay}ms`,
        error?.message
      );
      updateQueueItem(nextItem.recordingId, {
        status: 'queued',
        retryCount: retryCount + 1,
        backoffUntil: now() + delay,
        lastErrorMessage: toUserFacingQueueError(error),
        errorMessage: '',
      });
      scheduleBackoffReset?.(nextItem.recordingId, delay);
      return;
    }

    const userFacingMessage = toUserFacingQueueError(error);
    const errorKey = `${nextItem.recordingId}:${userFacingMessage}`;
    if (getState().lastQueueErrorKey !== errorKey) {
      if (!isExpectedDomainFailure(error)) {
        console.error('Recording queue item failed.', error);
      }
      setState({ lastQueueErrorKey: errorKey });
    }

    const isPermanent =
      error?.status === 409 ||
      isRemoteRecordingMissingError(error) ||
      isWorkspaceMissingErrorMessage(userFacingMessage) ||
      isWorkspaceMissingErrorMessage(error?.message) ||
      (!isTransientNetworkError(error) && retryCount >= maxAutoRetries);

    updateQueueItem(nextItem.recordingId, {
      status: isPermanent ? 'failed_permanent' : 'failed',
      errorMessage: userFacingMessage,
    });
    const failedSnapshot = getPipelineSnapshot('failed', 0, userFacingMessage);
    setState({
      analysisStatus: 'error',
      pipelineProgressPercent: failedSnapshot.progressPercent,
      pipelineStageLabel: failedSnapshot.stageLabel,
      recordingMessage: userFacingMessage
        ? `Blad w kolejce: ${userFacingMessage}`
        : 'Blad w kolejce. Sprobuj ponownie.',
    });
  }
}
