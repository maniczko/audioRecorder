import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRecorderStore } from "./recorderStore";
import * as audioStore from "../lib/audioStore";
import * as mediaService from "../services/mediaService";

vi.mock("../lib/audioStore", () => ({
  getAudioBlob: vi.fn(),
}));

vi.mock("../services/mediaService", () => ({
  createMediaService: vi.fn(),
}));

describe("recorderStore - processQueue", () => {
  beforeEach(() => {
    useRecorderStore.setState({
      recordingQueue: [],
      isProcessingQueue: false,
      analysisStatus: "idle",
      recordingMessage: "",
    });
    vi.clearAllMocks();
  });

  it("should process a queued item and transition through states", async () => {
    const mockBlob = new Blob(["audio data"], { type: "audio/webm" });
    (audioStore.getAudioBlob as any).mockResolvedValue(mockBlob);

    const mockMediaService = {
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({ storageMode: "remote" }),
      startTranscriptionJob: vi.fn().mockResolvedValue({ 
        pipelineStatus: "done", 
        verifiedSegments: [{ text: "Hello", speakerId: 0, timestamp: 0 }] 
      }),
      getTranscriptionJobStatus: vi.fn(),
    };
    (mediaService.createMediaService as any).mockReturnValue(mockMediaService);

    const resolveMeeting = vi.fn().mockReturnValue({ id: "m1", workspaceId: "w1" });
    const attachCompleted = vi.fn();
    const setCurrentSegments = vi.fn();

    const item = { recordingId: "rec_1", status: "queued", uploaded: false };
    useRecorderStore.getState().setRecordingQueue([item]);

    // Manually trigger processQueue
    await useRecorderStore.getState().processQueue(resolveMeeting, attachCompleted, setCurrentSegments);

    const finalState = useRecorderStore.getState();
    expect(finalState.recordingQueue.length).toBe(0);
    expect(finalState.analysisStatus).toBe("done");
    expect(attachCompleted).toHaveBeenCalledWith("m1", expect.objectContaining({
      id: "rec_1",
      transcript: [{ text: "Hello", speakerId: 0, timestamp: 0 }]
    }));
  });

  it("should handle server errors and show correctly in state", async () => {
    (audioStore.getAudioBlob as any).mockResolvedValue(new Blob());

    const mockMediaService = {
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockRejectedValue(new Error("Cannot read properties of null (reading 'transcribeRecording')")),
    };
    (mediaService.createMediaService as any).mockReturnValue(mockMediaService);

    const item = { recordingId: "rec_error", status: "queued", uploaded: false };
    useRecorderStore.getState().setRecordingQueue([item]);

    await useRecorderStore.getState().processQueue(vi.fn().mockReturnValue({ id: "m1" }), vi.fn(), vi.fn());

    const finalState = useRecorderStore.getState();
    expect(finalState.analysisStatus).toBe("error");
    expect(finalState.recordingMessage).toContain("Błąd w kolejce: Cannot read properties of null");
    expect(finalState.recordingQueue[0].status).toBe("failed");
  });
});
