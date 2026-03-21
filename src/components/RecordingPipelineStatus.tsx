import React from "react";
import "./RecordingPipelineStatus.css";

interface RecordingPipelineStatusProps {
  status: string;
  errorMessage?: string;
  progressMessage?: string;
  progressPercent?: number;
  stageLabel?: string;
  onRetry?: () => void;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  uploading: "Wysyłanie...",
  queued: "W kolejce",
  processing: "Przetwarzanie...",
  diarization: "Rozpoznawanie mówców...",
  review: "Oczekuje na weryfikację",
  done: "Transkrypcja gotowa",
  failed: "Błąd przetwarzania",
};

export function RecordingPipelineStatus({
  status,
  errorMessage,
  progressMessage,
  progressPercent = 0,
  stageLabel = "",
  onRetry,
  className = "",
}: RecordingPipelineStatusProps) {
  const isFailed = status === "failed";
  const inProgress = ["uploading", "queued", "processing", "diarization"].includes(status);
  const isDone = status === "done" || status === "review";
  
  const label = STATUS_LABELS[status] || STATUS_LABELS.queued;

  return (
    <div className={`pipeline-status-wrapper ${className}`}>
      <span
        className={`status-chip status-chip-sm ${inProgress ? "processing" : ""} ${
          isDone ? "done" : ""
        } ${isFailed ? "failed" : ""}`}
      >
        {inProgress && <span className="status-spinner" />}
        {label}
      </span>
      
      {progressMessage && inProgress && (
        <div className="pipeline-progress-block">
          <span className="pipeline-progress-text">
            {stageLabel ? `${stageLabel} (${Math.max(0, Math.min(100, Math.round(progressPercent)))}%)` : progressMessage}
          </span>
          <div
            className="pipeline-progress-meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, Math.min(100, Math.round(progressPercent)))}
            aria-label="Postep przetwarzania nagrania"
          >
            <span style={{ width: `${Math.max(4, Math.min(100, Math.round(progressPercent)))}%` }} />
          </div>
          {stageLabel && progressMessage && stageLabel !== progressMessage ? (
            <span className="pipeline-progress-subtext">{progressMessage}</span>
          ) : null}
        </div>
      )}

      {isFailed && (
        <div className="pipeline-error-box">
          <span className="pipeline-error-text" title={errorMessage}>
            {errorMessage || "Wystąpił nieoczekiwany błąd."}
          </span>
          {onRetry && (
            <button className="pipeline-retry-btn" onClick={(e) => { e.stopPropagation(); onRetry(); }}>
              🔄 Spróbuj ponownie
            </button>
          )}
        </div>
      )}
    </div>
  );
}
