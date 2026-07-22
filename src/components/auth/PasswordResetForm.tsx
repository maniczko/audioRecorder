import { KeyRound, Lock, Mail } from 'lucide-react';
import { formatDateTime } from '../../lib/storage';
import type { ResetDraftLike, ResetValues } from './authValues';

interface PasswordResetFormProps {
  resetValues: ResetValues;
  resetMessage?: string;
  resetPreviewCode?: string;
  resetExpiresAt?: string;
  setResetDraft: (updater: (previous: ResetDraftLike) => ResetDraftLike) => void;
  requestResetCode: () => void;
  completeReset: () => void;
  onBackToLogin: () => void;
  passwordResetEnabled?: boolean;
}

export default function PasswordResetForm({
  resetValues,
  resetMessage,
  resetPreviewCode,
  resetExpiresAt,
  setResetDraft,
  requestResetCode,
  completeReset,
  onBackToLogin,
  passwordResetEnabled = true,
}: PasswordResetFormProps) {
  const isDisabled = passwordResetEnabled !== true;

  return (
    <div className="auth-form">
      {isDisabled ? (
        <div className="inline-alert warning mb-4">
          Reset hasła jest obecnie niedostępny. Skontaktuj się z administratorem.
        </div>
      ) : null}

      <div className="auth-input-group">
        <label htmlFor="reset-email">Adres email</label>
        <div className="auth-input-wrapper">
          <Mail />
          <input
            id="reset-email"
            type="email"
            value={resetValues.email}
            disabled={isDisabled}
            onChange={(event) => {
              const { value } = event.target;
              setResetDraft((previous) => ({ ...previous, email: value }));
            }}
            placeholder="name@company.com"
          />
        </div>
      </div>

      <button
        type="button"
        className="auth-submit-btn mb-6"
        disabled={isDisabled}
        onClick={requestResetCode}
      >
        Wyślij kod resetu
      </button>

      {resetPreviewCode ? (
        <div className="inline-alert info mb-6">
          Twój lokalny kod resetu: <strong>{resetPreviewCode}</strong>
          {resetExpiresAt ? ` (ważny do ${formatDateTime(resetExpiresAt)})` : ''}
        </div>
      ) : null}

      <div className="auth-input-group">
        <label htmlFor="reset-code">Kod resetu</label>
        <div className="auth-input-wrapper">
          <KeyRound />
          <input
            id="reset-code"
            type="text"
            value={resetValues.code}
            disabled={isDisabled}
            onChange={(event) => {
              const { value } = event.target;
              setResetDraft((previous) => ({ ...previous, code: value }));
            }}
            placeholder="Wpisz 6-cyfrowy kod"
          />
        </div>
      </div>

      <div className="auth-input-group">
        <label htmlFor="new-password">Nowe hasło</label>
        <div className="auth-input-wrapper">
          <Lock />
          <input
            id="new-password"
            type="password"
            value={resetValues.newPassword}
            disabled={isDisabled}
            onChange={(event) => {
              const { value } = event.target;
              setResetDraft((previous) => ({
                ...previous,
                newPassword: value,
              }));
            }}
            placeholder="Minimum 6 znaków"
          />
        </div>
      </div>

      <div className="auth-input-group">
        <label htmlFor="confirm-password">Potwierdź nowe hasło</label>
        <div className="auth-input-wrapper">
          <Lock />
          <input
            id="confirm-password"
            type="password"
            value={resetValues.confirmPassword}
            disabled={isDisabled}
            onChange={(event) => {
              const { value } = event.target;
              setResetDraft((previous) => ({
                ...previous,
                confirmPassword: value,
              }));
            }}
            placeholder="Powtórz hasło"
          />
        </div>
      </div>

      <button
        type="button"
        className="auth-submit-btn"
        disabled={isDisabled}
        onClick={completeReset}
      >
        Zmień hasło
      </button>

      {resetMessage ? <div className="inline-alert info mt-4">{resetMessage}</div> : null}

      <div className="text-center mt-6">
        <button type="button" className="link-button" onClick={onBackToLogin}>
          Wróć do logowania
        </button>
      </div>
    </div>
  );
}
