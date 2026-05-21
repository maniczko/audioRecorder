import React from 'react';
import { render, screen } from '@testing-library/react';
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
});
