import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../../app.ts";

describe("Media Routes", () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;
  let mockWorkspaceService: any;

  beforeEach(() => {
    mockTranscriptionService = {
      upsertMediaAsset: vi.fn(),
      getMediaAsset: vi.fn(),
      queueTranscription: vi.fn(),
      ensureTranscriptionJob: vi.fn(),
      queryRAG: vi.fn(),
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
      id: "rec_2", workspace_id: "ws_1", transcription_status: "completed", diarization_json: JSON.stringify({ speakerCount: 2 }), transcript_json: "[]"
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
  });
});
