import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { createApp } from "../../app.ts";

describe("Media Routes - Additional Coverage", () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;
  let mockWorkspaceService: any;
  let mockAuthService: any;

  beforeEach(() => {
    mockTranscriptionService = {
      upsertMediaAsset: vi.fn(),
      analyzeAudioQuality: vi.fn(),
      saveAudioQualityDiagnostics: vi.fn(),
      getMediaAsset: vi.fn(),
      queueTranscription: vi.fn(),
      ensureTranscriptionJob: vi.fn(),
      queryRAG: vi.fn(),
      normalizeRecording: vi.fn(),
      createVoiceProfileFromSpeaker: vi.fn(),
      generateVoiceCoaching: vi.fn(),
      saveTranscriptionResult: vi.fn(),
      diarizeFromTranscript: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
      getMediaRecordings: vi.fn(),
      deleteMediaAsset: vi.fn(),
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ member_role: "owner" }),
    };
    mockAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: "user_1", workspace_id: "ws_1" }),
    };

    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /media/recordings/:recordingId/transcribe", () => {
    test("returns transcription status for completed job", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: "rec_1",
        workspace_id: "ws_1",
        transcript_json: '[{"text": "hello"}]',
        transcription_status: "done",
      });

      const res = await app.request("/media/recordings/rec_1/transcribe", {
        method: "GET",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.pipelineStatus).toBe("done");
    });

    test("returns 404 for non-existent recording", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request("/media/recordings/non_existent/transcribe", {
        method: "GET",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /media/recordings/:recordingId/normalize", () => {
    test("normalizes audio successfully", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: "rec_norm",
        workspace_id: "ws_1",
        file_path: "/tmp/audio.wav",
      });
      mockTranscriptionService.normalizeRecording.mockResolvedValue(undefined);

      const res = await app.request("/media/recordings/rec_norm/normalize", {
        method: "POST",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(200);
      expect(mockTranscriptionService.normalizeRecording).toHaveBeenCalledWith(
        "/tmp/audio.wav",
        expect.objectContaining({ signal: expect.any(Object) })
      );
    });

    test("returns 404 for non-existent recording", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request("/media/recordings/non_existent/normalize", {
        method: "POST",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(404);
    });

    test("returns 500 when normalization fails", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: "rec_fail",
        workspace_id: "ws_1",
        file_path: "/tmp/audio.wav",
      });
      mockTranscriptionService.normalizeRecording.mockRejectedValue(new Error("ffmpeg failed"));

      const res = await app.request("/media/recordings/rec_fail/normalize", {
        method: "POST",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(500);
    });
  });

  describe("POST /media/recordings/:recordingId/voice-coaching", () => {
    test("generates voice coaching successfully", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: "rec_coach",
        workspace_id: "ws_1",
        transcript_json: '[{"speakerId": 0, "text": "hello"}]',
      });
      mockTranscriptionService.generateVoiceCoaching.mockResolvedValue("Good job!");

      const res = await app.request("/media/recordings/rec_coach/voice-coaching", {
        method: "POST",
        headers: { 
          Authorization: "Bearer fake_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ speakerId: 0 }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.coaching).toBe("Good job!");
    });

    test("returns 400 when speakerId is missing", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: "rec_coach",
        workspace_id: "ws_1",
        transcript_json: '[{"speakerId": 0, "text": "hello"}]',
      });

      const res = await app.request("/media/recordings/rec_coach/voice-coaching", {
        method: "POST",
        headers: { 
          Authorization: "Bearer fake_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test("returns 404 for non-existent recording", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request("/media/recordings/non_existent/voice-coaching", {
        method: "POST",
        headers: { 
          Authorization: "Bearer fake_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ speakerId: 0 }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /media/recordings/:recordingId", () => {
    test("deletes recording successfully", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue({
        id: "rec_del",
        workspace_id: "ws_1",
      });
      mockTranscriptionService.deleteMediaAsset.mockResolvedValue(undefined);

      const res = await app.request("/media/recordings/rec_del", {
        method: "DELETE",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(204);
      expect(mockTranscriptionService.deleteMediaAsset).toHaveBeenCalledWith("rec_del", "ws_1");
    });

    test("returns 404 for non-existent recording", async () => {
      mockTranscriptionService.getMediaAsset.mockResolvedValue(null);

      const res = await app.request("/media/recordings/non_existent", {
        method: "DELETE",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /media/recordings", () => {
    test("returns list of recordings for workspace", async () => {
      mockTranscriptionService.getMediaRecordings.mockResolvedValue([
        { id: "rec_1", title: "Meeting 1" },
        { id: "rec_2", title: "Meeting 2" },
      ]);

      const res = await app.request("/media/recordings?workspaceId=ws_1", {
        method: "GET",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.recordings).toHaveLength(2);
      expect(mockTranscriptionService.getMediaRecordings).toHaveBeenCalledWith("ws_1");
    });

    test("returns 400 when workspaceId is missing", async () => {
      const res = await app.request("/media/recordings", {
        method: "GET",
        headers: { Authorization: "Bearer fake_token" },
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /workspaces/:workspaceId/rag/ask", () => {
    test("returns 400 when question is missing", async () => {
      const res = await app.request("/workspaces/ws_1/rag/ask", {
        method: "POST",
        headers: {
          Authorization: "Bearer fake_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test("returns 200 with answer when RAG returns empty array", async () => {
      mockTranscriptionService.queryRAG.mockResolvedValue([]);

      const res = await app.request("/workspaces/ws_1/rag/ask", {
        method: "POST",
        headers: {
          Authorization: "Bearer fake_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: "What was decided?" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.answer).toBeDefined();
    });

    test("returns 200 with answer when RAG returns null", async () => {
      mockTranscriptionService.queryRAG.mockResolvedValue(null);

      const res = await app.request("/workspaces/ws_1/rag/ask", {
        method: "POST",
        headers: {
          Authorization: "Bearer fake_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: "What?" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.answer).toBeDefined();
    });
  });
});
