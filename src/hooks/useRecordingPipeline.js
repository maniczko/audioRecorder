import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useStoredState from "./useStoredState";
import { STORAGE_KEYS } from "../lib/storage";
import {
  buildRecordingQueueSummary,
  getNextProcessableRecordingQueueItem,
  getNextPendingRecordingQueueItem,
  getRecordingQueueForMeeting,
  normalizeRecordingPipelineStatus,
  removeRecordingQueueItem,
  updateRecordingQueueItem,
} from "../lib/recordingQueue";
import { getAudioBlob } from "../lib/audioStore";
import { analyzeMeeting } from "../lib/analysis";

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

export default function useRecordingPipeline({
  mediaService,
  userMeetingsRef,
  attachCompletedRecording,
  setCurrentSegments,
  isHydratingRemoteState,
}) {
  const [recordingQueue, setRecordingQueue] = useStoredState(STORAGE_KEYS.recordingQueue, []);
  const [analysisStatus, setAnalysisStatus] = useState("idle");
  const [recordingMessage, setRecordingMessage] = useState("");
  const queueProcessingRef = useRef(false);

  const normalizedQueue = useMemo(() => recordingQueue, [recordingQueue]);
  const queueSummary = useMemo(() => buildRecordingQueueSummary(normalizedQueue), [normalizedQueue]);

  const updateQueueItem = useCallback((recordingId, updates) => {
    setRecordingQueue((prev) => updateRecordingQueueItem(prev, recordingId, updates));
  }, [setRecordingQueue]);

  const removeQueueItem = useCallback((recordingId) => {
    setRecordingQueue((prev) => removeRecordingQueueItem(prev, recordingId));
  }, [setRecordingQueue]);

  const resolveMeetingForQueueItem = useCallback((item) => {
    return userMeetingsRef.current.find((m) => m.id === item.meetingId) || item.meetingSnapshot || null;
  }, [userMeetingsRef]);

  const pollRemoteTranscription = useCallback(async (recordingId) => {
    let attempts = 0;
    while (attempts < 120) {
      attempts += 1;
      const result = await mediaService.getTranscriptionJobStatus(recordingId);
      const status = normalizeRecordingPipelineStatus(result?.pipelineStatus);
      if (status === "done") return { ...result, pipelineStatus: "done" };
      if (status === "failed") throw new Error(result?.errorMessage || "Serwer nie zakonczyl transkrypcji.");
      updateQueueItem(recordingId, { status, errorMessage: "" });
      await sleep(1500);
    }
    throw new Error("Transkrypcja trwa zbyt dlugo. Sprobuj ponownie za chwile.");
  }, [mediaService, updateQueueItem]);

  const buildRecordingFromQueueItem = useCallback(async (item, transcription) => {
    const target = resolveMeetingForQueueItem(item);
    if (!target?.id) throw new Error("Nie znaleziono spotkania dla nagrania w kolejce.");

    const verifiedSegments = Array.isArray(transcription.verifiedSegments) ? transcription.verifiedSegments : [];
    setCurrentSegments(verifiedSegments);
    setAnalysisStatus("processing");

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
      analysis = buildFallbackAnalysis("Analiza AI nie powiodla sie. Zachowalismy transkrypcje i segmenty.", transcription.diarization || { speakerNames: {}, speakerCount: 0 });
    }

    return {
      id: item.recordingId,
      createdAt: item.createdAt || new Date().toISOString(),
      duration: item.duration || 0,
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
  }, [mediaService.mode, resolveMeetingForQueueItem, setCurrentSegments]);

  const processQueueItem = useCallback(async (item) => {
    const target = resolveMeetingForQueueItem(item);
    if (!target?.id) return false;

    const localBlob = await getAudioBlob(item.recordingId);
    if (!localBlob) {
      updateQueueItem(item.recordingId, { status: "failed", errorMessage: "Brakuje lokalnego audio." });
      return true;
    }

    try {
      if (!item.uploaded) {
        updateQueueItem(item.recordingId, { status: "uploading", attempts: (item.attempts || 0) + 1, errorMessage: "" });
        await mediaService.persistRecordingAudio(item.recordingId, localBlob, { workspaceId: target.workspaceId || item.workspaceId || "", meetingId: target.id });
      }

      updateQueueItem(item.recordingId, { status: "processing", uploaded: true, errorMessage: "" });

      const started = item.uploaded && item.status === "processing"
        ? await mediaService.getTranscriptionJobStatus(item.recordingId)
        : await mediaService.startTranscriptionJob({ recordingId: item.recordingId, blob: localBlob, meeting: target, rawSegments: item.rawSegments });

      const startStatus = normalizeRecordingPipelineStatus(started?.pipelineStatus);
      const transcription = startStatus === "done" ? { ...started, pipelineStatus: "done" } : await pollRemoteTranscription(item.recordingId);

      const recording = await buildRecordingFromQueueItem(item, transcription);
      attachCompletedRecording(target.id, recording);
      removeQueueItem(item.recordingId);
      setAnalysisStatus("done");
      setRecordingMessage(recording.transcript.some((s) => s.verificationStatus === "review") ? "Nagranie czeka czesciowo na review." : "");
      return true;
    } catch (error) {
      console.error("Recording queue item failed.", error);
      updateQueueItem(item.recordingId, { status: "failed", errorMessage: error.message || "Błąd przetwarzania." });
      setAnalysisStatus("error");
      setRecordingMessage(error.message ? `Błąd w kolejce: ${error.message}` : "Błąd w kolejce. Sprobuj ponownie.");
      return true;
    }
  }, [attachCompletedRecording, buildRecordingFromQueueItem, mediaService, pollRemoteTranscription, removeQueueItem, resolveMeetingForQueueItem, updateQueueItem]);

  useEffect(() => {
    if (isHydratingRemoteState) return;

    const nextItem = getNextProcessableRecordingQueueItem(normalizedQueue, (item) => Boolean(resolveMeetingForQueueItem(item)?.id));
    if (!nextItem || queueProcessingRef.current) {
      const blocked = getNextPendingRecordingQueueItem(normalizedQueue);
      if (blocked && !queueProcessingRef.current && !resolveMeetingForQueueItem(blocked)?.id) {
        updateQueueItem(blocked.recordingId, { status: "failed", errorMessage: "Nie znaleziono spotkania." });
        setAnalysisStatus("error");
        setRecordingMessage("Zablokowany wpis w kolejce.");
      }
      return;
    }

    queueProcessingRef.current = true;
    setAnalysisStatus(nextItem.status === "uploading" ? "uploading" : nextItem.status === "processing" ? "processing" : "queued");
    processQueueItem(nextItem).finally(() => { queueProcessingRef.current = false; });
  }, [isHydratingRemoteState, normalizedQueue, processQueueItem, resolveMeetingForQueueItem, updateQueueItem]);

  function retryRecordingQueueItem(recordingId) {
    updateQueueItem(recordingId, { status: "queued", uploaded: false, errorMessage: "" });
    setRecordingMessage("Ponawiamy nagranie z kolejki.");
    setAnalysisStatus("queued");
  }

  function getMeetingQueue(meetingId) {
    return getRecordingQueueForMeeting(normalizedQueue, meetingId || "");
  }

  return {
    recordingQueue: normalizedQueue,
    queueSummary,
    analysisStatus,
    recordingMessage,
    setRecordingMessage,
    retryRecordingQueueItem,
    getMeetingQueue,
    updateQueueItem,
    removeQueueItem,
    setRecordingQueue,
  };
}
