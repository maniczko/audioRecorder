export function normalizeRecordingPipelineStatus(value) {
  if (value === "completed") {
    return "done";
  }
  if (["queued", "uploading", "processing", "failed", "done"].includes(String(value || ""))) {
    return value;
  }
  return "queued";
}

export function createRecordingQueueItem({
  recordingId,
  meeting,
  mimeType,
  rawSegments = [],
  duration = 0,
  createdAt = new Date().toISOString(),
}) {
  return {
    id: recordingId,
    recordingId,
    meetingId: meeting?.id || "",
    workspaceId: meeting?.workspaceId || "",
    meetingTitle: meeting?.title || "Spotkanie",
    meetingSnapshot: meeting || null,
    mimeType: mimeType || "audio/webm",
    rawSegments: Array.isArray(rawSegments) ? rawSegments : [],
    duration: Number(duration) || 0,
    status: "queued",
    uploaded: false,
    attempts: 0,
    errorMessage: "",
    createdAt,
    updatedAt: createdAt,
  };
}

export function normalizeRecordingQueue(queue = []) {
  return (Array.isArray(queue) ? queue : [])
    .map((item) => {
      if (!item?.recordingId) {
        return null;
      }

      return {
        ...item,
        status: normalizeRecordingPipelineStatus(item.status),
        uploaded: Boolean(item.uploaded),
        attempts: Math.max(0, Number(item.attempts) || 0),
        errorMessage: String(item.errorMessage || ""),
        rawSegments: Array.isArray(item.rawSegments) ? item.rawSegments : [],
        duration: Math.max(0, Number(item.duration) || 0),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

export function upsertRecordingQueueItem(queue, nextItem) {
  const normalizedQueue = normalizeRecordingQueue(queue);
  const next = nextItem ? { ...nextItem, updatedAt: new Date().toISOString() } : null;
  if (!next?.recordingId) {
    return normalizedQueue;
  }

  const index = normalizedQueue.findIndex((item) => item.recordingId === next.recordingId);
  if (index === -1) {
    return normalizeRecordingQueue([...normalizedQueue, next]);
  }

  const updated = [...normalizedQueue];
  updated[index] = {
    ...updated[index],
    ...next,
  };
  return normalizeRecordingQueue(updated);
}

export function removeRecordingQueueItem(queue, recordingId) {
  return normalizeRecordingQueue(queue).filter((item) => item.recordingId !== recordingId);
}

export function updateRecordingQueueItem(queue, recordingId, updates) {
  const existing = normalizeRecordingQueue(queue).find((item) => item.recordingId === recordingId);
  if (!existing) {
    return normalizeRecordingQueue(queue);
  }

  return upsertRecordingQueueItem(queue, {
    ...existing,
    ...updates,
  });
}

export function getRecordingQueueForMeeting(queue, meetingId) {
  return normalizeRecordingQueue(queue).filter((item) => item.meetingId === meetingId);
}

export function getNextPendingRecordingQueueItem(queue) {
  return normalizeRecordingQueue(queue).find((item) =>
    ["queued", "uploading", "processing"].includes(item.status)
  );
}

export function getNextProcessableRecordingQueueItem(queue, canProcess = () => true) {
  return normalizeRecordingQueue(queue).find(
    (item) => ["queued", "uploading", "processing"].includes(item.status) && canProcess(item)
  );
}

export function buildRecordingQueueSummary(queue) {
  return normalizeRecordingQueue(queue).reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.status] += 1;
      return summary;
    },
    {
      total: 0,
      queued: 0,
      uploading: 0,
      processing: 0,
      failed: 0,
      done: 0,
    }
  );
}
