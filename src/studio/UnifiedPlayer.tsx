import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { formatDuration } from '../lib/storage';
import { getSpeakerColor } from '../lib/speakerColors';
import { labelSpeaker } from '../lib/recording';
import { useHotkeys } from '../hooks/useHotkeys';
import { getRecordingQueueStatusView, getRecordingStartView } from '../lib/recordingQueueUx';
import './UnifiedPlayerStyles.css';

export default function UnifiedPlayer({
  // recording
  isRecording,
  analysisStatus,
  activeQueueItem,
  elapsed,
  visualBars,
  stopRecording,
  startRecording,
  retryRecordingQueueItem,
  recordPermission,
  speechRecognitionSupported,
  liveText,
  recordingMessage,
  canRecord,
  // playback
  audioRef,
  selectedRecordingAudioUrl,
  selectedRecordingAudioError,
  currentTime,
  audioDuration,
  isPlaying,
  playbackRate,
  setPlaybackRate,
  // speaker
  transcript,
  displaySpeakerNames,
}) {
  const [playError, setPlayError] = useState<string | null>(null);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);

  // Clear play error when audio source changes
  useEffect(() => {
    setPlayError(null);
  }, [selectedRecordingAudioUrl]);

  const queueView = getRecordingQueueStatusView({
    status: activeQueueItem?.status || analysisStatus,
    errorMessage: activeQueueItem?.errorMessage,
    errorCode: activeQueueItem?.errorCode,
    retryable: activeQueueItem?.retryable,
    queuedPosition: activeQueueItem?.queuedPosition,
    processingAgeMs: activeQueueItem?.processingAgeMs,
    backoffUntil: activeQueueItem?.backoffUntil,
    isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
  });
  const startView = getRecordingStartView({
    canRecord,
    recordPermission,
    speechRecognitionSupported,
  });
  const isQueued =
    !isRecording &&
    !selectedRecordingAudioUrl &&
    [
      'uploading',
      'queued',
      'processing',
      'diarization',
      'failed',
      'failed_permanent',
      'offline',
      'backend_unavailable',
      'storage_quota',
    ].includes(queueView.status);

  const mode: 'recording' | 'playback' | 'queue' | 'idle' = isRecording
    ? 'recording'
    : selectedRecordingAudioUrl
      ? 'playback'
      : isQueued
        ? 'queue'
        : 'idle';

  const togglePlayback = useCallback(() => {
    const a = audioRef?.current;
    if (!a || mode !== 'playback') return;

    if (playError) {
      // Retry on click after error
      setPlayError(null);
      a.load();
      a.play().catch((err: Error) => {
        setPlayError(
          err.name === 'NotAllowedError'
            ? 'Kliknij aby odblokować audio'
            : `Nie można odtworzyć — ${err.message}`
        );
      });
      return;
    }
    if (a.paused) {
      a.play().catch((err: Error) => {
        setPlayError(
          err.name === 'NotAllowedError'
            ? 'Kliknij aby odblokować audio'
            : 'Nie można odtworzyć — plik może być uszkodzony'
        );
      });
    } else {
      a.pause();
    }
  }, [audioRef, playError, mode]);

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const a = audioRef?.current;
      if (!a || mode !== 'playback') return;

      const duration = Math.max(0, Number(audioDuration || a.duration || 0));
      const baseTime = Number.isFinite(a.currentTime) ? a.currentTime : currentTime;
      const nextTime =
        duration > 0
          ? Math.min(duration, Math.max(0, baseTime + deltaSeconds))
          : Math.max(0, baseTime + deltaSeconds);
      a.currentTime = nextTime;
    },
    [audioDuration, audioRef, currentTime, mode]
  );

  const getSeekTimeFromPointer = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!audioDuration) return null;
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width) return null;
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      return ratio * audioDuration;
    },
    [audioDuration]
  );

  useHotkeys([
    {
      key: ' ',
      handler: (e) => {
        if (mode === 'playback') {
          e.preventDefault();
          togglePlayback();
        }
      },
    },
    {
      key: 'ArrowLeft',
      handler: () => seekBy(-5),
    },
    {
      key: 'ArrowRight',
      handler: () => seekBy(5),
    },
    {
      key: 'ArrowLeft',
      shiftKey: true,
      handler: () => seekBy(-15),
    },
    {
      key: 'ArrowRight',
      shiftKey: true,
      handler: () => seekBy(15),
    },
  ]);

  const peakLevel =
    isRecording && visualBars.length
      ? Math.max(...visualBars) / 58 // bars range 6–58px
      : 0;
  const gainPct = Math.round(Math.min(1, peakLevel) * 100);

  // Active speaker based on currentTime
  const activeSeg =
    Array.isArray(transcript) && currentTime > 0
      ? transcript.find((s) => s.timestamp <= currentTime && s.endTimestamp > currentTime)
      : null;

  const queueLabel =
    analysisStatus === 'uploading'
      ? 'Wysyłanie audio…'
      : analysisStatus === 'processing'
        ? 'Transkrypcja w toku…'
        : activeQueueItem?.status === 'failed_permanent'
          ? 'Wymaga ponownego importu'
          : activeQueueItem?.backoffUntil > Date.now()
            ? `Ponowienie za chwilę… (próba ${activeQueueItem.retryCount}/3)`
            : 'Nagranie w kolejce…';

  const queueStatusLabel =
    activeQueueItem?.backoffUntil > Date.now()
      ? `${queueView.summary} (próba ${activeQueueItem.retryCount}/3)`
      : queueView.summary || queueLabel;

  const fillPct = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <section className="panel unified-player-panel">
      <div className="unified-player-bar">
        {/* LEFT: big action button */}
        {mode === 'recording' ? (
          <button type="button" className="uplayer-stop-btn" onClick={stopRecording}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="10" height="10" rx="2" />
            </svg>
            Stop
          </button>
        ) : mode === 'playback' ? (
          <button
            type="button"
            className={`uplayer-play-btn${playError ? ' uplayer-play-btn--error' : ''}`}
            onClick={togglePlayback}
            aria-label={
              playError ? 'Błąd odtwarzania — kliknij aby ponowić' : isPlaying ? 'Pauza' : 'Odtwórz'
            }
            title={playError || undefined}
          >
            {playError ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 1a6 6 0 100 12A6 6 0 007 1zm-.75 3h1.5v4h-1.5V4zm0 5h1.5v1.5h-1.5V9z" />
              </svg>
            ) : isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="2" y="1" width="4" height="12" rx="1" />
                <rect x="8" y="1" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M3 1.5l10 5.5-10 5.5z" />
              </svg>
            )}
          </button>
        ) : mode === 'queue' ? (
          <span className="uplayer-queue-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle
                cx="9"
                cy="9"
                r="7"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="10 6"
                className="uplayer-spinner"
              />
            </svg>
          </span>
        ) : (
          <button
            type="button"
            className="uplayer-record-btn"
            onClick={() => startRecording()}
            disabled={!canRecord}
            aria-label="Nagraj"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="6" cy="6" r="5" />
            </svg>
          </button>
        )}

        {/* CENTER: track area */}
        <div className="uplayer-track">
          {mode === 'recording' ? (
            <>
              <span className="uplayer-elapsed">{formatDuration(elapsed)}</span>
              <div className="uplayer-live-bars">
                {visualBars.map((h, i) => (
                  <span
                    key={i}
                    className="uplayer-bar"
                    style={{ '--h': `${Math.max(3, h)}px` } as React.CSSProperties}
                  />
                ))}
              </div>
              <div
                className="uplayer-gain-meter"
                title={`Poziom wejścia: ${gainPct}%`}
                aria-label={`Poziom wejścia ${gainPct}%`}
              >
                <div
                  className="uplayer-gain-fill"
                  style={{
                    width: `${gainPct}%`,
                    background:
                      gainPct > 85
                        ? 'var(--error, #f87171)'
                        : gainPct > 65
                          ? 'var(--warning, #fbbf24)'
                          : 'var(--accent, #75d6c4)',
                  }}
                />
              </div>
              {liveText ? <span className="uplayer-live-text">{liveText.slice(-60)}</span> : null}
            </>
          ) : mode === 'playback' ? (
            <>
              <span className="uplayer-time-cur">{formatDuration(currentTime)}</span>
              {activeSeg ? (
                <span
                  className="uplayer-speaker-chip"
                  style={
                    { '--chip-color': getSpeakerColor(activeSeg.speakerId) } as React.CSSProperties
                  }
                >
                  {labelSpeaker(displaySpeakerNames, activeSeg.speakerId)}
                </span>
              ) : null}
              <div
                className="uplayer-waveform-shell"
                style={{ '--uplayer-progress': `${fillPct}%` } as React.CSSProperties}
                title={
                  hoverSeekTime !== null
                    ? `Przejdź do ${formatDuration(Math.floor(hoverSeekTime))}`
                    : 'Kliknij lub przeciągnij, aby przewinąć nagranie'
                }
                onMouseMove={(event) => {
                  const nextHoverTime = getSeekTimeFromPointer(event);
                  setHoverSeekTime(nextHoverTime);
                }}
                onMouseLeave={() => setHoverSeekTime(null)}
              >
                <div className="uplayer-waveform-visual" aria-hidden="true" />
                <input
                  type="range"
                  className="uplayer-scrubber"
                  min={0}
                  max={audioDuration || 1}
                  step={0.05}
                  value={currentTime}
                  onChange={(e) => {
                    const a = audioRef.current;
                    if (a) a.currentTime = Number(e.target.value);
                  }}
                  aria-label="Pozycja odtwarzania"
                />
              </div>
              <span className="uplayer-time-total">{formatDuration(audioDuration)}</span>
            </>
          ) : mode === 'queue' ? (
            <span
              className="uplayer-queue-label"
              role={queueView.role}
              aria-live={queueView.live}
              aria-busy={queueView.busy ? 'true' : 'false'}
              title={queueView.description}
            >
              {queueStatusLabel}
            </span>
          ) : (
            <div className="uplayer-idle-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => startRecording({ adHoc: true })}
                disabled={!canRecord}
              >
                Ad hoc
              </button>
              <span className="uplayer-hint" aria-label={startView.summary}>
                {!canRecord
                  ? 'Brak uprawnień do nagrywania.'
                  : recordPermission === 'denied'
                    ? '🎤 Kliknij "Nagraj", aby przyznać dostęp do mikrofonu.'
                    : speechRecognitionSupported
                      ? 'Transkrypcja na żywo włącza się automatycznie.'
                      : 'Audio trafi na serwer po zakończeniu.'}
              </span>
            </div>
          )}
        </div>

        {/* RIGHT: speed (playback only) or status badge */}
        {mode === 'playback' ? (
          <button
            type="button"
            className="uplayer-speed-btn"
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              const rates = [1, 1.25, 1.5, 1.75, 2];
              const next = rates[(rates.indexOf(a.playbackRate) + 1) % rates.length];
              a.playbackRate = next;
              setPlaybackRate(next);
            }}
          >
            ×{playbackRate}
          </button>
        ) : mode === 'recording' ? (
          <span className="uplayer-rec-dot" aria-label="Nagrywanie">
            REC
          </span>
        ) : activeQueueItem?.status === 'failed' ? (
          <button
            type="button"
            className="ghost-button"
            style={{ fontSize: '0.75rem' }}
            onClick={() => retryRecordingQueueItem(activeQueueItem.recordingId)}
          >
            Ponów
          </button>
        ) : activeQueueItem?.retryCount > 0 ? (
          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
            Próba {activeQueueItem.retryCount}/{3}
          </span>
        ) : null}
      </div>

      {/* Error / review alert below the bar */}
      {mode === 'playback' && playError ? (
        <div className="inline-alert error" style={{ margin: '4px 0 0' }}>
          {playError}
        </div>
      ) : mode === 'playback' && selectedRecordingAudioError ? (
        <div className="inline-alert error" style={{ margin: '4px 0 0' }}>
          Błąd audio: {selectedRecordingAudioError}
        </div>
      ) : null}
      {recordingMessage ? (
        <div className="inline-alert info" style={{ margin: '4px 0 0' }}>
          {recordingMessage}
        </div>
      ) : null}
    </section>
  );
}

UnifiedPlayer.propTypes = {
  isRecording: PropTypes.bool,
  analysisStatus: PropTypes.string,
  activeQueueItem: PropTypes.object,
  selectedMeetingQueue: PropTypes.array,
  elapsed: PropTypes.number,
  visualBars: PropTypes.array,
  stopRecording: PropTypes.func,
  startRecording: PropTypes.func,
  retryRecordingQueueItem: PropTypes.func,
  recordPermission: PropTypes.string,
  speechRecognitionSupported: PropTypes.bool,
  liveText: PropTypes.string,
  recordingMessage: PropTypes.string,
  canRecord: PropTypes.bool,
  audioRef: PropTypes.object,
  selectedRecordingAudioUrl: PropTypes.string,
  selectedRecordingAudioError: PropTypes.string,
  currentTime: PropTypes.number,
  audioDuration: PropTypes.number,
  isPlaying: PropTypes.bool,
  playbackRate: PropTypes.number,
  setPlaybackRate: PropTypes.func,
  transcript: PropTypes.array,
  displaySpeakerNames: PropTypes.object,
};
