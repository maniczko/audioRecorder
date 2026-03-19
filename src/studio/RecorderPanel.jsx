import { formatDuration } from "../lib/storage";
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
}) {
  const statusLabel =
    analysisStatus === "uploading"
      ? "Uploading"
      : analysisStatus === "queued"
        ? "Queued"
        : analysisStatus === "processing"
          ? "Processing"
          : analysisStatus === "done"
            ? "Done"
            : analysisStatus === "error"
              ? "Error"
              : "Ready";

  return (
    <section className="panel recorder-panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Recorder</div>
          <h2>Live capture</h2>
        </div>
        <div className="status-cluster">
          <span className={isRecording ? "live-pill recording" : "live-pill"}>{isRecording ? "REC" : "Idle"}</span>
          <span className="live-pill subtle">{statusLabel}</span>
        </div>
      </div>

      <div className="recorder-body">
        <div className="timer">{formatDuration(elapsed)}</div>
        <div className={`visualizer${isRecording ? " visualizer-active" : ""}`}>
          {isRecording ? (
            <>
              <div className="visualizer-pulse-ring visualizer-pulse-ring-1" />
              <div className="visualizer-pulse-ring visualizer-pulse-ring-2" />
              <div className="visualizer-bars">
                {visualBars.map((height, index) => (
                  <span
                    key={index}
                    className="bar bar-live"
                    style={{ "--bar-h": `${Math.max(4, height)}px`, "--bar-delay": `${(index % 8) * 0.06}s` }}
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
            className={isRecording ? "danger-button" : "primary-button"}
            onClick={isRecording ? stopRecording : () => startRecording()}
            disabled={!canRecord}
          >
            {isRecording ? "Stop recording" : "Start recording"}
          </button>
          {!isRecording ? (
            <button type="button" className="ghost-button" onClick={() => startRecording({ adHoc: true })} disabled={!canRecord}>
              Nagranie ad hoc
            </button>
          ) : null}
          <div className="microcopy">
            {!canRecord
              ? "Ta rola ma dostep tylko do podgladu. Nagrywanie i edycja sa zablokowane."
              : recordPermission === "denied"
              ? "Mikrofon zablokowany. Odblokuj go przy pasku adresu."
              : speechRecognitionSupported
                ? "Live transcript wlacza sie automatycznie."
                : "Audio trafi na serwer i po zatrzymaniu przejdzie przez STT, diarization i review."}
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
                : activeQueueItem.status === "uploading"
                  ? "Wysylamy audio na serwer."
                  : activeQueueItem.status === "processing"
                    ? "Serwer przetwarza STT i diarization."
                    : "Nagranie czeka na kolejke."}
            </small>
            {activeQueueItem.status === "failed" ? (
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
          <div className="microcopy">W kolejce dla tego spotkania: {selectedMeetingQueue.length}</div>
        ) : null}
      </div>
    </section>
  );
}
