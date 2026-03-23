import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAudioBlob: vi.fn(),
  analyzeMeeting: vi.fn(),
  createMediaService: vi.fn(),
  getPreviewRuntimeStatus: vi.fn().mockReturnValue("unknown"),
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

vi.mock("../services/httpClient", () => ({
  getPreviewRuntimeStatus: () => mocks.getPreviewRuntimeStatus(),
}));

// VAD filter: return original blob (no silence removed) in tests
vi.mock("../audio/vadFilter", () => ({
  filterSilence: (blob: Blob) => Promise.resolve({ blob, originalDurationS: 10, filteredDurationS: 10, removedS: 0 }),
}));

describe("recorderStore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getAudioBlob.mockReset();
    mocks.analyzeMeeting.mockReset();
    mocks.createMediaService.mockReset();
    mocks.getPreviewRuntimeStatus.mockReset().mockReturnValue("unknown");
    const { useRecorderStore } = await import("./recorderStore");
    useRecorderStore.setState({
      recordingQueue: [],
      analysisStatus: "idle",
      recordingMessage: "",
      pipelineProgressPercent: 0,
      pipelineStageLabel: "",
      isProcessingQueue: false,
      lastQueueErrorKey: "",
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
      uploaded: true,
      errorMessage: "",
    });
    expect(useRecorderStore.getState().recordingMessage).toBe(
      "Ponawiamy transkrypcje z pliku zapisanego juz na serwerze."
    );
    expect(useRecorderStore.getState().pipelineProgressPercent).toBe(8);
  });

  test("queues stored recording for retry without reupload", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    const recordingId = useRecorderStore.getState().retryStoredRecording(
      { id: "m1", workspaceId: "ws1", title: "Weekly" },
      { id: "rec_existing", duration: 18, contentType: "audio/mpeg" }
    );

    expect(recordingId).toBe("rec_existing");
    expect(useRecorderStore.getState().recordingQueue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recordingId: "rec_existing",
          meetingId: "m1",
          workspaceId: "ws1",
          uploaded: true,
          status: "queued",
        }),
      ])
    );
    expect(useRecorderStore.getState().recordingMessage).toContain("Ponawiamy transkrypcje");
    expect(useRecorderStore.getState().analysisStatus).toBe("queued");
  });

  test("retries failed remote item without requiring local audio re-upload", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(null);
    const retryTranscriptionJob = vi.fn().mockResolvedValue({
      pipelineStatus: "done",
      diarization: { speakerNames: { "0": "Anna" }, speakerCount: 1, confidence: 0.7 },
      verifiedSegments: [{ text: "hello", verificationStatus: "verified" }],
      providerId: "remote",
      providerLabel: "Remote",
      reviewSummary: null,
      pipelineGitSha: "retry1234",
      pipelineVersion: "0.1.0",
      pipelineBuildTime: "2026-03-21T21:00:00.000Z",
    });
    const persistRecordingAudio = vi.fn();
    mocks.analyzeMeeting.mockResolvedValue({
      summary: "Done",
      decisions: [],
      actionItems: [],
      followUps: [],
      needsCoverage: [],
      speakerLabels: { "0": "Anna" },
      speakerCount: 1,
    });
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio,
      retryTranscriptionJob,
      startTranscriptionJob: vi.fn(),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
    });
    const attachCompletedRecording = vi.fn();
    useRecorderStore.setState({
      recordingQueue: [
        {
          recordingId: "rec1",
          status: "queued",
          uploaded: true,
          createdAt: "2026-03-21T10:00:00.000Z",
          duration: 12,
        },
      ],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", title: "Weekly", attendees: [] }),
      attachCompletedRecording,
      vi.fn()
    );

    expect(persistRecordingAudio).not.toHaveBeenCalled();
    expect(retryTranscriptionJob).toHaveBeenCalledWith("rec1");
    expect(attachCompletedRecording).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({
        id: "rec1",
        pipelineGitSha: "retry1234",
        pipelineVersion: "0.1.0",
      })
    );
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
    mocks.createMediaService.mockReturnValue({
      mode: "local",
      startTranscriptionJob: vi.fn(),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
    });
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
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: true }],
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
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: true }],
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
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: true, retryCount: 3 }],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", attendees: [] }),
      vi.fn(),
      vi.fn()
    );

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed_permanent",
      errorMessage: "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.",
    });
    expect(useRecorderStore.getState().recordingMessage).toBe(
      "Blad w kolejce: Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile."
    );
  });

  test("maps failed fetch errors to a hosted preview message when preview health was healthy", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getPreviewRuntimeStatus.mockReturnValue("healthy");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
    });
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: true, retryCount: 3 }],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", attendees: [] }),
      vi.fn(),
      vi.fn()
    );

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed_permanent",
      errorMessage:
        "Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.",
    });
  });

  test("maps 502 application-failed responses to a backend availability message", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockRejectedValue(new Error("Application failed to respond")),
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
      errorMessage: "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.",
    });
  });

  test("maps Vercel router target errors to a backend availability message", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi
        .fn()
        .mockRejectedValue(new Error("ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR_CD8")),
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
      errorMessage: "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.",
    });
  });

  test("maps explicit HTTP 502 errors to a backend availability message", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockRejectedValue(new Error("HTTP 502")),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
    });
    useRecorderStore.setState({
      // retryCount: 3 = MAX_AUTO_RETRIES — bypasses auto-retry so the test gets an immediate permanent failure
      recordingQueue: [{ recordingId: "rec1", status: "queued", uploaded: false, retryCount: 3 }],
    });

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", attendees: [] }),
      vi.fn(),
      vi.fn()
    );

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: "failed_permanent",
      errorMessage: "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.",
    });
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
        "Nie wykryto wypowiedzi w nagraniu. Sprawdz jakosc pliku, glosnosc albo sprobuj ponownie innym formatem.",
    });
  });

  test("treats empty transcript as a completed import without console error", async () => {
    const { useRecorderStore } = await import("./recorderStore");
    const consoleErrorSpy = vi.spyOn(console, "error");
    consoleErrorSpy.mockClear();
    mocks.getAudioBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/webm" }));
    mocks.createMediaService.mockReturnValue({
      mode: "remote",
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockResolvedValue({
        pipelineStatus: "done",
        transcriptOutcome: "empty",
        emptyReason: "no_segments_from_stt",
        userMessage: "Nie wykryto wypowiedzi w nagraniu.",
        diarization: { speakerNames: {}, speakerCount: 0, confidence: 0 },
        verifiedSegments: [],
        providerId: "remote",
        providerLabel: "Remote",
        reviewSummary: { needsReview: 0, approved: 0 },
      }),
      subscribeToTranscriptionProgress: vi.fn(() => () => {}),
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

    await useRecorderStore.getState().processQueue(
      () => ({ id: "m1", workspaceId: "ws1", title: "Weekly", attendees: [] }),
      attachCompletedRecording,
      setCurrentSegments
    );

    expect(attachCompletedRecording).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({
        id: "rec1",
        pipelineStatus: "done",
        transcript: [],
        transcriptOutcome: "empty",
        analysis: expect.objectContaining({
          summary: "Nie wykryto wypowiedzi w nagraniu.",
        }),
      })
    );
    expect(useRecorderStore.getState().recordingQueue).toEqual([]);
    expect(useRecorderStore.getState().analysisStatus).toBe("done");
    expect(useRecorderStore.getState().recordingMessage).toBe(
      "Nie wykryto wypowiedzi w nagraniu. Sprawdz jakosc pliku, glosnosc albo sprobuj ponownie innym formatem."
    );
    expect(useRecorderStore.getState().pipelineProgressPercent).toBe(100);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
