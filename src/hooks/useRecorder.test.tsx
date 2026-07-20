import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import useRecorder from './useRecorder';
import { RECORDING_WORKSPACE_REQUIRED_MESSAGE } from '../lib/recordingQueue';
import {
  RECORDING_CONSENT_POLICY_VERSION,
  createRecordingConsentDisclosure,
  createRecordingConsentMetadata,
} from '../lib/recordingConsent';

const {
  mediaServiceMode,
  pipelineState,
  hydrationState,
  hardwareState,
  hardwareOptions,
  liveTranscriptValue,
  saveAudioBlobMock,
  deleteRecordingBlobMock,
  getAudioStorageEstimateMock,
  listStoredSizesMock,
} = vi.hoisted(() => ({
  mediaServiceMode: { current: 'remote' },
  pipelineState: {
    recordingQueue: [],
    getMeetingQueue: vi.fn(() => []),
    setAnalysisStatus: vi.fn(),
    setPipelineProgress: vi.fn(),
    setRecordingMessage: vi.fn(),
    setRecordingQueue: vi.fn(),
    recordingMessage: '',
    analysisStatus: 'idle',
    pipelineProgressPercent: 0,
    pipelineStageLabel: '',
    retryRecordingQueueItem: vi.fn(),
    updateQueueItem: vi.fn(),
    removeQueueItem: vi.fn(),
  },
  hydrationState: {
    audioUrls: {},
    audioHydrationErrors: {},
    audioHydrationStatusByRecordingId: {},
    hydrateRecordingAudio: vi.fn().mockResolvedValue(null),
    registerAudioUrl: vi.fn(),
    removeAudioUrl: vi.fn(),
  },
  hardwareState: {
    chunksRef: { current: [] as Blob[] },
    mimeTypeRef: { current: 'audio/webm' },
    isRecording: false,
    startRecording: vi.fn(),
    cleanupRecorder: vi.fn(),
    stopRecording: vi.fn(),
    canRecord: true,
  },
  hardwareOptions: { current: null as any },
  liveTranscriptValue: { current: '' },
  saveAudioBlobMock: vi.fn(),
  deleteRecordingBlobMock: vi.fn(),
  getAudioStorageEstimateMock: vi.fn(),
  listStoredSizesMock: vi.fn(),
}));

vi.mock('../services/mediaService', () => ({
  createMediaService: () => ({
    mode: mediaServiceMode.current,
    supportsLiveTranscription: () => false,
    transcribeLiveChunk: vi.fn().mockResolvedValue(''),
  }),
}));

vi.mock('../lib/audioStore', () => ({
  saveAudioBlob: (...args: any[]) => saveAudioBlobMock(...args),
  deleteRecordingBlob: (...args: any[]) => deleteRecordingBlobMock(...args),
  getAudioStorageEstimate: (...args: any[]) => getAudioStorageEstimateMock(...args),
  listStoredSizes: (...args: any[]) => listStoredSizesMock(...args),
}));

vi.mock('./useRecordingPipeline', () => ({
  default: () => pipelineState,
}));

vi.mock('./useAudioHydration', () => ({
  default: () => hydrationState,
}));

vi.mock('./useAudioHardware', () => ({
  default: (options: any) => {
    hardwareOptions.current = options;
    return hardwareState;
  },
}));

vi.mock('./useLiveTranscript', () => ({
  default: () => liveTranscriptValue.current,
}));

describe('useRecorder', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    errorSpy.mockRestore();
  });

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mediaServiceMode.current = 'remote';
    liveTranscriptValue.current = '';
    pipelineState.getMeetingQueue.mockReturnValue([]);
    pipelineState.setAnalysisStatus.mockReset();
    pipelineState.setPipelineProgress.mockReset();
    pipelineState.setRecordingMessage.mockReset();
    pipelineState.setRecordingQueue.mockReset();
    hydrationState.audioUrls = {};
    hydrationState.audioHydrationErrors = {};
    hydrationState.audioHydrationStatusByRecordingId = {};
    hydrationState.hydrateRecordingAudio = vi.fn().mockResolvedValue(null);
    hydrationState.registerAudioUrl.mockReset();
    hydrationState.removeAudioUrl.mockReset();
    saveAudioBlobMock.mockReset();
    deleteRecordingBlobMock.mockReset();
    getAudioStorageEstimateMock.mockReset();
    listStoredSizesMock.mockReset();
    hardwareState.startRecording.mockReset();
    hardwareState.cleanupRecorder.mockReset();
    hardwareState.isRecording = false;
    hardwareOptions.current = null;
    window.localStorage.clear();
    getAudioStorageEstimateMock.mockResolvedValue({
      usageBytes: 50 * 1024 * 1024,
      quotaBytes: 100 * 1024 * 1024,
      freeBytes: 50 * 1024 * 1024,
      usageRatio: 0.5,
      isNearQuota: false,
    });
    listStoredSizesMock.mockResolvedValue([]);
  });

  test('defers ad hoc meeting creation until consent disclosure is accepted', () => {
    const createAdHocMeeting = vi.fn(() => ({ id: 'meeting-ad-hoc', workspaceId: 'ws1' }));
    const selectMeeting = vi.fn();

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
        selectMeeting,
        currentWorkspaceId: 'ws1',
      })
    );

    act(() => {
      result.current.startRecording();
    });

    expect(createAdHocMeeting).not.toHaveBeenCalled();
    expect(result.current.recordingConsent.isPromptOpen).toBe(true);
    expect(hardwareState.startRecording).not.toHaveBeenCalled();

    act(() => {
      result.current.recordingConsent.accept();
    });

    expect(createAdHocMeeting).toHaveBeenCalledTimes(1);
    expect(selectMeeting).toHaveBeenCalledWith({ id: 'meeting-ad-hoc', workspaceId: 'ws1' });
    expect(hardwareState.startRecording).toHaveBeenCalledWith('meeting-ad-hoc');
    expect(window.localStorage.length).toBe(1);
  });

  // -----------------------------------------------------------------
  // Issue #0 - declining recording consent created an ad hoc meeting
  // Date: 2026-07-20
  // Bug: starting an ad hoc recording created a persistent meeting before
  //      the consent dialog was accepted, so cancelling left a false record.
  // Fix: defer ad hoc meeting creation until the user accepts consent.
  // -----------------------------------------------------------------
  test('Regression: declining consent does not create an ad hoc meeting', () => {
    const createAdHocMeeting = vi.fn(() => ({ id: 'meeting-ad-hoc', workspaceId: 'ws1' }));

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
        currentWorkspaceId: 'ws1',
      })
    );

    act(() => {
      result.current.startRecording({ adHoc: true });
    });
    act(() => {
      result.current.recordingConsent.decline();
    });

    expect(createAdHocMeeting).not.toHaveBeenCalled();
    expect(hardwareState.startRecording).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  test('uses persisted workspace consent to start recording without prompting again', () => {
    const disclosure = createRecordingConsentDisclosure({ remoteMode: true });
    const consent = createRecordingConsentMetadata({
      workspaceId: 'ws1',
      acceptedAt: '2026-06-25T10:00:00.000Z',
      disclosure,
    });
    window.localStorage.setItem(
      `voicelog.recordingConsent.${RECORDING_CONSENT_POLICY_VERSION}.ws1`,
      JSON.stringify(consent)
    );

    const createAdHocMeeting = vi.fn(() => ({ id: 'meeting-ad-hoc', workspaceId: 'ws1' }));
    const selectMeeting = vi.fn();

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
        selectMeeting,
        currentWorkspaceId: 'ws1',
      })
    );

    act(() => {
      result.current.startRecording();
    });

    expect(result.current.recordingConsent.isPromptOpen).toBe(false);
    expect(selectMeeting).toHaveBeenCalledWith({ id: 'meeting-ad-hoc', workspaceId: 'ws1' });
    expect(hardwareState.startRecording).toHaveBeenCalledWith('meeting-ad-hoc');
  });

  test('bridges server live transcript into live text in remote mode', async () => {
    liveTranscriptValue.current = 'Serwerowy podpis';

    const { result, rerender } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1' },
        userMeetings: [{ id: 'm1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    rerender();

    expect(result.current.liveText).toBe('Serwerowy podpis');
  });

  test('resets recorder state and cleans up hardware', () => {
    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1' },
        userMeetings: [{ id: 'm1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    act(() => {
      result.current.resetRecorderState();
    });

    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith('');
    expect(hardwareState.cleanupRecorder).toHaveBeenCalledTimes(1);
  });

  test('queues imported file immediately with persisted blob and queue status', async () => {
    saveAudioBlobMock.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1', title: 'Demo import', workspaceId: 'ws1' },
        userMeetings: [{ id: 'm1', title: 'Demo import', workspaceId: 'ws1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const file = new File(['audio'], 'demo-call.webm', { type: 'audio/webm' });

    await act(async () => {
      await result.current.queueRecording('m1', file);
    });

    expect(hydrationState.registerAudioUrl).toHaveBeenCalledTimes(1);
    expect(saveAudioBlobMock).toHaveBeenCalledTimes(1);
    expect(pipelineState.setRecordingQueue).toHaveBeenCalledTimes(1);
    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('queued');
    expect(pipelineState.setPipelineProgress).toHaveBeenCalledWith(8, 'Plik dodany do kolejki');
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      'Plik dodany do kolejki. Rozpoczynamy wgrywanie...'
    );
  });

  test('loads audio storage stats and removes stored audio blobs', async () => {
    listStoredSizesMock
      .mockResolvedValueOnce([
        { recordingId: 'rec-1', sizeBytes: 85 * 1024 * 1024, mimeType: 'audio/webm' },
      ])
      .mockResolvedValueOnce([]);
    getAudioStorageEstimateMock
      .mockResolvedValueOnce({
        usageBytes: 85 * 1024 * 1024,
        quotaBytes: 100 * 1024 * 1024,
        freeBytes: 15 * 1024 * 1024,
        usageRatio: 0.85,
        isNearQuota: true,
      })
      .mockResolvedValueOnce({
        usageBytes: 0,
        quotaBytes: 100 * 1024 * 1024,
        freeBytes: 100 * 1024 * 1024,
        usageRatio: 0,
        isNearQuota: false,
      });

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1', title: 'Demo import', workspaceId: 'ws1' },
        userMeetings: [{ id: 'm1', title: 'Demo import', workspaceId: 'ws1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    await waitFor(() => {
      expect(result.current.audioStorageState.items).toHaveLength(1);
    });

    expect(result.current.audioStorageState.isNearQuota).toBe(true);
    expect(result.current.audioStorageState.warningMessage).toContain('85%');

    await act(async () => {
      await result.current.deleteStoredRecordingAudio('rec-1');
    });

    expect(deleteRecordingBlobMock).toHaveBeenCalledWith('rec-1');
    expect(hydrationState.removeAudioUrl).toHaveBeenCalledWith('rec-1');
    expect(listStoredSizesMock).toHaveBeenCalled();
    expect(result.current.audioStorageState.items).toEqual([]);
  });

  test('queueRecording sets error status when saveAudioBlob throws', async () => {
    saveAudioBlobMock.mockRejectedValue(new Error('temporary storage write failure'));

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1', title: 'Demo', workspaceId: 'ws1' },
        userMeetings: [{ id: 'm1', title: 'Demo', workspaceId: 'ws1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const file = new File(['audio'], 'test.webm', { type: 'audio/webm' });

    await act(async () => {
      await result.current.queueRecording('m1', file);
    });

    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('error');
    expect(pipelineState.setPipelineProgress).toHaveBeenCalledWith(
      0,
      'Dodanie pliku nie powiodlo sie'
    );
    expect(pipelineState.setRecordingQueue).not.toHaveBeenCalled();
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      'Nie udalo sie zapisac pliku do kolejki.'
    );
  });

  test('quota exceeded error keeps recording queued as retryable', async () => {
    saveAudioBlobMock.mockRejectedValue(
      new Error('Za malo miejsca w przegladarce. Zostalo 2 MB. Zwolnij miejsce i sprobuj ponownie.')
    );

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1', title: 'Demo', workspaceId: 'ws1' },
        userMeetings: [{ id: 'm1', title: 'Demo', workspaceId: 'ws1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const file = new File(['audio'], 'quota.webm', { type: 'audio/webm' });
    let recordingId: string | null = null;

    await act(async () => {
      recordingId = await result.current.queueRecording('m1', file);
    });

    expect(recordingId).toMatch(/^\w/);
    expect(pipelineState.setRecordingQueue).toHaveBeenCalledTimes(1);
    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('error');
    expect(pipelineState.setPipelineProgress).toHaveBeenCalledWith(
      0,
      'Dodanie pliku nie powiodlo sie'
    );
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      'Nie udalo sie zapisac pliku do kolejki.'
    );

    const queueUpdater = pipelineState.setRecordingQueue.mock.calls[0][0];
    const queue = queueUpdater([]);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      recordingId,
      meetingId: 'm1',
      status: 'queued',
      lastErrorMessage:
        'Za malo miejsca w przegladarce. Zostalo 2 MB. Zwolnij miejsce i sprobuj ponownie.',
      errorMessage: '',
    });
  });

  test('transitions blob upload error into recoverable queue state', async () => {
    saveAudioBlobMock.mockRejectedValue(new Error('Failed to upload audio blob to cache.'));

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1', title: 'Demo', workspaceId: 'ws1' },
        userMeetings: [{ id: 'm1', title: 'Demo', workspaceId: 'ws1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const file = new File(['audio'], 'upload.webm', { type: 'audio/webm' });
    let recordingId: string | null = null;

    await act(async () => {
      recordingId = await result.current.queueRecording('m1', file);
    });

    expect(recordingId).toMatch(/^\w/);
    expect(pipelineState.setRecordingQueue).toHaveBeenCalledTimes(1);
    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('error');
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      'Nie udalo sie zapisac pliku do kolejki.'
    );

    const queueUpdater = pipelineState.setRecordingQueue.mock.calls[0][0];
    const queue = queueUpdater([]);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      recordingId,
      meetingId: 'm1',
      status: 'queued',
      lastErrorMessage: 'Failed to upload audio blob to cache.',
      errorMessage: '',
      uploaded: false,
    });
  });

  test('queueRecording removes partial artifacts and keeps queue unchanged on storage failures', async () => {
    saveAudioBlobMock.mockRejectedValue(new Error('ENOSPC'));

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1', title: 'Demo', workspaceId: 'ws1' },
        userMeetings: [{ id: 'm1', title: 'Demo', workspaceId: 'ws1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const file = new File(['audio'], 'retry.webm', { type: 'audio/webm' });
    let rid: string | null = null;

    await act(async () => {
      rid = await result.current.queueRecording('m1', file);
    });

    expect(rid).toBeNull();
    expect(hydrationState.registerAudioUrl).toHaveBeenCalledTimes(1);
    expect(saveAudioBlobMock).toHaveBeenCalledTimes(1);
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      'Nie udalo sie zapisac pliku do kolejki.'
    );
    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('error');
    expect(pipelineState.setPipelineProgress).toHaveBeenCalledWith(
      0,
      'Dodanie pliku nie powiodlo sie'
    );
    expect(pipelineState.setRecordingQueue).not.toHaveBeenCalled();
  });

  test('does not start recording when accepted consent cannot create an ad hoc meeting', () => {
    const createAdHocMeeting = vi.fn(() => null);
    const selectMeeting = vi.fn();

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
        selectMeeting,
        currentWorkspaceId: 'ws1',
      })
    );

    act(() => {
      result.current.startRecording();
    });

    expect(createAdHocMeeting).not.toHaveBeenCalled();
    expect(result.current.recordingConsent.isPromptOpen).toBe(true);

    act(() => {
      result.current.recordingConsent.accept();
    });

    expect(createAdHocMeeting).toHaveBeenCalledTimes(1);
    expect(hardwareState.startRecording).not.toHaveBeenCalled();
  });

  test('Regression: clears recordingMeetingId when hardware start fails', async () => {
    const createAdHocMeeting = vi.fn(() => ({ id: 'meeting-ad-hoc', workspaceId: 'ws1' }));
    const selectMeeting = vi.fn();
    hardwareState.startRecording.mockImplementation(() => {
      hardwareOptions.current?.onStartFailure?.();
      return Promise.resolve();
    });

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
        selectMeeting,
        currentWorkspaceId: 'ws1',
      })
    );

    await act(async () => {
      await result.current.startRecording();
    });
    await act(async () => {
      await result.current.recordingConsent.accept();
    });

    expect(createAdHocMeeting).toHaveBeenCalledTimes(1);
    expect(hardwareState.startRecording).toHaveBeenCalledWith('meeting-ad-hoc');
    expect(result.current.recordingMeetingId).toBeNull();
  });

  test('blocks remote recording when workspace context is missing', () => {
    const createAdHocMeeting = vi.fn(() => ({ id: 'meeting-without-workspace' }));

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    act(() => {
      result.current.startRecording();
    });

    expect(hardwareState.startRecording).not.toHaveBeenCalled();
    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('error');
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      RECORDING_WORKSPACE_REQUIRED_MESSAGE
    );
  });

  // -----------------------------------------------------------------
  // Issue #0 - selected meeting retried missing audio on every render
  // Date: 2026-04-05
  // Bug: the auto-hydration effect only skipped "loading", so recordings
  //      already marked as "error" were fetched again after every rerender.
  // Fix: skip automatic hydration while the selected recording is in error
  //      state and wait for an explicit manual retry.
  // -----------------------------------------------------------------
  test('Regression: skips auto-hydration when selected recording audio already failed', () => {
    hydrationState.audioUrls = {};
    hydrationState.audioHydrationErrors = { rec404: 'Nie znaleziono nagrania.' };
    hydrationState.audioHydrationStatusByRecordingId = { rec404: 'error' };
    hydrationState.hydrateRecordingAudio = vi.fn().mockResolvedValue(null);

    const meeting = {
      id: 'm1',
      latestRecordingId: 'rec404',
      recordings: [{ id: 'rec404' }],
    };

    const { rerender } = renderHook(
      ({ selectedMeeting }) =>
        useRecorder({
          selectedMeeting,
          userMeetings: [meeting],
          createAdHocMeeting: vi.fn(),
          attachCompletedRecording: vi.fn(),
          isHydratingRemoteState: false,
        }),
      { initialProps: { selectedMeeting: meeting } }
    );

    rerender({ selectedMeeting: { ...meeting } });

    expect(hydrationState.hydrateRecordingAudio).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — Import fails with "Nie znaleziono spotkania"
  // Date: 2026-03-30
  // Bug: createMeetingDirect adds meeting to state synchronously but
  //      userMeetingsRef is updated only after React re-render (useEffect).
  //      queueRecording called immediately after couldn't find the meeting.
  // Fix: queueRecording accepts optional meetingHint (3rd arg) as fallback.
  // ─────────────────────────────────────────────────────────────────
  test('Regression: skips auto-hydration for server-marked unavailable audio', () => {
    hydrationState.audioUrls = {};
    hydrationState.audioHydrationErrors = {};
    hydrationState.audioHydrationStatusByRecordingId = {};
    hydrationState.hydrateRecordingAudio = vi.fn().mockResolvedValue(null);

    const meeting = {
      id: 'm1',
      latestRecordingId: 'rec-unavailable',
      recordings: [
        {
          id: 'rec-unavailable',
          audioAvailable: false,
          audioUnavailable: true,
          audioUnavailableReason: 'audio_source_unavailable',
        },
      ],
    };

    renderHook(() =>
      useRecorder({
        selectedMeeting: meeting,
        userMeetings: [meeting],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    expect(hydrationState.hydrateRecordingAudio).not.toHaveBeenCalled();
  });

  test('Regression: queueRecording uses meetingHint when meeting not in userMeetings', async () => {
    saveAudioBlobMock.mockResolvedValue(undefined);

    // Meeting NOT in userMeetings (simulates race after createMeetingDirect)
    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const meetingHint = { id: 'new_m', title: 'Import: test', workspaceId: 'ws1' };
    const file = new File(['audio'], 'test.webm', { type: 'audio/webm' });

    await act(async () => {
      await result.current.queueRecording('new_m', file, meetingHint);
    });

    // Queue item should be created successfully using meetingHint
    expect(pipelineState.setRecordingQueue).toHaveBeenCalledTimes(1);
    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('queued');

    // Verify the queue item has the meeting snapshot from hint
    const updater = pipelineState.setRecordingQueue.mock.calls[0][0];
    const result_queue = updater([]);
    expect(result_queue[0].meetingSnapshot).toEqual(meetingHint);
    expect(result_queue[0].meetingId).toBe('new_m');
  });

  test('blocks remote file import before saving audio when workspace context is missing', async () => {
    saveAudioBlobMock.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const file = new File(['audio'], 'test.webm', { type: 'audio/webm' });

    await act(async () => {
      await result.current.queueRecording('new_m', file, { id: 'new_m', title: 'Import' });
    });

    expect(saveAudioBlobMock).not.toHaveBeenCalled();
    expect(pipelineState.setRecordingQueue).not.toHaveBeenCalled();
    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('error');
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      RECORDING_WORKSPACE_REQUIRED_MESSAGE
    );
  });

  test('does not enqueue stopped remote recording when workspace context is missing', async () => {
    saveAudioBlobMock.mockResolvedValue(undefined);

    renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1', title: 'No workspace meeting' },
        userMeetings: [{ id: 'm1', title: 'No workspace meeting' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    await act(async () => {
      await hardwareOptions.current.onRecordingStop({
        meetingId: 'm1',
        chunks: [new Blob(['audio'], { type: 'audio/webm' })],
        mimeType: 'audio/webm',
        rawSegments: [],
        duration: 5,
      });
    });

    expect(pipelineState.setRecordingQueue).not.toHaveBeenCalled();
    expect(pipelineState.setAnalysisStatus).toHaveBeenCalledWith('error');
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      RECORDING_WORKSPACE_REQUIRED_MESSAGE
    );
  });

  test('stores accepted consent metadata on the queued recording after stop', async () => {
    saveAudioBlobMock.mockResolvedValue(undefined);
    const createAdHocMeeting = vi.fn(() => ({
      id: 'm-consent',
      title: 'Consent meeting',
      workspaceId: 'ws-consent',
    }));

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [{ id: 'm-consent', title: 'Consent meeting', workspaceId: 'ws-consent' }],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
        currentWorkspaceId: 'ws-consent',
      })
    );

    act(() => {
      result.current.startRecording({ adHoc: true });
    });
    act(() => {
      result.current.recordingConsent.accept();
    });

    expect(hardwareState.startRecording).toHaveBeenCalledWith('m-consent');

    await act(async () => {
      await hardwareOptions.current.onRecordingStop({
        meetingId: 'm-consent',
        chunks: [new Blob(['audio'], { type: 'audio/webm' })],
        mimeType: 'audio/webm',
        rawSegments: [],
        duration: 5,
      });
    });

    const updater = pipelineState.setRecordingQueue.mock.calls[0][0];
    const [queued] = updater([]);

    expect(queued.recordingConsent).toMatchObject({
      workspaceId: 'ws-consent',
      policyVersion: RECORDING_CONSENT_POLICY_VERSION,
      disclosureTitle: 'Zgoda na nagrywanie i przetwarzanie AI',
    });
    expect(queued.recordingConsent.providers.map((provider) => provider.id)).toEqual(
      expect.arrayContaining(['stt', 'diarization', 'llm-analysis', 'embeddings'])
    );
  });

  test('queues recording fails if blob is missing and can be retried by user flow', async () => {
    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: { id: 'm1', title: 'Demo', workspaceId: 'ws1' },
        userMeetings: [{ id: 'm1', title: 'Demo', workspaceId: 'ws1' }],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    await act(async () => {
      await result.current.queueRecording('m1', null as unknown as Blob);
    });

    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      'Nie udalo sie dodac pliku do kolejki.'
    );
    expect(pipelineState.setRecordingQueue).not.toHaveBeenCalled();

    pipelineState.setRecordingMessage.mockReset();
    saveAudioBlobMock.mockResolvedValue(undefined);

    const file = new File(['audio'], 'retry.webm', { type: 'audio/webm' });
    await act(async () => {
      await result.current.queueRecording('m1', file);
    });

    expect(pipelineState.setRecordingQueue).toHaveBeenCalledTimes(1);
    expect(pipelineState.setPipelineProgress).toHaveBeenCalledWith(8, 'Plik dodany do kolejki');
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      'Plik dodany do kolejki. Rozpoczynamy wgrywanie...'
    );
  });

  // -----------------------------------------------------------------
  // Issue #0 - persisted selected meeting triggered audio fetch before
  //            remote workspace bootstrap finished.
  // Date: 2026-04-11
  // Bug: useRecorder auto-hydrated selected recording immediately even
  //      while useWorkspaceData was still replacing persisted meetings
  //      with the fresh backend snapshot, causing stale recordingId 404s.
  // Fix: skip automatic hydration while remote workspace state is still
  //      hydrating, then allow hydration once bootstrap completes.
  // -----------------------------------------------------------------
  test('Regression: skips auto-hydration while remote workspace state is hydrating', () => {
    hydrationState.audioUrls = {};
    hydrationState.audioHydrationErrors = {};
    hydrationState.audioHydrationStatusByRecordingId = {};
    hydrationState.hydrateRecordingAudio = vi.fn().mockResolvedValue(null);

    const staleMeeting = {
      id: 'm-stale',
      latestRecordingId: 'recording_n21cnnw2_mnpfre9n',
      recordings: [{ id: 'recording_n21cnnw2_mnpfre9n' }],
    };

    renderHook(() =>
      useRecorder({
        selectedMeeting: staleMeeting,
        userMeetings: [staleMeeting],
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: true,
      })
    );

    expect(hydrationState.hydrateRecordingAudio).not.toHaveBeenCalled();
  });

  test('Regression: hydrates selected recording after remote workspace hydration completes', () => {
    hydrationState.audioUrls = {};
    hydrationState.audioHydrationErrors = {};
    hydrationState.audioHydrationStatusByRecordingId = {};
    hydrationState.hydrateRecordingAudio = vi.fn().mockResolvedValue(null);

    const meeting = {
      id: 'm-fresh',
      latestRecordingId: 'rec-ready',
      recordings: [{ id: 'rec-ready' }],
    };

    const { rerender } = renderHook(
      ({ isHydratingRemoteState }) =>
        useRecorder({
          selectedMeeting: meeting,
          userMeetings: [meeting],
          createAdHocMeeting: vi.fn(),
          attachCompletedRecording: vi.fn(),
          isHydratingRemoteState,
        }),
      { initialProps: { isHydratingRemoteState: true } }
    );

    expect(hydrationState.hydrateRecordingAudio).not.toHaveBeenCalled();

    rerender({ isHydratingRemoteState: false });

    expect(hydrationState.hydrateRecordingAudio).toHaveBeenCalledWith('rec-ready', {
      priority: true,
    });
  });
});
