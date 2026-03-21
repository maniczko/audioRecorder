import React from "react";
import "./RecordingPipelineStatus.css";

interface RecordingPipelineStatusProps {
  status: string;
  errorMessage?: string;
  progressMessage?: string;
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
        <span className="pipeline-progress-text">{progressMessage}</span>
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
