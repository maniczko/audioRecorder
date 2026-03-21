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

function clampProgress(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function getPipelineSnapshot(status, upstreamProgress = null, upstreamMessage = "") {
  const message = String(upstreamMessage || "").trim();
  const normalizedStatus = String(status || "queued");

  if (normalizedStatus === "uploading") {
    return {
      progressPercent: clampProgress(upstreamProgress ?? 12),
      stageLabel: message || "Wgrywanie audio na serwer",
    };
  }

  if (normalizedStatus === "queued") {
    return {
      progressPercent: clampProgress(upstreamProgress ?? 24),
      stageLabel: message || "Nagranie czeka na rozpoczecie przetwarzania",
    };
  }

  if (normalizedStatus === "processing") {
    const mapped = upstreamProgress == null ? 56 : 25 + clampProgress(upstreamProgress) * 0.6;
    return {
      progressPercent: clampProgress(mapped),
      stageLabel: message || "Serwer przygotowuje transkrypcje",
    };
  }

  if (normalizedStatus === "diarization") {
    const mapped = upstreamProgress == null ? 78 : 55 + clampProgress(upstreamProgress) * 0.35;
    return {
      progressPercent: clampProgress(mapped),
      stageLabel: message || "Rozpoznawanie mowcow i porzadkowanie segmentow",
    };
  }

  if (normalizedStatus === "review") {
    return {
      progressPercent: clampProgress(upstreamProgress ?? 92),
      stageLabel: message || "Finalne sprawdzenie transkrypcji",
    };
  }

  if (normalizedStatus === "done") {
    return {
      progressPercent: 100,
      stageLabel: message || "Nagranie przetworzone",
    };
  }

  if (normalizedStatus === "failed") {
    return {
      progressPercent: clampProgress(upstreamProgress ?? 0),
      stageLabel: message || "Przetwarzanie nie powiodlo sie",
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

export const useRecorderStore = create<any>()(
  persist(
    (set, get: any) => ({
      recordingQueue: [],
      analysisStatus: "idle",
      recordingMessage: "",
      pipelineProgressPercent: 0,
      pipelineStageLabel: "",
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
      setPipelineProgress: (progressPercent, stageLabel = "") =>
        set({
          pipelineProgressPercent: clampProgress(progressPercent),
          pipelineStageLabel: String(stageLabel || ""),
        }),

      retryRecordingQueueItem: (recordingId) => {
        get().updateQueueItem(recordingId, { status: "queued", uploaded: false, errorMessage: "" });
        const snapshot = getPipelineSnapshot("queued", 8, "Ponawiamy wgrywanie nagrania");
        set({
          recordingMessage: "Ponawiamy nagranie z kolejki.",
          analysisStatus: "queued",
          pipelineProgressPercent: snapshot.progressPercent,
          pipelineStageLabel: snapshot.stageLabel,
        });
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
            get().updateQueueItem(blocked.recordingId, {
              status: "failed",
              errorMessage: "Nie znaleziono spotkania.",
            });
            const snapshot = getPipelineSnapshot("failed", 0, "Nie znaleziono spotkania dla wpisu w kolejce");
            set({
              analysisStatus: "error",
              recordingMessage: "Zablokowany wpis w kolejce.",
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
            nextItem.status === "uploading"
              ? "uploading"
              : nextItem.status === "processing"
              ? "processing"
              : "queued",
          pipelineProgressPercent: statusSnapshot.progressPercent,
          pipelineStageLabel: statusSnapshot.stageLabel,
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
            const snapshot = getPipelineSnapshot("failed", 0, "Brakuje lokalnego audio");
            set({
              isProcessingQueue: false,
              pipelineProgressPercent: snapshot.progressPercent,
              pipelineStageLabel: snapshot.stageLabel,
            });
            return;
          }

          const mediaService = createMediaService();

          if (!nextItem.uploaded) {
            const uploadSnapshot = getPipelineSnapshot("uploading", 12, "Wgrywanie audio na serwer");
            set({
              pipelineProgressPercent: uploadSnapshot.progressPercent,
              pipelineStageLabel: uploadSnapshot.stageLabel,
              recordingMessage: "Wgrywanie nagrania na serwer...",
            });
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

          const processingSnapshot = getPipelineSnapshot(
            "processing",
            24,
            "Plik zapisany. Oczekiwanie na start transkrypcji"
          );
          set({
            pipelineProgressPercent: processingSnapshot.progressPercent,
            pipelineStageLabel: processingSnapshot.stageLabel,
            recordingMessage: "Audio przeslane. Oczekiwanie na przetwarzanie...",
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
          const startSnapshot = getPipelineSnapshot(startStatus, startStatus === "queued" ? 28 : null);
          set({
            pipelineProgressPercent: startSnapshot.progressPercent,
            pipelineStageLabel: startSnapshot.stageLabel,
          });

          const unsubscribeProgress = mediaService.subscribeToTranscriptionProgress?.(
            nextItem.recordingId,
            (payload) => {
              if (!payload || !payload.message) return;
              const progressSnapshot = getPipelineSnapshot(
                payload?.status || "processing",
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

          let transcription;
          try {
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
                const pollingSnapshot = getPipelineSnapshot(status);
                set({
                  pipelineProgressPercent: pollingSnapshot.progressPercent,
                  pipelineStageLabel: pollingSnapshot.stageLabel,
                  recordingMessage:
                    status === "queued"
                      ? "Nagranie czeka na wolny slot przetwarzania..."
                      : status === "diarization"
                      ? "Rozpoznawanie mowcow i porzadkowanie wypowiedzi..."
                      : "Serwer przetwarza nagranie...",
                });
                await sleep(1500);
              }
              if (!finalTranscription) {
                throw new Error("Transkrypcja trwa zbyt dlugo. Sprobuj ponownie za chwile.");
              }
              transcription = finalTranscription;
            }
          } finally {
            if (unsubscribeProgress) unsubscribeProgress();
          }

          const verifiedSegments = Array.isArray(transcription.verifiedSegments)
            ? transcription.verifiedSegments
            : [];
          if (setCurrentSegments) setCurrentSegments(verifiedSegments);

          const reviewSnapshot = getPipelineSnapshot(
            "review",
            92,
            "Tworzenie podsumowania i finalizacja wyniku"
          );
          set({
            analysisStatus: "processing",
            pipelineProgressPercent: reviewSnapshot.progressPercent,
            pipelineStageLabel: reviewSnapshot.stageLabel,
            recordingMessage: "Tworzenie podsumowania spotkania...",
          });

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
          const doneSnapshot = getPipelineSnapshot("done");
          set({
            analysisStatus: "done",
            pipelineProgressPercent: doneSnapshot.progressPercent,
            pipelineStageLabel: doneSnapshot.stageLabel,
            recordingMessage: recording.transcript.some(
              (s) => s.verificationStatus === "review"
            )
              ? "Nagranie czeka czesciowo na review."
              : "Nagranie zostalo przetworzone.",
          });
        } catch (error) {
          console.error("Recording queue item failed.", error);
          const errorMessage = String(error?.message || "Blad przetwarzania.");
          const userFacingMessage =
            errorMessage.includes("Brak tokenu autoryzacyjnego") || errorMessage.includes("Sesja wygasla")
              ? "Brak autoryzacji do backendu. Zaloguj sie ponownie."
              : errorMessage;
          get().updateQueueItem(nextItem.recordingId, {
            status: "failed",
            errorMessage: userFacingMessage,
          });
          const failedSnapshot = getPipelineSnapshot("failed", 0, userFacingMessage);
          set({
            analysisStatus: "error",
            pipelineProgressPercent: failedSnapshot.progressPercent,
            pipelineStageLabel: failedSnapshot.stageLabel,
            recordingMessage: userFacingMessage
              ? `Blad w kolejce: ${userFacingMessage}`
              : "Blad w kolejce. Sprobuj ponownie.",
          });
        } finally {
          set({ isProcessingQueue: false });
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
