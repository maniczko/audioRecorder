import { formatDuration } from "../lib/storage";

export default function RecorderPanel({
  isRecording,
  analysisStatus,
  elapsed,
  visualBars,
  stopRecording,
  startRecording,
  recordPermission,
  speechRecognitionSupported,
  liveText,
  recordingMessage,
}) {
  return (
    <section className="panel recorder-panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Recorder</div>
          <h2>Live capture</h2>
        </div>
        <div className="status-cluster">
          <span className={isRecording ? "live-pill recording" : "live-pill"}>{isRecording ? "REC" : "Idle"}</span>
          <span className="live-pill subtle">{analysisStatus === "analyzing" ? "Analyzing" : "Ready"}</span>
        </div>
      </div>

      <div className="recorder-body">
        <div className="timer">{formatDuration(elapsed)}</div>
        <div className="visualizer">
          {visualBars.map((height, index) => (
            <span key={`${height}-${index}`} className="bar" style={{ height: `${height}px` }} />
          ))}
        </div>
        <div className="button-row align-center">
          <button
            type="button"
            className={isRecording ? "danger-button" : "primary-button"}
            onClick={isRecording ? stopRecording : () => startRecording()}
          >
            {isRecording ? "Stop recording" : "Start recording"}
          </button>
          {!isRecording ? (
            <button type="button" className="ghost-button" onClick={() => startRecording({ adHoc: true })}>
              Nagranie ad hoc
            </button>
          ) : null}
          <div className="microcopy">
            {recordPermission === "denied"
              ? "Mikrofon zablokowany. Odblokuj go przy pasku adresu."
              : speechRecognitionSupported
                ? "Live transcript wlacza sie automatycznie."
                : "Audio trafi na serwer i po zatrzymaniu przejdzie przez STT, diarization i review."}
          </div>
        </div>
        {liveText ? <div className="live-text">Na zywo: {liveText}</div> : null}
        {recordingMessage ? <div className="inline-alert info">{recordingMessage}</div> : null}
      </div>
    </section>
  );
}
