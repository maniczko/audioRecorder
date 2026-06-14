import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import UnifiedPlayer from './UnifiedPlayer';

const defaultProps = {
  isRecording: false,
  analysisStatus: 'processing',
  activeQueueItem: null,
  elapsed: 0,
  visualBars: [],
  stopRecording: vi.fn(),
  startRecording: vi.fn(),
  retryRecordingQueueItem: vi.fn(),
  recordPermission: 'granted',
  speechRecognitionSupported: true,
  liveText: '',
  recordingMessage: '',
  canRecord: true,
  audioRef: React.createRef<HTMLAudioElement>(),
  selectedRecordingAudioUrl: null,
  selectedRecordingAudioError: '',
  currentTime: 0,
  audioDuration: 0,
  isPlaying: false,
  playbackRate: 1,
  setPlaybackRate: vi.fn(),
  transcript: [],
  displaySpeakerNames: {},
};

describe('UnifiedPlayer', () => {
  // -----------------------------------------------------------------
  // Issue #0 - permanent queue failures exposed retry in the player
  // Date: 2026-05-21
  // Bug: failed_permanent still looked manually retryable in playback chrome.
  // Fix: hide retry and present it as a re-import state.
  // -----------------------------------------------------------------
  test('Regression: does not show retry action for permanent queue failures', () => {
    const retryRecordingQueueItem = vi.fn();

    render(
      <UnifiedPlayer
        {...defaultProps}
        activeQueueItem={{
          recordingId: 'rec-permanent',
          status: 'failed_permanent',
          retryCount: 0,
        }}
        retryRecordingQueueItem={retryRecordingQueueItem}
      />
    );

    expect(screen.queryByRole('button', { name: /Ponow/i })).not.toBeInTheDocument();
    expect(retryRecordingQueueItem).not.toHaveBeenCalled();
  });

  test('Regression: waveform keyboard shortcuts seek the playback position', () => {
    const audio = document.createElement('audio');
    Object.defineProperty(audio, 'currentTime', { value: 30, writable: true });
    const audioRef = { current: audio };

    render(
      <UnifiedPlayer
        {...defaultProps}
        audioRef={audioRef}
        selectedRecordingAudioUrl="blob:test"
        audioDuration={90}
        currentTime={30}
      />
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(audio.currentTime).toBe(35);

    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
    expect(audio.currentTime).toBe(20);
  });

  test('Regression: waveform hover explains the target seek time', () => {
    const audio = document.createElement('audio');
    const audioRef = { current: audio };

    render(
      <UnifiedPlayer
        {...defaultProps}
        audioRef={audioRef}
        selectedRecordingAudioUrl="blob:test"
        audioDuration={100}
        currentTime={25}
      />
    );

    const scrubber = screen.getByLabelText('Pozycja odtwarzania');
    const waveform = scrubber.closest('.uplayer-waveform-shell') as HTMLElement;
    Object.defineProperty(waveform, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 200, top: 0, bottom: 42, right: 200, height: 42 }),
    });

    fireEvent.mouseMove(waveform, { clientX: 100 });

    expect(waveform).toHaveAttribute('title', 'Przejdź do 00:50');
  });
});
