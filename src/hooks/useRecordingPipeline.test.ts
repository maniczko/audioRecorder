/**
 * @vitest-environment jsdom
 * useRecordingPipeline Hook Tests
 *
 * Tests for recording pipeline state management
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import useRecordingPipeline from './useRecordingPipeline';

// Mock store (must match recorderStore shape)
const mockRecorderStore = vi.hoisted(() => ({
  recordingQueue: [],
  analysisStatus: 'idle',
  pipelineProgressPercent: 0,
  pipelineStageLabel: '',
  recordingMessage: '',
  isProcessingQueue: false,
  setRecordingQueue: vi.fn(),
  setAnalysisStatus: vi.fn(),
  setPipelineProgress: vi.fn(),
  setRecordingMessage: vi.fn(),
  retryRecordingQueueItem: vi.fn(),
  retryStoredRecording: vi.fn(),
  updateQueueItem: vi.fn(),
  removeQueueItem: vi.fn(),
  processQueue: vi.fn(),
}));

vi.mock('../store/recorderStore', () => ({
  useRecorderStore: () => mockRecorderStore,
}));

const mockBuildSummary = vi.hoisted(() =>
  vi.fn(() => ({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }))
);
const mockGetMeetingQueue = vi.hoisted(() => vi.fn(() => []));

vi.mock('../lib/recordingQueue', () => ({
  buildRecordingQueueSummary: mockBuildSummary,
  getRecordingQueueForMeeting: mockGetMeetingQueue,
}));

// Default hook params
const defaultParams = {
  userMeetingsRef: { current: [] },
  attachCompletedRecording: vi.fn(),
  setCurrentSegments: vi.fn(),
  isHydratingRemoteState: false,
};

describe('useRecordingPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    mockRecorderStore.recordingQueue = [];
    mockRecorderStore.analysisStatus = 'idle';
    mockRecorderStore.pipelineProgressPercent = 0;
    mockRecorderStore.pipelineStageLabel = '';
    mockRecorderStore.recordingMessage = '';
    mockRecorderStore.isProcessingQueue = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns recording queue state', () => {
    const { result } = renderHook(() => useRecordingPipeline(defaultParams));

    expect(result.current.recordingQueue).toEqual([]);
    expect(result.current.analysisStatus).toBe('idle');
    expect(result.current.pipelineProgressPercent).toBe(0);
    expect(result.current.pipelineStageLabel).toBe('');
    expect(result.current.recordingMessage).toBe('');
  });

  it('returns queue management methods', () => {
    const { result } = renderHook(() => useRecordingPipeline(defaultParams));

    expect(result.current.setRecordingQueue).toBeDefined();
    expect(result.current.setAnalysisStatus).toBeDefined();
    expect(result.current.setPipelineProgress).toBeDefined();
    expect(result.current.setRecordingMessage).toBeDefined();
    expect(result.current.retryRecordingQueueItem).toBeDefined();
    expect(result.current.updateQueueItem).toBeDefined();
    expect(result.current.removeQueueItem).toBeDefined();
  });

  it('returns getMeetingQueue method', () => {
    const { result } = renderHook(() => useRecordingPipeline(defaultParams));

    expect(result.current.getMeetingQueue).toBeDefined();
    expect(typeof result.current.getMeetingQueue).toBe('function');
  });

  it('getMeetingQueue delegates to getRecordingQueueForMeeting', () => {
    const filtered = [{ meetingId: 'm1', id: 'r1', status: 'pending' }];
    mockGetMeetingQueue.mockReturnValue(filtered);

    const { result } = renderHook(() => useRecordingPipeline(defaultParams));
    const queue = result.current.getMeetingQueue('m1');

    expect(mockGetMeetingQueue).toHaveBeenCalledWith([], 'm1');
    expect(queue).toEqual(filtered);
  });

  it('getMeetingQueue returns empty array for unknown meeting', () => {
    mockGetMeetingQueue.mockReturnValue([]);

    const { result } = renderHook(() => useRecordingPipeline(defaultParams));
    const unknownQueue = result.current.getMeetingQueue('unknown');

    expect(unknownQueue).toEqual([]);
  });

  describe('setAnalysisStatus', () => {
    it('sets analysis status', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.setAnalysisStatus('analyzing');
      });

      expect(mockRecorderStore.setAnalysisStatus).toHaveBeenCalledWith('analyzing');
    });

    it('accepts different status values', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.setAnalysisStatus('idle');
      });
      act(() => {
        result.current.setAnalysisStatus('analyzing');
      });
      act(() => {
        result.current.setAnalysisStatus('completed');
      });
      act(() => {
        result.current.setAnalysisStatus('failed');
      });

      expect(mockRecorderStore.setAnalysisStatus).toHaveBeenCalledTimes(4);
    });
  });

  describe('setPipelineProgress', () => {
    it('sets pipeline progress', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.setPipelineProgress(50, 'Transcribing');
      });

      expect(mockRecorderStore.setPipelineProgress).toHaveBeenCalledWith(50, 'Transcribing');
    });

    it('accepts progress without label', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.setPipelineProgress(75);
      });

      expect(mockRecorderStore.setPipelineProgress).toHaveBeenCalledWith(75);
    });
  });

  describe('setRecordingMessage', () => {
    it('sets recording message', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.setRecordingMessage('Processing...');
      });

      expect(mockRecorderStore.setRecordingMessage).toHaveBeenCalledWith('Processing...');
    });

    it('clears message with empty string', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.setRecordingMessage('');
      });

      expect(mockRecorderStore.setRecordingMessage).toHaveBeenCalledWith('');
    });
  });

  describe('updateQueueItem', () => {
    it('updates queue item by ID', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.updateQueueItem('r1', { status: 'completed' });
      });

      expect(mockRecorderStore.updateQueueItem).toHaveBeenCalledWith('r1', {
        status: 'completed',
      });
    });
  });

  describe('removeQueueItem', () => {
    it('removes queue item by ID', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.removeQueueItem('r1');
      });

      expect(mockRecorderStore.removeQueueItem).toHaveBeenCalledWith('r1');
    });
  });

  describe('retryRecordingQueueItem', () => {
    it('retries failed queue item', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      act(() => {
        result.current.retryRecordingQueueItem('r1');
      });

      expect(mockRecorderStore.retryRecordingQueueItem).toHaveBeenCalledWith('r1');
    });
  });

  describe('setRecordingQueue', () => {
    it('sets new recording queue', () => {
      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      const newQueue = [
        { id: 'r1', meetingId: 'm1', status: 'pending' },
        { id: 'r2', meetingId: 'm1', status: 'processing' },
      ];

      act(() => {
        result.current.setRecordingQueue(newQueue);
      });

      expect(mockRecorderStore.setRecordingQueue).toHaveBeenCalledWith(newQueue);
    });
  });

  describe('state updates', () => {
    it('reflects updated queue state', () => {
      mockRecorderStore.recordingQueue = [{ id: 'r1', meetingId: 'm1', status: 'completed' }];

      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      expect(result.current.recordingQueue).toEqual([
        { id: 'r1', meetingId: 'm1', status: 'completed' },
      ]);
    });

    it('reflects updated analysis status', () => {
      mockRecorderStore.analysisStatus = 'analyzing';

      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      expect(result.current.analysisStatus).toBe('analyzing');
    });

    it('reflects updated progress', () => {
      mockRecorderStore.pipelineProgressPercent = 75;
      mockRecorderStore.pipelineStageLabel = 'Diarization';

      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      expect(result.current.pipelineProgressPercent).toBe(75);
      expect(result.current.pipelineStageLabel).toBe('Diarization');
    });

    it('reflects updated message', () => {
      mockRecorderStore.recordingMessage = 'Uploading...';

      const { result } = renderHook(() => useRecordingPipeline(defaultParams));

      expect(result.current.recordingMessage).toBe('Uploading...');
    });
  });

  describe('processQueue', () => {
    it('calls processQueue on mount when not hydrating', () => {
      renderHook(() => useRecordingPipeline(defaultParams));

      expect(mockRecorderStore.processQueue).toHaveBeenCalled();
    });

    it('skips processQueue when hydrating remote state', () => {
      renderHook(() => useRecordingPipeline({ ...defaultParams, isHydratingRemoteState: true }));

      expect(mockRecorderStore.processQueue).not.toHaveBeenCalled();
    });
  });
});
