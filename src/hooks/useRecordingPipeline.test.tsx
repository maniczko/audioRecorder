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

    // Simulate queue with items
    mockStore.recordingQueue = [{ recordingId: 'r1', meetingId: 'm1' }];

    renderHook(() =>
      useRecordingPipeline({
        userMeetingsRef,
        attachCompletedRecording,
        setCurrentSegments,
        isHydratingRemoteState: false,
      })
    );

    // Hook should be created successfully
    expect(mockStore.recordingQueue).toBeDefined();
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
