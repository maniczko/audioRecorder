import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS, idbJSONStorage } from '../lib/storage';
import {
  getNextProcessableRecordingQueueItem,
  getNextPendingRecordingQueueItem,
  normalizeRecordingPipelineStatus,
  removeRecordingQueueItem,
  updateRecordingQueueItem,
} from '../lib/recordingQueue';
import { getAudioBlob } from '../lib/audioStore';
import { analyzeMeeting } from '../lib/analysis';
import { createMediaService } from '../services/mediaService';
import { getPreviewRuntimeStatus } from '../services/httpClient';
import { filterSilence } from '../audio/vadFilter';
import {
  normalizeMediaTranscriptionResponse,
  type MediaTranscriptionResponse,
} from '../shared/contracts';
import type { TranscriptionStatusPayload } from '../shared/types';
import type { RecordingPipelineStatus } from '../lib/recordingQueue';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function clampProgress(value: number | null | undefined) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getPipelineSnapshot(
  status: RecordingPipelineStatus | string | null | undefined,
  upstreamProgress: number | null = null,
  upstreamMessage = ''
) {
  const message = String(upstreamMessage || '').trim();
  const normalizedStatus = String(status || 'queued');

  if (normalizedStatus === 'uploading') {
    return {
      progressPercent: clampProgress(upstreamProgress ?? 12),
      stageLabel: message || 'Wgrywanie audio na serwer',
    };
  }

  if (normalizedStatus === 'queued') {
    return {
      progressPercent: clampProgress(upstreamProgress ?? 24),
      stageLabel: message || 'Nagranie czeka na rozpoczecie przetwarzania',
    };
  }

  if (normalizedStatus === 'processing') {
    const mapped = upstreamProgress == null ? 56 : 25 + clampProgress(upstreamProgress) * 0.6;
    return {
      progressPercent: clampProgress(mapped),
      stageLabel: message || 'Serwer przygotowuje transkrypcje',
    };
  }

  if (normalizedStatus === 'diarization') {
    const mapped = upstreamProgress == null ? 78 : 55 + clampProgress(upstreamProgress) * 0.35;
    return {
      progressPercent: clampProgress(mapped),
      stageLabel: message || 'Rozpoznawanie mowcow i porzadkowanie segmentow',
    };
  }

  if (normalizedStatus === 'review') {
    return {
      progressPercent: clampProgress(upstreamProgress ?? 92),
      stageLabel: message || 'Finalne sprawdzenie transkrypcji',
    };
  }

  if (normalizedStatus === 'done') {
    return {
      progressPercent: 100,
      stageLabel: message || 'Nagranie przetworzone',
    };
  }

  if (normalizedStatus === 'failed') {
    return {
      progressPercent: clampProgress(upstreamProgress ?? 0),
      stageLabel: message || 'Przetwarzanie nie powiodlo sie',
    };
  }

  return {
    progressPercent: clampProgress(upstreamProgress ?? 0),
    stageLabel: message,
  };
}

function buildFallbackAnalysis(message, diarization) {
  return {
    summary: message,
    decisions: [],
    actionItems: [],
    followUps: [],
    needsCoverage: [],
    speakerLabels: diarization.speakerNames,
    speakerCount: diarization.speakerCount,
  };
}

type ExtendedMediaTranscriptionResponse = MediaTranscriptionResponse & {
  verifiedSegments?: TranscriptionStatusPayload['segments'];
  providerId?: string;
  providerLabel?: string;
  reviewSummary?: unknown;
};

function normalizeTranscriptionResponse(
  response: ExtendedMediaTranscriptionResponse | null | undefined
): TranscriptionStatusPayload & {
  providerId?: string;
  providerLabel?: string;
  reviewSummary?: unknown;
} {
  const normalized = normalizeMediaTranscriptionResponse(response);
  return {
    ...normalized,
    segments: Array.isArray(response?.verifiedSegments)
      ? response.verifiedSegments
      : normalized.segments,
    providerId: response?.providerId,
    providerLabel: response?.providerLabel,
    reviewSummary: response?.reviewSummary ?? normalized.reviewSummary,
  };
}

const EMPTY_TRANSCRIPT_MESSAGE =
  'Nie wykryto wypowiedzi w nagraniu. Sprawdz jakosc pliku, glosnosc albo sprobuj ponownie innym formatem.';

function normalizeErrorForMatching(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toUserFacingQueueError(error: any) {
  const errorMessage = String(error?.message || 'Blad przetwarzania.');
  const normalizedMessage = normalizeErrorForMatching(errorMessage);

  if (
    errorMessage.includes('Brak tokenu autoryzacyjnego') ||
    errorMessage.includes('Sesja wygasla')
  ) {
    return 'Brak autoryzacji do backendu. Zaloguj sie ponownie.';
  }

  if (
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('Load failed') ||
    errorMessage.includes('ERR_FAILED') ||
    errorMessage.includes('Application failed to respond') ||
    errorMessage.includes('ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR') ||
    errorMessage.includes('Bad Gateway') ||
    errorMessage.includes('HTTP 502')
  ) {
    if (getPreviewRuntimeStatus() === 'stale_runtime') {
      return 'Hostowany preview jest nieaktualny wzgledem backendu. Odswiez strone lub otworz najnowszy deploy.';
    }
    if (getPreviewRuntimeStatus() === 'healthy' && errorMessage.includes('Failed to fetch')) {
      return 'Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.';
    }
    return 'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.';
  }

  if (errorMessage.includes('Model STT nie zwrocil zadnych segmentow transkrypcji')) {
    return EMPTY_TRANSCRIPT_MESSAGE;
  }

  if (
    normalizedMessage.includes('serwer chwilowo przeciazony pamieciowo') ||
    normalizedMessage.includes('serwer jest przeciazony')
  ) {
    return 'Serwer chwilowo przeciazony pamieciowo - sprobuj ponownie za minute.';
  }

  if (
    error?.status === 507 ||
    errorMessage.includes('Brak miejsca na dysku') ||
    errorMessage.includes('ENOSPC')
  ) {
    return 'Serwer nie ma miejsca na dysku. Skontaktuj sie z administratorem lub poczekaj na zwolnienie miejsca.';
  }

  return errorMessage;
}

function isExpectedDomainFailure(error: any) {
  const errorMessage = String(error?.message || '');
  return (
    errorMessage.includes('Model STT nie zwrocil zadnych segmentow transkrypcji.') ||
    errorMessage.includes('Lokalny plik audio nie istnieje') ||
    error?.status === 409
  );
}

function isTransientNetworkError(error: any) {
  const msg = normalizeErrorForMatching(error?.message);
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('bad gateway') ||
    msg.includes('http 502') ||
    msg.includes('hostowany preview nie moze') ||
    msg.includes('serwer chwilowo przeciazony pamieciowo') ||
    msg.includes('serwer jest przeciazony')
  );
}

const MAX_AUTO_RETRIES = 5;
// Exponential backoff delays for retries: 1s, 4s, 16s, 32s, 64s (~2 min total — enough for Railway restart)
const RETRY_DELAYS_MS = [1000, 4000, 16000, 32000, 64000];

export const useRecorderStore = create<any>()(
  persist(
    (set, get: any) => ({
      recordingQueue: [],
      analysisStatus: 'idle',
      recordingMessage: '',
      pipelineProgressPercent: 0,
      pipelineStageLabel: '',
      isProcessingQueue: false,
      lastQueueErrorKey: '',

      setRecordingQueue: (updater) =>
        set((state) => ({
          recordingQueue: typeof updater === 'function' ? updater(state.recordingQueue) : updater,
        })),

      updateQueueItem: (recordingId, updates) =>
        set((state) => ({
          recordingQueue: updateRecordingQueueItem(state.recordingQueue, recordingId, updates),
        })),

      removeQueueItem: (recordingId) =>
        set((state) => ({
          recordingQueue: removeRecordingQueueItem(state.recordingQueue, recordingId),
        })),

      setAnalysisStatus: (status) => set({ analysisStatus: status }),
      setRecordingMessage: (message) => set({ recordingMessage: message }),
      setPipelineProgress: (progressPercent, stageLabel = '') =>
        set({
          pipelineProgressPercent: clampProgress(progressPercent),
          pipelineStageLabel: String(stageLabel || ''),
        }),

      retryRecordingQueueItem: (recordingId) => {
        const existing = (get().recordingQueue || []).find(
          (item) => item.recordingId === recordingId
        );
        const reuseRemoteUpload = Boolean(existing?.uploaded);
        get().updateQueueItem(recordingId, {
          status: 'queued' as RecordingPipelineStatus,
          uploaded: reuseRemoteUpload,
          errorMessage: '',
          retryCount: 0,
          backoffUntil: 0,
          lastErrorMessage: '',
          pipelineGitSha: '',
          pipelineVersion: '',
          pipelineBuildTime: '',
          audioQuality: existing?.audioQuality || null,
        });
        const snapshot = getPipelineSnapshot('queued', 8, 'Ponawiamy wgrywanie nagrania');
        set({
          lastQueueErrorKey: '',
          recordingMessage: reuseRemoteUpload
            ? 'Ponawiamy transkrypcje z pliku zapisanego juz na serwerze.'
            : 'Ponawiamy nagranie z kolejki.',
          analysisStatus: 'queued',
          pipelineProgressPercent: snapshot.progressPercent,
          pipelineStageLabel: snapshot.stageLabel,
        });
      },

      retryStoredRecording: (meeting, recording) => {
        if (!meeting?.id || !recording?.id) return null;
        const createdAt = recording.createdAt || new Date().toISOString();
        const queueItem = {
          id: recording.id,
          recordingId: recording.id,
          meetingId: meeting.id,
          workspaceId: meeting.workspaceId || '',
          meetingTitle: meeting.title || 'Spotkanie',
          meetingSnapshot: meeting,
          mimeType: recording.contentType || recording.mimeType || 'audio/mpeg',
          rawSegments: [] as any[],
          duration: Number(recording.duration) || 0,
          status: 'queued' as const,
          uploaded: true,
          attempts: 0,
          errorMessage: '',
          createdAt,
          updatedAt: createdAt,
          pipelineGitSha: '',
          pipelineVersion: '',
          pipelineBuildTime: '',
          audioQuality: recording.audioQuality || null,
          transcriptionDiagnostics: null,
        };
        set((state) => ({
          recordingQueue: updateRecordingQueueItem(
            [...state.recordingQueue, queueItem],
            recording.id,
            queueItem
          ),
          lastQueueErrorKey: '',
          recordingMessage: 'Ponawiamy transkrypcje dla wybranego nagrania.',
          analysisStatus: 'queued',
          pipelineProgressPercent: 8,
          pipelineStageLabel: 'Ponawiamy transkrypcje z pliku zapisanego na serwerze',
        }));
        return recording.id;
      },

      processQueue: async (
        resolveMeetingForQueueItem,
        attachCompletedRecording,
        setCurrentSegments
      ) => {
        const state = get();
        if (state.isProcessingQueue) return;

        // Wait for network connectivity — register a one-time listener and bail
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const onOnline = () => {
            get().processQueue(
              resolveMeetingForQueueItem,
              attachCompletedRecording,
              setCurrentSegments
            );
          };
          window.addEventListener('online', onOnline, { once: true });
          return;
        }

        const nextItem = getNextProcessableRecordingQueueItem(state.recordingQueue, (item) =>
          Boolean(resolveMeetingForQueueItem(item)?.id)
        );

        if (!nextItem) {
          const blocked = getNextPendingRecordingQueueItem(state.recordingQueue);
          if (blocked && !resolveMeetingForQueueItem(blocked)?.id) {
            // Give hydration / state sync time before permanently failing.
            // The meeting may not yet be in userMeetingsRef after page reload.
            const attempts = blocked.attempts || 0;
            if (attempts < 3) {
              get().updateQueueItem(blocked.recordingId, {
                attempts: attempts + 1,
              });
              return;
            }
            get().updateQueueItem(blocked.recordingId, {
              status: 'failed',
              errorMessage: 'Nie znaleziono spotkania.',
            });
            const snapshot = getPipelineSnapshot(
              'failed',
              0,
              'Nie znaleziono spotkania dla wpisu w kolejce'
            );
            set({
              analysisStatus: 'error',
              recordingMessage: 'Zablokowany wpis w kolejce.',
              pipelineProgressPercent: snapshot.progressPercent,
              pipelineStageLabel: snapshot.stageLabel,
            });
          }
          return;
        }

        const statusSnapshot = getPipelineSnapshot(nextItem.status);
        set({
          isProcessingQueue: true,
          analysisStatus:
            nextItem.status === 'uploading'
              ? 'uploading'
              : nextItem.status === 'processing'
                ? 'processing'
                : 'queued',
          pipelineProgressPercent: statusSnapshot.progressPercent,
          pipelineStageLabel: statusSnapshot.stageLabel,
        });

        try {
          const target = resolveMeetingForQueueItem(nextItem);
          if (!target?.id) {
            set({ isProcessingQueue: false });
            return;
          }

          const mediaService = createMediaService();
          const canReuseRemoteUpload = mediaService.mode === 'remote' && nextItem.uploaded;
          const localBlob = canReuseRemoteUpload ? null : await getAudioBlob(nextItem.recordingId);
          if (!localBlob && !canReuseRemoteUpload) {
            get().updateQueueItem(nextItem.recordingId, {
              status: 'failed',
              errorMessage: 'Brakuje lokalnego audio.',
            });
            const snapshot = getPipelineSnapshot('failed', 0, 'Brakuje lokalnego audio');
            set({
              isProcessingQueue: false,
              pipelineProgressPercent: snapshot.progressPercent,
              pipelineStageLabel: snapshot.stageLabel,
            });
            return;
          }

          if (!nextItem.uploaded) {
            // VAD silence filter: strip silence gaps > 2s before upload to reduce
            // transcription cost and Whisper hallucinations on silence.
            let uploadBlob: Blob | null = localBlob as Blob;
            let vadRemovedS = 0;
            try {
              set({ pipelineStageLabel: 'Optymalizacja audio (VAD)…' });
              const vadResult = await filterSilence(localBlob as Blob);
              if (vadResult.removedS >= 2) {
                uploadBlob = vadResult.blob;
                vadRemovedS = vadResult.removedS;
              }
            } catch (_) {
              /* fallback to original */
            }

            const uploadSnapshot = getPipelineSnapshot(
              'uploading',
              12,
              'Wgrywanie audio na serwer'
            );
            set({
              pipelineProgressPercent: uploadSnapshot.progressPercent,
              pipelineStageLabel:
                vadRemovedS > 0
                  ? `Wgrywanie audio (wycięto ${Math.round(vadRemovedS)}s ciszy)…`
                  : uploadSnapshot.stageLabel,
              recordingMessage:
                vadRemovedS > 0
                  ? `Wgrywanie nagrania (wycięto ${Math.round(vadRemovedS)}s ciszy)…`
                  : 'Wgrywanie nagrania na serwer...',
            });
            get().updateQueueItem(nextItem.recordingId, {
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
                  set({
                    pipelineProgressPercent: mapped,
                    pipelineStageLabel: `Wgrywanie audio: ${Math.round(pct)}%`,
                  });
                },
              }
            );
            get().updateQueueItem(nextItem.recordingId, {
              audioQuality: uploadResult?.audioQuality || nextItem.audioQuality || null,
            });
          }

          get().updateQueueItem(nextItem.recordingId, {
            status: 'processing',
            uploaded: true,
            errorMessage: '',
          });

          const processingSnapshot = getPipelineSnapshot(
            'processing',
            24,
            'Plik zapisany. Oczekiwanie na start transkrypcji'
          );
          set({
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
          const started = normalizeTranscriptionResponse(
            startedRaw as ExtendedMediaTranscriptionResponse
          );
          const transcriptionProviderId = started.providerId || '';
          const transcriptionProviderLabel = started.providerLabel || transcriptionProviderId;

          get().updateQueueItem(nextItem.recordingId, {
            pipelineGitSha: started?.pipelineGitSha || '',
            pipelineVersion: started?.pipelineVersion || '',
            pipelineBuildTime: started?.pipelineBuildTime || '',
            audioQuality: started?.audioQuality || nextItem.audioQuality || null,
            transcriptionDiagnostics: started?.transcriptionDiagnostics || null,
          });

          const startStatus = normalizeRecordingPipelineStatus(started?.pipelineStatus);
          const startSnapshot = getPipelineSnapshot(
            startStatus,
            startStatus === 'queued' ? 28 : null
          );
          set({
            pipelineProgressPercent: startSnapshot.progressPercent,
            pipelineStageLabel: startSnapshot.stageLabel,
          });

          const unsubscribeProgress = mediaService.subscribeToTranscriptionProgress?.(
            nextItem.recordingId,
            (payload) => {
              if (!payload || !payload.message) return;
              const progressSnapshot = getPipelineSnapshot(
                payload?.status || 'processing',
                payload?.progress,
                payload?.message
              );
              set({
                recordingMessage: `⏳ ${clampProgress(payload.progress)}%: ${payload.message}`,
                pipelineProgressPercent: progressSnapshot.progressPercent,
                pipelineStageLabel: progressSnapshot.stageLabel,
              });
            }
          );

          let transcription: TranscriptionStatusPayload;
          try {
            if (startStatus === 'done') {
              transcription = { ...started, pipelineStatus: 'done' };
            } else {
              let attempts = 0;
              let consecutiveErrors = 0;
              let totalPollErrors = 0;
              const MAX_CONSECUTIVE_ERRORS = 20;
              const MAX_TOTAL_POLL_ERRORS = 30;
              let finalTranscription: TranscriptionStatusPayload | null = null;
              while (attempts < 120) {
                attempts += 1;
                let result: TranscriptionStatusPayload;
                try {
                  result = normalizeTranscriptionResponse(
                    (await mediaService.getTranscriptionJobStatus(
                      nextItem.recordingId
                    )) as ExtendedMediaTranscriptionResponse
                  );
                  consecutiveErrors = 0;
                } catch (pollError: any) {
                  consecutiveErrors += 1;
                  totalPollErrors += 1;
                  if (
                    consecutiveErrors === 1 ||
                    consecutiveErrors === MAX_CONSECUTIVE_ERRORS ||
                    totalPollErrors === MAX_TOTAL_POLL_ERRORS
                  ) {
                    console.warn(
                      `[Pipeline] Status poll error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}, total ${totalPollErrors}/${MAX_TOTAL_POLL_ERRORS}):`,
                      pollError?.message
                    );
                  }
                  if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    throw new Error(
                      'Backend niedostepny przez dluzszy czas. Sprobuj ponownie za chwile.'
                    );
                  }
                  if (totalPollErrors >= MAX_TOTAL_POLL_ERRORS) {
                    throw new Error(
                      'Backend niedostepny przez dluzszy czas. Sprobuj ponownie za chwile.'
                    );
                  }
                  await sleep(consecutiveErrors < 3 ? 2000 : 7000);
                  continue;
                }
                get().updateQueueItem(nextItem.recordingId, {
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
                  get().updateQueueItem(nextItem.recordingId, {
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
                get().updateQueueItem(nextItem.recordingId, {
                  status,
                  errorMessage: '',
                  audioQuality: result?.audioQuality || nextItem.audioQuality || null,
                  transcriptionDiagnostics: result?.transcriptionDiagnostics || null,
                });
                const pollingSnapshot = getPipelineSnapshot(status);
                set({
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
                  throw new Error(
                    'Backend niedostepny przez dluzszy czas. Sprobuj ponownie za chwile.'
                  );
                }
                throw new Error('Transkrypcja trwa zbyt dlugo. Sprobuj ponownie za chwile.');
              }
              transcription = finalTranscription;
            }
          } finally {
            if (unsubscribeProgress) unsubscribeProgress();
          }

          const verifiedSegments = Array.isArray(transcription.segments)
            ? transcription.segments
            : [];
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
          if (setCurrentSegments) setCurrentSegments(verifiedSegments);

          const isEmptyTranscript =
            transcription?.pipelineStatus === 'done' &&
            (transcription?.transcriptOutcome === 'empty' || verifiedSegments.length === 0);

          if (isEmptyTranscript) {
            const emptyMessage = EMPTY_TRANSCRIPT_MESSAGE;
            const emptyAnalysis = buildFallbackAnalysis('Nie wykryto wypowiedzi w nagraniu.', {
              speakerNames: transcription.speakerNames || {},
              speakerCount: transcription.speakerCount || 0,
            });
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
              analysis: emptyAnalysis,
            };

            const emptyAttached = attachCompletedRecording(target.id, recording);
            if (emptyAttached === false) {
              console.warn(
                '[queue] Meeting not found when attaching empty-transcript recording',
                nextItem.recordingId,
                target.id
              );
              get().updateQueueItem(nextItem.recordingId, {
                status: 'failed',
                errorMessage: 'Nie znaleziono spotkania do przypisania nagrania. Sprobuj ponownie.',
              });
              set({ isProcessingQueue: false });
              return;
            }
            get().removeQueueItem(nextItem.recordingId);
            const doneSnapshot = getPipelineSnapshot('done');
            set({
              lastQueueErrorKey: '',
              analysisStatus: 'done',
              pipelineProgressPercent: doneSnapshot.progressPercent,
              pipelineStageLabel: doneSnapshot.stageLabel,
              recordingMessage: emptyMessage,
            });
            return;
          }

          const reviewSnapshot = getPipelineSnapshot(
            'review',
            92,
            'Tworzenie podsumowania i finalizacja wyniku'
          );
          set({
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
          } catch (e) {
            console.error('Meeting analysis failed.', e);
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
          };

          const attached = attachCompletedRecording(target.id, recording);
          if (attached === false) {
            console.warn(
              '[queue] Meeting not found when attaching recording',
              nextItem.recordingId,
              target.id
            );
            get().updateQueueItem(nextItem.recordingId, {
              status: 'failed',
              errorMessage: 'Nie znaleziono spotkania do przypisania nagrania. Sprobuj ponownie.',
            });
            set({ isProcessingQueue: false });
            return;
          }
          get().removeQueueItem(nextItem.recordingId);
          const doneSnapshot = getPipelineSnapshot('done');
          set({
            lastQueueErrorKey: '',
            analysisStatus: 'done',
            pipelineProgressPercent: doneSnapshot.progressPercent,
            pipelineStageLabel: doneSnapshot.stageLabel,
            recordingMessage:
              needsReviewCount > 0
                ? 'Nagranie czeka czesciowo na review.'
                : 'Nagranie zostalo przetworzone.',
          });
        } catch (error) {
          const retryCount = nextItem.retryCount || 0;
          if (isTransientNetworkError(error) && retryCount < MAX_AUTO_RETRIES) {
            const delay =
              RETRY_DELAYS_MS[retryCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
            console.warn(
              `[queue] Transient network error (retry ${retryCount + 1}/${MAX_AUTO_RETRIES}), backoff ${delay}ms`,
              error?.message
            );
            get().updateQueueItem(nextItem.recordingId, {
              status: 'queued',
              retryCount: retryCount + 1,
              backoffUntil: Date.now() + delay,
              lastErrorMessage: toUserFacingQueueError(error),
              errorMessage: '',
            });
            set({ isProcessingQueue: false });
            // After the backoff expires, clear backoffUntil so the next processQueue run picks it up
            setTimeout(() => {
              get().updateQueueItem(nextItem.recordingId, { backoffUntil: 0 });
            }, delay);
            return;
          }

          const userFacingMessage = toUserFacingQueueError(error);
          const errorKey = `${nextItem.recordingId}:${userFacingMessage}`;
          if (get().lastQueueErrorKey !== errorKey) {
            if (!isExpectedDomainFailure(error)) {
              console.error('Recording queue item failed.', error);
            }
            set({ lastQueueErrorKey: errorKey });
          }
          // 409 = file permanently gone (not on local disk, not in Supabase) — no point retrying
          // Transient network errors always use "failed" (not "failed_permanent") — allows manual retry
          const isPermanent =
            error?.status === 409 ||
            (!isTransientNetworkError(error) && retryCount >= MAX_AUTO_RETRIES);
          get().updateQueueItem(nextItem.recordingId, {
            status: isPermanent ? 'failed_permanent' : 'failed',
            errorMessage: userFacingMessage,
          });
          const failedSnapshot = getPipelineSnapshot('failed', 0, userFacingMessage);
          set({
            analysisStatus: 'error',
            pipelineProgressPercent: failedSnapshot.progressPercent,
            pipelineStageLabel: failedSnapshot.stageLabel,
            recordingMessage: userFacingMessage
              ? `Blad w kolejce: ${userFacingMessage}`
              : 'Blad w kolejce. Sprobuj ponownie.',
          });
        } finally {
          set({ isProcessingQueue: false });
          get().processQueue(
            resolveMeetingForQueueItem,
            attachCompletedRecording,
            setCurrentSegments
          );
        }
      },
    }),
    {
      name: STORAGE_KEYS.recordingQueue,
      storage: createJSONStorage(() => idbJSONStorage),
      partialize: (state) => ({ recordingQueue: state.recordingQueue }),
    }
  )
);
