import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import useRecordingPipeline from './useRecordingPipeline';

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    recordingQueue: [],
    analysisStatus: 'idle',
    recordingMessage: '',
    pipelineProgressPercent: 0,
    pipelineStageLabel: '',
    isProcessingQueue: false,
    processQueue: vi.fn().mockResolvedValue(undefined),
    setAnalysisStatus: vi.fn(),
    setPipelineProgress: vi.fn(),
    setRecordingMessage: vi.fn(),
    retryRecordingQueueItem: vi.fn(),
    updateQueueItem: vi.fn(),
    removeQueueItem: vi.fn(),
    setRecordingQueue: vi.fn(),
  },
}));

vi.mock('../store/recorderStore', () => ({
  useRecorderStore: () => mockStore,
}));

vi.mock('../lib/recordingQueue', () => ({
  buildRecordingQueueSummary: vi.fn((queue) => ({ total: queue.length })),
  getRecordingQueueForMeeting: vi.fn((queue, meetingId) =>
    queue.filter((item) => item.meetingId === meetingId)
  ),
}));

describe('useRecordingPipeline', () => {
  beforeEach(() => {
    mockStore.recordingQueue = [];
    mockStore.analysisStatus = 'idle';
    mockStore.recordingMessage = '';
    mockStore.pipelineProgressPercent = 0;
    mockStore.pipelineStageLabel = '';
    mockStore.isProcessingQueue = false;
    mockStore.processQueue.mockClear();
  });

  test('triggers queue processing when hydration is finished', () => {
    const userMeetingsRef = { current: [{ id: 'm1', title: 'Demo' }] };
    const attachCompletedRecording = vi.fn();
    const setCurrentSegments = vi.fn();

    mockStore.recordingQueue = [{ recordingId: 'r1', meetingId: 'm1' }];

    renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef,
        attachCompletedRecording,
        setCurrentSegments,
        isHydratingRemoteState: false,
      })
    );

    expect(mockStore.processQueue).toHaveBeenCalledWith(
      expect.any(Function),
      attachCompletedRecording,
      setCurrentSegments
    );
  });

  test('does not process queue while remote state is hydrating', () => {
    const userMeetingsRef = { current: [{ id: 'm1', title: 'Demo' }] };

    renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef,
        attachCompletedRecording: vi.fn(),
        setCurrentSegments: vi.fn(),
        isHydratingRemoteState: true,
      })
    );

    expect(mockStore.processQueue).not.toHaveBeenCalled();
  });

  test('re-triggers processQueue when hydration transitions from true to false', () => {
    const userMeetingsRef = { current: [{ id: 'm1' }] };

    const { rerender } = renderHook(
      ({ isHydrating }) =>
        useRecordingPipeline({
          userMeetingsRef,
          attachCompletedRecording: vi.fn(),
          setCurrentSegments: vi.fn(),
          isHydratingRemoteState: isHydrating,
        }),
      { initialProps: { isHydrating: true } }
    );

    expect(mockStore.processQueue).not.toHaveBeenCalled();

    rerender({ isHydrating: false });

    expect(mockStore.processQueue).toHaveBeenCalled();
  });

  test('resolveMeetingForQueueItem finds meeting from userMeetingsRef', () => {
    const userMeetingsRef = { current: [{ id: 'm1', title: 'Demo Meeting' }] };
    const attachCompletedRecording = vi.fn();
    const setCurrentSegments = vi.fn();

    mockStore.recordingQueue = [{ recordingId: 'r1', meetingId: 'm1' }];

    renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef,
        attachCompletedRecording,
        setCurrentSegments,
        isHydratingRemoteState: false,
      })
    );

    // processQueue was called with resolveMeetingForQueueItem as first arg
    const resolveFunction = mockStore.processQueue.mock.calls[0][0];
    const resolved = resolveFunction({ meetingId: 'm1' });
    expect(resolved).toEqual({ id: 'm1', title: 'Demo Meeting' });
  });

  test('resolveMeetingForQueueItem falls back to meetingSnapshot when meeting not found', () => {
    const userMeetingsRef = { current: [] };

    mockStore.recordingQueue = [
      {
        recordingId: 'r1',
        meetingId: 'm_gone',
        meetingSnapshot: { id: 'm_gone', title: 'Snapshot' },
      },
    ];

    renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef,
        attachCompletedRecording: vi.fn(),
        setCurrentSegments: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const resolveFunction = mockStore.processQueue.mock.calls[0][0];
    const resolved = resolveFunction({
      meetingId: 'm_gone',
      meetingSnapshot: { id: 'm_gone', title: 'Snapshot' },
    });
    expect(resolved).toEqual({ id: 'm_gone', title: 'Snapshot' });
  });

  test('resolveMeetingForQueueItem returns null when meeting and snapshot both absent', () => {
    const userMeetingsRef = { current: [] };

    mockStore.recordingQueue = [{ recordingId: 'r1', meetingId: 'm_none' }];

    renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef,
        attachCompletedRecording: vi.fn(),
        setCurrentSegments: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    const resolveFunction = mockStore.processQueue.mock.calls[0][0];
    const resolved = resolveFunction({ meetingId: 'm_none' });
    expect(resolved).toBeNull();
  });

  test('exposes queue summary and meeting-specific queue accessors', () => {
    mockStore.recordingQueue = [
      { recordingId: 'r1', meetingId: 'm1' },
      { recordingId: 'r2', meetingId: 'm2' },
    ];

    const { result } = renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef: { current: [] },
        attachCompletedRecording: vi.fn(),
        setCurrentSegments: vi.fn(),
        isHydratingRemoteState: false,
      })
    );

    expect(result.current.queueSummary).toBeDefined();
    expect(result.current.getMeetingQueue).toBeDefined();
    expect(result.current.pipelineProgressPercent).toBeDefined();
    expect(result.current.pipelineStageLabel).toBeDefined();
  });
});
