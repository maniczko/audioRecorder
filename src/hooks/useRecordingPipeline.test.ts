/**
 * @vitest-environment jsdom
 * useRecordingPipeline Hook Tests
 *
 * Tests for recording pipeline state management
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import useRecordingPipeline from './useRecordingPipeline';

// Mock store
const mockRecordingPipelineStore = vi.hoisted(() => ({
  recordingQueue: [],
  analysisStatus: 'idle',
  pipelineProgressPercent: 0,
  pipelineStageLabel: '',
  recordingMessage: '',
  setRecordingQueue: vi.fn(),
  setAnalysisStatus: vi.fn(),
  setPipelineProgress: vi.fn(),
  setRecordingMessage: vi.fn(),
  retryRecordingQueueItem: vi.fn(),
  updateQueueItem: vi.fn(),
  removeQueueItem: vi.fn(),
}));

vi.mock('../store/recordingPipelineStore', () => ({
  useRecordingPipelineStore: () => mockRecordingPipelineStore,
}));

describe('useRecordingPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns recording queue state', () => {
    const { result } = renderHook(() => useRecordingPipeline());

    expect(result.current.recordingQueue).toEqual([]);
    expect(result.current.analysisStatus).toBe('idle');
    expect(result.current.pipelineProgressPercent).toBe(0);
    expect(result.current.pipelineStageLabel).toBe('');
    expect(result.current.recordingMessage).toBe('');
  });

  it('returns queue management methods', () => {
    const { result } = renderHook(() => useRecordingPipeline());

    expect(result.current.setRecordingQueue).toBeDefined();
    expect(result.current.setAnalysisStatus).toBeDefined();
    expect(result.current.setPipelineProgress).toBeDefined();
    expect(result.current.setRecordingMessage).toBeDefined();
    expect(result.current.retryRecordingQueueItem).toBeDefined();
    expect(result.current.updateQueueItem).toBeDefined();
    expect(result.current.removeQueueItem).toBeDefined();
  });

  it('returns getMeetingQueue method', () => {
    const { result } = renderHook(() => useRecordingPipeline());

    expect(result.current.getMeetingQueue).toBeDefined();
    expect(typeof result.current.getMeetingQueue).toBe('function');
  });

  it('getMeetingQueue filters queue by meeting ID', () => {
    mockRecordingPipelineStore.recordingQueue = [
      { meetingId: 'm1', id: 'r1', status: 'pending' },
      { meetingId: 'm2', id: 'r2', status: 'processing' },
      { meetingId: 'm1', id: 'r3', status: 'completed' },
    ];

    const { result } = renderHook(() => useRecordingPipeline());

    const meeting1Queue = result.current.getMeetingQueue('m1');
    const meeting2Queue = result.current.getMeetingQueue('m2');

    expect(meeting1Queue).toHaveLength(2);
    expect(meeting2Queue).toHaveLength(1);
  });

  it('getMeetingQueue returns empty array for unknown meeting', () => {
    mockRecordingPipelineStore.recordingQueue = [{ meetingId: 'm1', id: 'r1', status: 'pending' }];

    const { result } = renderHook(() => useRecordingPipeline());

    const unknownQueue = result.current.getMeetingQueue('unknown');

    expect(unknownQueue).toEqual([]);
  });

  describe('setAnalysisStatus', () => {
    it('sets analysis status', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      act(() => {
        result.current.setAnalysisStatus('analyzing');
      });

      expect(mockRecordingPipelineStore.setAnalysisStatus).toHaveBeenCalledWith('analyzing');
    });

    it('accepts different status values', () => {
      const { result } = renderHook(() => useRecordingPipeline());

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

      expect(mockRecordingPipelineStore.setAnalysisStatus).toHaveBeenCalledTimes(4);
    });
  });

  describe('setPipelineProgress', () => {
    it('sets pipeline progress', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      act(() => {
        result.current.setPipelineProgress(50, 'Transcribing');
      });

      expect(mockRecordingPipelineStore.setPipelineProgress).toHaveBeenCalledWith(
        50,
        'Transcribing'
      );
    });

    it('accepts progress without label', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      act(() => {
        result.current.setPipelineProgress(75);
      });

      expect(mockRecordingPipelineStore.setPipelineProgress).toHaveBeenCalledWith(75, undefined);
    });
  });

  describe('setRecordingMessage', () => {
    it('sets recording message', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      act(() => {
        result.current.setRecordingMessage('Processing...');
      });

      expect(mockRecordingPipelineStore.setRecordingMessage).toHaveBeenCalledWith('Processing...');
    });

    it('clears message with empty string', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      act(() => {
        result.current.setRecordingMessage('');
      });

      expect(mockRecordingPipelineStore.setRecordingMessage).toHaveBeenCalledWith('');
    });
  });

  describe('updateQueueItem', () => {
    it('updates queue item by ID', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      act(() => {
        result.current.updateQueueItem('r1', { status: 'completed' });
      });

      expect(mockRecordingPipelineStore.updateQueueItem).toHaveBeenCalledWith('r1', {
        status: 'completed',
      });
    });
  });

  describe('removeQueueItem', () => {
    it('removes queue item by ID', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      act(() => {
        result.current.removeQueueItem('r1');
      });

      expect(mockRecordingPipelineStore.removeQueueItem).toHaveBeenCalledWith('r1');
    });
  });

  describe('retryRecordingQueueItem', () => {
    it('retries failed queue item', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      act(() => {
        result.current.retryRecordingQueueItem('r1');
      });

      expect(mockRecordingPipelineStore.retryRecordingQueueItem).toHaveBeenCalledWith('r1');
    });
  });

  describe('setRecordingQueue', () => {
    it('sets new recording queue', () => {
      const { result } = renderHook(() => useRecordingPipeline());

      const newQueue = [
        { id: 'r1', meetingId: 'm1', status: 'pending' },
        { id: 'r2', meetingId: 'm1', status: 'processing' },
      ];

      act(() => {
        result.current.setRecordingQueue(newQueue);
      });

      expect(mockRecordingPipelineStore.setRecordingQueue).toHaveBeenCalledWith(newQueue);
    });
  });

  describe('state updates', () => {
    it('reflects updated queue state', () => {
      mockRecordingPipelineStore.recordingQueue = [
        { id: 'r1', meetingId: 'm1', status: 'completed' },
      ];

      const { result } = renderHook(() => useRecordingPipeline());

      expect(result.current.recordingQueue).toEqual([
        { id: 'r1', meetingId: 'm1', status: 'completed' },
      ]);
    });

    it('reflects updated analysis status', () => {
      mockRecordingPipelineStore.analysisStatus = 'analyzing';

      const { result } = renderHook(() => useRecordingPipeline());

      expect(result.current.analysisStatus).toBe('analyzing');
    });

    it('reflects updated progress', () => {
      mockRecordingPipelineStore.pipelineProgressPercent = 75;
      mockRecordingPipelineStore.pipelineStageLabel = 'Diarization';

      const { result } = renderHook(() => useRecordingPipeline());

      expect(result.current.pipelineProgressPercent).toBe(75);
      expect(result.current.pipelineStageLabel).toBe('Diarization');
    });

    it('reflects updated message', () => {
      mockRecordingPipelineStore.recordingMessage = 'Uploading...';

      const { result } = renderHook(() => useRecordingPipeline());

      expect(result.current.recordingMessage).toBe('Uploading...');
    });
  });
});
