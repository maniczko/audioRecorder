import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Hoisted mocks - these survive vi.resetModules()
const mocks = vi.hoisted(() => ({
  getAudioBlob: vi.fn(),
  analyzeMeeting: vi.fn(),
  createMediaService: vi.fn(),
  getPreviewRuntimeStatus: vi.fn().mockReturnValue('unknown'),
  filterSilence: vi.fn((blob: Blob) =>
    Promise.resolve({ blob, originalDurationS: 10, filteredDurationS: 10, removedS: 0 })
  ),
}));

// Mock modules - these are hoisted
vi.mock('../lib/audioStore', () => ({
  getAudioBlob: mocks.getAudioBlob,
}));

vi.mock('../lib/analysis', () => ({
  analyzeMeeting: mocks.analyzeMeeting,
}));

vi.mock('../services/mediaService', () => ({
  createMediaService: mocks.createMediaService,
}));

vi.mock('../services/httpClient', () => ({
  getPreviewRuntimeStatus: mocks.getPreviewRuntimeStatus,
}));

// VAD filter: return original blob (no silence removed) in tests
vi.mock('../audio/vadFilter', () => ({
  filterSilence: mocks.filterSilence,
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

  test('retries blocked queue item before failing when meeting cannot be resolved', async () => {
    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [{ recordingId: 'rec1', status: 'queued', uploaded: false, attempts: 0 }],
    });

    // First 3 calls should increment attempts without failing
    for (let i = 0; i < 3; i++) {
      await useRecorderStore.getState().processQueue(() => null, vi.fn(), vi.fn());
    }

    // After 3 retries, the item should still be queued (not yet failed)
    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: 'queued',
      attempts: 3,
    });

    // 4th call should mark as failed
    await useRecorderStore.getState().processQueue(() => null, vi.fn(), vi.fn());

    expect(useRecorderStore.getState().recordingQueue[0]).toMatchObject({
      status: 'failed',
      errorMessage: 'Nie znaleziono spotkania.',
    });
    expect(useRecorderStore.getState().analysisStatus).toBe('error');
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — Queue item immediately fails with "Nie znaleziono spotkania"
  // Date: 2026-04-03
  // Bug: processQueue marked items as failed on first attempt if meeting wasn't
  //      yet in userMeetingsRef (race condition after import/page reload)
  // Fix: retry 3 times before permanently failing, giving hydration time
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: #0 — processQueue race condition with meeting resolution', () => {
    test('does not immediately fail queue item when meeting is temporarily unavailable', async () => {
      const { useRecorderStore } = await import('./recorderStore');
      useRecorderStore.setState({
        recordingQueue: [
          {
            recordingId: 'rec_import',
            status: 'queued',
            uploaded: false,
            attempts: 0,
            meetingId: 'm_new',
          },
        ],
      });

      // Simulate meeting not yet hydrated
      await useRecorderStore.getState().processQueue(() => null, vi.fn(), vi.fn());

      const item = useRecorderStore.getState().recordingQueue[0];
      expect(item.status).toBe('queued');
      expect(item.attempts).toBe(1);
      expect(item.errorMessage || '').not.toBe('Nie znaleziono spotkania.');
    });

    test('succeeds when meeting becomes available after initial miss', async () => {
      const { useRecorderStore } = await import('./recorderStore');
      useRecorderStore.setState({
        recordingQueue: [
          {
            recordingId: 'rec_import2',
            status: 'queued',
            uploaded: false,
            attempts: 1,
            meetingId: 'm_new',
          },
        ],
      });

      // Meeting now available — resolver returns it
      const resolver = (item: any) =>
        item.meetingId === 'm_new' ? { id: 'm_new', workspaceId: 'ws1' } : null;

      // processQueue should find the item now (canProcess returns true)
      // It will proceed to processing — we just verify it doesn't fail

      mocks.getAudioBlob.mockResolvedValueOnce(null);

      mocks.createMediaService.mockReturnValue({ mode: 'local' });

      await useRecorderStore.getState().processQueue(resolver, vi.fn(), vi.fn());

      const item = useRecorderStore.getState().recordingQueue[0];
      // It should NOT be 'failed' with meeting error — it proceeds into the normal flow
      expect(item.errorMessage).not.toBe('Nie znaleziono spotkania.');
    });
  });

  test('fails queue item when local audio blob is missing', async () => {
    mocks.getAudioBlob.mockResolvedValueOnce(null);

    mocks.createMediaService.mockReturnValue({ mode: 'local' });

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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio'], { type: 'audio/webm' }));

    mocks.createMediaService.mockReturnValue({
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

    mocks.analyzeMeeting.mockRejectedValueOnce(new Error('AI failed'));

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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio'], { type: 'audio/webm' }));

    mocks.createMediaService.mockReturnValue({
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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    mocks.getPreviewRuntimeStatus.mockReturnValue('unknown');

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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('Failed to fetch')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    mocks.getPreviewRuntimeStatus.mockReturnValue('healthy');

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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('Application failed to respond')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    mocks.getPreviewRuntimeStatus.mockReturnValue('unknown');

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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi
        .fn()
        .mockRejectedValue(new Error('ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    mocks.getPreviewRuntimeStatus.mockReturnValue('unknown');

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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockRejectedValue(new Error('HTTP 502')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    mocks.getPreviewRuntimeStatus.mockReturnValue('unknown');

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

  // -----------------------------------------------------------------
  // Issue #0 - transient backend memory pressure killed import queue flow
  // Date: 2026-04-05
  // Bug: when the backend returned a temporary "server memory overloaded"
  //      error during transcription start, processQueue marked the item as
  //      failed immediately, so the uploaded recording never got retried.
  // Fix: classify temporary overload as transient and requeue with backoff.
  // -----------------------------------------------------------------
  test('Regression: retries queue item when backend is temporarily memory overloaded', async () => {
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi
        .fn()
        .mockRejectedValue(
          new Error('Serwer chwilowo przeciążony pamięciowo — spróbuj ponownie za minutę.')
        ),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec_mem', status: 'queued', uploaded: false, retryCount: 0 },
      ],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    const queueItem = useRecorderStore.getState().recordingQueue[0];
    expect(queueItem.status).toBe('queued');
    expect(queueItem.retryCount).toBe(1);
    expect(queueItem.backoffUntil).toBeGreaterThan(Date.now());
    expect(queueItem.lastErrorMessage).toBe(
      'Serwer chwilowo przeciazony pamieciowo - sprobuj ponownie za minute.'
    );
    expect(queueItem.errorMessage).toBe('');
    expect(useRecorderStore.getState().analysisStatus).toBe('queued');
  });

  // -----------------------------------------------------------------
  // Issue #0 - Vercel proxy timeouts were treated as permanent failures
  // Date: 2026-04-06
  // Bug: "timeout exceeded when trying to connect" was not classified as a
  //      transient network error, so queue items failed immediately instead
  //      of backing off and retrying after preview/backend transport outages.
  // Fix: classify proxy connection timeouts as transient and requeue.
  // -----------------------------------------------------------------
  test('Regression: retries queue item when Vercel proxy times out connecting to backend', async () => {
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
      mode: 'remote',
      persistRecordingAudio: vi.fn().mockResolvedValue({}),
      startTranscriptionJob: vi
        .fn()
        .mockRejectedValue(new Error('timeout exceeded when trying to connect')),
      subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
    });

    const { useRecorderStore } = await import('./recorderStore');
    useRecorderStore.setState({
      recordingQueue: [
        { recordingId: 'rec_proxy_timeout', status: 'queued', uploaded: false, retryCount: 0 },
      ],
    });

    await useRecorderStore
      .getState()
      .processQueue(() => ({ id: 'm1', workspaceId: 'ws1' }), vi.fn(), vi.fn());

    const queueItem = useRecorderStore.getState().recordingQueue[0];
    expect(queueItem.status).toBe('queued');
    expect(queueItem.retryCount).toBe(1);
    expect(queueItem.backoffUntil).toBeGreaterThan(Date.now());
    expect(queueItem.lastErrorMessage).toBe(
      'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.'
    );
    expect(queueItem.errorMessage).toBe('');
    expect(useRecorderStore.getState().analysisStatus).toBe('queued');
  });

  test('maps empty-stt-output failures to a recording quality message', async () => {
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
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
    mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

    mocks.createMediaService.mockReturnValue({
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

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — processQueue removes queue item even when meeting not found
  // Date: 2026-04-04
  // Bug: attachCompletedRecording silently failed when meeting was missing from
  //      state (e.g. after bootstrap overwrite). Queue item was removed anyway,
  //      permanently losing the recording data.
  // Fix: check return value; if false, mark queue item as failed instead of removing.
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: #0 — processQueue preserves queue item when attachment fails', () => {
    test('marks item as failed when attachCompletedRecording returns false (normal transcript)', async () => {
      mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

      mocks.analyzeMeeting.mockResolvedValueOnce({
        summary: 'test',
        speakerLabels: {},
        speakerCount: 1,
      });
      mocks.createMediaService.mockReturnValue({
        mode: 'remote',
        persistRecordingAudio: vi.fn().mockResolvedValue({}),
        startTranscriptionJob: vi.fn().mockResolvedValue({
          pipelineStatus: 'done',
          verifiedSegments: [{ text: 'Hello', speakerId: 0, timestamp: 0, endTimestamp: 2 }],
          diarization: { speakerNames: {}, speakerCount: 1 },
          providerId: 'test-provider',
        }),
        subscribeToTranscriptionProgress: vi.fn().mockReturnValue(null),
      });

      const { useRecorderStore } = await import('./recorderStore');
      useRecorderStore.setState({
        recordingQueue: [
          {
            recordingId: 'rec_orphan',
            meetingId: 'meeting_missing',
            status: 'queued',
            uploaded: false,
            createdAt: '2026-01-01T00:00:00Z',
            duration: 10,
          },
        ],
      });

      const attachMock = vi.fn().mockReturnValue(false);

      await useRecorderStore
        .getState()
        .processQueue(() => ({ id: 'meeting_missing', workspaceId: 'ws1' }), attachMock, vi.fn());

      expect(attachMock).toHaveBeenCalledTimes(1);
      const queueItem = useRecorderStore
        .getState()
        .recordingQueue.find((i) => i.recordingId === 'rec_orphan');
      expect(queueItem).toBeDefined();
      expect(queueItem!.status).toBe('failed');
      expect(queueItem!.errorMessage).toContain('Nie znaleziono spotkania');
    });

    test('marks item as failed when attachCompletedRecording returns false (empty transcript)', async () => {
      mocks.getAudioBlob.mockResolvedValueOnce(new Blob(['audio']));

      mocks.createMediaService.mockReturnValue({
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
            recordingId: 'rec_orphan_empty',
            meetingId: 'meeting_gone',
            status: 'queued',
            uploaded: false,
            createdAt: '2026-01-01T00:00:00Z',
            duration: 10,
          },
        ],
      });

      const attachMock = vi.fn().mockReturnValue(false);

      await useRecorderStore
        .getState()
        .processQueue(() => ({ id: 'meeting_gone', workspaceId: 'ws1' }), attachMock, vi.fn());

      expect(attachMock).toHaveBeenCalledTimes(1);
      const queueItem = useRecorderStore
        .getState()
        .recordingQueue.find((i) => i.recordingId === 'rec_orphan_empty');
      expect(queueItem).toBeDefined();
      expect(queueItem!.status).toBe('failed');
      expect(queueItem!.errorMessage).toContain('Nie znaleziono spotkania');
    });
  });
});
