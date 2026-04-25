import type { FormEvent } from 'react';
import './styles/auth.css';
import AuthCredentialsForm from './components/auth/AuthCredentialsForm';
import AuthHeroSection from './components/auth/AuthHeroSection';
import AuthModeTabs from './components/auth/AuthModeTabs';
import PasswordResetForm from './components/auth/PasswordResetForm';
import {
  type AuthDraftLike,
  type AuthMode,
  type ResetDraftLike,
  normalizeAuthDraft,
  normalizeResetDraft,
  shouldBlockAuthSubmit,
} from './components/auth/authValues';
import { APP_DATA_PROVIDER } from './services/config';

interface AuthScreenProps {
  authMode: AuthMode;
  authDraft?: AuthDraftLike | null;
  authError?: string;
  setAuthMode: (mode: AuthMode) => void;
  setAuthDraft: (updater: (previous: AuthDraftLike) => AuthDraftLike) => void;
  submitAuth: (event: FormEvent<HTMLFormElement>) => void;
  googleEnabled?: boolean;
  googleButtonRef?: unknown;
  googleAuthMessage?: string;
  resetDraft?: ResetDraftLike | null;
  setResetDraft: (updater: (previous: ResetDraftLike) => ResetDraftLike) => void;
  resetMessage?: string;
  resetPreviewCode?: string;
  resetExpiresAt?: string;
  requestResetCode: () => void;
  completeReset: () => void;
}

function AuthPanelHeader({ authMode }: { authMode: AuthMode }) {
  const isRegister = authMode === 'register';
  const isForgot = authMode === 'forgot';

  return (
    <div className="auth-form-header">
      <h2>{isRegister ? 'Dołącz do nas' : isForgot ? 'Zresetuj hasło' : 'Witaj ponownie'}</h2>
      <p>
        {isRegister
          ? 'Załóż darmowe konto by zacząć'
          : isForgot
            ? 'Podaj email, abyśmy mogli wysłać instrukcje'
            : 'Zaloguj się do swojego konta'}
      </p>
    </div>
  );
}

export default function AuthScreen({
  authMode,
  authDraft,
  authError,
  setAuthMode,
  setAuthDraft,
  submitAuth,
  resetDraft,
  setResetDraft,
  resetMessage,
  resetPreviewCode,
  resetExpiresAt,
  requestResetCode,
  completeReset,
}: AuthScreenProps) {
  const authValues = normalizeAuthDraft(authDraft);
  const resetValues = normalizeResetDraft(resetDraft);
  const isForgot = authMode === 'forgot';

  function internalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (shouldBlockAuthSubmit(authMode, authValues)) {
      return;
    }
    submitAuth(event);
  }

  return (
    <div className="auth-shell">
      <AuthHeroSection />

      <section className="auth-form-section">
        <div className="auth-form-container">
          <AuthPanelHeader authMode={authMode} />
          <AuthModeTabs authMode={authMode} onChange={setAuthMode} />

          {APP_DATA_PROVIDER !== 'remote' ? (
            <div className="inline-alert info mb-6">
              Tryb lokalny: dane nie są synchronizowane z zewnętrznym serwerem.
            </div>
          ) : null}

          {isForgot ? (
            <PasswordResetForm
              resetValues={resetValues}
              resetMessage={resetMessage}
              resetPreviewCode={resetPreviewCode}
              resetExpiresAt={resetExpiresAt}
              setResetDraft={setResetDraft}
              requestResetCode={requestResetCode}
              completeReset={completeReset}
              onBackToLogin={() => setAuthMode('login')}
            />
          ) : (
            <AuthCredentialsForm
              authMode={authMode}
              authValues={authValues}
              authError={authError}
              setAuthDraft={setAuthDraft}
              setAuthMode={setAuthMode}
              onSubmit={internalSubmit}
            />
          )}
        </div>
      </section>
    </div>
  );
}
