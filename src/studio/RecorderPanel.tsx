import { formatDuration } from '../lib/storage';
import './RecorderPanelStyles.css';

export default function RecorderPanel({
  isRecording,
  analysisStatus,
  activeQueueItem,
  selectedMeetingQueue = [],
  elapsed,
  visualBars,
  stopRecording,
  startRecording,
  retryRecordingQueueItem,
  recordPermission,
  speechRecognitionSupported,
  liveText,
  recordingMessage,
  canRecord = true,
  noiseReductionEnabled = true,
  onToggleNoiseReduction,
}) {
  const statusLabel =
    analysisStatus === 'uploading'
      ? 'Uploading'
      : analysisStatus === 'queued'
        ? 'Queued'
        : analysisStatus === 'processing'
          ? 'Processing'
          : analysisStatus === 'done'
            ? 'Done'
            : analysisStatus === 'error'
              ? 'Error'
              : 'Ready';

  // Check if noise reduction is actually working
  const isNoiseReductionActive = typeof window !== 'undefined' && (window as any).__NOISE_REDUCTION_ENABLED;

  return (
    <section className="panel recorder-panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Recorder</div>
          <h2>Live capture</h2>
        </div>
        <div className="status-cluster">
          <span className={isRecording ? 'live-pill recording' : 'live-pill'}>
            {isRecording ? 'REC' : 'Idle'}
          </span>
          <span className="live-pill subtle">{statusLabel}</span>
        </div>
      </div>

      <div className="recorder-body">
        <div className="timer">{formatDuration(elapsed)}</div>
        <div className={`visualizer${isRecording ? ' visualizer-active' : ''}`}>
          {isRecording ? (
            <>
              <div className="visualizer-pulse-ring visualizer-pulse-ring-1" />
              <div className="visualizer-pulse-ring visualizer-pulse-ring-2" />
              <div className="visualizer-bars">
                {visualBars.map((height, index) => (
                  <span
                    key={index}
                    className="bar bar-live"
                    style={{
                      '--bar-h': `${Math.max(4, height)}px`,
                      '--bar-delay': `${(index % 8) * 0.06}s`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="visualizer-idle">
              <span className="visualizer-idle-icon">🎙</span>
              <span className="visualizer-idle-label">Gotowy do nagrania</span>
            </div>
          )}
        </div>
        <div className="button-row align-center">
          <button
            type="button"
            className={isRecording ? 'danger-button' : 'primary-button'}
            onClick={isRecording ? stopRecording : () => startRecording()}
            disabled={!canRecord}
          >
            {isRecording ? 'Stop recording' : 'Start recording'}
          </button>
          {!isRecording ? (
            <button
              type="button"
              className="ghost-button"
              onClick={() => startRecording({ adHoc: true })}
              disabled={!canRecord}
            >
              Nagranie ad hoc
            </button>
          ) : null}
          
          {/* Noise Reduction Toggle */}
          <button
            type="button"
            className={`ghost-button ${noiseReductionEnabled ? 'active' : ''}`}
            onClick={onToggleNoiseReduction}
            title={noiseReductionEnabled ? 'Noise reduction WLACZONY - czyszczenie szumow' : 'Noise reduction WYLACZONY'}
            disabled={!canRecord || isRecording}
          >
            {noiseReductionEnabled ? '🔇 Szumy: ON' : '🎤 Szumy: OFF'}
          </button>
          
          <div className="microcopy">
            {!canRecord
              ? 'Ta rola ma dostep tylko do podgladu. Nagrywanie i edycja sa zablokowane.'
              : recordPermission === 'denied'
                ? 'Mikrofon zablokowany. Odblokuj go przy pasku adresu.'
                : speechRecognitionSupported
                  ? 'Live transcript wlacza sie automatycznie.'
                  : 'Audio trafi na serwer i po zatrzymaniu przejdzie przez STT, diarization i review.'}
            {isNoiseReductionActive && (
              <span className="noise-reduction-status"> ✅ Noise reduction aktywny</span>
            )}
          </div>
        </div>
        {liveText ? <div className="live-text">Na zywo: {liveText}</div> : null}
        {recordingMessage ? <div className="inline-alert info">{recordingMessage}</div> : null}
        {activeQueueItem ? (
          <div className="recorder-queue-card">
            <strong>Kolejka audio</strong>
            <span>
              {activeQueueItem.meetingTitle}: {activeQueueItem.status}
            </span>
            <small>
              {activeQueueItem.errorMessage
                ? activeQueueItem.errorMessage
                : activeQueueItem.status === 'uploading'
                  ? 'Wysylamy audio na serwer.'
                  : activeQueueItem.status === 'processing'
                    ? 'Serwer przetwarza STT i diarization.'
                    : 'Nagranie czeka na kolejke.'}
            </small>
            {activeQueueItem.status === 'failed' ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => retryRecordingQueueItem(activeQueueItem.recordingId)}
                disabled={!canRecord}
              >
                Ponow
              </button>
            ) : null}
          </div>
        ) : null}
        {selectedMeetingQueue.length ? (
          <div className="microcopy">
            W kolejce dla tego spotkania: {selectedMeetingQueue.length}
          </div>
        ) : null}
      </div>
    </section>
  );
}
