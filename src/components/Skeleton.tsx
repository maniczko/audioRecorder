import React from 'react';
import { Tooltip } from '../shared/Tooltip';
import './skeleton.css';

export function SkeletonBanner({ height = 120, className = '' }) {
  return <div className={`skeleton skeleton-banner ${className}`} style={{ height }} />;
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton-card ${className}`}>
      <div className="skeleton skeleton-title" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skeleton-text" style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function SkeletonList({ items = 5, lines = 2, className = '' }) {
  return (
    <div className={`skeleton-list ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry, className = '' }: any) {
  return (
    <div className={`ff-state-box error-state ${className}`}>
      <div className="ff-state-icon">⚠️</div>
      <div className="ff-state-title">Wystąpił błąd</div>
      <p className="ff-state-desc">{String(error || 'Coś poszło nie tak.')}</p>
      {onRetry && (
        <button type="button" className="ff-state-action primary-button" onClick={onRetry}>
          Spróbuj ponownie
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = '📄',
  title = 'Brak danych',
  message = '',
  action,
  actionText = 'Utwórz',
  actionTooltip,
  className = '',
}: any) {
  return (
    <div className={`ff-state-box empty-state ${className}`}>
      <div className="ff-state-icon">{icon}</div>
      <div className="ff-state-title">{title}</div>
      {message && <p className="ff-state-desc">{message}</p>}
      {action && (
        actionTooltip ? (
          <Tooltip content={actionTooltip} placement="top">
            <button type="button" className="ff-state-action primary-button" onClick={action}>
              {actionText}
            </button>
          </Tooltip>
        ) : (
          <button type="button" className="ff-state-action primary-button" onClick={action}>
            {actionText}
          </button>
        )
      )}
    </div>
  );
}

export function LoadingScreen({ message = 'Wczytywanie...', className = '' }: any) {
  return (
    <div className={`ff-state-box loading-state ${className}`}>
      <div className="ff-state-spinner" />
      <div className="ff-state-title">{message}</div>
    </div>
  );
}
