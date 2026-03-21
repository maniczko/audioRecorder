import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp } from "../../app.ts";

describe("Audio Pipeline Full Integration Flow", () => {
  let app: ReturnType<typeof createApp>;
  let mockTranscriptionService: any;
  let eventEmitterLogs: any[] = [];

  beforeEach(() => {
    eventEmitterLogs = [];

    mockTranscriptionService = {
      upsertMediaAsset: vi.fn().mockResolvedValue({
          id: "rec_flow_1", workspace_id: "ws_flow", size_bytes: 512, file_path: "/tmp/fake_flow.webm", content_type: "audio/webm", transcription_status: "uploaded"
      }),
      getMediaAsset: vi.fn(),
      queueTranscription: vi.fn().mockImplementation((id, body) => {
         eventEmitterLogs.push({ event: "queue", id });
      }),
      ensureTranscriptionJob: vi.fn().mockImplementation(async (id, asset, body) => {
         // Simulate transcription side effect modifying the database
         eventEmitterLogs.push({ event: "job_started", id });
         
         // Mocking behavior of a background job completing
         mockTranscriptionService.getMediaAsset.mockResolvedValueOnce({
            id: "rec_flow_1", workspace_id: "ws_flow", transcription_status: "completed", diarization_json: '{"speakerCount": 2, "speakerNames": {"0": "A", "1": "B"}}', transcript_json: '[{"text":"hello"}]'
         });
      }),
      on: vi.fn(),
      removeListener: vi.fn()
    };

    const mockAuthService = {
      getSession: vi.fn().mockResolvedValue({ user_id: "user_flow", workspace_id: "ws_flow" })
    };

    const mockWorkspaceService = {
      getMembership: vi.fn().mockResolvedValue({ member_role: "admin" })
    };

    app = createApp({
      authService: mockAuthService as any,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: "*", trustProxy: false, uploadDir: "/tmp" }
    });
  });

  it("Full scenario: Upload -> Transcribe -> Review Status -> Fallback Failure", async () => {
    // 1. Upload audio
    const resUpload = await app.request("/media/recordings/rec_flow_1/audio", {
      method: "PUT",
      headers: { "Authorization": "Bearer fake", "Content-Type": "audio/webm", "X-Workspace-Id": "ws_flow" },
      body: Buffer.from("fake-audio-blob")
    });
    expect(resUpload.status).toBe(200);
    const dataUpload = await resUpload.json();
    expect(dataUpload.id).toBe("rec_flow_1");

    // Initially, recording exists but is just uploaded
    // Need to return it twice because POST /transcribe calls it twice (initially, and after processing)
    mockTranscriptionService.getMediaAsset.mockResolvedValueOnce({
       id: "rec_flow_1", workspace_id: "ws_flow", transcription_status: "uploaded"
    }).mockResolvedValueOnce({
       id: "rec_flow_1", workspace_id: "ws_flow", transcription_status: "queued"
    });

    // 2. Start Transcription
    const resTranscribe = await app.request("/media/recordings/rec_flow_1/transcribe", {
      method: "POST",
      headers: { "Authorization": "Bearer fake", "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_flow" })
    });
    expect(resTranscribe.status).toBe(202);
    expect(eventEmitterLogs).toEqual(expect.arrayContaining([{ event: "queue", id: "rec_flow_1" }, { event: "job_started", id: "rec_flow_1" }]));

    // 3. Review Status (The mock in `ensureTranscriptionJob` shifted the DB status to "completed")
    const resStatus = await app.request("/media/recordings/rec_flow_1/transcribe", { method: "GET", headers: { "Authorization": "Bearer fake" } });
    expect(resStatus.status).toBe(200);
    const dataStatus = await resStatus.json();
    expect(dataStatus.pipelineStatus).toBe("done"); // "completed" maps to "done"
    expect(dataStatus.speakerCount).toBe(2);
    expect(dataStatus.segments[0].text).toBe("hello");

    // 4. Fallback Failure Scenario
    // Simulate another recording that fails
    mockTranscriptionService.getMediaAsset.mockResolvedValueOnce({
       id: "rec_flow_failed", workspace_id: "ws_flow", transcription_status: "uploaded"
    }).mockResolvedValueOnce({
       id: "rec_flow_failed", workspace_id: "ws_flow", transcription_status: "failed", diarization_json: '{"errorMessage": "AI unreachable"}'
    });
    mockTranscriptionService.ensureTranscriptionJob.mockImplementationOnce(async () => {
       mockTranscriptionService.getMediaAsset.mockResolvedValueOnce({
          id: "rec_flow_failed", workspace_id: "ws_flow", transcription_status: "failed", diarization_json: '{"errorMessage": "AI unreachable"}'
       });
    });

    await app.request("/media/recordings/rec_flow_failed/transcribe", {
      method: "POST",
      headers: { "Authorization": "Bearer fake", "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: "ws_flow" })
    });

    const resStatusFailed = await app.request("/media/recordings/rec_flow_failed/transcribe", { method: "GET", headers: { "Authorization": "Bearer fake" } });
    const dataStatusFailed = await resStatusFailed.json();
    expect(dataStatusFailed.pipelineStatus).toBe("failed");
    expect(dataStatusFailed.errorMessage).toBe("AI unreachable");
  });
});
