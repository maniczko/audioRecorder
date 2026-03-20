import { describe, it, expect, vi } from "vitest";
import TranscriptionService from "../services/TranscriptionService.ts";

// Mock dependencies
const mockDb: any = {
  getWorkspaceState: vi.fn(),
  getWorkspaceVoiceProfiles: vi.fn(),
  queueTranscription: vi.fn(),
  markTranscriptionProcessing: vi.fn(),
  saveTranscriptionResult: vi.fn(),
  markTranscriptionFailure: vi.fn(),
};

const mockWorkspaceService: any = {
  getWorkspaceMemberNames: vi.fn().mockReturnValue(['Anna', 'Jan']),
};

const mockSpeakerEmbedder: any = {};


describe("TranscriptionService", () => {
  it("should successfully fallback to audioPipeline and call transcribeRecording without throwing 'is not a function'", async () => {
    // Create a mock audioPipeline with transcribeRecording exported
    const mockAudioPipeline = {
      transcribeRecording: vi.fn().mockResolvedValue({ segments: [], speakerCount: 0 })
    };

    const service = new TranscriptionService(mockDb, mockWorkspaceService, mockAudioPipeline, mockSpeakerEmbedder);

    const asset = { id: "asset_1", file_path: "test.wav", workspace_id: "ws_1" };
    const options = { language: "pl" };

    mockDb.getWorkspaceState.mockReturnValue({ vocabulary: [] });

    // Ensure the job is spawned
    service.ensureTranscriptionJob("rec_1", asset, options);

    // Wait for the async job promise to settle
    await service.transcriptionJobs.get("rec_1");

    expect(mockAudioPipeline.transcribeRecording).toHaveBeenCalled();
  });

  it("should throw a descriptive error if transcribeRecording is missing", () => {
    // Empty object simulating circular dependency missing export
    const brokenAudioPipeline = {};
    const service = new TranscriptionService(mockDb, mockWorkspaceService, brokenAudioPipeline, mockSpeakerEmbedder);

    // It should throw instead of returning an invalid object
    expect(() => service.pipeline).toThrow("Critical: TranscriptionService.audioPipeline is missing 'transcribeRecording'");
  });
});
