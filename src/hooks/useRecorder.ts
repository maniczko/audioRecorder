import { useEffect, useMemo, useRef, useState } from "react";
import { createMediaService } from "../services/mediaService";
import { deleteRecordingBlob, getAudioStorageEstimate, listStoredSizes, saveAudioBlob } from "../lib/audioStore";
import { createId } from "../lib/storage";
import { createRecordingQueueItem, upsertRecordingQueueItem, getNextPendingRecordingQueueItem } from "../lib/recordingQueue";

import useAudioHardware from "./useAudioHardware";
import useAudioHydration from "./useAudioHydration";
import useRecordingPipeline from "./useRecordingPipeline";
import useLiveTranscript from "./useLiveTranscript";

export default function useRecorder({
  selectedMeeting,
  userMeetings,
  createAdHocMeeting,
  attachCompletedRecording,
  isHydratingRemoteState,
  selectMeeting,
}) {
  const mediaService = useMemo(() => createMediaService(), []);
  const [liveText, setLiveText] = useState("");
  const [currentSegments, setCurrentSegments] = useState([]);
  const [recordingMeetingId, setRecordingMeetingId] = useState(null);
  const [audioStorageState, setAudioStorageState] = useState({
    usageBytes: 0,
    quotaBytes: 0,
    freeBytes: 0,
    usageRatio: 0,
    isNearQuota: false,
    warningMessage: "",
    items: [],
  });
  const userMeetingsRef = useRef(userMeetings);

  useEffect(() => {
    userMeetingsRef.current = userMeetings;
  }, [userMeetings]);

  async function refreshAudioStorageState() {
    const [estimate, items] = await Promise.all([
      getAudioStorageEstimate(),
      listStoredSizes(),
    ]);

    const nextEstimate = estimate || {
      usageBytes: 0,
      quotaBytes: 0,
      freeBytes: 0,
      usageRatio: 0,
      isNearQuota: false,
    };
    const warningMessage = nextEstimate.isNearQuota
      ? `Storage audio jest wykorzystany w ${Math.round(nextEstimate.usageRatio * 100)}%. Zostało ${Math.max(0, Math.round(nextEstimate.freeBytes / 1024 / 1024))} MB.`
      : "";

    setAudioStorageState({
      ...nextEstimate,
      warningMessage,
      items,
    });
    return {
      ...nextEstimate,
      warningMessage,
      items,
    };
  }

  useEffect(() => {
    refreshAudioStorageState().catch((error) => {
      console.warn("Unable to read audio storage state.", error);
    });
  }, []);

  // 1. Pipeline & Queue Management
  const pipeline = useRecordingPipeline({
    userMeetingsRef,
    attachCompletedRecording,
    setCurrentSegments,
    isHydratingRemoteState,
  });

  // 2. Audio Assets & Hydration
  const hydration = useAudioHydration({
    mediaService,
    userMeetings,
  });

  useEffect(() => {
    const recordingId = selectedMeeting?.latestRecordingId || selectedMeeting?.recordings?.[0]?.id;
    if (!recordingId) return;
    if (hydration.audioUrls?.[recordingId]) return;
    hydration.hydrateRecordingAudio(recordingId, { priority: true }).catch(() => {});
  }, [hydration, selectedMeeting]);

  // 3. Hardware & Recording Control
  const hardware = useAudioHardware({
    mediaService,
    onRecordingStop: async ({ meetingId, chunks, mimeType, rawSegments, duration }) => {
      try {
        const rid = createId("recording");
        const blob = new Blob(chunks, { type: mimeType });
        hydration.registerAudioUrl(rid, blob);
        await saveAudioBlob(rid, blob);
        refreshAudioStorageState().catch(() => undefined);
        pipeline.setRecordingQueue((prev) =>
          upsertRecordingQueueItem(prev, createRecordingQueueItem({
            recordingId: rid,
            meetingId,
            meeting: userMeetingsRef.current.find(m => m.id === meetingId) || selectedMeeting,
            mimeType,
            rawSegments,
            duration,
          }))
        );
        pipeline.setRecordingMessage("Nagranie trafilo do kolejki.");
      } catch (e) {
        console.error("Recording finalization failed.", e);
        pipeline.setRecordingMessage("Błąd finalizacji nagrania.");
      } finally {
        setRecordingMeetingId(null);
      }
    },
    onSegmentsChange: setCurrentSegments,
    onInterimChange: setLiveText,
    onMessageChange: pipeline.setRecordingMessage,
  });

  // 4. Live Transcription Bridge
  const [liveTranscriptEnabled, setLiveTranscriptEnabled] = useState(mediaService.mode === "remote");
  const serverCaption = useLiveTranscript({
    chunksRef: hardware.chunksRef,
    isRecording: hardware.isRecording,
    enabled: mediaService.mode === "remote" && liveTranscriptEnabled && !mediaService.supportsLiveTranscription(),
    transcribeLive: (blob) => mediaService.transcribeLiveChunk?.(blob) ?? Promise.resolve(""),
    mimeType: hardware.mimeTypeRef.current,
  });

  useEffect(() => {
    if (mediaService.mode === "remote" && liveTranscriptEnabled && serverCaption) {
      setLiveText(serverCaption);
    }
  }, [serverCaption, mediaService.mode, liveTranscriptEnabled]);

  const startRecordingWrapper = (options = {}) => {
    const active = options.adHoc || !selectedMeeting ? createAdHocMeeting() : selectedMeeting;
    if (!active) {
      pipeline.setRecordingMessage("Nie udalo sie przygotowac spotkania.");
      return;
    }
    setRecordingMeetingId(active.id);
    selectMeeting?.(active);
    hardware.startRecording(active.id);
  };

  const selectedMeetingQueue = useMemo(
    () => pipeline.getMeetingQueue(selectedMeeting?.id),
    [pipeline, selectedMeeting?.id]
  );
  const activeQueueItem = useMemo(() => getNextPendingRecordingQueueItem(pipeline.recordingQueue), [pipeline.recordingQueue]);

  async function queueRecording(meetingId, file) {
    if (!meetingId || !file) {
      pipeline.setRecordingMessage("Nie udalo sie dodac pliku do kolejki.");
      return null;
    }

    const rid = createId("recording");
    const blob = file instanceof Blob ? file : new Blob([file]);
    const meeting =
      userMeetingsRef.current.find((item) => item.id === meetingId) ||
      (selectedMeeting?.id === meetingId ? selectedMeeting : null);

    try {
      hydration.registerAudioUrl(rid, blob);
      await saveAudioBlob(rid, blob);
      refreshAudioStorageState().catch(() => undefined);
      pipeline.setRecordingQueue((prev) =>
        upsertRecordingQueueItem(
          prev,
          createRecordingQueueItem({
            recordingId: rid,
            meetingId,
            meeting,
            mimeType: file.type || "audio/webm",
            rawSegments: [],
            duration: 0,
          })
        )
      );
      pipeline.setAnalysisStatus("queued");
      pipeline.setPipelineProgress(8, "Plik dodany do kolejki");
      pipeline.setRecordingMessage("Plik dodany do kolejki. Rozpoczynamy wgrywanie...");
      return rid;
    } catch (error) {
      console.error("Queued file import failed.", error);
      pipeline.setAnalysisStatus("error");
      pipeline.setPipelineProgress(0, "Dodanie pliku nie powiodlo sie");
      pipeline.setRecordingMessage("Nie udalo sie zapisac pliku do kolejki.");
      return null;
    }
  }

  function resetRecorderState() {
    pipeline.setRecordingMessage("");
    setLiveText("");
    setCurrentSegments([]);
    hardware.cleanupRecorder();
    setRecordingMeetingId(null);
  }

  function retryStoredRecording(meeting, recording) {
    return pipeline.retryStoredRecording?.(meeting, recording);
  }

  async function deleteStoredRecordingAudio(recordingId) {
    if (!recordingId) {
      return;
    }

    await deleteRecordingBlob(recordingId);
    hydration.removeAudioUrl?.(recordingId);
    await refreshAudioStorageState().catch(() => undefined);
  }

  return {
    ...hardware,
    ...hydration,
    ...pipeline,
    liveText,
    currentSegments,
    recordingMeetingId,
    selectedMeetingQueue,
    activeQueueItem,
    speechRecognitionSupported: mediaService.supportsLiveTranscription(),
    liveTranscriptEnabled,
    setLiveTranscriptEnabled: mediaService.mode === "remote" ? setLiveTranscriptEnabled : null,
    startRecording: startRecordingWrapper,
    pauseRecording: hardware.pauseRecording,
    resumeRecording: hardware.resumeRecording,
    queueRecording,
    retryStoredRecording,
    resetRecorderState,
    audioStorageState,
    refreshAudioStorageState,
    deleteStoredRecordingAudio,
  };
}
