import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { STORAGE_KEYS, idbJSONStorage } from "../lib/storage";
import {
  getNextProcessableRecordingQueueItem,
  getNextPendingRecordingQueueItem,
  normalizeRecordingPipelineStatus,
  removeRecordingQueueItem,
  updateRecordingQueueItem,
} from "../lib/recordingQueue";
import { getAudioBlob } from "../lib/audioStore";
import { analyzeMeeting } from "../lib/analysis";
import { createMediaService } from "../services/mediaService";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

export const useRecorderStore = create<any>()(
  persist(
    (set, get: any) => ({
      recordingQueue: [],
      analysisStatus: "idle",
      recordingMessage: "",
      isProcessingQueue: false,

      setRecordingQueue: (updater) =>
        set((state) => ({
          recordingQueue:
            typeof updater === "function" ? updater(state.recordingQueue) : updater,
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

      retryRecordingQueueItem: (recordingId) => {
        get().updateQueueItem(recordingId, { status: "queued", uploaded: false, errorMessage: "" });
        set({ recordingMessage: "Ponawiamy nagranie z kolejki.", analysisStatus: "queued" });
        // We could trigger queue processing here, but usually a component effect triggers it.
      },

      processQueue: async (resolveMeetingForQueueItem, attachCompletedRecording, setCurrentSegments) => {
        const state = get();
        if (state.isProcessingQueue) return;

        const nextItem = getNextProcessableRecordingQueueItem(
          state.recordingQueue,
          (item) => Boolean(resolveMeetingForQueueItem(item)?.id)
        );

        if (!nextItem) {
          const blocked = getNextPendingRecordingQueueItem(state.recordingQueue);
          if (blocked && !resolveMeetingForQueueItem(blocked)?.id) {
            get().updateQueueItem(blocked.recordingId, { status: "failed", errorMessage: "Nie znaleziono spotkania." });
            set({ analysisStatus: "error", recordingMessage: "Zablokowany wpis w kolejce." });
          }
          return;
        }

        set({
          isProcessingQueue: true,
          analysisStatus:
            nextItem.status === "uploading"
              ? "uploading"
              : nextItem.status === "processing"
              ? "processing"
              : "queued",
        });

        try {
          const target = resolveMeetingForQueueItem(nextItem);
          if (!target?.id) {
            set({ isProcessingQueue: false });
            return;
          }

          const localBlob = await getAudioBlob(nextItem.recordingId);
          if (!localBlob) {
            get().updateQueueItem(nextItem.recordingId, {
              status: "failed",
              errorMessage: "Brakuje lokalnego audio.",
            });
            set({ isProcessingQueue: false });
            return;
          }

          const mediaService = createMediaService();

          if (!nextItem.uploaded) {
            get().updateQueueItem(nextItem.recordingId, {
              status: "uploading",
              attempts: (nextItem.attempts || 0) + 1,
              errorMessage: "",
            });
            await mediaService.persistRecordingAudio(nextItem.recordingId, localBlob, {
              workspaceId: target.workspaceId || nextItem.workspaceId || "",
              meetingId: target.id,
            });
          }

          get().updateQueueItem(nextItem.recordingId, {
            status: "processing",
            uploaded: true,
            errorMessage: "",
          });

          const started =
            nextItem.uploaded && nextItem.status === "processing"
              ? await mediaService.getTranscriptionJobStatus(nextItem.recordingId)
              : await mediaService.startTranscriptionJob({
                  recordingId: nextItem.recordingId,
                  blob: localBlob,
                  meeting: target,
                  rawSegments: nextItem.rawSegments,
                });

          const startStatus = normalizeRecordingPipelineStatus(started?.pipelineStatus);

          let transcription;
          if (startStatus === "done") {
            transcription = { ...started, pipelineStatus: "done" };
          } else {
            let attempts = 0;
            let finalTranscription = null;
            while (attempts < 120) {
              attempts += 1;
              const result = await mediaService.getTranscriptionJobStatus(nextItem.recordingId);
              const status = normalizeRecordingPipelineStatus(result?.pipelineStatus);
              if (status === "done") {
                finalTranscription = { ...result, pipelineStatus: "done" };
                break;
              }
              if (status === "failed") {
                throw new Error(result?.errorMessage || "Serwer nie zakonczyl transkrypcji.");
              }
              get().updateQueueItem(nextItem.recordingId, { status, errorMessage: "" });
              await sleep(1500);
            }
            if (!finalTranscription) {
              throw new Error("Transkrypcja trwa zbyt dlugo. Sprobuj ponownie za chwile.");
            }
            transcription = finalTranscription;
          }

          const verifiedSegments = Array.isArray(transcription.verifiedSegments)
            ? transcription.verifiedSegments
            : [];
          if (setCurrentSegments) setCurrentSegments(verifiedSegments);
          set({ analysisStatus: "processing" });

          let analysis;
          try {
            analysis = await analyzeMeeting({
              meeting: target,
              segments: verifiedSegments,
              speakerNames: transcription.diarization?.speakerNames || {},
              diarization: transcription.diarization || {},
            });
          } catch (e) {
            console.error("Meeting analysis failed.", e);
            analysis = buildFallbackAnalysis(
              "Analiza AI nie powiodla sie. Zachowalismy transkrypcje i segmenty.",
              transcription.diarization || { speakerNames: {}, speakerCount: 0 }
            );
          }

          const recording = {
            id: nextItem.recordingId,
            createdAt: nextItem.createdAt || new Date().toISOString(),
            duration: nextItem.duration || 0,
            transcript: verifiedSegments,
            speakerNames: analysis.speakerLabels || transcription.diarization?.speakerNames || {},
            speakerCount: analysis.speakerCount || transcription.diarization?.speakerCount || 0,
            diarizationConfidence: transcription.diarization?.confidence || 0,
            reviewSummary: transcription.reviewSummary || {
              needsReview: verifiedSegments.filter((s) => s.verificationStatus === "review").length,
              approved: verifiedSegments.filter((s) => s.verificationStatus === "verified").length,
            },
            transcriptionProvider: transcription.providerId,
            transcriptionProviderLabel: transcription.providerLabel || transcription.providerId,
            pipelineStatus: "done",
            storageMode: mediaService.mode === "remote" ? "remote" : "indexeddb",
            analysis,
          };

          attachCompletedRecording(target.id, recording);
          get().removeQueueItem(nextItem.recordingId);
          set({
            analysisStatus: "done",
            recordingMessage: recording.transcript.some(
              (s) => s.verificationStatus === "review"
            )
              ? "Nagranie czeka czesciowo na review."
              : "",
          });
        } catch (error) {
          console.error("Recording queue item failed.", error);
          get().updateQueueItem(nextItem.recordingId, {
            status: "failed",
            errorMessage: error.message || "Błąd przetwarzania.",
          });
          set({
            analysisStatus: "error",
            recordingMessage: error.message
              ? `Błąd w kolejce: ${error.message}`
              : "Błąd w kolejce. Sprobuj ponownie.",
          });
        } finally {
          set({ isProcessingQueue: false });
          // Recursively call to process the next item if it exists
          get().processQueue(resolveMeetingForQueueItem, attachCompletedRecording, setCurrentSegments);
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
