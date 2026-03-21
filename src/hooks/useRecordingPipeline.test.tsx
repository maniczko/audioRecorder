import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import useRecordingPipeline from "./useRecordingPipeline";

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    recordingQueue: [],
    analysisStatus: "idle",
    recordingMessage: "",
    isProcessingQueue: false,
    processQueue: vi.fn(),
    setRecordingMessage: vi.fn(),
    retryRecordingQueueItem: vi.fn(),
    updateQueueItem: vi.fn(),
    removeQueueItem: vi.fn(),
    setRecordingQueue: vi.fn(),
  },
}));

vi.mock("../store/recorderStore", () => ({
  useRecorderStore: () => mockStore,
}));

vi.mock("../lib/recordingQueue", () => ({
  buildRecordingQueueSummary: vi.fn((queue) => ({ total: queue.length })),
  getRecordingQueueForMeeting: vi.fn((queue, meetingId) => queue.filter((item) => item.meetingId === meetingId)),
}));

describe("useRecordingPipeline", () => {
  beforeEach(() => {
    mockStore.recordingQueue = [];
    mockStore.analysisStatus = "idle";
    mockStore.recordingMessage = "";
    mockStore.isProcessingQueue = false;
    mockStore.processQueue.mockReset();
  });

  test("triggers queue processing when hydration is finished", async () => {
    const userMeetingsRef = { current: [{ id: "m1", title: "Demo" }] };
    const attachCompletedRecording = vi.fn();
    const setCurrentSegments = vi.fn();

    renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef,
        attachCompletedRecording,
        setCurrentSegments,
        isHydratingRemoteState: false,
      })
    );

    await waitFor(() => {
      expect(mockStore.processQueue).toHaveBeenCalledTimes(1);
    });
  });

  test("does not process queue while remote state is hydrating", () => {
    const userMeetingsRef = { current: [{ id: "m1", title: "Demo" }] };

    renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef,
        attachCompletedRecording: vi.fn(),
        setCurrentSegments: vi.fn(),
        isHydratingRemoteState: true,
      })
    );

    expect(mockStore.processQueue).not.toHaveBeenCalled();
  });

  test("exposes queue summary and meeting-specific queue accessors", () => {
    mockStore.recordingQueue = [
      { recordingId: "r1", meetingId: "m1" },
      { recordingId: "r2", meetingId: "m2" },
    ];

    const { result } = renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef: { current: [] },
        attachCompletedRecording: vi.fn(),
        setCurrentSegments: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    expect(result.current.queueSummary).toEqual({ total: 2 });
    expect(result.current.getMeetingQueue("m1")).toEqual([{ recordingId: "r1", meetingId: "m1" }]);
  });
});
