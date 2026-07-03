import { diarizeSegments, verifyRecognizedSegments } from '../lib/diarization';
import { getAudioBlob, saveAudioBlob } from '../lib/audioStore';
import { createBrowserTranscriptionController, TRANSCRIPTION_PROVIDER } from '../lib/transcription';
import { getSpeechRecognitionClass } from '../lib/recording';
import { apiRequest } from './httpClient';
import { MEDIA_PIPELINE_PROVIDER, API_BASE_URL, MEDIA_API_BASE_URL } from './config';
import { resolvePersistedSession } from '../lib/sessionStorage';
import {
  normalizeMediaTranscriptionResponse,
  type MediaTranscriptionResponse,
} from '../shared/contracts';
import type { TranscriptSegment } from '../shared/types';
import type { RecordingConsentMetadata } from '../lib/recordingConsent';

export const REMOTE_TRANSCRIPTION_PROVIDER = {
  id: 'remote-pipeline',
  label: 'Remote STT + diarization pipeline',
};

const CHUNK_UPLOAD_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000];
// Keep polling resilient, but avoid retry storms during deploy-window 502 outages.
const TRANSCRIPTION_STATUS_RETRIES = 5;
const PROGRESS_MAX_RECONNECT_ERRORS = 20;
let chunkStatusEndpointSupported: 'unknown' | 'yes' | 'no' = 'unknown';
const DEFAULT_UPLOAD_POLICY = {
  maxRawUploadBytes: 200 * 1024 * 1024,
  clientChunkBytes: 4 * 1024 * 1024,
  singleObjectMaxBytes: 24 * 1024 * 1024,
  segmentPartMaxBytes: 20 * 1024 * 1024,
  storageContentType: 'audio/webm',
};
let uploadPolicyPromise: Promise<typeof DEFAULT_UPLOAD_POLICY> | null = null;
const mediaApiOptions = MEDIA_API_BASE_URL ? { baseUrl: MEDIA_API_BASE_URL } : {};
type TranscriptionProgressAuthMode = 'session' | 'progress';
type LiveTranscriptionControllerOptions = Parameters<
  typeof createBrowserTranscriptionController
>[0];

export interface MediaServiceMeetingTarget {
  id?: string;
  workspaceId?: string;
  title?: string;
  attendees?: Array<string | { name?: string; email?: string }>;
  tags?: unknown[];
  [key: string]: unknown;
}

export interface PersistRecordingAudioOptions {
  workspaceId?: string;
  meetingId?: string;
  onProgress?: (percent: number) => void;
}

export interface PersistRecordingAudioResult {
  storageMode: 'indexeddb' | 'remote' | string;
  partCount?: number;
  durationMs?: number;
  audioQuality?: unknown;
}

export interface StartTranscriptionJobInput {
  recordingId?: string;
  blob?: Blob | null;
  meeting?: MediaServiceMeetingTarget | null;
  rawSegments?: TranscriptSegment[];
  recordingConsent?: RecordingConsentMetadata | null;
}

export interface TranscriptionProgressPayload {
  status?: string;
  progress?: number;
  message?: string;
  [key: string]: unknown;
}

export interface RagAnswerResponse {
  answer?: string;
  [key: string]: unknown;
}

export type RagAnswerResult = RagAnswerResponse | string;

export function buildTranscriptionProgressRequest(
  recordingId: string,
  token = '',
  authMode: TranscriptionProgressAuthMode = 'session'
) {
  const headers: Record<string, string> = token
    ? authMode === 'progress'
      ? { 'X-Progress-Token': token }
      : { Authorization: `Bearer ${token}` }
    : {};

  return {
    url: `${MEDIA_API_BASE_URL || API_BASE_URL}/media/recordings/${encodeURIComponent(recordingId)}/progress`,
    headers,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUploadPolicy() {
  if (!uploadPolicyPromise) {
    uploadPolicyPromise = apiRequest('/media/upload-policy', {
      ...mediaApiOptions,
      method: 'GET',
      retries: 0,
    })
      .then((policy: unknown) => ({
        ...DEFAULT_UPLOAD_POLICY,
        ...(policy && typeof policy === 'object' ? policy : {}),
      }))
      .catch(() => DEFAULT_UPLOAD_POLICY);
  }
  return uploadPolicyPromise;
}

function isRetryableChunkUploadError(error: unknown) {
  // Never retry when browser is clearly offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const errorDetails = error as { status?: unknown; message?: unknown } | null | undefined;
  const status = Number(errorDetails?.status || 0);
  if ([429, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(errorDetails?.message || '').toLowerCase();
  return (
    message.includes('backend jest chwilowo niedostepny') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('bad gateway') ||
    message.includes('upstream')
  );
}

async function uploadChunkWithRetry({
  recordingId,
  index,
  total,
  chunk,
  contentType,
  workspaceId,
  meetingId,
}: {
  recordingId: string;
  index: number;
  total: number;
  chunk: Blob;
  contentType: string;
  workspaceId?: string;
  meetingId?: string;
}) {
  const maxAttempts = CHUNK_UPLOAD_RETRY_DELAYS_MS.length + 1;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      await apiRequest(
        `/media/recordings/${recordingId}/audio/chunk?index=${index}&total=${total}`,
        {
          ...mediaApiOptions,
          method: 'PUT',
          body: chunk,
          retries: 0,
          headers: {
            'Content-Type': contentType || 'application/octet-stream',
            ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
            ...(meetingId ? { 'X-Meeting-Id': meetingId } : {}),
          },
        }
      );
      return;
    } catch (error: unknown) {
      attempt += 1;
      const canRetry = isRetryableChunkUploadError(error) && attempt < maxAttempts;
      if (!canRetry) {
        throw error;
      }

      const delayMs =
        CHUNK_UPLOAD_RETRY_DELAYS_MS[
          Math.min(attempt - 1, CHUNK_UPLOAD_RETRY_DELAYS_MS.length - 1)
        ];
      console.warn(
        `[upload] Chunk ${index + 1}/${total} retry ${attempt}/${maxAttempts - 1} after error: ${
          (error as { message?: unknown } | null)?.message || 'unknown error'
        }`
      );
      await sleep(delayMs);
    }
  }
}

export function mapRemoteTranscriptionResult(response: MediaTranscriptionResponse = {}) {
  const normalized = normalizeMediaTranscriptionResponse(response);
  const verifiedSegments = Array.isArray(response?.verifiedSegments)
    ? response.verifiedSegments
    : Array.isArray(response?.segments)
      ? response.segments
      : [];

  return {
    diarization: response.diarization || {},
    verifiedSegments,
    providerId: response.providerId || REMOTE_TRANSCRIPTION_PROVIDER.id,
    providerLabel: response.providerLabel || REMOTE_TRANSCRIPTION_PROVIDER.label,
    pipelineStatus: normalized.pipelineStatus || 'queued',
    transcriptOutcome: normalized.transcriptOutcome || 'normal',
    emptyReason: normalized.emptyReason || '',
    userMessage: normalized.userMessage || '',
    pipelineVersion: normalized.pipelineVersion || '',
    pipelineGitSha: normalized.pipelineGitSha || '',
    pipelineBuildTime: normalized.pipelineBuildTime || '',
    audioQuality: normalized.audioQuality || null,
    transcriptionDiagnostics: normalized.transcriptionDiagnostics || null,
    errorCode: normalized.errorCode || '',
    retryable: Boolean(normalized.retryable),
    retryAfterMs: normalized.retryAfterMs || null,
    audioValidation: normalized.audioValidation || null,
    sttAttempts: normalized.sttAttempts || [],
    reviewSummary: normalized.reviewSummary || null,
    errorMessage: normalized.errorMessage || '',
  };
}

type RemoteTranscriptionResultBase = ReturnType<typeof mapRemoteTranscriptionResult>;

export type MediaTranscriptionJobResult = Partial<
  Omit<RemoteTranscriptionResultBase, 'diarization' | 'pipelineStatus' | 'reviewSummary'>
> & {
  diarization?: unknown;
  verifiedSegments?: TranscriptSegment[];
  providerId?: string;
  providerLabel?: string;
  pipelineStatus?: string;
  reviewSummary?: unknown;
};

export interface MediaService {
  mode: 'local' | 'remote';
  supportsLiveTranscription: () => boolean;
  createLiveController: (options: LiveTranscriptionControllerOptions) => unknown;
  persistRecordingAudio: (
    recordingId: string,
    blob: Blob,
    options?: PersistRecordingAudioOptions
  ) => Promise<PersistRecordingAudioResult>;
  getRecordingAudioBlob: (recordingId: string) => Promise<Blob | null | undefined>;
  startTranscriptionJob: (
    input: StartTranscriptionJobInput
  ) => Promise<MediaTranscriptionJobResult>;
  getTranscriptionJobStatus: (recordingId: string) => Promise<MediaTranscriptionJobResult | null>;
  retryTranscriptionJob?: (recordingId: string) => Promise<MediaTranscriptionJobResult | null>;
  normalizeRecordingAudio: (recordingId: string) => Promise<void>;
  transcribeLiveChunk?: (blob: Blob) => Promise<string>;
  getVoiceCoaching: (
    recordingId: string,
    speakerId: string,
    segments: TranscriptSegment[]
  ) => Promise<string>;
  rediarize: (recordingId: string) => Promise<unknown>;
  subscribeToTranscriptionProgress: (
    recordingId: string,
    onProgress: (payload: TranscriptionProgressPayload) => void
  ) => (() => void) | undefined;
  extractVoiceProfileFromSpeaker: (
    recordingId: string,
    speakerId: string,
    speakerName?: string
  ) => Promise<unknown>;
  askRAG: (workspaceId: string, question: string) => Promise<RagAnswerResult>;
  deleteRecording: (recordingId: string) => Promise<void>;
}

function createLocalMediaService(): MediaService {
  return {
    mode: 'local',
    supportsLiveTranscription() {
      return Boolean(getSpeechRecognitionClass());
    },
    createLiveController(options: LiveTranscriptionControllerOptions) {
      return createBrowserTranscriptionController(options);
    },
    async persistRecordingAudio(recordingId: string, blob: Blob) {
      await saveAudioBlob(recordingId, blob);
      return {
        storageMode: 'indexeddb',
        audioQuality: null,
      };
    },
    getRecordingAudioBlob(recordingId: string) {
      return getAudioBlob(recordingId);
    },
    async startTranscriptionJob({ rawSegments }: StartTranscriptionJobInput) {
      const diarization = diarizeSegments(rawSegments || []);
      const verifiedSegments = verifyRecognizedSegments(diarization.segments);

      return {
        diarization,
        verifiedSegments,
        providerId: TRANSCRIPTION_PROVIDER.id,
        providerLabel: TRANSCRIPTION_PROVIDER.label,
        pipelineStatus: 'done',
        reviewSummary: {
          needsReview: verifiedSegments.filter(
            (segment) =>
              segment.verificationStatus === 'review' ||
              segment.verificationStatus === 'low-confidence'
          ).length,
          lowConfidence: verifiedSegments.filter(
            (segment) => segment.verificationStatus === 'low-confidence'
          ).length,
          approved: verifiedSegments.filter((segment) => segment.verificationStatus === 'verified')
            .length,
        },
      };
    },
    async getTranscriptionJobStatus() {
      return null;
    },
    async retryTranscriptionJob() {
      throw new Error('Ponawianie transkrypcji z serwera niedostepne w trybie lokalnym.');
    },
    async normalizeRecordingAudio() {
      throw new Error('Normalizacja głośności niedostępna w trybie lokalnym.');
    },
    async getVoiceCoaching(
      _recordingId: string,
      _speakerId: string,
      _segments: TranscriptSegment[]
    ) {
      throw new Error(
        'Trener Wymowy AI korzystający z analizy akustycznej dostępny jest tylko przy użyciu pełnego trybu serwerowego. Skonfiguruj bazę by odblokować supermoce OpenAI.'
      );
    },
    async rediarize(_recordingId: string) {
      throw new Error('Diarizacja zaawansowana dostępna tylko w trybie serwerowym.');
    },
    subscribeToTranscriptionProgress() {
      return () => {};
    },
    async extractVoiceProfileFromSpeaker() {
      throw new Error(
        'Generowanie profili głosowych bazujących na nagraniach z transkrypcji dostępne tylko w trybie serwerowym.'
      );
    },
    async askRAG(_workspaceId: string, question: string) {
      if (!question) return 'Zadaj konkretne pytanie.';
      return 'Funkcja przeszukiwania baz danych dostępna tylko przez zdalne API.';
    },
    async deleteRecording(_recordingId: string) {
      // Local mode: recordings are in IndexedDB, no server-side cleanup needed
    },
  };
}

function createRemoteMediaService(): MediaService {
  return {
    mode: 'remote',
    supportsLiveTranscription() {
      // Browser SpeechRecognition works independently of where audio is stored
      return Boolean(getSpeechRecognitionClass());
    },
    createLiveController(options: LiveTranscriptionControllerOptions) {
      // Use browser SpeechRecognition for immediate live captioning;
      // the server does high-quality Whisper transcription post-recording.
      return createBrowserTranscriptionController(options);
    },
    async persistRecordingAudio(
      recordingId: string,
      blob: Blob,
      options: PersistRecordingAudioOptions = {}
    ) {
      const { workspaceId = '', meetingId = '', onProgress } = options;
      const resolvedWorkspaceId = String(workspaceId || '').trim();
      if (!resolvedWorkspaceId) {
        throw new Error(
          'Nie można rozpocząć uploadu, bo przestrzeń robocza nie jest jeszcze gotowa. Odśwież lub wybierz workspace.'
        );
      }
      const uploadPolicy = await getUploadPolicy();
      const CHUNKED_THRESHOLD = Math.min(10 * 1024 * 1024, uploadPolicy.singleObjectMaxBytes);
      const CHUNK_SIZE = uploadPolicy.clientChunkBytes || DEFAULT_UPLOAD_POLICY.clientChunkBytes;
      const MAX_UPLOAD_SIZE =
        uploadPolicy.maxRawUploadBytes || DEFAULT_UPLOAD_POLICY.maxRawUploadBytes;

      if (blob && blob.size > MAX_UPLOAD_SIZE) {
        throw new Error(
          `Plik audio jest zbyt duzy (${Math.round(blob.size / 1024 / 1024)}MB). Maksymalny rozmiar to ${Math.round(MAX_UPLOAD_SIZE / 1024 / 1024)}MB.`
        );
      }

      if (blob && blob.size > CHUNKED_THRESHOLD) {
        const total = Math.ceil(blob.size / CHUNK_SIZE);
        let startIndex = 0;
        const shouldQueryChunkStatus = chunkStatusEndpointSupported !== 'no';
        if (shouldQueryChunkStatus) {
          try {
            const status = await apiRequest(
              `/media/recordings/${recordingId}/audio/chunk-status?total=${total}`,
              {
                ...mediaApiOptions,
                method: 'GET',
                retries: 0,
                headers: {
                  'X-Workspace-Id': resolvedWorkspaceId,
                },
              }
            );
            chunkStatusEndpointSupported = 'yes';
            const nextIndex = Number(status?.nextIndex);
            if (Number.isFinite(nextIndex)) {
              startIndex = Math.max(0, Math.min(total, Math.floor(nextIndex)));
            }
          } catch (error: unknown) {
            if (Number((error as { status?: unknown } | null)?.status) === 404) {
              chunkStatusEndpointSupported = 'no';
            }
            // If status lookup fails, fallback to uploading from the beginning.
            startIndex = 0;
          }
        }

        if (startIndex > 0) {
          onProgress?.((startIndex / total) * 90);
        }

        const PARALLEL_UPLOADS = 3;
        let uploaded = startIndex;

        for (let batchStart = startIndex; batchStart < total; batchStart += PARALLEL_UPLOADS) {
          const batchEnd = Math.min(batchStart + PARALLEL_UPLOADS, total);
          const results = await Promise.allSettled(
            Array.from({ length: batchEnd - batchStart }, (_, k) => {
              const i = batchStart + k;
              const chunk = blob.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
              return uploadChunkWithRetry({
                recordingId,
                index: i,
                total,
                chunk,
                contentType: blob.type || 'application/octet-stream',
                workspaceId: resolvedWorkspaceId,
                meetingId,
              });
            })
          );

          // Check for failures — report the first one
          const failed = results.find((r) => r.status === 'rejected');
          if (failed) {
            const reason = (failed as PromiseRejectedResult).reason;
            const failedIndex = batchStart + results.indexOf(failed);
            throw new Error(
              `Upload audio przerwany na fragmencie ${failedIndex + 1}/${total}. ${reason?.message || 'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.'}`
            );
          }

          uploaded = batchEnd;
          onProgress?.((uploaded / total) * 90);
        }
        const response = await apiRequest(`/media/recordings/${recordingId}/audio/finalize`, {
          ...mediaApiOptions,
          method: 'POST',
          retries: 1,
          body: {
            contentType: blob.type || 'application/octet-stream',
            workspaceId: resolvedWorkspaceId,
            meetingId,
            total,
          },
        });
        onProgress?.(100);
        return {
          storageMode: response?.storageMode || 'remote',
          partCount: response?.partCount || 0,
          durationMs: Number(response?.durationMs) || undefined,
          audioQuality:
            response?.audioQuality && typeof response.audioQuality === 'object'
              ? response.audioQuality
              : null,
        };
      }

      const response = await apiRequest(`/media/recordings/${recordingId}/audio`, {
        ...mediaApiOptions,
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob?.type || 'application/octet-stream',
          'X-Workspace-Id': resolvedWorkspaceId,
          ...(meetingId ? { 'X-Meeting-Id': meetingId } : {}),
        },
      });
      return {
        storageMode: response?.storageMode || 'remote',
        partCount: response?.partCount || 0,
        durationMs: Number(response?.durationMs) || undefined,
        audioQuality:
          response?.audioQuality && typeof response.audioQuality === 'object'
            ? response.audioQuality
            : null,
      };
    },
    async getRecordingAudioBlob(recordingId: string) {
      const response = await apiRequest(`/media/recordings/${recordingId}/audio`, {
        method: 'GET',
        parseAs: 'raw',
      });
      return response.blob();
    },
    async startTranscriptionJob({
      recordingId,
      blob,
      meeting,
      recordingConsent,
    }: StartTranscriptionJobInput) {
      const participants = (meeting?.attendees || [])
        .map((a) => (typeof a === 'string' ? a : a.name || a.email || ''))
        .filter(Boolean);
      const response = await apiRequest(`/media/recordings/${recordingId}/transcribe`, {
        method: 'POST',
        body: {
          meetingId: meeting?.id || '',
          workspaceId: meeting?.workspaceId || '',
          contentType: blob?.type || 'audio/webm',
          meetingTitle: meeting?.title || '',
          participants,
          tags: Array.isArray(meeting?.tags) ? meeting.tags : [],
          recordingConsent: recordingConsent || null,
        },
      });

      return mapRemoteTranscriptionResult(response);
    },
    async getTranscriptionJobStatus(recordingId: string) {
      const response = await apiRequest(`/media/recordings/${recordingId}/transcribe`, {
        method: 'GET',
        retries: TRANSCRIPTION_STATUS_RETRIES,
      });

      return mapRemoteTranscriptionResult(response);
    },
    async retryTranscriptionJob(recordingId: string) {
      const response = await apiRequest(`/media/recordings/${recordingId}/retry-transcribe`, {
        method: 'POST',
      });

      return mapRemoteTranscriptionResult(response);
    },
    async normalizeRecordingAudio(recordingId: string) {
      await apiRequest(`/media/recordings/${recordingId}/normalize`, { method: 'POST' });
    },
    async transcribeLiveChunk(blob: Blob) {
      const response = await apiRequest('/transcribe/live', {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': blob?.type || 'audio/webm' },
      });
      return typeof response === 'object' ? response?.text || '' : '';
    },
    async getVoiceCoaching(recordingId: string, speakerId: string, segments: TranscriptSegment[]) {
      const response = await apiRequest(`/media/recordings/${recordingId}/voice-coaching`, {
        method: 'POST',
        body: { speakerId, segments },
      });
      return typeof response === 'object' ? response?.coaching || '' : '';
    },
    async rediarize(recordingId: string) {
      return apiRequest(`/media/recordings/${recordingId}/rediarize`, { method: 'POST' });
    },
    subscribeToTranscriptionProgress(
      recordingId: string,
      onProgress: (payload: TranscriptionProgressPayload) => void
    ) {
      const token = resolvePersistedSession()?.token || '';
      const request = buildTranscriptionProgressRequest(recordingId, token);
      let closed = false;
      let errorCount = 0;
      let abortController: AbortController | null = null;

      const handleSseFrame = (frame: string) => {
        const lines = frame.split(/\r?\n/);
        const event = lines
          .find((line) => line.startsWith('event:'))
          ?.slice('event:'.length)
          .trim();
        const data = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice('data:'.length).trim())
          .join('\n');

        if (event !== 'progress' || !data) return;

        try {
          const payload = JSON.parse(data);
          errorCount = 0;
          onProgress(payload);
          if (payload?.progress >= 100) {
            closed = true;
            abortController?.abort();
          }
        } catch {
          // Ignore malformed keep-alive or partial frames.
        }
      };

      const connect = async () => {
        abortController = new AbortController();
        try {
          const response = await fetch(request.url, {
            headers: request.headers,
            signal: abortController.signal,
          });
          if (!response.ok || !response.body) {
            throw new Error(`Progress stream failed with HTTP ${response.status}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!closed) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let boundary = buffer.search(/\r?\n\r?\n/);
            while (boundary >= 0) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + (buffer[boundary] === '\r' ? 4 : 2));
              handleSseFrame(frame);
              boundary = buffer.search(/\r?\n\r?\n/);
            }
          }
        } catch (error: unknown) {
          if (closed || (error as { name?: unknown } | null)?.name === 'AbortError') return;
          errorCount += 1;
          if (errorCount > PROGRESS_MAX_RECONNECT_ERRORS) return;
          setTimeout(
            () => {
              if (!closed) {
                void connect();
              }
            },
            2000 * Math.min(errorCount, 5)
          );
        }
      };

      void connect();
      return () => {
        closed = true;
        abortController?.abort();
      };
    },
    async extractVoiceProfileFromSpeaker(
      recordingId: string,
      speakerId: string,
      speakerName?: string
    ) {
      return apiRequest(`/media/recordings/${recordingId}/voice-profiles/from-speaker`, {
        method: 'POST',
        body: { speakerId, speakerName },
      });
    },
    async askRAG(workspaceId: string, question: string) {
      return apiRequest(`/workspaces/${workspaceId}/rag/ask`, {
        method: 'POST',
        body: { question },
      });
    },
    async deleteRecording(recordingId: string) {
      await apiRequest(`/media/recordings/${recordingId}`, { method: 'DELETE' });
    },
  };
}

export function createMediaService(): MediaService {
  return MEDIA_PIPELINE_PROVIDER === 'remote'
    ? createRemoteMediaService()
    : createLocalMediaService();
}
