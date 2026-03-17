import { useEffect, useMemo, useRef, useState } from "react";
import { createMediaService } from "../services/mediaService";
import { saveAudioBlob } from "../lib/audioStore";
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
}) {
  const mediaService = useMemo(() => createMediaService(), []);
  const [liveText, setLiveText] = useState("");
  const [currentSegments, setCurrentSegments] = useState([]);
  const [recordingMeetingId, setRecordingMeetingId] = useState(null);
  const userMeetingsRef = useRef(userMeetings);

  useEffect(() => {
    userMeetingsRef.current = userMeetings;
  }, [userMeetings]);

  // 1. Pipeline & Queue Management
  const pipeline = useRecordingPipeline({
    mediaService,
    userMeetingsRef,
    attachCompletedRecording,
    setCurrentSegments,
  });

  // 2. Audio Assets & Hydration
  const hydration = useAudioHydration({
    mediaService,
    userMeetings,
  });

  // 3. Hardware & Recording Control
  const hardware = useAudioHardware({
    mediaService,
    onRecordingStop: async ({ meetingId, chunks, mimeType, rawSegments, duration }) => {
      try {
        const rid = createId("recording");
        const blob = new Blob(chunks, { type: mimeType });
        if (typeof URL !== "undefined" && URL.createObjectURL) {
          hydration.audioUrls[rid] = URL.createObjectURL(blob); // Note: ideally via hydration setter, but for now direct is ok as it's a ref-like update if we were careful.
          // Better: just let hydration hydrate it in next pass or provide a manual adder.
        }
        await saveAudioBlob(rid, blob);
        pipeline.setRecordingQueue((prev) =>
          upsertRecordingQueueItem(prev, createRecordingQueueItem({
            recordingId: rid,
            meeting: userMeetings.find(m => m.id === meetingId) || selectedMeeting,
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
    hardware.startRecording(active.id);
  };

  const selectedMeetingQueue = useMemo(
    () => pipeline.getMeetingQueue(selectedMeeting?.id),
    [pipeline, selectedMeeting?.id]
  );
  const activeQueueItem = useMemo(() => getNextPendingRecordingQueueItem(pipeline.recordingQueue), [pipeline.recordingQueue]);

  function resetRecorderState() {
    pipeline.setRecordingMessage("");
    setLiveText("");
    setCurrentSegments([]);
    hardware.cleanupRecorder();
    setRecordingMeetingId(null);
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
    resetRecorderState,
  };
}
