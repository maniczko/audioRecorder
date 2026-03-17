import { diarizeSegments, verifyRecognizedSegments } from "../lib/diarization";
import { getAudioBlob, saveAudioBlob } from "../lib/audioStore";
import { createBrowserTranscriptionController, TRANSCRIPTION_PROVIDER } from "../lib/transcription";
import { getSpeechRecognitionClass } from "../lib/recording";
import { apiRequest } from "./httpClient";
import { MEDIA_PIPELINE_PROVIDER } from "./config";

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
  };
}

function createRemoteMediaService() {
  return {
    mode: "remote",
    supportsLiveTranscription() {
      return false;
    },
    createLiveController() {
      return null;
    },
    async persistRecordingAudio(recordingId, blob, options = {}) {
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
  };
}

export function createMediaService() {
  return MEDIA_PIPELINE_PROVIDER === "remote" ? createRemoteMediaService() : createLocalMediaService();
}
