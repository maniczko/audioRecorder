import { diarizeSegments, verifyRecognizedSegments } from '../lib/diarization';
import { getAudioBlob, saveAudioBlob } from '../lib/audioStore';
import { createBrowserTranscriptionController, TRANSCRIPTION_PROVIDER } from '../lib/transcription';
import { getSpeechRecognitionClass } from '../lib/recording';
import { apiRequest } from './httpClient';
import { MEDIA_PIPELINE_PROVIDER, API_BASE_URL } from './config';
import { resolvePersistedSession } from '../lib/sessionStorage';
import {
  normalizeMediaTranscriptionResponse,
  type MediaTranscriptionResponse,
} from '../shared/contracts';

export const REMOTE_TRANSCRIPTION_PROVIDER = {
  id: 'remote-pipeline',
  label: 'Remote STT + diarization pipeline',
};

function mapRemoteTranscriptionResult(response: MediaTranscriptionResponse = {}) {
  const normalized = normalizeMediaTranscriptionResponse(response);

  return {
    diarization: response.diarization || {},
    verifiedSegments: response.segments || [],
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
    reviewSummary: normalized.reviewSummary || null,
    errorMessage: normalized.errorMessage || '',
  };
}

function createLocalMediaService() {
  return {
    mode: 'local',
    supportsLiveTranscription() {
      return Boolean(getSpeechRecognitionClass());
    },
    createLiveController(options) {
      return createBrowserTranscriptionController(options);
    },
    async persistRecordingAudio(recordingId, blob) {
      await saveAudioBlob(recordingId, blob);
      return {
        storageMode: 'indexeddb',
        audioQuality: null,
      };
    },
    getRecordingAudioBlob(recordingId) {
      return getAudioBlob(recordingId);
    },
    async startTranscriptionJob({ rawSegments }) {
      const diarization = diarizeSegments(rawSegments || []);
      const verifiedSegments = verifyRecognizedSegments(diarization.segments);

      return {
        diarization,
        verifiedSegments,
        providerId: TRANSCRIPTION_PROVIDER.id,
        providerLabel: TRANSCRIPTION_PROVIDER.label,
        pipelineStatus: 'done',
        reviewSummary: {
          needsReview: verifiedSegments.filter((segment) => segment.verificationStatus === 'review')
            .length,
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
    async getVoiceCoaching(recordingId, speakerId, segments) {
      throw new Error(
        'Trener Wymowy AI korzystający z analizy akustycznej dostępny jest tylko przy użyciu pełnego trybu serwerowego. Skonfiguruj bazę by odblokować supermoce OpenAI.'
      );
    },
    async rediarize(recordingId) {
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
    async askRAG(workspaceId, question) {
      if (!question) return 'Zadaj konkretne pytanie.';
      return 'Funkcja przeszukiwania baz danych dostępna tylko przez zdalne API.';
    },
    async deleteRecording(_recordingId: string) {
      // Local mode: recordings are in IndexedDB, no server-side cleanup needed
    },
  };
}

function createRemoteMediaService() {
  return {
    mode: 'remote',
    supportsLiveTranscription() {
      // Browser SpeechRecognition works independently of where audio is stored
      return Boolean(getSpeechRecognitionClass());
    },
    createLiveController(options) {
      // Use browser SpeechRecognition for immediate live captioning;
      // the server does high-quality Whisper transcription post-recording.
      return createBrowserTranscriptionController(options);
    },
    async persistRecordingAudio(recordingId, blob, options: any = {}) {
      const { workspaceId = '', meetingId = '', onProgress } = options;
      const CHUNKED_THRESHOLD = 10 * 1024 * 1024; // 10 MB
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB
      const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB — matches server finalize limit

      if (blob && blob.size > MAX_UPLOAD_SIZE) {
        throw new Error(
          `Plik audio jest zbyt duży (${Math.round(blob.size / 1024 / 1024)}MB). Maksymalny rozmiar to 500MB. Skompresuj nagranie do formatu WebM lub MP3.`
        );
      }

      if (blob && blob.size > CHUNKED_THRESHOLD) {
        const total = Math.ceil(blob.size / CHUNK_SIZE);
        for (let i = 0; i < total; i++) {
          const chunk = blob.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          await apiRequest(
            `/media/recordings/${recordingId}/audio/chunk?index=${i}&total=${total}`,
            {
              method: 'PUT',
              body: chunk,
              headers: {
                'Content-Type': blob.type || 'application/octet-stream',
                ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
                ...(meetingId ? { 'X-Meeting-Id': meetingId } : {}),
              },
            }
          );
          onProgress?.(((i + 1) / total) * 90);
        }
        const response = await apiRequest(`/media/recordings/${recordingId}/audio/finalize`, {
          method: 'POST',
          body: {
            contentType: blob.type || 'application/octet-stream',
            workspaceId,
            meetingId,
            total,
          },
        });
        onProgress?.(100);
        return {
          storageMode: 'remote',
          audioQuality:
            response?.audioQuality && typeof response.audioQuality === 'object'
              ? response.audioQuality
              : null,
        };
      }

      const response = await apiRequest(`/media/recordings/${recordingId}/audio`, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob?.type || 'application/octet-stream',
          ...(workspaceId ? { 'X-Workspace-Id': workspaceId } : {}),
          ...(meetingId ? { 'X-Meeting-Id': meetingId } : {}),
        },
      });
      return {
        storageMode: 'remote',
        audioQuality:
          response?.audioQuality && typeof response.audioQuality === 'object'
            ? response.audioQuality
            : null,
      };
    },
    async getRecordingAudioBlob(recordingId) {
      const response = await apiRequest(`/media/recordings/${recordingId}/audio`, {
        method: 'GET',
        parseAs: 'raw',
      });
      return response.blob();
    },
    async startTranscriptionJob({ recordingId, blob, meeting }) {
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
        },
      });

      return mapRemoteTranscriptionResult(response);
    },
    async getTranscriptionJobStatus(recordingId) {
      const response = await apiRequest(`/media/recordings/${recordingId}/transcribe`, {
        method: 'GET',
      });

      return mapRemoteTranscriptionResult(response);
    },
    async retryTranscriptionJob(recordingId) {
      const response = await apiRequest(`/media/recordings/${recordingId}/retry-transcribe`, {
        method: 'POST',
      });

      return mapRemoteTranscriptionResult(response);
    },
    async normalizeRecordingAudio(recordingId) {
      await apiRequest(`/media/recordings/${recordingId}/normalize`, { method: 'POST' });
    },
    async transcribeLiveChunk(blob) {
      const response = await apiRequest('/transcribe/live', {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': blob?.type || 'audio/webm' },
      });
      return typeof response === 'object' ? response?.text || '' : '';
    },
    async getVoiceCoaching(recordingId, speakerId, segments) {
      const response = await apiRequest(`/media/recordings/${recordingId}/voice-coaching`, {
        method: 'POST',
        body: { speakerId, segments },
      });
      return typeof response === 'object' ? response?.coaching || '' : '';
    },
    async rediarize(recordingId) {
      return apiRequest(`/media/recordings/${recordingId}/rediarize`, { method: 'POST' });
    },
    subscribeToTranscriptionProgress(recordingId, onProgress) {
      const token = resolvePersistedSession()?.token || '';
      const query = token ? `?token=${encodeURIComponent(token)}` : '';
      const url = `${API_BASE_URL}/media/recordings/${recordingId}/progress${query}`;
      const es = new EventSource(url);
      es.addEventListener('progress', (e) => {
        try {
          const payload = JSON.parse(e.data);
          onProgress(payload);
          if (payload?.progress >= 100) es.close();
        } catch (err) {}
      });
      es.onerror = () => es.close();
      return () => es.close();
    },
    async extractVoiceProfileFromSpeaker(recordingId, speakerId, speakerName) {
      return apiRequest(`/media/recordings/${recordingId}/voice-profiles/from-speaker`, {
        method: 'POST',
        body: { speakerId, speakerName },
      });
    },
    async askRAG(workspaceId, question) {
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

export function createMediaService() {
  return MEDIA_PIPELINE_PROVIDER === 'remote'
    ? createRemoteMediaService()
    : createLocalMediaService();
}
