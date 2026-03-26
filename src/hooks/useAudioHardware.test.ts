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
});
