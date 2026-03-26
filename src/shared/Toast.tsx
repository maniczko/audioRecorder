import { createContext, useCallback, useContext, useRef, useState } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const show = useCallback(
    (message, options = {}) => {
      const id = ++toastIdCounter;
      const toast = {
        id,
        message,
        type: options.type || 'success',
        action: options.action || null,
        actionLabel: options.actionLabel || null,
        duration: options.duration ?? 3500,
      };

      setToasts((prev) => [...prev.slice(-4), toast]);

      if (toast.duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), toast.duration);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback((msg, opts) => show(msg, { ...opts, type: 'success' }), [show]);
  const error = useCallback((msg, opts) => show(msg, { ...opts, type: 'error' }), [show]);
  const info = useCallback((msg, opts) => show(msg, { ...opts, type: 'info' }), [show]);
  const warning = useCallback((msg, opts) => show(msg, { ...opts, type: 'warning' }), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info, warning, dismiss }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '✕'}
              {t.type === 'info' && 'ℹ'}
              {t.type === 'warning' && '⚠'}
            </span>
            <span className="toast-message">{t.message}</span>
            {t.action && t.actionLabel && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action();
                  dismiss(t.id);
                }}
              >
                {t.actionLabel}
              </button>
            )}
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Zamknij"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
