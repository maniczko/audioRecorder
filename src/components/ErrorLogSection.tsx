import { useState } from 'react';
import { useErrorLogStore } from '../store/errorLogStore';
import type { ErrorLogEntry } from '../store/errorLogStore';

const TYPE_LABELS: Record<ErrorLogEntry['type'], string> = {
  runtime: '⚡ Runtime',
  'unhandled-rejection': '💥 Promise',
  'react-boundary': '🧱 React',
  network: '🌐 Network',
  manual: '📝 Manual',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ErrorLogSection() {
  const errors = useErrorLogStore((s) => s.errors);
  const clearErrors = useErrorLogStore((s) => s.clearErrors);
  const exportErrors = useErrorLogStore((s) => s.exportErrors);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const json = exportErrors();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voicelog-errors-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    const json = exportErrors();
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReportError = () => {
    useErrorLogStore.getState().addError({
      type: 'manual',
      message: 'User-reported issue (manual entry)',
      context: 'Reported via Error Log panel',
    });
  };

  const sorted = [...errors].reverse();

  return (
    <>
      <section className="panel profile-grid-span-two" data-testid="error-log-section">
        <div className="panel-header compact">
          <div>
            <div className="eyebrow">Diagnostyka</div>
            <h2>Dziennik błędów ({errors.length})</h2>
          </div>
          <div className="button-row">
            <button type="button" className="ghost-button" onClick={handleReportError}>
              ➕ Zgłoś
            </button>
            <button type="button" className="ghost-button" onClick={handleCopyToClipboard}>
              {copied ? '✅ Skopiowano' : '📋 Kopiuj'}
            </button>
            <button type="button" className="ghost-button" onClick={handleExport}>
              📥 Eksportuj JSON
            </button>
            {errors.length > 0 && (
              <button type="button" className="ghost-button" onClick={clearErrors}>
                🗑️ Wyczyść
              </button>
            )}
          </div>
        </div>

        {errors.length === 0 ? (
          <div className="integration-card">
            <p style={{ opacity: 0.6 }}>
              Brak zarejestrowanych błędów. Wszystko działa poprawnie! ✅
            </p>
          </div>
        ) : (
          <div className="stack-form" style={{ maxHeight: 400, overflowY: 'auto' }}>
            {sorted.map((err) => (
              <div
                key={err.id}
                className="integration-card"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === err.id ? null : err.id)}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>
                    <strong>{TYPE_LABELS[err.type]}</strong>{' '}
                    <span style={{ opacity: 0.7 }}>{formatTime(err.timestamp)}</span>
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', wordBreak: 'break-word' }}>{err.message}</p>
                {expanded === err.id && (
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 8,
                      background: 'var(--bg-muted, #1a1a1a)',
                      borderRadius: 6,
                      fontSize: 11,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {err.stack || 'No stack trace'}
                    {err.source && `\nSource: ${err.source}`}
                    {err.context && `\nContext: ${err.context}`}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
