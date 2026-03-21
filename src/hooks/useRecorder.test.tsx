import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import useRecorder from "./useRecorder";

const {
  mediaServiceMode,
  pipelineState,
  hydrationState,
  hardwareState,
  liveTranscriptValue,
} = vi.hoisted(() => ({
  mediaServiceMode: { current: "remote" },
  pipelineState: {
    recordingQueue: [],
    getMeetingQueue: vi.fn(() => []),
    setRecordingMessage: vi.fn(),
    setRecordingQueue: vi.fn(),
    recordingMessage: "",
    analysisStatus: "idle",
    pipelineProgressPercent: 0,
    pipelineStageLabel: "",
    retryRecordingQueueItem: vi.fn(),
    updateQueueItem: vi.fn(),
    removeQueueItem: vi.fn(),
  },
  hydrationState: {
    audioUrls: {},
    audioHydrationErrors: {},
    registerAudioUrl: vi.fn(),
  },
  hardwareState: {
    chunksRef: { current: [] as Blob[] },
    mimeTypeRef: { current: "audio/webm" },
    isRecording: false,
    startRecording: vi.fn(),
    cleanupRecorder: vi.fn(),
    stopRecording: vi.fn(),
    canRecord: true,
  },
  liveTranscriptValue: { current: "" },
}));

vi.mock("../services/mediaService", () => ({
  createMediaService: () => ({
    mode: mediaServiceMode.current,
    supportsLiveTranscription: () => false,
    transcribeLiveChunk: vi.fn().mockResolvedValue(""),
  }),
}));

vi.mock("./useRecordingPipeline", () => ({
  default: () => pipelineState,
}));

vi.mock("./useAudioHydration", () => ({
  default: () => hydrationState,
}));

vi.mock("./useAudioHardware", () => ({
  default: (_options: any) => hardwareState,
}));

vi.mock("./useLiveTranscript", () => ({
  default: () => liveTranscriptValue.current,
}));

describe("useRecorder", () => {
  beforeEach(() => {
    mediaServiceMode.current = "remote";
    liveTranscriptValue.current = "";
    pipelineState.getMeetingQueue.mockReturnValue([]);
    pipelineState.setRecordingMessage.mockReset();
    hardwareState.startRecording.mockReset();
    hardwareState.cleanupRecorder.mockReset();
    hardwareState.isRecording = false;
  });

  test("creates ad hoc meeting when no meeting is selected and starts recording", () => {
    const createAdHocMeeting = vi.fn(() => ({ id: "meeting-ad-hoc" }));

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    act(() => {
      result.current.startRecording();
    });

    expect(createAdHocMeeting).toHaveBeenCalledTimes(1);
    expect(hardwareState.startRecording).toHaveBeenCalledWith("meeting-ad-hoc");
  });

  test("bridges server live transcript into live text in remote mode", async () => {
    liveTranscriptValue.current = "Serwerowy podpis";

    const { result, rerender } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: "m1" },
        userMeetings: [{ id: "m1" }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    rerender();

    expect(result.current.liveText).toBe("Serwerowy podpis");
  });

  test("resets recorder state and cleans up hardware", () => {
    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: "m1" },
        userMeetings: [{ id: "m1" }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    act(() => {
      result.current.resetRecorderState();
    });

    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith("");
    expect(hardwareState.cleanupRecorder).toHaveBeenCalledTimes(1);
  });
});
