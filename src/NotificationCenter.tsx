import { useEffect, useRef } from 'react';
import { formatDateTime } from './lib/storage';
import './NotificationCenterStyles.css';

function NotificationToneBadge({ tone }) {
  const label =
    tone === 'danger' ? 'Pilne' : tone === 'warning' ? 'Uwaga' : tone === 'success' ? 'OK' : 'Info';

  return <span className={`notification-tone ${tone || 'neutral'}`}>{label}</span>;
}

export default function NotificationCenter({
  open,
  unreadCount,
  items = [],
  permissionState = 'default',
  browserNotificationsSupported = false,
  onToggle,
  onClose,
  onRequestPermission,
  onDismiss,
  onActivate,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointer(event) {
      if (!panelRef.current?.contains(event.target)) {
        onClose();
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('mousedown', handlePointer);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handlePointer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, open]);

  return (
    <div className="notification-anchor" ref={panelRef}>
      <button
        type="button"
        className={open ? 'notification-trigger active' : 'notification-trigger'}
        aria-label="Powiadomienia"
        onClick={onToggle}
      >
        <span className="notification-trigger-icon">{'\u23f0'}</span>
        {unreadCount ? <strong className="notification-trigger-badge">{unreadCount}</strong> : null}
      </button>

      {open ? (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <div className="ui-page-header__copy" style={{ marginBottom: 'var(--space-2)' }}>
              <div className="eyebrow">Powiadomienia</div>
              <h2 className="ui-page-header__title">Centrum alertow</h2>
            </div>
            <span className="status-chip">{unreadCount} nowych</span>
          </div>

          <div className="notification-panel-tools">
            <span className="microcopy">
              {browserNotificationsSupported
                ? permissionState === 'granted'
                  ? 'Browser notifications aktywne'
                  : 'Mozesz wlaczyc alerty przegladarki'
                : 'Ta przegladarka nie obsluguje browser notifications'}
            </span>
            {browserNotificationsSupported && permissionState !== 'granted' ? (
              <button type="button" className="ghost-button" onClick={onRequestPermission}>
                Wlacz w przegladarce
              </button>
            ) : null}
          </div>

          <div className="notification-list">
            {items.length ? (
              items.map((item) => (
                <article key={item.id} className={`notification-card ${item.tone || 'neutral'}`}>
                  <button
                    type="button"
                    className="notification-card-main"
                    onClick={() => onActivate(item)}
                  >
                    <div className="notification-card-top">
                      <NotificationToneBadge tone={item.tone} />
                      <span>{formatDateTime(item.sortAt || item.deliverAt)}</span>
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </button>
                  <button
                    type="button"
                    className="notification-dismiss"
                    onClick={() => onDismiss(item.id)}
                  >
                    Zamknij
                  </button>
                </article>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Na razie spokoj</strong>
                <span>Tu pojawia sie przypomnienia o spotkaniach i taskach po SLA.</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
