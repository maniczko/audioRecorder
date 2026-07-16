import React from 'react';
import './RecordingPipelineStatus.css';
import { ProgressBar } from './ProgressBar';
import { ProcessingTimer } from './ProcessingTimer';
import { getRecordingQueueStatusView } from '../lib/recordingQueueUx';

interface RecordingPipelineStatusProps {
  status: string;
  errorMessage?: string;
  errorCode?: string;
  retryable?: boolean;
  progressMessage?: string;
  progressPercent?: number;
  stageLabel?: string;
  onRetry?: () => void;
  retryLabel?: string;
  allowInProgressRetry?: boolean;
  className?: string;
  /** ISO timestamp when processing started - shows elapsed time during processing */
  processingStartedAt?: string;
  queuedPosition?: number | null;
  processingAgeMs?: number | null;
  backoffUntil?: number | null;
}

function RetryIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function RecordingPipelineStatus({
  status,
  errorMessage,
  errorCode,
  retryable,
  progressMessage,
  progressPercent = 0,
  stageLabel = '',
  onRetry,
  retryLabel,
  allowInProgressRetry = false,
  className = '',
  processingStartedAt,
  queuedPosition,
  processingAgeMs,
  backoffUntil,
}: RecordingPipelineStatusProps) {
  const statusView = getRecordingQueueStatusView({
    status,
    errorMessage,
    errorCode,
    retryable,
    queuedPosition,
    processingAgeMs,
    backoffUntil,
    isOffline: typeof navigator !== 'undefined' && navigator.onLine === false,
  });
  const normalizedStatus = statusView.status;
  const isFailed = statusView.role === 'alert' && statusView.tone === 'danger';
  const isEmpty = normalizedStatus === 'empty' || normalizedStatus === 'no_audio';
  const inProgress = ['uploading', 'queued', 'processing', 'diarization'].includes(
    normalizedStatus
  );
  const isDone = normalizedStatus === 'done' || normalizedStatus === 'review';
  const canRetryFailedStatus =
    statusView.retryable &&
    (normalizedStatus === 'failed' || normalizedStatus === 'auth_required');
  const retryHandler =
    canRetryFailedStatus || (allowInProgressRetry && inProgress) ? onRetry : undefined;
  const resolvedRetryLabel =
    retryLabel ||
    (normalizedStatus === 'auth_required'
      ? 'Zaloguj ponownie i ponów upload'
      : 'Spróbuj ponownie');
  const progressText = progressMessage || statusView.summary;
  const detailMessage = errorMessage || statusView.description;

  return (
    <div
      className={`pipeline-status-wrapper ${className}`}
      role={statusView.role}
      aria-live={statusView.live}
      aria-atomic="true"
      aria-busy={statusView.busy ? 'true' : 'false'}
      aria-label={`${statusView.label}. ${statusView.summary}`}
    >
      <span
        className={`status-chip status-chip-sm ${inProgress ? 'processing' : ''} ${
          isDone ? 'done' : ''
        } ${isFailed ? 'failed' : ''} ${isEmpty ? 'empty' : ''}`}
        title={statusView.description}
      >
        {inProgress && <span className="status-spinner" aria-hidden="true" />}
        {statusView.label}
      </span>

      {progressMessage && inProgress && (
        <div className="pipeline-progress-block">
          <span className="pipeline-progress-text">
            {stageLabel
              ? `${stageLabel} (${Math.max(0, Math.min(100, Math.round(progressPercent)))}%)`
              : progressText}
          </span>
          <div
            className="pipeline-progress-meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, Math.min(100, Math.round(progressPercent)))}
            aria-label="Postęp przetwarzania nagrania"
          >
            <ProgressBar value={progressPercent} animated={false} />
          </div>
          {stageLabel && progressText && stageLabel !== progressText ? (
            <span className="pipeline-progress-subtext">{progressText}</span>
          ) : null}
          {processingStartedAt && (
            <ProcessingTimer
              startedAt={processingStartedAt}
              className="pipeline-processing-timer"
            />
          )}
        </div>
      )}

      {retryHandler && inProgress ? (
        <button
          type="button"
          className="pipeline-retry-btn pipeline-retry-btn-inline"
          onClick={(e) => {
            e.stopPropagation();
            retryHandler();
          }}
        >
          <RetryIcon />
          {resolvedRetryLabel}
        </button>
      ) : null}

      {isFailed && (
        <div className="pipeline-error-box">
          <svg
            className="pipeline-error-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="pipeline-error-text" title={detailMessage}>
            {detailMessage}
          </span>
          {retryHandler && (
            <button
              type="button"
              className="pipeline-retry-btn"
              onClick={(e) => {
                e.stopPropagation();
                retryHandler();
              }}
            >
              <RetryIcon />
              {resolvedRetryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
