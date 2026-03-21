import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAudioBlob: vi.fn(),
  analyzeMeeting: vi.fn(),
  createMediaService: vi.fn(),
}));

vi.mock("../lib/audioStore", () => ({
  getAudioBlob: (...args: any[]) => mocks.getAudioBlob(...args),
}));

vi.mock("../lib/analysis", () => ({
  analyzeMeeting: (...args: any[]) => mocks.analyzeMeeting(...args),
}));

vi.mock("../services/mediaService", () => ({
  createMediaService: () => mocks.createMediaService(),
}));

describe("recorderStore", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    mocks.getAudioBlob.mockReset();
    mocks.analyzeMeeting.mockReset();
    mocks.createMediaService.mockReset();
    const { useRecorderStore } = await import("./recorderStore");
    useRecorderStore.setState({
      recordingQueue: [],
      analysisStatus: "idle",
      recordingMessage: "",
      pipelineProgressPercent: 0,
      pipelineStageLabel: "",
      isProcessingQueue: false,
    });
  });

  test("retries queued item by resetting flags and status message", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: "rec1", status: "failed", uploaded: true, errorMessage: "boom" }],
    });

    useRecorderStore.getState().retryRecordingQueueItem("rec1");

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      recordingId: "rec1",
      status: "queued",
      uploaded: false,
      errorMessage: "",
    });
    expect(useRecorderStore.getState().recordingMessage).toBe("Ponawiamy nagranie z kolejki.");
    expect(useRecorderStore.getState().pipelineProgressPercent).toBe(8);
  });

  test("fails blocked queue item when meeting cannot be resolved", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: false }],
    });

    await useRecorderStore.getState().processQueue(() => null, vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed",
      errorMessage: "Nie znaleziono spotkania.",
    });
    expect(useRecorderStore.getState().analysisStatus).toBe("error");
  });

  test("fails queue item when local audio blob is missing", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(null);
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: false }],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1" }),
      vi.fn(),
      vi.fn()
    );

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed",
      errorMessage: "Brakuje lokalnego audio.",
    });
  });

  test("processes successful queue item and builds fallback analysis on AI error", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.analyzeMeeting.mockRejectedValue(new Error("analysis failed"));
    const persistRecordingAudio = vi.fn().mockResolvedValue({ storageMode: "remote" });
    const startTranscriptionJob = vi.fn().mockResolvedValue({
      pipelineStatus: "done",
      diarization: { speakerNames: { "0": "Anna" }, speakerCount: 1, confidence: 0.7 },
      verifiedSegments: [{ text: "hello", verificationStatus: "review" }],
      providerId: "remote",
      providerLabel: "Remote",
      reviewSummary: null,
    });
    const subscribeToTranscriptionProgress = vi.fn(() => () => {});
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio,
      startTranscriptionJob,
      subscribeToTranscriptionProgress,
    });
    const attachCompletedRecording = vi.fn();
    const setCurrentSegments = vi.fn();
    useRecorderStore.setState({
      recordingQueue: [
        {
          recordingId: "rec1",
          status: "queued",
          uploaded: false,
          createdAt: "2026-03-21T10:00:00.000Z",
          duration: 12,
          rawSegments: [],
        },
      ],
    });

    const promise = useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", title: "Weekly", attendees: [] }),
      attachCompletedRecording,
      setCurrentSegments
    );
    await promise;

    expect(persistRecordingAudio).toHaveBeenCalledTimes(1);
    expect(startTranscriptionJob).toHaveBeenCalledTimes(1);
    expect(setCurrentSegments).toHaveBeenCalledWith([{ text: "hello", verificationStatus: "review" }]);
    expect(attachCompletedRecording).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({
        id: "rec1",
        pipelineStatus: "done",
        storageMode: "remote",
        analysis: expect.objectContaining({
          summary: "Analiza AI nie powiodla sie. Zachowalismy transkrypcje i segmenty.",
        }),
      })
    );
    expect(useRecorderStore.getState().recordingQueue).toEqual([]);
    expect(useRecorderStore.getState().recordingMessage).toBe("Nagranie czeka czesciowo na review.");
    expect(useRecorderStore.getState().pipelineProgressPercent).toBe(100);
  });

  test("marks item as failed when remote transcription throws", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockRejectedValue(new Error("server exploded")),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
    });
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: false }],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", attendees: [] }),
      vi.fn(),
      vi.fn()
    );

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed",
      errorMessage: "server exploded",
    });
    expect(useRecorderStore.getState().analysisStatus).toBe("error");
  });

  test("maps missing-token failures to a re-login message", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockRejectedValue(new Error("Brak tokenu autoryzacyjnego.")),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
    });
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: false }],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", attendees: [] }),
      vi.fn(),
      vi.fn()
    );

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed",
      errorMessage: "Brak autoryzacji do backendu. Zaloguj sie ponownie.",
    });
    expect(useRecorderStore.getState().recordingMessage).toBe(
      "Blad w kolejce: Brak autoryzacji do backendu. Zaloguj sie ponownie."
    );
  });

  test("maps failed fetch errors to a backend availability message", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
    });
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: false }],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", attendees: [] }),
      vi.fn(),
      vi.fn()
    );

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed",
      errorMessage:
        "Backend jest chwilowo niedostepny albo odpowiedz zostala zablokowana przez przegladarke. Sprobuj ponownie za chwile.",
    });
    expect(useRecorderStore.getState().recordingMessage).toBe(
      "Blad w kolejce: Backend jest chwilowo niedostepny albo odpowiedz zostala zablokowana przez przegladarke. Sprobuj ponownie za chwile."
    );
  });

  test("maps empty-stt-output failures to a recording quality message", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi
        .fn()
        .mockRejectedValue(new Error("Model STT nie zwrocil zadnych segmentow transkrypcji.")),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
    });
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: false }],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", attendees: [] }),
      vi.fn(),
      vi.fn()
    );

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed",
      errorMessage:
        "Model transkrypcji nie wykryl wypowiedzi w nagraniu. Sprawdz jakosc pliku albo sprobuj ponownie innym formatem.",
    });
  });
});
