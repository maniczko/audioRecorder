import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createMediaService, REMOTE_TRANSCRIPTION_PROVIDER } from './mediaService';

const mockApiRequest = vi.fn();
const mockDiarizeSegments = vi.fn();
const mockVerifyRecognizedSegments = vi.fn();
const mockGetAudioBlob = vi.fn();
const mockSaveAudioBlob = vi.fn();
const mockGetSpeechRecognitionClass = vi.fn();
const mockCreateBrowserTranscriptionController = vi.fn();
const mockResolvePersistedSession = vi.fn();
const mockNormalizeMediaTranscriptionResponse = vi.fn();
let mockMediaPipelineProvider = 'local';

vi.mock('../lib/diarization', () => ({
  diarizeSegments: (...args: any[]) => mockDiarizeSegments(...args),
  verifyRecognizedSegments: (...args: any[]) => mockVerifyRecognizedSegments(...args),
}));

vi.mock('../lib/audioStore', () => ({
  getAudioBlob: (...args: any[]) => mockGetAudioBlob(...args),
  saveAudioBlob: (...args: any[]) => mockSaveAudioBlob(...args),
}));

vi.mock('../lib/transcription', () => ({
  createBrowserTranscriptionController: (...args: any[]) =>
    mockCreateBrowserTranscriptionController(...args),
  TRANSCRIPTION_PROVIDER: { id: 'browser-stt', label: 'Browser STT' },
}));

vi.mock('../lib/recording', () => ({
  getSpeechRecognitionClass: () => mockGetSpeechRecognitionClass(),
}));

vi.mock('./httpClient', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

vi.mock('./config', () => ({
  get MEDIA_PIPELINE_PROVIDER() {
    return mockMediaPipelineProvider;
  },
  API_BASE_URL: 'http://test-api.local',
}));

vi.mock('../lib/sessionStorage', () => ({
  resolvePersistedSession: () => mockResolvePersistedSession(),
}));

vi.mock('../shared/contracts', () => ({
  normalizeMediaTranscriptionResponse: (...args: any[]) =>
    mockNormalizeMediaTranscriptionResponse(...args),
}));

describe('mediaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNormalizeMediaTranscriptionResponse.mockReturnValue({
      pipelineStatus: 'done',
      transcriptOutcome: 'normal',
      emptyReason: '',
      userMessage: '',
      pipelineVersion: '',
      pipelineGitSha: '',
      pipelineBuildTime: '',
      audioQuality: null,
      transcriptionDiagnostics: null,
      reviewSummary: null,
      errorMessage: '',
    });
  });

  it('exports REMOTE_TRANSCRIPTION_PROVIDER constant', () => {
    expect(REMOTE_TRANSCRIPTION_PROVIDER.id).toBe('remote-pipeline');
    expect(REMOTE_TRANSCRIPTION_PROVIDER.label).toContain('Remote');
  });

  describe('local mode', () => {
    beforeEach(() => {
      mockMediaPipelineProvider = 'local';
    });

    it('returns mode local', () => {
      expect(createMediaService().mode).toBe('local');
    });

    it('supportsLiveTranscription delegates to getSpeechRecognitionClass', () => {
      mockGetSpeechRecognitionClass.mockReturnValue(class FakeSR {});
      expect(createMediaService().supportsLiveTranscription()).toBe(true);

      mockGetSpeechRecognitionClass.mockReturnValue(null);
      expect(createMediaService().supportsLiveTranscription()).toBe(false);
    });

    it('createLiveController delegates to browser transcription', () => {
      const fakeController = { start: vi.fn() };
      mockCreateBrowserTranscriptionController.mockReturnValue(fakeController);
      const opts = { onResult: vi.fn() };
      expect(createMediaService().createLiveController(opts)).toBe(fakeController);
      expect(mockCreateBrowserTranscriptionController).toHaveBeenCalledWith(opts);
    });

    it('persistRecordingAudio saves blob to indexeddb', async () => {
      mockSaveAudioBlob.mockResolvedValue(undefined);
      const blob = new Blob(['audio'], { type: 'audio/webm' });
      const result = await createMediaService().persistRecordingAudio('rec-1', blob);
      expect(mockSaveAudioBlob).toHaveBeenCalledWith('rec-1', blob);
      expect(result.storageMode).toBe('indexeddb');
      expect(result.audioQuality).toBeNull();
    });

    it('getRecordingAudioBlob delegates to audioStore', async () => {
      const blob = new Blob(['data']);
      mockGetAudioBlob.mockResolvedValue(blob);
      const result = await createMediaService().getRecordingAudioBlob('rec-1');
      expect(result).toBe(blob);
      expect(mockGetAudioBlob).toHaveBeenCalledWith('rec-1');
    });

    it('startTranscriptionJob runs local diarization pipeline', async () => {
      const segments = [{ text: 'hello', start: 0, end: 1 }];
      const diarization = { segments: [{ text: 'hello', speaker: 0 }] };
      const verified = [{ text: 'hello', speaker: 0, verificationStatus: 'verified' }];
      mockDiarizeSegments.mockReturnValue(diarization);
      mockVerifyRecognizedSegments.mockReturnValue(verified);

      const result = await createMediaService().startTranscriptionJob({ rawSegments: segments });

      expect(mockDiarizeSegments).toHaveBeenCalledWith(segments);
      expect(mockVerifyRecognizedSegments).toHaveBeenCalledWith(diarization.segments);
      expect(result.providerId).toBe('browser-stt');
      expect(result.pipelineStatus).toBe('done');
      expect(result.verifiedSegments).toBe(verified);
      expect(result.reviewSummary).toEqual({ needsReview: 0, approved: 1 });
    });

    it('startTranscriptionJob handles empty rawSegments', async () => {
      mockDiarizeSegments.mockReturnValue({ segments: [] });
      mockVerifyRecognizedSegments.mockReturnValue([]);
      const result = await createMediaService().startTranscriptionJob({ rawSegments: undefined });
      expect(mockDiarizeSegments).toHaveBeenCalledWith([]);
      expect(result.reviewSummary).toEqual({ needsReview: 0, approved: 0 });
    });

    it('getTranscriptionJobStatus returns null', async () => {
      expect(await createMediaService().getTranscriptionJobStatus('rec-1')).toBeNull();
    });

    it('retryTranscriptionJob throws with Polish message', async () => {
      await expect(createMediaService().retryTranscriptionJob('rec-1')).rejects.toThrow(
        /trybie lokalnym/
      );
    });

    it('normalizeRecordingAudio throws with Polish message', async () => {
      await expect(createMediaService().normalizeRecordingAudio('rec-1')).rejects.toThrow(
        /trybie lokalnym/
      );
    });

    it('getVoiceCoaching throws with Polish message', async () => {
      await expect(createMediaService().getVoiceCoaching('rec-1', 's1', [])).rejects.toThrow(
        /serwerowego/
      );
    });

    it('rediarize throws with Polish message', async () => {
      await expect(createMediaService().rediarize('rec-1')).rejects.toThrow(/serwerowym/);
    });

    it('subscribeToTranscriptionProgress returns unsubscribe fn', () => {
      const unsub = createMediaService().subscribeToTranscriptionProgress('rec-1', vi.fn());
      expect(typeof unsub).toBe('function');
    });

    it('extractVoiceProfileFromSpeaker throws', async () => {
      await expect(
        createMediaService().extractVoiceProfileFromSpeaker('rec-1', 's1', 'Jan')
      ).rejects.toThrow(/serwerowym/);
    });

    it('askRAG returns static message for local mode', async () => {
      const result = await createMediaService().askRAG('ws-1', 'co to jest?');
      expect(result).toContain('zdalne API');
    });

    it('askRAG returns prompt when question is empty', async () => {
      const result = await createMediaService().askRAG('ws-1', '');
      expect(result).toContain('Zadaj');
    });

    it('deleteRecording resolves without error', async () => {
      await expect(createMediaService().deleteRecording('rec-1')).resolves.toBeUndefined();
    });

    it('does not call apiRequest for any local operation', async () => {
      const service = createMediaService();
      mockDiarizeSegments.mockReturnValue({ segments: [] });
      mockVerifyRecognizedSegments.mockReturnValue([]);
      mockSaveAudioBlob.mockResolvedValue(undefined);
      mockGetAudioBlob.mockResolvedValue(new Blob());

      await service.persistRecordingAudio('r1', new Blob());
      await service.getRecordingAudioBlob('r1');
      await service.startTranscriptionJob({ rawSegments: [] });
      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

  describe('remote mode', () => {
    beforeEach(() => {
      mockMediaPipelineProvider = 'remote';
      mockApiRequest.mockResolvedValue({});
    });

    it('returns mode remote', () => {
      expect(createMediaService().mode).toBe('remote');
    });

    it('persistRecordingAudio sends small blob via PUT', async () => {
      const smallBlob = new Blob(['short audio'], { type: 'audio/webm' });
      mockApiRequest.mockResolvedValue({ audioQuality: { snr: 25 } });

      const result = await createMediaService().persistRecordingAudio('rec-1', smallBlob);

      expect(mockApiRequest).toHaveBeenCalledWith('/media/recordings/rec-1/audio', {
        method: 'PUT',
        body: smallBlob,
        headers: expect.objectContaining({ 'Content-Type': 'audio/webm' }),
      });
      expect(result.storageMode).toBe('remote');
      expect(result.audioQuality).toEqual({ snr: 25 });
    });

    it('persistRecordingAudio rejects blobs over 500MB', async () => {
      const hugeBlob = { size: 600 * 1024 * 1024, type: 'audio/webm' };
      await expect(
        createMediaService().persistRecordingAudio('rec-1', hugeBlob as any)
      ).rejects.toThrow(/500MB/);
    });

    it('persistRecordingAudio passes workspace and meeting headers', async () => {
      const blob = new Blob(['data'], { type: 'audio/webm' });
      mockApiRequest.mockResolvedValue({});
      await createMediaService().persistRecordingAudio('rec-1', blob, {
        workspaceId: 'ws-5',
        meetingId: 'mt-3',
      });

      expect(mockApiRequest).toHaveBeenCalledWith(
        '/media/recordings/rec-1/audio',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Workspace-Id': 'ws-5',
            'X-Meeting-Id': 'mt-3',
          }),
        })
      );
    });

    it('getRecordingAudioBlob fetches blob via GET', async () => {
      const fakeBlob = new Blob(['audio']);
      mockApiRequest.mockResolvedValue({ blob: () => Promise.resolve(fakeBlob) });
      const result = await createMediaService().getRecordingAudioBlob('rec-1');
      expect(result).toBe(fakeBlob);
      expect(mockApiRequest).toHaveBeenCalledWith('/media/recordings/rec-1/audio', {
        method: 'GET',
        parseAs: 'raw',
      });
    });

    it('startTranscriptionJob sends POST with meeting metadata', async () => {
      const meeting = {
        id: 'mt-1',
        workspaceId: 'ws-1',
        title: 'Standup',
        attendees: ['Alice', { name: 'Bob', email: 'bob@test.com' }],
        tags: ['daily'],
      };
      const blob = { type: 'audio/webm' };
      mockApiRequest.mockResolvedValue({ pipelineStatus: 'queued' });

      await createMediaService().startTranscriptionJob({
        recordingId: 'rec-1',
        blob,
        meeting,
      });

      expect(mockApiRequest).toHaveBeenCalledWith('/media/recordings/rec-1/transcribe', {
        method: 'POST',
        body: {
          meetingId: 'mt-1',
          workspaceId: 'ws-1',
          contentType: 'audio/webm',
          meetingTitle: 'Standup',
          participants: ['Alice', 'Bob'],
          tags: ['daily'],
        },
      });
    });

    it('getTranscriptionJobStatus fetches GET with reduced retries to avoid poll storm', async () => {
      mockApiRequest.mockResolvedValue({ pipelineStatus: 'done' });
      await createMediaService().getTranscriptionJobStatus('rec-1');
      expect(mockApiRequest).toHaveBeenCalledWith('/media/recordings/rec-1/transcribe', {
        method: 'GET',
        retries: 2,
      });
    });

    it('retryTranscriptionJob sends POST to retry-transcribe', async () => {
      mockApiRequest.mockResolvedValue({ pipelineStatus: 'queued' });
      await createMediaService().retryTranscriptionJob('rec-1');
      expect(mockApiRequest).toHaveBeenCalledWith('/media/recordings/rec-1/retry-transcribe', {
        method: 'POST',
      });
    });

    it('normalizeRecordingAudio sends POST', async () => {
      await createMediaService().normalizeRecordingAudio('rec-1');
      expect(mockApiRequest).toHaveBeenCalledWith('/media/recordings/rec-1/normalize', {
        method: 'POST',
      });
    });

    it('deleteRecording sends DELETE', async () => {
      await createMediaService().deleteRecording('rec-1');
      expect(mockApiRequest).toHaveBeenCalledWith('/media/recordings/rec-1', {
        method: 'DELETE',
      });
    });

    it('askRAG sends POST with question', async () => {
      mockApiRequest.mockResolvedValue('AI response');
      const result = await createMediaService().askRAG('ws-1', 'summary?');
      expect(mockApiRequest).toHaveBeenCalledWith('/workspaces/ws-1/rag/ask', {
        method: 'POST',
        body: { question: 'summary?' },
      });
      expect(result).toBe('AI response');
    });

    it('extractVoiceProfileFromSpeaker sends POST', async () => {
      mockApiRequest.mockResolvedValue({ profileId: 'vp-1' });
      const result = await createMediaService().extractVoiceProfileFromSpeaker(
        'rec-1',
        'spk-1',
        'Jan'
      );
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/media/recordings/rec-1/voice-profiles/from-speaker',
        { method: 'POST', body: { speakerId: 'spk-1', speakerName: 'Jan' } }
      );
      expect(result).toEqual({ profileId: 'vp-1' });
    });

    it('getVoiceCoaching returns coaching text', async () => {
      mockApiRequest.mockResolvedValue({ coaching: 'Mów wolniej.' });
      const result = await createMediaService().getVoiceCoaching('rec-1', 'spk-1', []);
      expect(result).toBe('Mów wolniej.');
    });

    it('getVoiceCoaching returns empty string for non-object response', async () => {
      mockApiRequest.mockResolvedValue('plain text');
      const result = await createMediaService().getVoiceCoaching('rec-1', 'spk-1', []);
      expect(result).toBe('');
    });

    it('rediarize sends POST', async () => {
      mockApiRequest.mockResolvedValue({ segments: [] });
      await createMediaService().rediarize('rec-1');
      expect(mockApiRequest).toHaveBeenCalledWith('/media/recordings/rec-1/rediarize', {
        method: 'POST',
      });
    });
  });
});
