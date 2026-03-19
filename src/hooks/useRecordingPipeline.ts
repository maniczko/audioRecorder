import { useEffect, useMemo, useCallback } from "react";
import { useRecorderStore } from "../store/recorderStore";
import { buildRecordingQueueSummary, getRecordingQueueForMeeting } from "../lib/recordingQueue";

export default function useRecordingPipeline({
  userMeetingsRef,
  attachCompletedRecording,
  setCurrentSegments,
  isHydratingRemoteState,
}) {
  const store = useRecorderStore();

  const resolveMeetingForQueueItem = useCallback(
    (item) => {
      return userMeetingsRef.current.find((m) => m.id === item.meetingId) || item.meetingSnapshot || null;
    },
    [userMeetingsRef]
  );

  // Trigger processing when new items arrive or hydrate finishes
  useEffect(() => {
    if (isHydratingRemoteState) return;
    store.processQueue(resolveMeetingForQueueItem, attachCompletedRecording, setCurrentSegments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isHydratingRemoteState,
    store.recordingQueue, // trigger processQueue if new items arrive
    store.isProcessingQueue, // also re-trigger if it finished the previous item
  ]);

  const queueSummary = useMemo(
    () => buildRecordingQueueSummary(store.recordingQueue),
    [store.recordingQueue]
  );

  function getMeetingQueue(meetingId) {
    return getRecordingQueueForMeeting(store.recordingQueue, meetingId || "");
  }

  return {
    recordingQueue: store.recordingQueue,
    queueSummary,
    analysisStatus: store.analysisStatus,
    recordingMessage: store.recordingMessage,
    setRecordingMessage: store.setRecordingMessage,
    retryRecordingQueueItem: store.retryRecordingQueueItem,
    getMeetingQueue,
    updateQueueItem: store.updateQueueItem,
    removeQueueItem: store.removeQueueItem,
    setRecordingQueue: store.setRecordingQueue,
  };
}
