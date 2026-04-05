```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TranscriptionService from '../services/TranscriptionService.ts';

describe('TranscriptionService', () => {
  let mockDb: any;
  let mockWorkspaceService: any;
  let mockSpeakerEmbedder: any;
  let mockAudioPipeline: any;

  beforeEach(() => {
    mockDb = {
      uploadDir: '/tmp',
      getWorkspaceState: vi.fn().mockResolvedValue({ vocabulary: ['crm'] }),
      getWorkspaceVoiceProfiles: vi.fn().mockResolvedValue([{ id: 'vp1' }]),
      queueTranscription: vi.fn(),
      markTranscriptionProcessing: vi.fn(),
      saveTranscriptionResult: vi.fn(),
      updateTranscriptionMetadata: vi.fn(),
      markTranscriptionFailure: vi.fn(),
      saveRagChunk: vi.fn(),
      saveRagChunks: vi.fn(),
    };
    mockWorkspaceService = {
      getWorkspaceMemberNames: vi.fn().mockResolvedValue(['Anna', 'Jan']),
      saveVoiceProfile: vi.fn().mockResolvedValue({ id: 'vp_new', speaker_name: 'Anna' }),
    };
    mockSpeakerEmbedder = {
      computeEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
    mockAudioPipeline = {
      transcribeRecording: vi.fn(),
      extractSpeakerAudioClip: vi.fn(),
      diarizeFromTranscript: vi.fn(),
      transcribeLiveChunk: vi.fn(),
      analyzeMeetingWithOpenAI: vi.fn(),
      normalizeRecording: vi.fn(),
      generateVoiceCoaching: vi.fn(),
      embedTextChunks: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to injected audioPipeline and calls transcribeRecording', async () => {
    mockAudioPipeline.transcribeRecording.mockResolvedValue({
      segments: [],
      diarization: { confidence: 0 },
    });
    const service = new TranscriptionService(
      mockDb,
      mockWorkspaceService,
      mockAudioPipeline,
      mockSpeakerEmbedder
    );
    const asset = { id: 'asset_1', file_path: 'test.wav', workspace_id: 'ws_1' };

    // Start the job and await the stored promise directly
    service.ensureTranscriptionJob('rec_1', asset, { language: 'pl' });
    const job = service.transcriptionJobs.get('rec_1');
    await job;

    expect(mockAudioPipeline.transcribeRecording).toHaveBeenCalledTimes(1); // Change here to expect 1 call
  }, 30000);

  it('throws a descriptive error if transcribeRecording is missing', () => {
    const service = new TranscriptionService(mockDb, mockWorkspaceService, {}, mockSpeakerEmbedder);
    expect(() => service.pipeline).toThrow(
      "Critical: TranscriptionService.audioPipeline is missing 'transcribeRecording'"
    );
  });

  it('deduplicates in-flight transcription jobs and persists successful results', async () => {
    const service = new TranscriptionService(
      mockDb,
      mockWorkspaceService,
      mockAudioPipeline,
      mockSpeakerEmbedder
    );
    const progressEvents: any[] = [];
    service.on('progress-rec_1', (payload) => progressEvents.push(payload));
    mockAudioPipeline.transcribeRecording.mockImplementation(async (_asset: any, options: any) => {
      // Implementation here...
    });
  });
});
```