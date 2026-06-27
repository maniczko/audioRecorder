import { ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { RecordingConsentDisclosure } from '../../lib/recordingConsent';

interface RecordingConsentDialogProps {
  open: boolean;
  disclosure: RecordingConsentDisclosure;
  onAccept: () => void | Promise<void>;
  onDecline: () => void;
}

export default function RecordingConsentDialog({
  open,
  disclosure,
  onAccept,
  onDecline,
}: RecordingConsentDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const checkboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmed(false);
      return;
    }
    window.requestAnimationFrame(() => checkboxRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDecline();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDecline, open]);

  if (!open) return null;

  const enabledProviders = disclosure.providers.filter((provider) => provider.enabled);

  return (
    <div className="recording-consent-overlay" role="presentation">
      <section
        className="recording-consent-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recording-consent-title"
      >
        <header className="recording-consent-header">
          <div className="recording-consent-title-row">
            <ShieldCheck size={20} aria-hidden="true" />
            <h2 id="recording-consent-title">{disclosure.title}</h2>
          </div>
          <button
            type="button"
            className="recording-consent-close"
            onClick={onDecline}
            aria-label="Zamknij zgode na nagrywanie"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="recording-consent-body">
          <p>{disclosure.summary}</p>
          <p>{disclosure.storageNotice}</p>
          <p>{disclosure.providerNotice}</p>

          <ul className="recording-consent-provider-list" aria-label="Kategorie dostawcow">
            {enabledProviders.map((provider) => (
              <li key={provider.id}>{provider.label}</li>
            ))}
          </ul>

          <p className="recording-consent-audit">{disclosure.auditNotice}</p>

          <label className="recording-consent-check">
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              Rozumiem i potwierdzam, ze moge nagrywac to spotkanie oraz wyslac dane do
              skonfigurowanych dostawcow.
            </span>
          </label>
        </div>

        <footer className="recording-consent-actions">
          <button type="button" className="recording-consent-secondary" onClick={onDecline}>
            Anuluj
          </button>
          <button
            type="button"
            className="recording-consent-primary"
            disabled={!confirmed}
            onClick={onAccept}
          >
            Akceptuje i zaczynam nagrywanie
          </button>
        </footer>
      </section>
    </div>
  );
}
