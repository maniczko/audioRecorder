import { renderHook, act } from '@testing-library/react';
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

    expect(onMessageChange).toHaveBeenCalledWith(expect.stringContaining('nie obsługuje'));
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
    expect(result.current.visualBars).toBeDefined();
    expect(Array.isArray(result.current.visualBars)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — Mic permission denied blocks recording permanently
  // Date: 2026-03-29
  // Bug: startRecording() checked recordPermission === 'denied' and returned
  //      early without trying getUserMedia, so even after user grants permission
  //      in browser settings the app would never re-request.
  // Fix: Always attempt getUserMedia — let the browser handle the permission popup.
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: denied permission does not permanently block recording', () => {
    test('startRecording calls getUserMedia even after prior NotAllowedError', async () => {
      const getUserMediaMock = vi.fn();
      const onMessageChange = vi.fn();
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
        })
      );

      await act(async () => {
        await result.current.startRecording('m1');
      });

      expect(getUserMediaMock).toHaveBeenCalledTimes(1);
      expect(result.current.recordPermission).toBe('denied');

      // Phase 2: simulate user granting permission in browser settings
      getUserMediaMock.mockResolvedValueOnce({
        getTracks: () => [{ stop: vi.fn() }],
      });

      await act(async () => {
        await result.current.startRecording('m2');
      });

      // Must have called getUserMedia again — NOT blocked by stale 'denied' state
      expect(getUserMediaMock).toHaveBeenCalledTimes(2);
    });

    test('non-permission errors do not set recordPermission to denied', async () => {
      const onMessageChange = vi.fn();
      navigator.mediaDevices = {
        getUserMedia: vi.fn().mockRejectedValue(
          Object.assign(new Error('Device busy'), { name: 'NotReadableError' })
        ),
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

      // NotReadableError is not a permission error — should NOT set denied
      expect(result.current.recordPermission).not.toBe('denied');
    });
  });
});
