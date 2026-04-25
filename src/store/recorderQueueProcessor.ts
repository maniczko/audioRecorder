import { normalizeRecordingPipelineStatus, type RecordingQueueItem } from '../lib/recordingQueue';
import type { RecordingPipelineStatus } from '../lib/recordingQueue';
import type { TranscriptionStatusPayload } from '../shared/types';
import type { MeetingAnalysis, TranscriptSegment } from '../shared/types';

type QueueSnapshot = {
  progressPercent: number;
  stageLabel: string;
};

type QueueStatePatch = Record<string, unknown>;

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
};

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
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
}) {
  if (startStatus === 'done') {
    return { ...started, pipelineStatus: 'done' } as StartedTranscription;
  }

  let attempts = 0;
  let consecutiveErrors = 0;
  let totalPollErrors = 0;
  const maxConsecutiveErrors = 20;
  const maxTotalPollErrors = 30;
  let finalTranscription: StartedTranscription | null = null;

  while (attempts < 120) {
    attempts += 1;
    let result: StartedTranscription;

    try {
      result = normalizeTranscriptionResponse(
        await mediaService.getTranscriptionJobStatus(nextItem.recordingId)
      ) as StartedTranscription;
      consecutiveErrors = 0;
    } catch (pollError: any) {
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
    await sleep(1500);
  }

  if (!finalTranscription) {
    if (totalPollErrors > 0) {
      throw new Error('Backend niedostepny przez dluzszy czas. Sprobuj ponownie za chwile.');
    }
    throw new Error('Transkrypcja trwa zbyt dlugo. Sprobuj ponownie za chwile.');
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
          workspaceId: target.workspaceId || nextItem.workspaceId || '',
          meetingId: target.id,
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

    updateQueueItem(nextItem.recordingId, {
      status: 'processing',
      uploaded: true,
      errorMessage: '',
      processingStartedAt: new Date().toISOString(),
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

    const startedRaw =
      nextItem.uploaded && nextItem.status === 'processing'
        ? await mediaService.getTranscriptionJobStatus(nextItem.recordingId)
        : canReuseRemoteUpload &&
            nextItem.status !== 'processing' &&
            mediaService.retryTranscriptionJob
          ? await mediaService.retryTranscriptionJob(nextItem.recordingId)
          : await mediaService.startTranscriptionJob({
              recordingId: nextItem.recordingId,
              blob: localBlob,
              meeting: target,
              rawSegments: nextItem.rawSegments,
            });

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
        nextItem,
        mediaService,
        started,
        startStatus,
        updateQueueItem,
        setState,
        getPipelineSnapshot,
        normalizeTranscriptionResponse,
        sleep,
      });
    } finally {
      unsubscribeProgress?.();
    }

    const verifiedSegments = Array.isArray(transcription.segments) ? transcription.segments : [];
    const reviewableSegments = verifiedSegments as Array<
      TranscriptionStatusPayload['segments'][number] & {
        verificationStatus?: 'review' | 'verified';
      }
    >;
    const needsReviewCount = reviewableSegments.filter(
      (segment) => segment.verificationStatus === 'review'
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
        reviewSummary: transcription.reviewSummary || { needsReview: 0, approved: 0 },
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
        meetingId: target.id,
        recording,
        sleep,
      });

      if (!attached) {
        console.warn(
          '[queue] Meeting not found when attaching empty-transcript recording after retries',
          nextItem.recordingId,
          target.id
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
        meeting: target,
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
      meetingId: target.id,
      recording,
      sleep,
    });

    if (!attached) {
      console.warn(
        '[queue] Meeting not found when attaching recording after retries',
        nextItem.recordingId,
        target.id
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
      error?.status === 409 || (!isTransientNetworkError(error) && retryCount >= maxAutoRetries);

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
