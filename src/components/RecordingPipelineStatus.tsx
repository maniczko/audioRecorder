import React from "react";
import "./RecordingPipelineStatus.css";
import { ProgressBar } from "./ProgressBar";

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
            <ProgressBar value={progressPercent} animated={false} />
          </div>
          {stageLabel && progressMessage && stageLabel !== progressMessage ? (
            <span className="pipeline-progress-subtext">{progressMessage}</span>
          ) : null}
        </div>
      )}

      {isFailed && (
        <div className="pipeline-error-box">
          <svg className="pipeline-error-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span className="pipeline-error-text" title={errorMessage}>
            {errorMessage || "Wystąpił nieoczekiwany błąd."}
          </span>
          {onRetry && (
            <button type="button" className="pipeline-retry-btn" onClick={(e) => { e.stopPropagation(); onRetry(); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Spróbuj ponownie
            </button>
          )}
        </div>
      )}
    </div>
  );
}
