import { afterEach, describe, expect, test, vi } from "vitest";
import { STORAGE_KEYS } from "../lib/storage";

async function loadMediaService(provider = "local") {
  const apiRequest = vi.fn();
  const diarizeSegments = vi.fn(() => ({ segments: [{ text: "a", speakerId: 0 }], speakerNames: { "0": "Speaker 1" }, speakerCount: 1 }));
  const verifyRecognizedSegments = vi.fn(() => [{ text: "a", verificationStatus: "verified" }]);
  const getAudioBlob = vi.fn();
  const saveAudioBlob = vi.fn();
  const createBrowserTranscriptionController = vi.fn(() => ({ stop: vi.fn() }));
  const getSpeechRecognitionClass = vi.fn(() => function SpeechRecognition() {});
  vi.resetModules();
  vi.doMock("./config", () => ({
    MEDIA_PIPELINE_PROVIDER: provider,
    API_BASE_URL: "https://api.example.test",
  }));
  vi.doMock("./httpClient", () => ({ apiRequest }));
  vi.doMock("../lib/diarization", () => ({ diarizeSegments, verifyRecognizedSegments }));
  vi.doMock("../lib/audioStore", () => ({ getAudioBlob, saveAudioBlob }));
  vi.doMock("../lib/transcription", () => ({
    createBrowserTranscriptionController,
    TRANSCRIPTION_PROVIDER: { id: "browser", label: "Browser" },
  }));
  vi.doMock("../lib/recording", () => ({ getSpeechRecognitionClass }));

  const module = await import("./mediaService");
  return {
    ...module,
    apiRequest,
    diarizeSegments,
    verifyRecognizedSegments,
    getAudioBlob,
    saveAudioBlob,
    createBrowserTranscriptionController,
    getSpeechRecognitionClass,
  };
}

describe("mediaService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("local media service stores audio and performs local diarization", async () => {
    const { createMediaService, saveAudioBlob, getAudioBlob } = await loadMediaService("local");
    getAudioBlob.mockResolvedValue(new Blob(["audio"]));
    const service = createMediaService();

    expect(service.mode).toBe("local");
    expect(service.supportsLiveTranscription()).toBe(true);
    expect(service.createLiveController({ language: "pl" })).toBeTruthy();
    await expect(service.persistRecordingAudio("rec1", new Blob(["audio"]))).resolves.toEqual({ storageMode: "indexeddb" });
    await expect(service.getRecordingAudioBlob("rec1")).resolves.toBeInstanceOf(Blob);
    await expect(service.startTranscriptionJob({ rawSegments: [{ text: "a" }] })).resolves.toMatchObject({
      pipelineStatus: "done",
      providerId: "browser",
    });
    expect(saveAudioBlob).toHaveBeenCalledTimes(1);
  });

  test("local media service throws for remote-only features", async () => {
    const { createMediaService } = await loadMediaService("local");
    const service = createMediaService();

    await expect(service.normalizeRecordingAudio("rec1")).rejects.toThrow(/lokalnym/);
    await expect(service.getVoiceCoaching("rec1", "0", [])).rejects.toThrow(/serwerowego/);
    await expect(service.rediarize("rec1")).rejects.toThrow(/serwerowym/);
    await expect(service.extractVoiceProfileFromSpeaker("rec1", "0", "Anna")).rejects.toThrow(/serwerowym/);
    await expect(service.askRAG("ws1", "")).resolves.toBe("Zadaj konkretne pytanie.");
  });

  test("remote media service calls API endpoints and maps responses", async () => {
    const { createMediaService, apiRequest } = await loadMediaService("remote");
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ token: "session-token" }));
    apiRequest
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ blob: vi.fn().mockResolvedValue(new Blob(["audio"])) })
      .mockResolvedValueOnce({
        diarization: { speakerCount: 1 },
        segments: [{ text: "a" }],
        providerId: "remote",
        providerLabel: "Remote",
        pipelineStatus: "queued",
        reviewSummary: { approved: 1 },
      })
      .mockResolvedValueOnce({
        diarization: { speakerCount: 1 },
        segments: [{ text: "a" }],
        pipelineStatus: "done",
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ text: "live" })
      .mockResolvedValueOnce({ coaching: "coach" })
      .mockResolvedValueOnce({ speakerCount: 2 })
      .mockResolvedValueOnce({ id: "vp1" })
      .mockResolvedValueOnce({ answer: "rag" });
    const service = createMediaService();
    const es = {
      addEventListener: vi.fn((_event, handler) => handler({ data: JSON.stringify({ progress: 100, message: "done" }) })),
      close: vi.fn(),
      onerror: null as any,
    };
    const EventSourceMock = vi.fn(function EventSourceMock() {
      return es;
    });
    vi.stubGlobal("EventSource", EventSourceMock as any);

    await expect(service.persistRecordingAudio("rec1", new Blob(["audio"], { type: "audio/webm" }), { workspaceId: "ws1", meetingId: "m1" })).resolves.toEqual({ storageMode: "remote" });
    await expect(service.getRecordingAudioBlob("rec1")).resolves.toBeInstanceOf(Blob);
    await expect(service.startTranscriptionJob({ recordingId: "rec1", blob: new Blob(["audio"], { type: "audio/webm" }), meeting: { id: "m1", workspaceId: "ws1", attendees: ["Anna"], title: "Weekly", tags: ["tag"] } })).resolves.toMatchObject({ pipelineStatus: "queued" });
    await expect(service.getTranscriptionJobStatus("rec1")).resolves.toMatchObject({ pipelineStatus: "done" });
    await expect(service.normalizeRecordingAudio("rec1")).resolves.toBeUndefined();
    await expect(service.transcribeLiveChunk(new Blob(["audio"], { type: "audio/webm" }))).resolves.toBe("live");
    await expect(service.getVoiceCoaching("rec1", "0", [])).resolves.toBe("coach");
    await expect(service.rediarize("rec1")).resolves.toEqual({ speakerCount: 2 });
    const unsubscribe = service.subscribeToTranscriptionProgress("rec1", vi.fn());
    unsubscribe();
    await expect(service.extractVoiceProfileFromSpeaker("rec1", "0", "Anna")).resolves.toEqual({ id: "vp1" });
    await expect(service.askRAG("ws1", "co?")).resolves.toEqual({ answer: "rag" });
    expect(apiRequest).toHaveBeenCalled();
    expect(EventSourceMock).toHaveBeenCalledWith(
      "https://api.example.test/media/recordings/rec1/progress?token=session-token"
    );
    expect(es.close).toHaveBeenCalled();
  });
});
