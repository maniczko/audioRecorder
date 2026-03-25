import './styles/auth.css';
import { formatDateTime } from './lib/storage';
import { APP_DATA_PROVIDER } from './services/config';
import './AuthScreenStyles.css';

export default function AuthScreen({
  authMode,
  authDraft,
  authError,
  setAuthMode,
  setAuthDraft,
  submitAuth,
  googleEnabled,
  googleButtonRef,
  googleAuthMessage,
  resetDraft,
  setResetDraft,
  resetMessage,
  resetPreviewCode,
  resetExpiresAt,
  requestResetCode,
  completeReset,
}) {
  const isRegister = authMode === 'register';
  const isForgot = authMode === 'forgot';
  const authValues = {
    name: String(authDraft?.name || ''),
    role: String(authDraft?.role || ''),
    company: String(authDraft?.company || ''),
    email: String(authDraft?.email || ''),
    password: String(authDraft?.password || ''),
    workspaceMode: authDraft?.workspaceMode === 'join' ? 'join' : 'create',
    workspaceName: String(authDraft?.workspaceName || ''),
    workspaceCode: String(authDraft?.workspaceCode || ''),
  };
  const resetValues = {
    email: String(resetDraft?.email || ''),
    code: String(resetDraft?.code || ''),
    newPassword: String(resetDraft?.newPassword || ''),
    confirmPassword: String(resetDraft?.confirmPassword || ''),
  };

  function internalSubmit(event) {
    event.preventDefault();
    if (isRegister && authValues.password.length < 6) {
      return;
    }
    submitAuth(event);
  }

  return (
    <div className="auth-shell">
      <div className="backdrop-orb backdrop-orb-left" />
      <div className="backdrop-orb backdrop-orb-right" />

      <section className="auth-hero">
        <div className="eyebrow">VoiceBóbr</div>
        <h1>Meeting intelligence z kalendarzem i rozpoznawaniem rozmowcow.</h1>
        <p className="hero-copy">
          Planujesz spotkania, logujesz sie lokalnie albo przez Google, a po nagraniu od razu
          widzisz kto co mowil, jakie byly decyzje i czy odpowiedzi pokrywaja Twoje potrzeby.
        </p>

        <div className="hero-grid">
          <article className="feature-card">
            <h2>Diarization</h2>
            <p>Segmenty sa grupowane po sygnaturze glosu, a nie tylko po ciszy.</p>
          </article>
          <article className="feature-card">
            <h2>Calendar tab</h2>
            <p>
              Masz miesieczny widok spotkan w stylu Google Calendar i szybkie wejscie do wydarzen.
            </p>
          </article>
          <article className="feature-card">
            <h2>Need-based insights</h2>
            <p>
              Do kazdego spotkania zapisujesz, co chcesz z niego wyciagnac, a analiza odpowiada na
              te potrzeby.
            </p>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Workspace access</div>
            <h2>{isRegister ? 'Stworz konto' : isForgot ? 'Reset hasla' : 'Zaloguj sie'}</h2>
          </div>
          <div className="mode-switch">
            <button
              type="button"
              className={isRegister ? 'pill active' : 'pill'}
              onClick={() => setAuthMode('register')}
            >
              Rejestracja
            </button>
            <button
              type="button"
              className={authMode === 'login' ? 'pill active' : 'pill'}
              onClick={() => setAuthMode('login')}
            >
              Logowanie
            </button>
            <button
              type="button"
              className={isForgot ? 'pill active' : 'pill'}
              onClick={() => setAuthMode('forgot')}
            >
              Reset
            </button>
          </div>
        </div>

        {/* 
        <div className="google-auth-block">
          <div>
            <div className="eyebrow">Google</div>
            <strong>Logowanie przez Google</strong>
          </div>
          {googleEnabled ? (
            <div ref={googleButtonRef} className="google-button-slot" />
          ) : (
            <div className="inline-alert info">
              Dodaj `REACT_APP_GOOGLE_CLIENT_ID`, aby wlaczyc logowanie Google i synchronizacje kalendarza.
            </div>
          )}
          {googleAuthMessage ? <div className="inline-alert info">{googleAuthMessage}</div> : null}
        </div>
        */}

        <div className="auth-divider">
          <span>albo klasycznie</span>
        </div>

        {APP_DATA_PROVIDER !== 'remote' ? (
          <div className="inline-alert info">
            Ta instancja dziala w trybie lokalnym. Konta i sesja sa zapisane tylko w tej
            przegladarce, wiec po deployu na innym adresie albo po czyszczeniu storage mozesz nie
            widziec poprzedniego uzytkownika.
          </div>
        ) : null}

        {isForgot ? (
          <div className="auth-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={resetValues.email}
                onChange={(event) =>
                  setResetDraft((previous) => ({ ...previous, email: event.target.value }))
                }
                placeholder="name@company.com"
              />
            </label>

            <button type="button" className="primary-button" onClick={requestResetCode}>
              Wyslij kod resetu
            </button>

            {resetPreviewCode ? (
              <div className="inline-alert info">
                W tej lokalnej wersji kod pokazujemy tutaj zamiast wysylki mailem:
                <strong> {resetPreviewCode}</strong>
                {resetExpiresAt ? ` (wazny do ${formatDateTime(resetExpiresAt)})` : ''}
              </div>
            ) : null}

            <label>
              <span>Kod resetu</span>
              <input
                type="text"
                value={resetValues.code}
                onChange={(event) =>
                  setResetDraft((previous) => ({ ...previous, code: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Nowe haslo</span>
              <input
                type="password"
                value={resetValues.newPassword}
                onChange={(event) =>
                  setResetDraft((previous) => ({ ...previous, newPassword: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Potwierdz haslo</span>
              <input
                type="password"
                value={resetValues.confirmPassword}
                onChange={(event) =>
                  setResetDraft((previous) => ({
                    ...previous,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            </label>

            <button type="button" className="primary-button" onClick={completeReset}>
              Zmien haslo
            </button>

            {resetMessage ? <div className="inline-alert info">{resetMessage}</div> : null}
          </div>
        ) : (
          <form className="auth-form" onSubmit={internalSubmit}>
            {isRegister ? (
              <>
                <label>
                  <span>Imie i nazwisko</span>
                  <input
                    placeholder="np. Anna Nowak"
                    value={authValues.name}
                    onChange={(event) =>
                      setAuthDraft((previous) => ({ ...previous, name: event.target.value }))
                    }
                  />
                </label>
                <div className="grid-2">
                  <label>
                    <span>Rola</span>
                    <input
                      value={authValues.role}
                      onChange={(event) =>
                        setAuthDraft((previous) => ({ ...previous, role: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    <span>Firma</span>
                    <input
                      value={authValues.company}
                      onChange={(event) =>
                        setAuthDraft((previous) => ({ ...previous, company: event.target.value }))
                      }
                    />
                  </label>
                </div>
              </>
            ) : null}

            <label>
              <span>Email</span>
              <input
                type="email"
                placeholder="name@company.com"
                value={authValues.email}
                onChange={(event) =>
                  setAuthDraft((previous) => ({ ...previous, email: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Haslo</span>
              <input
                type="password"
                placeholder="minimum 6 znakow"
                value={authValues.password}
                onChange={(event) =>
                  setAuthDraft((previous) => ({ ...previous, password: event.target.value }))
                }
              />
            </label>

            {isRegister ? (
              <>
                <div className="workspace-choice">
                  <button
                    type="button"
                    className={
                      authValues.workspaceMode === 'create' ? 'choice-btn active' : 'choice-btn'
                    }
                    onClick={() =>
                      setAuthDraft((previous) => ({ ...previous, workspaceMode: 'create' }))
                    }
                  >
                    Stworz workspace
                  </button>
                  <button
                    type="button"
                    className={
                      authValues.workspaceMode === 'join' ? 'choice-btn active' : 'choice-btn'
                    }
                    onClick={() =>
                      setAuthDraft((previous) => ({ ...previous, workspaceMode: 'join' }))
                    }
                  >
                    Dolacz kodem
                  </button>
                </div>

                {authValues.workspaceMode === 'create' ? (
                  <label>
                    <span>Nazwa workspace</span>
                    <input
                      placeholder="np. Zespol sprzedazy"
                      value={authValues.workspaceName}
                      onChange={(event) =>
                        setAuthDraft((previous) => ({
                          ...previous,
                          workspaceName: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : (
                  <label>
                    <span>Kod zaproszenia</span>
                    <input
                      value={authValues.workspaceCode}
                      onChange={(event) =>
                        setAuthDraft((previous) => ({
                          ...previous,
                          workspaceCode: event.target.value,
                        }))
                      }
                    />
                  </label>
                )}
              </>
            ) : null}

            <button type="submit" className="primary-button">
              {isRegister ? 'Wejdz do workspace' : 'Zaloguj sie'}
            </button>

            {authError ? <div className="inline-alert error">{authError}</div> : null}
          </form>
        )}
      </section>
    </div>
  );
}
