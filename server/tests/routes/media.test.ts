import fs from "node:fs";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { createApp } from "../../app.ts";

describe("Media Routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;
  let mockWorkspaceService: any;
  const originalExistsSync = fs.existsSync;
  const originalCreateReadStream = fs.createReadStream;
  const originalStatSync = fs.statSync;

  beforeEach(() => {
    mockTranscriptionService = {
      upsertMediaAsset: vi.fn(),
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
    };
    mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ member_role: "owner" }),
    };

    const mockAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: "user_1", workspace_id: "ws_1" })
    };

    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: "http://localhost:3000", trustProxy: false, uploadDir: "/tmp" }
    });
  });

  afterEach(() => {
    fs.existsSync = originalExistsSync;
    fs.createReadStream = originalCreateReadStream;
    fs.statSync = originalStatSync;
    vi.restoreAllMocks();
  });

  it("PUT /media/recordings/:recordingId/audio - upload success", async () => {
    mockTranscriptionService.upsertMediaAsset.mockResolvedValue({
      id: "rec_new", workspace_id: "ws_1", size_bytes: 512
    });

    const res = await app.request("/media/recordings/rec_new/audio", {
      method: "PUT",
      headers: { 
        "Authorization": "Bearer fake_token", 
        "Content-Type": "audio/webm",
        "X-Workspace-Id": "ws_1" 
      },
      body: Buffer.from("small-audio-data")
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("rec_new");
    expect(mockTranscriptionService.upsertMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({ recordingId: "rec_new", workspaceId: "ws_1", contentType: "audio/webm" })
    );
  });

  it("OPTIONS /media/recordings/:recordingId/audio - returns preview CORS headers for vercel origins", async () => {
    const previewOrigin = "https://preview-app.vercel.app";
    const res = await app.request("/media/recordings/rec_new/audio", {
      method: "OPTIONS",
      headers: {
        Origin: previewOrigin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "Authorization,Content-Type,X-Workspace-Id,X-Meeting-Id",
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(previewOrigin);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-Workspace-Id");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-Meeting-Id");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("POST /media/recordings/:recordingId/transcribe - queues job", async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: "rec_1", workspace_id: "ws_1", file_path: "/tmp/fake.webm", content_type: "audio/webm", size_bytes: 1024, transcription_status: "queued"
    });

    const res = await app.request("/media/recordings/rec_1/transcribe", {
      method: "POST",
      headers: { "Authorization": "Bearer fake_token", "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_1" })
    });

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.recordingId).toBe("rec_1");
    expect(data.pipelineStatus).toBe("queued");
    expect(mockTranscriptionService.queueTranscription).toHaveBeenCalledWith("rec_1", expect.any(Object));
  });

  it("GET /media/recordings/:recordingId/transcribe - returns payload", async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: "rec_2",
      workspace_id: "ws_1",
      transcription_status: "completed",
      diarization_json: JSON.stringify({
        speakerCount: 2,
        transcriptOutcome: "empty",
        emptyReason: "no_segments_from_stt",
        userMessage: "Nie wykryto wypowiedzi w nagraniu.",
      }),
      transcript_json: "[]"
    });

    const res = await app.request("/media/recordings/rec_2/transcribe", {
      method: "GET",
      headers: { "Authorization": "Bearer fake_token" }
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.recordingId).toBe("rec_2");
    expect(data.pipelineStatus).toBe("done"); 
    expect(data.diarization.speakerCount).toBe(2);
    expect(data.transcriptOutcome).toBe("empty");
    expect(data.emptyReason).toBe("no_segments_from_stt");
    expect(data.userMessage).toBe("Nie wykryto wypowiedzi w nagraniu.");
  });

  it("PUT /media/recordings/:recordingId/audio - requires workspace header and rejects oversize upload", async () => {
    const previewOrigin = "https://preview-app.vercel.app";
    const missingWorkspace = await app.request("/media/recordings/rec_missing/audio", {
      method: "PUT",
      headers: {
        Authorization: "Bearer fake_token",
        "Content-Type": "audio/webm",
        Origin: previewOrigin,
      },
      body: Buffer.from("small-audio-data"),
    });

    expect(missingWorkspace.status).toBe(400);
    expect(missingWorkspace.headers.get("Access-Control-Allow-Origin")).toBe(previewOrigin);
    expect(missingWorkspace.headers.get("Vary")).toContain("Origin");

    const oversize = await app.request("/media/recordings/rec_large/audio", {
      method: "PUT",
      headers: {
        Authorization: "Bearer fake_token",
        "Content-Type": "audio/webm",
        "X-Workspace-Id": "ws_1",
        Origin: previewOrigin,
      },
      body: Buffer.alloc(100 * 1024 * 1024 + 1, 1),
    });

    expect(oversize.status).toBe(413);
    expect(oversize.headers.get("Access-Control-Allow-Origin")).toBe(previewOrigin);
    expect(oversize.headers.get("Vary")).toContain("Origin");
  });

  it("GET /media/recordings/:recordingId/audio - returns 404 for missing assets and files", async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValueOnce(null);
    const missingAsset = await app.request("/media/recordings/rec_missing/audio", {
      method: "GET",
      headers: { Authorization: "Bearer fake_token" },
    });
    expect(missingAsset.status).toBe(404);

    mockTranscriptionService.getMediaAsset.mockResolvedValueOnce({
      id: "rec_file",
      workspace_id: "ws_1",
      file_path: "/tmp/missing.webm",
      content_type: "audio/webm",
    });
    fs.existsSync = vi.fn().mockReturnValue(false) as any;

    const missingFile = await app.request("/media/recordings/rec_file/audio", {
      method: "GET",
      headers: { Authorization: "Bearer fake_token" },
    });

    expect(missingFile.status).toBe(404);
  });

  it("GET /media/recordings/:recordingId/audio - streams existing file with safe headers", async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: "rec_stream",
      workspace_id: "ws_1",
      file_path: "/tmp/audio.webm",
      content_type: "text/html",
    });
    fs.existsSync = vi.fn().mockReturnValue(true) as any;
    fs.statSync = vi.fn().mockReturnValue({ size: 1234 }) as any;
    fs.createReadStream = vi.fn().mockReturnValue(Buffer.from("audio")) as any;

    const res = await app.request("/media/recordings/rec_stream/audio", {
      method: "GET",
      headers: { Authorization: "Bearer fake_token" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Length")).toBe("1234");
  });

  it("POST /media/recordings/:recordingId/normalize and /voice-coaching handle happy path", async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: "rec_norm",
      workspace_id: "ws_1",
      file_path: "/tmp/audio.webm",
      content_type: "audio/webm",
    });
    mockTranscriptionService.generateVoiceCoaching.mockResolvedValue("Mow wolniej.");

    const normalizeRes = await app.request("/media/recordings/rec_norm/normalize", {
      method: "POST",
      headers: { Authorization: "Bearer fake_token" },
    });
    const coachingRes = await app.request("/media/recordings/rec_norm/voice-coaching", {
      method: "POST",
      headers: { Authorization: "Bearer fake_token", "Content-Type": "application/json" },
      body: JSON.stringify({ speakerId: "0", segments: [{ text: "Ala" }] }),
    });

    expect(normalizeRes.status).toBe(200);
    expect(await normalizeRes.json()).toEqual({ ok: true });
    expect(mockTranscriptionService.normalizeRecording).toHaveBeenCalledWith("/tmp/audio.webm", {});

    expect(coachingRes.status).toBe(200);
    expect(await coachingRes.json()).toEqual({ coaching: "Mow wolniej." });
  });

  it("POST /media/recordings/:recordingId/voice-profiles/from-speaker and /rediarize handle success and validation", async () => {
    mockTranscriptionService.getMediaAsset
      .mockResolvedValueOnce({
        id: "rec_voice",
        workspace_id: "ws_1",
        transcript_json: '[{"text":"hello","timestamp":0,"endTimestamp":1}]',
      })
      .mockResolvedValueOnce({
        id: "rec_rediarize_missing",
        workspace_id: "ws_1",
        transcript_json: "[]",
      })
      .mockResolvedValueOnce({
        id: "rec_rediarize_ok",
        workspace_id: "ws_1",
        transcript_json: '[{"id":"s1","text":"hello","timestamp":0,"endTimestamp":1}]',
      });
    mockTranscriptionService.createVoiceProfileFromSpeaker.mockResolvedValue({ id: "vp_1" });
    mockTranscriptionService.diarizeFromTranscript.mockResolvedValue({
      speakerCount: 1,
      speakerNames: { "0": "Speaker 1" },
      segments: [{ id: "seg1", text: "hello", timestamp: 0, endTimestamp: 1, speakerId: 0, rawSpeakerLabel: "A" }],
    });

    const voiceRes = await app.request("/media/recordings/rec_voice/voice-profiles/from-speaker", {
      method: "POST",
      headers: { Authorization: "Bearer fake_token", "Content-Type": "application/json" },
      body: JSON.stringify({ speakerId: "0", speakerName: "Anna" }),
    });
    expect(voiceRes.status).toBe(201);
    expect(await voiceRes.json()).toEqual({ id: "vp_1" });

    const noTranscriptRes = await app.request("/media/recordings/rec_rediarize_missing/rediarize", {
      method: "POST",
      headers: { Authorization: "Bearer fake_token" },
    });
    expect(noTranscriptRes.status).toBe(400);

    const okRediarizeRes = await app.request("/media/recordings/rec_rediarize_ok/rediarize", {
      method: "POST",
      headers: { Authorization: "Bearer fake_token" },
    });
    expect(okRediarizeRes.status).toBe(200);
    expect(mockTranscriptionService.saveTranscriptionResult).toHaveBeenCalledWith(
      "rec_rediarize_ok",
      expect.objectContaining({ pipelineStatus: "completed" })
    );
  });

  it("POST /media/recordings/:recordingId/rediarize returns 422 when diarization fails", async () => {
    mockTranscriptionService.getMediaAsset.mockResolvedValue({
      id: "rec_rediarize_fail",
      workspace_id: "ws_1",
      transcript_json: '[{"id":"s1","text":"hello","timestamp":0,"endTimestamp":1}]',
    });
    mockTranscriptionService.diarizeFromTranscript.mockResolvedValue(null);

    const res = await app.request("/media/recordings/rec_rediarize_fail/rediarize", {
      method: "POST",
      headers: { Authorization: "Bearer fake_token" },
    });

    expect(res.status).toBe(422);
  });

  it("POST /media/analyze returns fallback when analysis service returns null", async () => {
    mockTranscriptionService.analyzeMeetingWithOpenAI = vi.fn().mockResolvedValue(null);

    const res = await app.request("/media/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting: {}, segments: [] }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ mode: "no-key" });
  });
});
