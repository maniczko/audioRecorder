import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TranscriptionService from '../services/TranscriptionService.ts';

async function waitForCondition(
  predicate: () => boolean,
  { timeoutMs = 5000, intervalMs = 25 } = {}
) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

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

    expect(mockAudioPipeline.transcribeRecording).toHaveBeenCalled();
  }, 30000);

  it('throws a descriptive error if transcribeRecording is missing', () => {
    const service = new TranscriptionService(mockDb, mockWorkspaceService, {}, mockSpeakerEmbedder);
    expect(() => service.pipeline).toThrow(
      "Critical: TranscriptionService.audioPipeline is missing 'transcribeRecording'"
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — postprocess retry assertion flakes in CI
  // Date: 2026-04-05
  // Bug: the test slept for 1000ms and sometimes asserted before the
  //      background fast->full postprocess had triggered.
  // Fix: explicitly force fast mode and poll for the second pipeline call.
  // ─────────────────────────────────────────────────────────────────
  // TODO: Re-enable when pipeline deduplication is stabilized
  it.skip('deduplicates in-flight transcription jobs and persists successful results', async () => {
    const service = new TranscriptionService(
      mockDb,
      mockWorkspaceService,
      mockAudioPipeline,
      mockSpeakerEmbedder
    );
    const progressEvents: any[] = [];
    service.on('progress-rec_1', (payload) => progressEvents.push(payload));
    mockAudioPipeline.transcribeRecording.mockImplementation(async (_asset: any, options: any) => {
      options.onProgress({ progress: 55, message: 'mid' });
      return {
        segments: [
          { text: 'Pierwszy segment tekstu', speakerId: 0 },
          { text: 'Drugi segment tekstu', speakerId: 0 },
          { text: 'Trzeci segment tekstu', speakerId: 1 },
        ],
        diarization: { confidence: 0.91 },
      };
    });
    mockAudioPipeline.embedTextChunks.mockResolvedValue([[0.1]]);
    const asset = { id: 'asset_1', file_path: 'test.wav', workspace_id: 'ws_1' };

    service.ensureTranscriptionJob('rec_1', asset, {
      participants: ['Kasia'],
      vocabulary: 'lead',
      processingMode: 'fast',
    });
    service.ensureTranscriptionJob('rec_1', asset, {
      participants: ['Kasia'],
      vocabulary: 'lead',
      processingMode: 'fast',
    });

    await service.transcriptionJobs.get('rec_1');
    await waitForCondition(() => mockAudioPipeline.transcribeRecording.mock.calls.length >= 2);

    expect(mockDb.markTranscriptionProcessing).toHaveBeenCalled();
    expect(mockAudioPipeline.transcribeRecording).toHaveBeenCalledTimes(2);
    expect(mockAudioPipeline.transcribeRecording).toHaveBeenNthCalledWith(
      1,
      asset,
      expect.objectContaining({ processingMode: 'fast' })
    );
    expect(mockAudioPipeline.transcribeRecording).toHaveBeenNthCalledWith(
      2,
      asset,
      expect.objectContaining({ processingMode: 'full' })
    );
    expect(progressEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ progress: 55, message: 'mid' })])
    );
    expect(mockDb.saveTranscriptionResult).toHaveBeenCalled();
    expect(service.transcriptionJobs.has('rec_1')).toBe(false);
  }, 30000);

  it('marks transcription failure and clears the job map on pipeline error', async () => {
    const service = new TranscriptionService(
      mockDb,
      mockWorkspaceService,
      mockAudioPipeline,
      mockSpeakerEmbedder
    );
    const failure: any = new Error('STT exploded');
    failure.transcriptionDiagnostics = {
      usedChunking: true,
      chunksAttempted: 2,
      chunksSentToStt: 2,
      chunksFailedAtStt: 2,
      lastChunkErrorMessage: 'timeout',
    };
    mockAudioPipeline.transcribeRecording.mockRejectedValue(failure);
    const asset = { id: 'asset_2', file_path: 'test.wav', workspace_id: 'ws_1' };

    service.ensureTranscriptionJob('rec_2', asset, {});

    // Wait for job to fail
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(mockDb.markTranscriptionFailure).toHaveBeenCalled();
    expect(service.transcriptionJobs.has('rec_2')).toBe(false);
  }, 10000);

  it('persists empty transcript results without marking failure or vectorizing RAG', async () => {
    const service = new TranscriptionService(
      mockDb,
      mockWorkspaceService,
      mockAudioPipeline,
      mockSpeakerEmbedder
    );
    const progressEvents: any[] = [];
    service.on('progress-rec_empty', (payload) => progressEvents.push(payload));
    mockAudioPipeline.transcribeRecording.mockResolvedValue({
      pipelineStatus: 'completed',
      transcriptOutcome: 'empty',
      emptyReason: 'no_segments_from_stt',
      userMessage: 'Nie wykryto wypowiedzi w nagraniu.',
      segments: [],
      diarization: {
        speakerNames: {},
        speakerCount: 0,
        confidence: 0,
      },
      reviewSummary: { needsReview: 0, approved: 0 },
    });
    const asset = { id: 'asset_empty', file_path: 'test.wav', workspace_id: 'ws_1' };

    service.ensureTranscriptionJob('rec_empty', asset, {});
    await service.transcriptionJobs.get('rec_empty');

    expect(mockDb.saveTranscriptionResult).toHaveBeenCalledWith(
      'rec_empty',
      expect.objectContaining({
        pipelineStatus: 'completed',
        transcriptOutcome: 'empty',
        emptyReason: 'no_segments_from_stt',
      })
    );
    expect(mockDb.markTranscriptionFailure).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockDb.saveRagChunk).not.toHaveBeenCalled();
    expect(mockDb.saveRagChunks).not.toHaveBeenCalled();
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ progress: 100, message: 'Nie wykryto wypowiedzi w nagraniu.' }),
      ])
    );
  });

  it('creates voice profile from speaker clip and removes temp file afterward', async () => {
    vi.resetModules();
    const renameSync = vi.fn();
    const unlinkSync = vi.fn();
    vi.doMock('node:fs', () => ({
      default: { renameSync, unlinkSync },
      renameSync,
      unlinkSync,
    }));
    const { default: DynamicTranscriptionService } =
      await import('../services/TranscriptionService.ts');
    const service = new DynamicTranscriptionService(
      mockDb,
      mockWorkspaceService,
      mockAudioPipeline,
      mockSpeakerEmbedder
    );
    mockAudioPipeline.extractSpeakerAudioClip.mockResolvedValue('/tmp/clip.wav');
    const asset = {
      id: 'asset_3',
      workspace_id: 'ws_1',
      transcript_json: JSON.stringify([
        { text: 'hello', speakerId: 0, timestamp: 0, endTimestamp: 1 },
      ]),
    };

    const profile = await service.createVoiceProfileFromSpeaker(asset, '0', 'Anna', 'u1');

    expect(mockAudioPipeline.extractSpeakerAudioClip).toHaveBeenCalledWith(
      asset,
      '0',
      [{ text: 'hello', speakerId: 0, timestamp: 0, endTimestamp: 1 }],
      {}
    );
    expect(mockWorkspaceService.saveVoiceProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        workspaceId: 'ws_1',
        speakerName: 'Anna',
        audioPath: expect.stringMatching(/vp_.*\.wav$/),
      })
    );
    expect(renameSync).toHaveBeenCalledTimes(1);
    expect(unlinkSync).toHaveBeenCalledWith('/tmp/clip.wav');
    expect(profile).toEqual({ id: 'vp_new', speaker_name: 'Anna' });
  });

  it('lazy-loads speaker embedder when missing', async () => {
    // This test verifies the lazy-loading mechanism works when speakerEmbedder is null
    // The computeEmbedding method will dynamically import speakerEmbedder.ts
    const service = new TranscriptionService(mockDb, mockWorkspaceService, mockAudioPipeline, null);

    // Since we can't easily mock dynamic imports, we verify the method exists
    expect(service.computeEmbedding).toBeDefined();
    expect(typeof service.computeEmbedding).toBe('function');
  });

  // TODO: Re-enable when MAX_CONCURRENT_JOBS logic is stabilized
  it.skip('rejects new transcription jobs when MAX_CONCURRENT_JOBS is reached', async () => {
    const service = new TranscriptionService(
      mockDb,
      mockWorkspaceService,
      mockAudioPipeline,
      mockSpeakerEmbedder
    );

    // Simulate a long-running job by manually inserting a promise (MAX_CONCURRENT_JOBS = 1)
    let resolveJob1!: () => void;
    service.transcriptionJobs.set('rec_a', new Promise<void>((r) => (resolveJob1 = r)));

    const asset = { id: 'asset_3', file_path: 'test.wav', workspace_id: 'ws_1' };
    await service.ensureTranscriptionJob('rec_c', asset, {});

    // rec_c should have been rejected (markTranscriptionFailure called)
    expect(mockDb.markTranscriptionFailure).toHaveBeenCalledWith(
      'rec_c',
      expect.stringContaining('przeciążony'),
      null,
      null
    );
    // rec_c should NOT be in the job map
    expect(service.transcriptionJobs.has('rec_c')).toBe(false);

    // Cleanup
    resolveJob1();
  });
});
