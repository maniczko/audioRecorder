import { renderHook, act } from '@testing-library/react';
import useAudioHardware from './useAudioHardware';

describe('useAudioHardware', () => {
  let originalMediaDevices;
  let originalMediaRecorder;
  let originalAudioContext;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    originalMediaDevices = navigator.mediaDevices;
    originalMediaRecorder = global.MediaRecorder;
    originalAudioContext = global.AudioContext || global.webkitAudioContext;

    navigator.mediaDevices = {
      getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [{ stop: jest.fn() }],
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
        return { connect: jest.fn() };
      }
      createAnalyser() {
        return {
          frequencyBinCount: 1024,
          getByteFrequencyData: jest.fn(),
          connect: jest.fn(),
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
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('starts and stops recording', async () => {
    const onRecordingStop = jest.fn();
    const mockMediaService = {
      createLiveController: () => ({
        setOnEnd: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        clearHandlers: jest.fn(),
      }),
    };

    const { result } = renderHook(() =>
      useAudioHardware({
        mediaService: mockMediaService,
        onRecordingStop,
        onSegmentsChange: jest.fn(),
        onInterimChange: jest.fn(),
        onMessageChange: jest.fn(),
      })
    );

    await act(async () => {
      await result.current.startRecording('m1');
    });

    expect(result.current.isRecording).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(onRecordingStop).toHaveBeenCalled();
  });
});
