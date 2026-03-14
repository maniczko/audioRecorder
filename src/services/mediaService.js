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
    async finalizeTranscription({ rawSegments }) {
      const diarization = diarizeSegments(rawSegments || []);
      const verifiedSegments = verifyRecognizedSegments(diarization.segments);

      return {
        diarization,
        verifiedSegments,
        providerId: TRANSCRIPTION_PROVIDER.id,
      };
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
    async finalizeTranscription({ recordingId, blob, meeting }) {
      const response = await apiRequest(`/media/recordings/${recordingId}/transcribe`, {
        method: "POST",
        body: {
          meetingId: meeting?.id || "",
          workspaceId: meeting?.workspaceId || "",
          contentType: blob?.type || "audio/webm",
        },
      });

      return {
        diarization: response.diarization || {
          segments: response.segments || [],
          speakerNames: response.speakerNames || {},
          speakerCount: response.speakerCount || 0,
          confidence: response.confidence || 0,
        },
        verifiedSegments: response.segments || [],
        providerId: REMOTE_TRANSCRIPTION_PROVIDER.id,
      };
    },
  };
}

export function createMediaService() {
  return MEDIA_PIPELINE_PROVIDER === "remote" ? createRemoteMediaService() : createLocalMediaService();
}
