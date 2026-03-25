import { describe, it, expect } from 'vitest';
import TranscriptionService from '../services/TranscriptionService.ts';

describe('TranscriptionService Reproduction', () => {
  it('should throw a clear error if pipeline is null', async () => {
    const mockDb: any = {};
    const mockWorkspaceService: any = {};
    const mockSpeakerEmbedder: any = {};

    // Explicitly pass null as audioPipeline
    const service = new TranscriptionService(
      mockDb,
      mockWorkspaceService,
      null,
      mockSpeakerEmbedder
    );

    const asset = { id: 'asset_1', file_path: 'test.wav', workspace_id: 'ws_1' };

    // This should fail with a meaningful error message instead of 'Cannot read properties of null'
    const act = async () => {
      service.pipeline.transcribeRecording(asset, {});
    };

    await expect(act()).rejects.toThrow(
      'Critical: TranscriptionService.audioPipeline is null or undefined.'
    );
  });

  it('should throw a clear error if pipeline is missing transcribeRecording', async () => {
    const mockDb: any = {};
    const mockWorkspaceService: any = {};
    const mockSpeakerEmbedder: any = {};

    // Explicitly pass an empty object
    const brokenPipeline = {};
    const service = new TranscriptionService(
      mockDb,
      mockWorkspaceService,
      brokenPipeline,
      mockSpeakerEmbedder
    );

    const asset = { id: 'asset_1', file_path: 'test.wav', workspace_id: 'ws_1' };

    const act = async () => {
      service.pipeline.transcribeRecording(asset, {});
    };

    await expect(act()).rejects.toThrow(
      "Critical: TranscriptionService.audioPipeline is missing 'transcribeRecording'."
    );
  });
});
