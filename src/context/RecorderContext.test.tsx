/**
 * @vitest-environment jsdom
 * RecorderContext Tests
 *
 * Tests for RecorderContext provider and hook
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { RecorderProvider, useRecorderCtx } from './RecorderContext';

// Mock hooks
const mockRecorderHook = vi.hoisted(() => ({
  default: vi.fn(() => ({
    isRecording: false,
    recordingMeetingId: null,
    currentSegments: [],
    audioUrls: {},
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
  })),
}));

const mockMeetingsHook = vi.hoisted(() => ({
  default: vi.fn(() => ({
    selectedMeeting: null,
    userMeetings: [],
    isHydratingRemoteState: false,
    createAdHocMeeting: vi.fn(),
    attachCompletedRecording: vi.fn(),
    selectMeeting: vi.fn(),
  })),
}));

vi.mock('../hooks/useRecorder', () => mockRecorderHook);
vi.mock('../hooks/useMeetings', () => mockMeetingsHook);

describe('RecorderContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RecorderProvider', () => {
    it('renders children without crashing', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current).toBeDefined();
    });

    it('provides recorder context value', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current).toBeDefined();
    });

    it('calls useMeetings hook', () => {
      renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(mockMeetingsHook.default).toHaveBeenCalled();
    });

    it('calls useRecorder hook with meetings data', () => {
      renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(mockRecorderHook.default).toHaveBeenCalledWith({
        selectedMeeting: null,
        userMeetings: [],
        createAdHocMeeting: expect.any(Function),
        attachCompletedRecording: expect.any(Function),
        isHydratingRemoteState: false,
        selectMeeting: expect.any(Function),
      });
    });

    it('provides isRecording state', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.isRecording).toBe(false);
    });

    it('provides recordingMeetingId', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.recordingMeetingId).toBeNull();
    });

    it('provides currentSegments', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.currentSegments).toEqual([]);
    });

    it('provides audioUrls', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.audioUrls).toEqual({});
    });

    it('provides startRecording method', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.startRecording).toBeDefined();
      expect(typeof result.current.startRecording).toBe('function');
    });

    it('provides stopRecording method', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.stopRecording).toBeDefined();
      expect(typeof result.current.stopRecording).toBe('function');
    });

    it('provides pauseRecording method', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.pauseRecording).toBeDefined();
      expect(typeof result.current.pauseRecording).toBe('function');
    });

    it('provides resumeRecording method', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.resumeRecording).toBeDefined();
      expect(typeof result.current.resumeRecording).toBe('function');
    });

    it('passes selectedMeeting from meetings to useRecorder', () => {
      mockMeetingsHook.default.mockReturnValueOnce({
        selectedMeeting: { id: 'm1', title: 'Test Meeting' },
        userMeetings: [],
        isHydratingRemoteState: false,
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        selectMeeting: vi.fn(),
      });

      renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(mockRecorderHook.default).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedMeeting: { id: 'm1', title: 'Test Meeting' },
        })
      );
    });

    it('passes userMeetings from meetings to useRecorder', () => {
      const userMeetings = [{ id: 'm1', title: 'Meeting 1' }];
      mockMeetingsHook.default.mockReturnValueOnce({
        selectedMeeting: null,
        userMeetings,
        isHydratingRemoteState: false,
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        selectMeeting: vi.fn(),
      });

      renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(mockRecorderHook.default).toHaveBeenCalledWith(
        expect.objectContaining({ userMeetings })
      );
    });

    it('passes isHydratingRemoteState from meetings to useRecorder', () => {
      mockMeetingsHook.default.mockReturnValueOnce({
        selectedMeeting: null,
        userMeetings: [],
        isHydratingRemoteState: true,
        createAdHocMeeting: vi.fn(),
        attachCompletedRecording: vi.fn(),
        selectMeeting: vi.fn(),
      });

      renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(mockRecorderHook.default).toHaveBeenCalledWith(
        expect.objectContaining({ isHydratingRemoteState: true })
      );
    });
  });

  describe('useRecorderCtx', () => {
    it('returns safe defaults when used outside RecorderProvider', () => {
      const { result } = renderHook(() => useRecorderCtx());

      expect(result.current).toBeDefined();
      expect(result.current.recordingState).toBeNull();
      expect(typeof result.current.startRecording).toBe('function');
    });

    it('returns recorder context when used within RecorderProvider', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current.isRecording).toBeDefined();
      expect(result.current.startRecording).toBeDefined();
    });
  });

  describe('integration', () => {
    it('provides all recorder methods', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(result.current).toHaveProperty('isRecording');
      expect(result.current).toHaveProperty('recordingMeetingId');
      expect(result.current).toHaveProperty('currentSegments');
      expect(result.current).toHaveProperty('audioUrls');
      expect(result.current).toHaveProperty('startRecording');
      expect(result.current).toHaveProperty('stopRecording');
      expect(result.current).toHaveProperty('pauseRecording');
      expect(result.current).toHaveProperty('resumeRecording');
    });

    it('can call recording methods', () => {
      const { result } = renderHook(() => useRecorderCtx(), {
        wrapper: RecorderProvider,
      });

      expect(() => result.current.startRecording()).not.toThrow();
      expect(() => result.current.stopRecording()).not.toThrow();
      expect(() => result.current.pauseRecording()).not.toThrow();
      expect(() => result.current.resumeRecording()).not.toThrow();
    });
  });
});
