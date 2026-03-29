import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock modules - these are hoisted
vi.mock('../lib/audioStore', () => ({
  getAudioBlob: vi.fn(),
}));

vi.mock('../lib/analysis', () => ({
  analyzeMeeting: vi.fn(),
}));

vi.mock('../services/mediaService', () => ({
  createMediaService: vi.fn(),
}));

vi.mock('../services/httpClient', () => ({
  getPreviewRuntimeStatus: vi.fn().mockReturnValue('unknown'),
}));

// VAD filter: return original blob (no silence removed) in tests
vi.mock('../audio/vadFilter', () => ({
  filterSilence: vi.fn((blob: Blob) =>
    Promise.resolve({ blob, originalDurationS: 10, filteredDurationS: 10, removedS: 0 })
  ),
}));

describe('recorderStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [],
      analysisStatus: 'idle',
      recordingMessage: '',
      pipelineProgressPercent: 0,
      pipelineStageLabel: '',
      isProcessingQueue: false,
      lastQueueErrorKey: '',
    });
  });

  test('retries queued item by resetting flags and status message', async () => {
    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec1', status: 'failed', uploaded: true, errorMessage: 'boom' },
      ],
    });

    useRecorderStore.getState().retryRecordingQueueItem('rec1');

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      recordingId: 'rec1',
      status: 'queued',
      uploaded: true,
      errorMessage: '',
    });
    expect(useRecorderStore.getState().recordingMessage).toBe(
      'Ponawiamy transkrypcje z pliku zapisanego juz na serwerze.'
    );
    expect(useRecorderStore.getState().pipelineProgressPercent).toBe(8);
  });

  test('queues stored recording for retry without reupload', async () => {
    const { useRecorderStore } = await import('./recorderStore');
    const meeting = { id: 'm1', workspaceId: 'ws1', title: 'Test' };
    const recording = {
      id: 'rec_stored',
      createdAt: '2026-01-01T00:00:00Z',
      duration: 60,
      mimeType: 'audio/webm',
    };

    const result = useRecorderStore.getState().retryStoredRecording(meeting, recording);

    expect(result).toBe('rec_stored');
    const item = useRecorderStore
      .getState()
      .recordingQueue.find((i) => i.recordingId === 'rec_stored');
    expect(item).toMatchObject({
      recordingId: 'rec_stored',
      meetingId: 'm1',
      status: 'queued',
      uploaded: true,
    });
    expect(useRecorderStore.getState().analysisStatus).toBe('queued');
  });

  test('retryStoredRecording returns null for missing meeting or recording', async () => {
    const { useRecorderStore } = await import('./recorderStore');

    expect(useRecorderStore.getState().retryStoredRecording(null, { id: 'r1' })).toBeNull();
    expect(useRecorderStore.getState().retryStoredRecording({ id: 'm1' }, null)).toBeNull();
  });

  test('fails blocked queue item when meeting cannot be resolved', async () => {
    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: 'rec1', status: 'queued', uploaded: false }],
    });

    await useRecorderStore.getState().processQueue(() => null, vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: 'failed',
      errorMessage: 'Nie znaleziono spotkania.',
    });
    expect(useRecorderStore.getState().analysisStatus).toBe('error');
  });

  test('fails queue item when local audio blob is missing', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(null);

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({ mode: 'local' });

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: 'rec_no_blob', status: 'queued', uploaded: false }],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: 'failed',
      errorMessage: 'Brakuje lokalnego audio.',
    });
  });

  test('processes successful queue item and builds fallback analysis on AI error', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio'], { type: 'audio/webm' }));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockResolvedValue({
        pipelineStatus: 'done',
        verifiedSegments: [{ text: 'hello', speakerId: 1, verificationStatus: 'verified' }],
        diarization: { speakerNames: { 1: 'Alice' }, speakerCount: 1, confidence: 0.9 },
        providerId: 'test-provider',
      }),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { analyzeMeeting } = await import('../lib/analysis');
    (analyzeMeeting as any).mockRejectedValueOnce(new Error('AI failed'));

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        {
          recordingId: 'rec_ok',
          status: 'queued',
          uploaded: false,
          createdAt: '2026-01-01T00:00:00Z',
          duration: 30,
        },
      ],
    });

    const attachMock = vi.fn();
    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), attachMock, vi.fn());

    expect(attachMock).toHaveBeenCalledTimes(1);
    const recording = attachMock.mock.calls[0][1];
    expect(recording.analysis.summary).toContain('Analiza AI nie powiodla sie');
    expect(recording.transcript).toHaveLength(1);
    expect(useRecorderStore.getState().analysisStatus).toBe('done');
  });

  test('marks item as failed when remote transcription throws', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio'], { type: 'audio/webm' }));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockRejectedValue(new Error('Server error')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec_fail', status: 'queued', uploaded: false, duration: 10 },
      ],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: 'failed',
      errorMessage: 'Server error',
    });
    expect(useRecorderStore.getState().analysisStatus).toBe('error');
  });

  test('maps missing-token failures to a re-login message', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio']));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('Brak tokenu autoryzacyjnego')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: 'rec_auth', status: 'queued', uploaded: false }],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0].errorMessage).toBe(
      'Brak autoryzacji do backendu. Zaloguj sie ponownie.'
    );
  });

  test('maps failed fetch errors to a backend availability message', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio']));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { getPreviewRuntimeStatus } = await import('../services/httpClient');
    (getPreviewRuntimeStatus as any).mockReturnValue('unknown');

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec_net', status: 'queued', uploaded: false, retryCount: 5 },
      ],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0].errorMessage).toBe(
      'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.'
    );
  });

  test('maps failed fetch errors to a hosted preview message when preview health was healthy', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio']));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { getPreviewRuntimeStatus } = await import('../services/httpClient');
    (getPreviewRuntimeStatus as any).mockReturnValue('healthy');

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec_preview', status: 'queued', uploaded: false, retryCount: 5 },
      ],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0].errorMessage).toBe(
      'Hostowany preview nie moze polaczyc sie z backendem. Odswiez strone lub otworz najnowszy deploy.'
    );
  });

  test('maps 502 application-failed responses to a backend availability message', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio']));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('Application failed to respond')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { getPreviewRuntimeStatus } = await import('../services/httpClient');
    (getPreviewRuntimeStatus as any).mockReturnValue('unknown');

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec_502', status: 'queued', uploaded: false, retryCount: 5 },
      ],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0].errorMessage).toBe(
      'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.'
    );
  });

  test('maps Vercel router target errors to a backend availability message', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio']));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi
        .fn()
        .mockRejectedValue(new Error('ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { getPreviewRuntimeStatus } = await import('../services/httpClient');
    (getPreviewRuntimeStatus as any).mockReturnValue('unknown');

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec_vercel', status: 'queued', uploaded: false, retryCount: 5 },
      ],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0].errorMessage).toBe(
      'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.'
    );
  });

  test('maps explicit HTTP 502 errors to a backend availability message', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio']));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('HTTP 502')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { getPreviewRuntimeStatus } = await import('../services/httpClient');
    (getPreviewRuntimeStatus as any).mockReturnValue('unknown');

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec_http502', status: 'queued', uploaded: false, retryCount: 5 },
      ],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0].errorMessage).toBe(
      'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.'
    );
  });

  test('maps empty-stt-output failures to a recording quality message', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio']));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi
        .fn()
        .mockRejectedValue(new Error('Model STT nie zwrocil zadnych segmentow transkrypcji')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: 'rec_empty_stt', status: 'queued', uploaded: false }],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0].errorMessage).toContain(
      'Nie wykryto wypowiedzi w nagraniu'
    );
  });

  test('treats empty transcript as a completed import without console error', async () => {
    const { getAudioBlob } = await import('../lib/audioStore');
    (getAudioBlob as any).mockResolvedValueOnce(new Blob(['audio']));

    const { createMediaService } = await import('../services/mediaService');
    (createMediaService as any).mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi.fn().mockResolvedValue({
        pipelineStatus: 'done',
        verifiedSegments: [],
        transcriptOutcome: 'empty',
        diarization: { speakerNames: {}, speakerCount: 0 },
        providerId: 'test-provider',
      }),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        {
          recordingId: 'rec_empty',
          status: 'queued',
          uploaded: false,
          createdAt: '2026-01-01T00:00:00Z',
          duration: 10,
        },
      ],
    });

    const attachMock = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error');
    consoleSpy.mockClear();

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), attachMock, vi.fn());

    expect(attachMock).toHaveBeenCalledTimes(1);
    const recording = attachMock.mock.calls[0][1];
    expect(recording.transcriptOutcome).toBe('empty');
    expect(recording.transcript).toEqual([]);
    expect(useRecorderStore.getState().analysisStatus).toBe('done');
    // Queue item should be removed after successful empty-transcript completion
    expect(
      useRecorderStore.getState().recordingQueue.find((i) => i.recordingId === 'rec_empty')
    ).toBeUndefined();
  });
});
