import {
  buildRecordingQueueSummary,
  createRecordingQueueItem,
  getNextPendingRecordingQueueItem,
  getNextProcessableRecordingQueueItem,
  getRecordingQueueForMeeting,
  normalizeRecordingPipelineStatus,
  updateRecordingQueueItem,
} from "./recordingQueue";

describe("recordingQueue helpers", () => {
  test("normalizes completed to done", () => {
    expect(normalizeRecordingPipelineStatus("completed")).toBe("done");
    expect(normalizeRecordingPipelineStatus("processing")).toBe("processing");
  });

  test("updates queue item state and keeps meeting filters working", () => {
    const item = createRecordingQueueItem({
      recordingId: "recording_1",
      meeting: { id: "meeting_1", workspaceId: "workspace_1", title: "Daily" },
      mimeType: "audio/webm",
    });

    const updatedQueue = updateRecordingQueueItem([item], "recording_1", {
      status: "failed",
      errorMessage: "network",
    });

    expect(getRecordingQueueForMeeting(updatedQueue, "meeting_1")).toHaveLength(1);
    expect(buildRecordingQueueSummary(updatedQueue)).toMatchObject({
      total: 1,
      failed: 1,
    });
  });

  test("returns the next processable pending item based on a predicate", () => {
    const first = createRecordingQueueItem({
      recordingId: "recording_1",
      meeting: { id: "meeting_1", workspaceId: "workspace_1", title: "Daily" },
      createdAt: "2026-03-15T08:00:00.000Z",
    });
    const second = createRecordingQueueItem({
      recordingId: "recording_2",
      meeting: { id: "meeting_2", workspaceId: "workspace_1", title: "Retro" },
      createdAt: "2026-03-15T08:01:00.000Z",
    });

    const queue = [first, second];

    expect(getNextPendingRecordingQueueItem(queue)?.recordingId).toBe("recording_1");
    expect(
      getNextProcessableRecordingQueueItem(queue, (item) => item.meetingId === "meeting_2")?.recordingId
    ).toBe("recording_2");
  });
});
