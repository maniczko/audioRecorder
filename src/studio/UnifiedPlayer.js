import { formatDuration } from "../lib/storage";

export default function UnifiedPlayer({
  // recording
  isRecording, analysisStatus, activeQueueItem,
  elapsed, visualBars, stopRecording, startRecording,
  retryRecordingQueueItem, recordPermission,
  speechRecognitionSupported, liveText, recordingMessage,
  canRecord,
  // playback
  audioRef, selectedRecordingAudioUrl, selectedRecordingAudioError,
  currentTime, audioDuration, isPlaying, playbackRate, setPlaybackRate,
}) {
  const isQueued = ["queued","uploading","processing"].includes(analysisStatus) && !isRecording;

  // Which mode to show in the player track area:
  // "recording" > "playback" > "queue" > "idle"
  const mode = isRecording ? "recording"
    : selectedRecordingAudioUrl ? "playback"
    : isQueued ? "queue"
    : "idle";

  const queueLabel = analysisStatus === "uploading" ? "Wysyłanie audio…"
    : analysisStatus === "processing" ? "Transkrypcja w toku…"
    : "Nagranie w kolejce…";

  const fillPct = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <section className="panel unified-player-panel">
      <div className="unified-player-bar">

        {/* LEFT: big action button */}
        {mode === "recording" ? (
          <button type="button" className="uplayer-stop-btn" onClick={stopRecording}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="10" height="10" rx="2"/>
            </svg>
            Stop
          </button>
        ) : mode === "playback" ? (
          <button
            type="button"
            className="uplayer-play-btn"
            onClick={() => {
              const a = audioRef.current;
              if (!a) return;
              if (a.paused) a.play().catch(() => {});
              else a.pause();
            }}
            aria-label={isPlaying ? "Pauza" : "Odtwórz"}
          >
            {isPlaying
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="4" height="12" rx="1"/><rect x="8" y="1" width="4" height="12" rx="1"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5l10 5.5-10 5.5z"/></svg>
            }
          </button>
        ) : mode === "queue" ? (
          <span className="uplayer-queue-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="10 6" className="uplayer-spinner"/>
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
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="5"/></svg>
          </button>
        )}

        {/* CENTER: track area */}
        <div className="uplayer-track">
          {mode === "recording" ? (
            <>
              <span className="uplayer-elapsed">{formatDuration(elapsed)}</span>
              <div className="uplayer-live-bars">
                {visualBars.map((h, i) => (
                  <span key={i} className="uplayer-bar" style={{ "--h": `${Math.max(3, h)}px` }} />
                ))}
              </div>
              {liveText ? <span className="uplayer-live-text">{liveText.slice(-60)}</span> : null}
            </>
          ) : mode === "playback" ? (
            <>
              <span className="uplayer-time-cur">{formatDuration(currentTime)}</span>
              <input
                type="range"
                className="uplayer-scrubber"
                min={0}
                max={audioDuration || 1}
                step={0.05}
                value={currentTime}
                style={{
                  background: audioDuration > 0
                    ? `linear-gradient(to right, var(--accent,#75d6c4) ${fillPct}%, rgba(255,255,255,0.12) ${fillPct}%)`
                    : undefined,
                }}
                onChange={(e) => {
                  const a = audioRef.current;
                  if (a) a.currentTime = Number(e.target.value);
                }}
                aria-label="Pozycja odtwarzania"
              />
              <span className="uplayer-time-total">{formatDuration(audioDuration)}</span>
            </>
          ) : mode === "queue" ? (
            <span className="uplayer-queue-label">{queueLabel}</span>
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
              <span className="uplayer-hint">
                {!canRecord
                  ? "Brak uprawnień do nagrywania."
                  : recordPermission === "denied"
                  ? "Mikrofon zablokowany."
                  : speechRecognitionSupported
                  ? "Transkrypcja na żywo włącza się automatycznie."
                  : "Audio trafi na serwer po zakończeniu."}
              </span>
            </div>
          )}
        </div>

        {/* RIGHT: speed (playback only) or status badge */}
        {mode === "playback" ? (
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
        ) : mode === "recording" ? (
          <span className="uplayer-rec-dot" aria-label="Nagrywanie">REC</span>
        ) : activeQueueItem?.status === "failed" ? (
          <button
            type="button"
            className="ghost-button"
            style={{ fontSize: "0.75rem" }}
            onClick={() => retryRecordingQueueItem(activeQueueItem.recordingId)}
          >
            Ponów
          </button>
        ) : null}
      </div>

      {/* Error / review alert below the bar */}
      {mode === "playback" && selectedRecordingAudioError ? (
        <div className="inline-alert error" style={{ margin: "4px 0 0" }}>
          Błąd audio: {selectedRecordingAudioError}
        </div>
      ) : null}
      {recordingMessage ? (
        <div className="inline-alert info" style={{ margin: "4px 0 0" }}>{recordingMessage}</div>
      ) : null}
    </section>
  );
}
