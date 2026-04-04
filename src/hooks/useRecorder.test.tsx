import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import useRecorder from './useRecorder';

const {
  mediaServiceMode,
  pipelineState,
  hydrationState,
  hardwareState,
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
  default: (_options: any) => hardwareState,
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
    hydrationState.registerAudioUrl.mockReset();
    hydrationState.removeAudioUrl.mockReset();
    saveAudioBlobMock.mockReset();
    deleteRecordingBlobMock.mockReset();
    getAudioStorageEstimateMock.mockReset();
    listStoredSizesMock.mockReset();
    hardwareState.startRecording.mockReset();
    hardwareState.cleanupRecorder.mockReset();
    hardwareState.isRecording = false;
    getAudioStorageEstimateMock.mockResolvedValue({
      usageBytes: 50 * 1024 * 1024,
      quotaBytes: 100 * 1024 * 1024,
      freeBytes: 50 * 1024 * 1024,
      usageRatio: 0.5,
      isNearQuota: false,
    });
    listStoredSizesMock.mockResolvedValue([]);
  });

  test('creates ad hoc meeting when no meeting is selected and starts recording', () => {
    const createAdHocMeeting = vi.fn(() => ({ id: 'meeting-ad-hoc' }));
    const selectMeeting = vi.fn();

    const { result } = renderHook(() =>
      useRecorder({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting,
        attachCompletedRecording: vi.fn(),
        isHydratingRemoteState: false,
        selectMeeting,
      })
    );

    act(() => {
      result.current.startRecording();
    });

    expect(createAdHocMeeting).toHaveBeenCalledTimes(1);
    expect(selectMeeting).toHaveBeenCalledWith({ id: 'meeting-ad-hoc' });
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
    saveAudioBlobMock.mockRejectedValue(new Error('QuotaExceededError'));

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
    expect(pipelineState.setRecordingMessage).toHaveBeenCalledWith(
      'Nie udalo sie zapisac pliku do kolejki.'
    );
  });

  test('startRecording is a no-op when createAdHocMeeting returns null', () => {
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
      })
    );

    act(() => {
      result.current.startRecording();
    });

    expect(createAdHocMeeting).toHaveBeenCalledTimes(1);
    // startRecording on hardware should not be called when no meeting was created
    expect(hardwareState.startRecording).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — Import fails with "Nie znaleziono spotkania"
  // Date: 2026-03-30
  // Bug: createMeetingDirect adds meeting to state synchronously but
  //      userMeetingsRef is updated only after React re-render (useEffect).
  //      queueRecording called immediately after couldn't find the meeting.
  // Fix: queueRecording accepts optional meetingHint (3rd arg) as fallback.
  // ─────────────────────────────────────────────────────────────────
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
});
