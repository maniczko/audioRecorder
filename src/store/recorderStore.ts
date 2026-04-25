import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS, idbJSONStorage } from '../lib/storage';
import {
  getNextProcessableRecordingQueueItem,
  getNextPendingRecordingQueueItem,
  removeRecordingQueueItem,
  updateRecordingQueueItem,
} from '../lib/recordingQueue';
import { getAudioBlob } from '../lib/audioStore';
import { analyzeMeeting } from '../lib/analysis';
import { createMediaService } from '../services/mediaService';
import { getPreviewRuntimeStatus } from '../services/httpClient';
import { filterSilence } from '../audio/vadFilter';
import { enhanceAndReencode } from '../lib/audioEnhancer';
import {
  normalizeMediaTranscriptionResponse,
  type MediaTranscriptionResponse,
} from '../shared/contracts';
import type { TranscriptionStatusPayload } from '../shared/types';
import type { RecordingPipelineStatus } from '../lib/recordingQueue';
import { isTransportErrorMessage } from '../lib/transportErrors';
import { processRecordingQueueItem } from './recorderQueueProcessor';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
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

  if (errorMessage.includes('ERR_FAILED') || isTransportErrorMessage(errorMessage)) {
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
  const msg = String(error?.message || '');
  return (
    isTransportErrorMessage(msg) ||
    normalizeErrorForMatching(msg).includes('http 502') ||
    normalizeErrorForMatching(msg).includes('serwer chwilowo przeciazony pamieciowo') ||
    normalizeErrorForMatching(msg).includes('serwer jest przeciazony')
  );
}

const MAX_AUTO_RETRIES = 5;
// Exponential backoff delays for retries: 1s, 4s, 16s, 32s, 64s (~2 min total - enough for Railway restart)
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

        // Wait for network connectivity - register a one-time listener and bail
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
          await processRecordingQueueItem({
            nextItem,
            resolveMeetingForQueueItem,
            attachCompletedRecording,
            setCurrentSegments,
            updateQueueItem: (recordingId, updates) => get().updateQueueItem(recordingId, updates),
            removeQueueItem: (recordingId) => get().removeQueueItem(recordingId),
            setState: (patch) => set(patch),
            getState: () => get(),
            getAudioBlob,
            createMediaService,
            filterSilence,
            enhanceAndReencode,
            analyzeMeeting,
            getPipelineSnapshot,
            normalizeTranscriptionResponse,
            buildFallbackAnalysis,
            emptyTranscriptMessage: EMPTY_TRANSCRIPT_MESSAGE,
            toUserFacingQueueError,
            isExpectedDomainFailure,
            isTransientNetworkError,
            maxAutoRetries: MAX_AUTO_RETRIES,
            retryDelaysMs: RETRY_DELAYS_MS,
            sleep,
            scheduleBackoffReset: (recordingId, delay) => {
              setTimeout(() => {
                get().updateQueueItem(recordingId, { backoffUntil: 0 });
              }, delay);
            },
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
