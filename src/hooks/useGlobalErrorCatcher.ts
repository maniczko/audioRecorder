import { useEffect } from 'react';
import { useErrorLogStore } from '../store/errorLogStore';

export function useGlobalErrorCatcher() {
  const addError = useErrorLogStore((s) => s.addError);

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      addError({
        type: 'runtime',
        message: event.message || 'Unknown runtime error',
        stack: event.error?.stack,
        source: `${event.filename || 'unknown'}:${event.lineno}:${event.colno}`,
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      addError({
        type: 'unhandled-rejection',
        message: reason?.message || String(reason) || 'Unhandled promise rejection',
        stack: reason?.stack,
      });
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [addError]);
}
