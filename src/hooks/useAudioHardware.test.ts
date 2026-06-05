import { act, renderHook } from '@testing-library/react';
import { DEFAULT_BARS } from '../lib/recording';
import useAudioHardware from './useAudioHardware';

describe('useAudioHardware', () => {
  let originalMediaDevices;
  let originalMediaRecorder;
  let originalAudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    originalMediaDevices = navigator.mediaDevices;
    originalMediaRecorder = global.MediaRecorder;
    originalAudioContext = global.AudioContext || global.webkitAudioContext;

    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    };

    global.MediaRecorder = class {
      constructor() {
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
      static isTypeSupported() {
        return true;
      }
    };

    global.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          frequencyBinCount: 1024,
          getByteFrequencyData: vi.fn(),
          connect: vi.fn(),
        };
      }
      createMediaStreamDestination() {
        return { stream: {} };
      }
      close() {
        return Promise.resolve();
      }
    };
  });

  afterEach(() => {
    navigator.mediaDevices = originalMediaDevices;
    global.MediaRecorder = originalMediaRecorder;
    global.AudioContext = originalAudioContext;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test('starts and stops recording', async () => {
    const onRecordingStop = vi.fn();
    const mockMediaService = {
      createLiveController: () => ({
        setOnEnd: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        clearHandlers: vi.fn(),
      }),
    };

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: mockMediaService,
        onRecordingStop,
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(result.current.isRecording).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(onRecordingStop).toHaveBeenCalled();
  });

  test('shows error message when microphone permission is denied', async () => {
    const onMessageChange = vi.fn();
    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange,
      })
    );

    // Simulate denied permission
    act(() => {
      // Set permission to denied by calling startRecording when getUserMedia rejects
    });

    // Override to simulate denied state by forcing the state
    Object.defineProperty(result.current, 'recordPermission', { value: 'denied', writable: true });

    // Instead, test what happens when getUserMedia throws
    navigator.mediaDevices.getUserMedia = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
      );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(onMessageChange).toHaveBeenCalled();
    const message = onMessageChange.mock.calls.find((c) => c[0].length > 0);
    expect(message).toBeTruthy();
  });

  test('calls onStartFailure and keeps idle state when recording start fails', async () => {
    const onStartFailure = vi.fn();
    const onMessageChange = vi.fn();
    navigator.mediaDevices.getUserMedia = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
      );

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange,
        onStartFailure,
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(onStartFailure).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.recordPermission).toBe('denied');
  });

  test('retries microphone access with relaxed constraints after OverconstrainedError', async () => {
    const relaxedStream = {
      getTracks: () => [{ stop: vi.fn() }],
    };
    const getUserMediaMock = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Unsupported constraints'), { name: 'OverconstrainedError' })
      )
      .mockResolvedValueOnce(relaxedStream);
    navigator.mediaDevices.getUserMedia = getUserMediaMock;

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(getUserMediaMock).toHaveBeenCalledTimes(2);
    expect(getUserMediaMock).toHaveBeenNthCalledWith(2, { audio: true });
    expect(result.current.isRecording).toBe(true);
    expect(result.current.recordPermission).toBe('granted');
  });

  test('shows error when getUserMedia is not available', async () => {
    navigator.mediaDevices = { getUserMedia: undefined } as any;
    const onMessageChange = vi.fn();

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange,
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(onMessageChange).toHaveBeenCalledWith(expect.stringContaining('nie obsĹ‚uguje'));
  });

  test('shows error when MediaRecorder is not available', async () => {
    delete global.MediaRecorder;
    const onMessageChange = vi.fn();

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange,
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(onMessageChange).toHaveBeenCalledWith(expect.stringContaining('MediaRecorder'));
  });

  test('startRecording times out and marks setup as recoverable retry state', async () => {
    const onMessageChange = vi.fn();
    const onStartFailure = vi.fn();
    navigator.mediaDevices.getUserMedia = vi.fn().mockImplementation(
      () =>
        new Promise((_resolve) => {
          // never resolves - timeout branch should recover
        })
    );

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange,
        onStartFailure,
      })
    );

    const startPromise = result.current.startRecording('m1');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
      await startPromise;
    });

    expect(onStartFailure).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.recordPermission).toBe('loading');
    expect(result.current.voiceActivityStatus).toBe('unsupported');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    expect(onMessageChange).toHaveBeenCalledWith(expect.any(String));
  });

  test('pause and resume recording', async () => {
    const mockMediaService = {
      createLiveController: () => ({
        setOnEnd: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        clearHandlers: vi.fn(),
      }),
    };

    global.MediaRecorder = class {
      constructor() {
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
      pause() {
        this.state = 'paused';
      }
      resume() {
        this.state = 'recording';
      }
      static isTypeSupported() {
        return true;
      }
    };

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: mockMediaService,
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.isPaused).toBe(false);

    act(() => {
      result.current.pauseRecording();
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      result.current.resumeRecording();
    });

    expect(result.current.isPaused).toBe(false);
    expect(result.current.isRecording).toBe(true);

    act(() => {
      result.current.stopRecording();
    });
  });

  test('cleanupRecorder resets state without crash', async () => {
    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange: vi.fn(),
      })
    );

    // Should not throw even when nothing is initialized
    act(() => {
      result.current.cleanupRecorder();
    });

    expect(result.current.voiceActivityStatus).toBe('unsupported');
  });

  test('stopRecording calls stream/audio cleanup and finalizes recording state', async () => {
    const trackStop = vi.fn();
    const audioContextClose = vi.fn().mockResolvedValue(undefined);
    const onRecordingStop = vi.fn();
    const onSegmentsChange = vi.fn();
    const onInterimChange = vi.fn();
    const onMessageChange = vi.fn();

    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: trackStop }],
      }),
    } as any;

    global.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          frequencyBinCount: 1024,
          getByteFrequencyData: vi.fn(),
          connect: vi.fn(),
        };
      }
      createMediaStreamDestination() {
        return { stream: {} };
      }
      close() {
        return audioContextClose();
      }
    };

    global.MediaRecorder = class {
      constructor() {
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
      static isTypeSupported() {
        return true;
      }
      state: string;
      mimeType: string;
      onstop?: () => void;
      ondataavailable?: (e: { data: Blob }) => void;
    };

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: {
          createLiveController: () => ({
            setOnEnd: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            clearHandlers: vi.fn(),
          }),
        },
        onRecordingStop,
        onSegmentsChange,
        onInterimChange,
        onMessageChange,
      })
    );

    await act(async () => {
      await result.current.startRecording('meeting-stop-cleanup');
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.recordPermission).toBe('granted');

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(audioContextClose).toHaveBeenCalledTimes(1);
    expect(result.current.voiceActivityStatus).toBe('unsupported');
    expect(result.current.recordPermission).toBe('granted');
    expect(onRecordingStop).toHaveBeenCalledTimes(1);
    expect(onRecordingStop).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: 'meeting-stop-cleanup',
        chunks: expect.any(Array),
        duration: expect.any(Number),
      })
    );
  });

  test('resetSilenceTimer clears countdown', async () => {
    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange: vi.fn(),
        silenceAutoStopMinutes: 3,
      })
    );

    act(() => {
      result.current.resetSilenceTimer();
    });

    expect(result.current.silenceCountdown).toBeNull();
  });

  test('auto-stops recording after silence timeout and performs cleanup', async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame');
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const nowState = { current: Date.now() };
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowState.current);
    const rafQueue: FrameRequestCallback[] = [];

    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    }) as any;
    window.cancelAnimationFrame = vi.fn();

    const onRecordingStop = vi.fn();
    const onSegmentsChange = vi.fn();
    const onInterimChange = vi.fn();
    const onMessageChange = vi.fn();

    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    } as any;

    global.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          frequencyBinCount: 1024,
          getByteFrequencyData: vi.fn((frequencyData: Uint8Array) => {
            frequencyData.fill(0);
          }),
          connect: vi.fn(),
        };
      }
      createMediaStreamDestination() {
        return { stream: {} };
      }
      close() {
        return Promise.resolve();
      }
    };

    global.MediaRecorder = class {
      constructor() {
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) {
          this.onstop();
        }
      }
      static isTypeSupported() {
        return true;
      }
      state: string;
      mimeType: string;
      onstop?: () => void;
      ondataavailable?: (e: { data: Blob }) => void;
    };

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: {
          createLiveController: () => ({
            setOnEnd: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            clearHandlers: vi.fn(),
          }),
        },
        onRecordingStop,
        onSegmentsChange,
        onInterimChange,
        onMessageChange,
        silenceAutoStopMinutes: 0.001,
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    for (let i = 0; i < 200; i += 1) {
      act(() => {
        const nextFrame = rafQueue.shift();
        if (nextFrame) {
          nextFrame(performance.now());
        }
      });
      act(() => {
        nowState.current += 50;
        vi.advanceTimersByTime(50);
      });
      if (onRecordingStop.mock.calls.length > 0) {
        break;
      }
    }

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(onRecordingStop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(onRecordingStop.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        meetingId: 'm1',
        duration: expect.any(Number),
      })
    );
    expect(result.current.recordPermission).toBe('granted');
    expect(result.current.voiceActivityStatus).toBe('unsupported');
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();

    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    nowSpy.mockRestore();
  });

  test('onRecordingStop receives correct data shape', async () => {
    const onRecordingStop = vi.fn();
    const mockMediaService = {
      createLiveController: () => ({
        setOnEnd: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        clearHandlers: vi.fn(),
      }),
    };

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: mockMediaService,
        onRecordingStop,
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange: vi.fn(),
      })
    );

    await act(async () => {
      await result.current.startRecording('test_meeting');
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(onRecordingStop).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: 'test_meeting',
        chunks: expect.any(Array),
        mimeType: expect.any(String),
        rawSegments: expect.any(Array),
        duration: expect.any(Number),
      })
    );
  });

  test('cleanupRecorder is invoked when recorder setup fails', async () => {
    const trackStop = vi.fn();
    const onStartFailure = vi.fn();
    const onMessageChange = vi.fn();

    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: trackStop }],
      }),
    } as any;

    global.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          frequencyBinCount: 1024,
          getByteFrequencyData: vi.fn(),
          connect: vi.fn(),
        };
      }
      createMediaStreamDestination() {
        return { stream: {} };
      }
      close() {
        return Promise.resolve();
      }
    };

    global.MediaRecorder = class {
      constructor() {
        throw new Error('MediaRecorder init failed');
      }
    };

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: vi.fn() } as any,
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange,
        onStartFailure,
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(onStartFailure).toHaveBeenCalledTimes(1);
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(result.current.recordPermission).not.toBe('denied');
    expect(onMessageChange).toHaveBeenCalled();
  });

  test('releases stream/audio resources when recognition controller initialization fails', async () => {
    const trackStop = vi.fn();
    const audioContextClose = vi.fn().mockResolvedValue(undefined);
    const onStartFailure = vi.fn();
    const onMessageChange = vi.fn();

    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: trackStop }],
      }),
    } as any;

    global.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          frequencyBinCount: 1024,
          getByteFrequencyData: vi.fn(),
          connect: vi.fn(),
        };
      }
      createMediaStreamDestination() {
        return { stream: {} };
      }
      close() {
        return audioContextClose();
      }
    };

    global.MediaRecorder = class {
      constructor() {
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      static isTypeSupported() {
        return true;
      }
      state: string;
      mimeType: string;
    };

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: {
          createLiveController: vi.fn(() => {
            throw new Error('Recognition init failed');
          }),
        },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange,
        onStartFailure,
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(onStartFailure).toHaveBeenCalledTimes(1);
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(audioContextClose).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.recordPermission).toBe('loading');
    expect(result.current.voiceActivityStatus).toBe('unsupported');
    expect(onMessageChange).toHaveBeenCalled();
  });

  test('initial state is correct before any recording', () => {
    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: { createLiveController: () => null },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange: vi.fn(),
      })
    );

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.elapsed).toBe(0);
    expect(result.current.silenceCountdown).toBeNull();
    expect(result.current.voiceActivityStatus).toBe('unsupported');

    expect(Array.isArray(result.current.visualBars)).toBe(true);
    expect(result.current.visualBars).toEqual(DEFAULT_BARS);
  });

  test('does not leak tracks across repeated start failures', async () => {
    const firstTrackStop = vi.fn();
    const secondTrackStop = vi.fn();
    const firstStream = { getTracks: () => [{ stop: firstTrackStop }] };
    const secondStream = { getTracks: () => [{ stop: secondTrackStop }] };
    const getUserMediaMock = vi
      .fn()
      .mockResolvedValueOnce(firstStream)
      .mockResolvedValueOnce(secondStream);
    const onStartFailure = vi.fn();
    const onMessageChange = vi.fn();
    let mediaRecorderCalls = 0;

    navigator.mediaDevices = { getUserMedia: getUserMediaMock } as any;

    global.AudioContext = class {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          frequencyBinCount: 1024,
          getByteFrequencyData: vi.fn(),
          connect: vi.fn(),
        };
      }
      createMediaStreamDestination() {
        return { stream: {} };
      }
      close() {
        return Promise.resolve();
      }
    };

    global.MediaRecorder = class {
      constructor() {
        mediaRecorderCalls += 1;
        if (mediaRecorderCalls === 1) {
          throw new Error('Transient recorder init failure');
        }
        this.state = 'inactive';
        this.mimeType = 'audio/webm';
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) {
          this.onstop();
        }
      }
      static isTypeSupported() {
        return true;
      }
      state: string;
      mimeType: string;
      onstop?: () => void;
      ondataavailable?: (e: { data: Blob }) => void;
    } as any;

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: {
          createLiveController: () => ({
            setOnEnd: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            clearHandlers: vi.fn(),
          }),
        },
        onRecordingStop: vi.fn(),
        onSegmentsChange: vi.fn(),
        onInterimChange: vi.fn(),
        onMessageChange,
        onStartFailure,
      })
    );

    await act(async () => {
      await result.current.startRecording('first-attempt');
    });
    expect(firstTrackStop).toHaveBeenCalledTimes(1);
    expect(secondTrackStop).toHaveBeenCalledTimes(0);
    expect(mediaRecorderCalls).toBe(1);
    expect(onStartFailure).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);

    await act(async () => {
      await result.current.startRecording('second-attempt');
    });
    expect(mediaRecorderCalls).toBe(2);
    expect(firstTrackStop).toHaveBeenCalledTimes(1);
    expect(secondTrackStop).toHaveBeenCalledTimes(0);
    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      result.current.stopRecording();
    });
    expect(secondTrackStop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
  });

  // ------------------------------------------------------------
  // Issue #0 - Mic permission denied blocks recording permanently
  // Date: 2026-03-29
  // Bug: startRecording() checked recordPermission === 'denied' and returned
  //      early without trying getUserMedia, so even after user grants permission
  //      in browser settings the app would never re-request.
  // Fix: Always attempt getUserMedia - let the browser handle the permission popup.
  // ------------------------------------------------------------
  describe('Regression: denied permission does not permanently block recording', () => {
    test('startRecording calls getUserMedia after prior NotAllowedError and recovers on retry', async () => {
      const getUserMediaMock = vi.fn();
      const onMessageChange = vi.fn();
      const onStartFailure = vi.fn();
      const mockMediaService = {
        createLiveController: () => ({
          setOnEnd: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          clearHandlers: vi.fn(),
        }),
      };

      // Phase 1: getUserMedia rejects with NotAllowedError
      getUserMediaMock.mockRejectedValueOnce(
        Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
      );
      navigator.mediaDevices = { getUserMedia: getUserMediaMock } as any;

      const { result } = renderHook(() =>
        useAudioHardware({
          mediaService: mockMediaService,
          onRecordingStop: vi.fn(),
          onSegmentsChange: vi.fn(),
          onInterimChange: vi.fn(),
          onMessageChange,
          onStartFailure,
        })
      );

      await act(async () => {
        await result.current.startRecording('m1');
      });

      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      expect(result.current.recordPermission).toBe('denied');
      expect(result.current.isRecording).toBe(false);
      expect(onStartFailure).toHaveBeenCalledTimes(1);

      // Phase 2: simulate user granting permission in browser settings
      getUserMediaMock.mockResolvedValueOnce({
        getTracks: () => [{ stop: vi.fn() }],
      });

      await act(async () => {
        await result.current.startRecording('m2');
      });

      // Must have called getUserMedia again - NOT blocked by stale 'denied' state
      expect(getUserMediaMock).toHaveBeenCalledTimes(2);
      expect(result.current.recordPermission).toBe('granted');
      expect(result.current.isRecording).toBe(true);
      expect(onStartFailure).toHaveBeenCalledTimes(1);
      expect(onMessageChange).toHaveBeenCalledWith(expect.stringContaining('Pobieranie'));
    });

    test('temporary setup failure is recoverable and retry succeeds', async () => {
      const getUserMediaMock = vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error('setup timeout'), { name: 'TimeoutError' }))
        .mockResolvedValueOnce({
          getTracks: () => [{ stop: vi.fn() }],
        });
      const onStartFailure = vi.fn();
      const onMessageChange = vi.fn();
      navigator.mediaDevices = { getUserMedia: getUserMediaMock } as any;

      const { result } = renderHook(() =>
        useAudioHardware({
          mediaService: { createLiveController: () => null },
          onRecordingStop: vi.fn(),
          onSegmentsChange: vi.fn(),
          onInterimChange: vi.fn(),
          onMessageChange,
          onStartFailure,
        })
      );

      await act(async () => {
        await result.current.startRecording('m-fail');
      });

      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      expect(result.current.recordPermission).toBe('loading');
      expect(result.current.isRecording).toBe(false);
      expect(onStartFailure).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.startRecording('m-retry');
      });

      expect(getUserMediaMock).toHaveBeenCalledTimes(2);
      expect(result.current.recordPermission).toBe('granted');
      expect(result.current.isRecording).toBe(true);
      expect(onStartFailure).toHaveBeenCalledTimes(1);
    });

    test('non-permission errors do not set recordPermission to denied', async () => {
      const onMessageChange = vi.fn();
      navigator.mediaDevices = {
        getUserMedia: vi
          .fn()
          .mockRejectedValue(Object.assign(new Error('Device busy'), { name: 'NotReadableError' })),
      } as any;

      const { result } = renderHook(() =>
        useAudioHardware({
          mediaService: { createLiveController: () => null },
          onRecordingStop: vi.fn(),
          onSegmentsChange: vi.fn(),
          onInterimChange: vi.fn(),
          onMessageChange,
        })
      );

      await act(async () => {
        await result.current.startRecording('m1');
      });

      // NotReadableError is not a permission error - should NOT set denied
      expect(result.current.recordPermission).not.toBe('denied');
    });
  });
});
