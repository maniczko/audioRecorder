const TranscriptionService = require('../services/TranscriptionService.ts');

// Mock dependencies
const mockDb = {
  getWorkspaceState: jest.fn(),
  getWorkspaceVoiceProfiles: jest.fn(),
  queueTranscription: jest.fn(),
  markTranscriptionProcessing: jest.fn(),
  saveTranscriptionResult: jest.fn(),
  markTranscriptionFailure: jest.fn(),
};

const mockWorkspaceService = {
  getWorkspaceMemberNames: jest.fn().mockReturnValue(['Anna', 'Jan']),
};

const mockSpeakerEmbedder = {};

describe("TranscriptionService", () => {
  it("should successfully fallback to audioPipeline and call transcribeRecording without throwing 'is not a function'", async () => {
    // Create a mock audioPipeline with transcribeRecording exported
    const mockAudioPipeline = {
      transcribeRecording: jest.fn().mockResolvedValue({ segments: [], speakerCount: 0 })
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

  it("should handle missing transcribeRecording gracefully by logging and recovering if possible", () => {
    // Empty object simulating circular dependency missing export
    const brokenAudioPipeline = {};
    const service = new TranscriptionService(mockDb, mockWorkspaceService, brokenAudioPipeline, mockSpeakerEmbedder);

    // It should invoke the fallback logic in get pipeline()
    const pipeline = service.pipeline;
    expect(pipeline).toBeDefined();
    // Since fallback requires the actual pipeline module, just ensure it doesn't crash here.
  });
});
