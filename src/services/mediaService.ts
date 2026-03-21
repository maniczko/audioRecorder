import { diarizeSegments, verifyRecognizedSegments } from "../lib/diarization";
import { getAudioBlob, saveAudioBlob } from "../lib/audioStore";
import { createBrowserTranscriptionController, TRANSCRIPTION_PROVIDER } from "../lib/transcription";
import { getSpeechRecognitionClass } from "../lib/recording";
import { apiRequest } from "./httpClient";
import { MEDIA_PIPELINE_PROVIDER, API_BASE_URL } from "./config";
import { resolvePersistedSession } from "../lib/sessionStorage";

export const REMOTE_TRANSCRIPTION_PROVIDER = {
  id: "remote-pipeline",
  label: "Remote STT + diarization pipeline",
};

function createLocalMediaService() {
  return {
    mode: "local",
    supportsLiveTranscription() {
      return Boolean(getSpeechRecognitionClass());
    },
    createLiveController(options) {
      return createBrowserTranscriptionController(options);
    },
    async persistRecordingAudio(recordingId, blob) {
      await saveAudioBlob(recordingId, blob);
      return {
        storageMode: "indexeddb",
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
        pipelineStatus: "done",
        reviewSummary: {
          needsReview: verifiedSegments.filter((segment) => segment.verificationStatus === "review").length,
          approved: verifiedSegments.filter((segment) => segment.verificationStatus === "verified").length,
        },
      };
    },
    async getTranscriptionJobStatus() {
      return null;
    },
    async normalizeRecordingAudio() {
      throw new Error("Normalizacja głośności niedostępna w trybie lokalnym.");
    },
    async getVoiceCoaching(recordingId, speakerId, segments) {
      throw new Error("Trener Wymowy AI korzystający z analizy akustycznej dostępny jest tylko przy użyciu pełnego trybu serwerowego. Skonfiguruj bazę by odblokować supermoce OpenAI.");
    },
    async rediarize(recordingId) {
      throw new Error("Diarizacja zaawansowana dostępna tylko w trybie serwerowym.");
    },
    subscribeToTranscriptionProgress() {
      return () => {};
    },
    async extractVoiceProfileFromSpeaker() {
      throw new Error("Generowanie profili głosowych bazujących na nagraniach z transkrypcji dostępne tylko w trybie serwerowym.");
    },
    async askRAG(workspaceId, question) {
      if (!question) return "Zadaj konkretne pytanie.";
      return "Funkcja przeszukiwania baz danych dostępna tylko przez zdalne API.";
    },
  };
}

function createRemoteMediaService() {
  return {
    mode: "remote",
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
      await apiRequest(`/media/recordings/${recordingId}/audio`, {
        method: "PUT",
        body: blob,
        headers: {
          "Content-Type": blob?.type || "application/octet-stream",
          ...(options.workspaceId ? { "X-Workspace-Id": options.workspaceId } : {}),
          ...(options.meetingId ? { "X-Meeting-Id": options.meetingId } : {}),
        },
      });
      return {
        storageMode: "remote",
      };
    },
    async getRecordingAudioBlob(recordingId) {
      const response = await apiRequest(`/media/recordings/${recordingId}/audio`, {
        method: "GET",
        parseAs: "raw",
      });
      return response.blob();
    },
    async startTranscriptionJob({ recordingId, blob, meeting }) {
      const participants = (meeting?.attendees || [])
        .map((a) => (typeof a === "string" ? a : (a.name || a.email || "")))
        .filter(Boolean);
      const response = await apiRequest(`/media/recordings/${recordingId}/transcribe`, {
        method: "POST",
        body: {
          meetingId: meeting?.id || "",
          workspaceId: meeting?.workspaceId || "",
          contentType: blob?.type || "audio/webm",
          meetingTitle: meeting?.title || "",
          participants,
          tags: Array.isArray(meeting?.tags) ? meeting.tags : [],
        },
      });

      return {
        diarization: response.diarization || {},
        verifiedSegments: response.segments || [],
        providerId: response.providerId || REMOTE_TRANSCRIPTION_PROVIDER.id,
        providerLabel: response.providerLabel || REMOTE_TRANSCRIPTION_PROVIDER.label,
        pipelineStatus: response.pipelineStatus || "queued",
        transcriptOutcome: response.transcriptOutcome || "normal",
        emptyReason: response.emptyReason || "",
        userMessage: response.userMessage || "",
        reviewSummary: response.reviewSummary || null,
        errorMessage: response.errorMessage || "",
      };
    },
    async getTranscriptionJobStatus(recordingId) {
      const response = await apiRequest(`/media/recordings/${recordingId}/transcribe`, {
        method: "GET",
      });

      return {
        diarization: response.diarization || {},
        verifiedSegments: response.segments || [],
        providerId: response.providerId || REMOTE_TRANSCRIPTION_PROVIDER.id,
        providerLabel: response.providerLabel || REMOTE_TRANSCRIPTION_PROVIDER.label,
        pipelineStatus: response.pipelineStatus || "queued",
        transcriptOutcome: response.transcriptOutcome || "normal",
        emptyReason: response.emptyReason || "",
        userMessage: response.userMessage || "",
        reviewSummary: response.reviewSummary || null,
        errorMessage: response.errorMessage || "",
      };
    },
    async normalizeRecordingAudio(recordingId) {
      await apiRequest(`/media/recordings/${recordingId}/normalize`, { method: "POST" });
    },
    async transcribeLiveChunk(blob) {
      const response = await apiRequest("/transcribe/live", {
        method: "POST",
        body: blob,
        headers: { "Content-Type": blob?.type || "audio/webm" },
      });
      return typeof response === "object" ? (response?.text || "") : "";
    },
    async getVoiceCoaching(recordingId, speakerId, segments) {
      const response = await apiRequest(`/media/recordings/${recordingId}/voice-coaching`, {
        method: "POST",
        body: { speakerId, segments },
      });
      return typeof response === "object" ? (response?.coaching || "") : "";
    },
    async rediarize(recordingId) {
      return apiRequest(`/media/recordings/${recordingId}/rediarize`, { method: "POST" });
    },
    subscribeToTranscriptionProgress(recordingId, onProgress) {
      const token = resolvePersistedSession()?.token || "";
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const url = `${API_BASE_URL}/media/recordings/${recordingId}/progress${query}`;
      const es = new EventSource(url);
      es.addEventListener("progress", (e) => {
        try {
          const payload = JSON.parse(e.data);
          onProgress(payload);
          if (payload?.progress >= 100) es.close();
        } catch(err) {}
      });
      es.onerror = () => es.close();
      return () => es.close();
    },
    async extractVoiceProfileFromSpeaker(recordingId, speakerId, speakerName) {
      return apiRequest(`/media/recordings/${recordingId}/voice-profiles/from-speaker`, {
        method: "POST",
        body: { speakerId, speakerName },
      });
    },
    async askRAG(workspaceId, question) {
      return apiRequest(`/workspaces/${workspaceId}/rag/ask`, {
        method: "POST",
        body: { question }
      });
    },
  };
}

export function createMediaService() {
  return MEDIA_PIPELINE_PROVIDER === "remote" ? createRemoteMediaService() : createLocalMediaService();
}
