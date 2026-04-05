import './styles/auth.css';
import { formatDateTime } from './lib/storage';
import { APP_DATA_PROVIDER } from './services/config';
import {
  Sparkles,
  CalendarDays,
  BrainCircuit,
  Mail,
  Lock,
  User,
  Users,
  Briefcase,
  KeyRound,
  ArrowRight,
} from 'lucide-react';

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
      <section className="auth-hero-section">
        <div className="auth-hero-content">
          <div className="auth-hero-branding">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 64 64"
              fill="none"
            >
              <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <g strokeWidth="3.8">
                  <path d="M18 18c-3.5 0-6 2.8-6 6.2 0 3.1 2.2 5.7 5.2 6.1" />
                  <path d="M46 18c3.5 0 6 2.8 6 6.2 0 3.1-2.2 5.7-5.2 6.1" />
                  <path d="M20 45V35.5c0-8 5.8-14.5 12-14.5s12 6.5 12 14.5V45" />
                  <path d="M22 29.5c1.9-4.6 5.8-8.6 10-8.6s8.1 4 10 8.6" />
                  <path d="M27.3 35.8c1.3 2.5 3.1 3.8 4.7 3.8 1.6 0 3.4-1.3 4.7-3.8" />
                  <path d="M32 29.8v7.7" />
                  <path d="M28.7 40.2v4.9c0 1.4 1.1 2.5 2.5 2.5h1.6c1.4 0 2.5-1.1 2.5-2.5v-4.9" />
                  <path d="M44.6 40.5c2.9.1 5.2-.9 7-2.7 2.4-2.4 3.4-5.8 3.4-9.6-4 1.3-6.6 3.4-8.3 6.1" />
                  <path d="M22.2 43.8c-2.4-1.1-4.4-2.8-5.8-4.8" />
                  <path d="M41.8 43.8c1.2-.6 2.3-1.3 3.3-2.1" />
                  <path d="M23.4 17.5c2.5-2.3 5.4-4 8.6-4.9 3.3.9 6.2 2.6 8.7 4.9" />
                  <path d="M29 16.5l3 2.1 3-2.1" />
                </g>
                <g fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="24.5" cy="28.3" r="2.1" />
                  <circle cx="39.5" cy="28.3" r="2.1" />
                  <path d="M29 31.8c1.1-1.5 2-2.2 3-2.2s1.9.7 3 2.2c-.8 1.3-1.8 2-3 2s-2.2-.7-3-2Z" />
                  <rect x="29.2" y="40.4" width="2.1" height="6.1" rx="1" />
                  <rect x="32.7" y="40.4" width="2.1" height="6.1" rx="1" />
                </g>
                <g transform="rotate(24 21 49)" fill="none" stroke="currentColor">
                  <path
                    d="M18.4 44.6c0-2.1 1.7-3.8 3.8-3.8 2.1 0 3.8 1.7 3.8 3.8v5.8h-7.6v-5.8Z"
                    strokeWidth="2.8"
                  />
                  <rect x="21" y="50.4" width="2.4" height="6.1" rx="1.2" strokeWidth="1.8" />
                  <path d="M16.4 44.1c0-3.2 2.6-5.8 5.8-5.8s5.8 2.6 5.8 5.8" strokeWidth="2.8" />
                  <path d="M17.8 43.2h8.8" strokeWidth="2.1" />
                  <path d="M18.8 46.1h6.8" strokeWidth="2.1" />
                </g>
              </g>
            </svg>
            VoiceBóbr
          </div>
          <h1>Więcej niż bóbr.</h1>
          <p className="auth-hero-copy">
            Pracuj szybciej i inteligentniej. VoiceBóbr automatycznie grupuje wypowiedzi i dostarcza
            potrzebnych Ci kontekstów ze spotkań w czasie rzeczywistym.
          </p>

          <div className="auth-features-grid">
            <article className="auth-feature">
              <div className="auth-feature-icon">
                <Sparkles size={24} />
              </div>
              <div>
                <h3>Precyzyjna Diaryzacja</h3>
                <p>
                  Nigdy więcej pomyłek. Segmenty grupujemy precyzyjnie po sygnaturze głosu, a nie po
                  samej ciszy w tle.
                </p>
              </div>
            </article>
            <article className="auth-feature">
              <div className="auth-feature-icon">
                <CalendarDays size={24} />
              </div>
              <div>
                <h3>Centrum Spotkań</h3>
                <p>
                  Miesięczny widok zdarzeń wprost połączony ze spotkaniami Google. Bez przełączania
                  między systemami.
                </p>
              </div>
            </article>
            <article className="auth-feature">
              <div className="auth-feature-icon">
                <BrainCircuit size={24} />
              </div>
              <div>
                <h3>Insight Driven Analytics</h3>
                <p>
                  Ustalasz cel przed wejściem, a silnik LLM samodzielnie wyciągnie z rozmowy to,
                  czego naprawdę szukałeś.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="auth-form-section">
        <div className="auth-form-container">
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

          <div className="auth-mode-tabs">
            <button
              type="button"
              className={`auth-mode-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => setAuthMode('login')}
            >
              Logowanie
            </button>
            <button
              type="button"
              className={`auth-mode-tab ${isRegister ? 'active' : ''}`}
              onClick={() => setAuthMode('register')}
            >
              Rejestracja
            </button>
          </div>

          {APP_DATA_PROVIDER !== 'remote' ? (
            <div className="inline-alert info mb-6">
              Tryb lokalny: dane nie są synchronizowane z zewnętrznym serwerem.
            </div>
          ) : null}

          {isForgot ? (
            <div className="auth-form">
              <div className="auth-input-group">
                <label htmlFor="reset-email">Adres email</label>
                <div className="auth-input-wrapper">
                  <Mail />
                  <input
                    id="reset-email"
                    type="email"
                    value={resetValues.email}
                    onChange={(event) =>
                      setResetDraft((previous) => ({ ...previous, email: event.target.value }))
                    }
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <button type="button" className="auth-submit-btn mb-6" onClick={requestResetCode}>
                Wyślij kod resetu
              </button>

              {resetPreviewCode ? (
                <div className="inline-alert info mb-6">
                  Twój lokalny kod resetu: <strong>{resetPreviewCode}</strong>
                  {resetExpiresAt ? ` (wazny do ${formatDateTime(resetExpiresAt)})` : ''}
                </div>
              ) : null}

              <div className="auth-input-group">
                <label htmlFor="reset-code">Kod z emaila (Lokalnie: podaj z góry)</label>
                <div className="auth-input-wrapper">
                  <KeyRound />
                  <input
                    id="reset-code"
                    type="text"
                    value={resetValues.code}
                    onChange={(event) =>
                      setResetDraft((previous) => ({ ...previous, code: event.target.value }))
                    }
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
                    onChange={(event) =>
                      setResetDraft((previous) => ({
                        ...previous,
                        newPassword: event.target.value,
                      }))
                    }
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
                    onChange={(event) =>
                      setResetDraft((previous) => ({
                        ...previous,
                        confirmPassword: event.target.value,
                      }))
                    }
                    placeholder="Powtórz hasło"
                  />
                </div>
              </div>

              <button type="button" className="auth-submit-btn" onClick={completeReset}>
                Zmień hasło
              </button>

              {resetMessage ? <div className="inline-alert info mt-4">{resetMessage}</div> : null}

              <div className="text-center mt-6">
                <button type="button" className="link-button" onClick={() => setAuthMode('login')}>
                  Wróć do logowania
                </button>
              </div>
            </div>
          ) : (
            <form className="auth-form" onSubmit={internalSubmit}>
              {isRegister ? (
                <>
                  <div className="auth-input-group">
                    <label htmlFor="auth-name">Imię i nazwisko</label>
                    <div className="auth-input-wrapper">
                      <User />
                      <input
                        id="auth-name"
                        placeholder="np. Anna Nowak"
                        value={authValues.name}
                        onChange={(event) =>
                          setAuthDraft((previous) => ({ ...previous, name: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="auth-input-group">
                      <label htmlFor="auth-role">Stanowisko</label>
                      <div className="auth-input-wrapper">
                        <Briefcase />
                        <input
                          id="auth-role"
                          placeholder="np. Manager"
                          value={authValues.role}
                          onChange={(event) =>
                            setAuthDraft((previous) => ({ ...previous, role: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="auth-input-group">
                      <label htmlFor="auth-company">Firma</label>
                      <div className="auth-input-wrapper">
                        <User />
                        <input
                          id="auth-company"
                          placeholder="np. Acme Corp"
                          value={authValues.company}
                          onChange={(event) =>
                            setAuthDraft((previous) => ({
                              ...previous,
                              company: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="auth-input-group">
                <label htmlFor="auth-email">Adres email</label>
                <div className="auth-input-wrapper">
                  <Mail />
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="name@company.com"
                    value={authValues.email}
                    onChange={(event) =>
                      setAuthDraft((previous) => ({ ...previous, email: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <label htmlFor="auth-password">Hasło</label>
                  {!isRegister && (
                    <button
                      type="button"
                      className="link-button"
                      style={{ fontSize: '0.8rem' }}
                      onClick={() => setAuthMode('forgot')}
                    >
                      Zapomniałeś hasła?
                    </button>
                  )}
                </div>
                <div className="auth-input-wrapper">
                  <Lock />
                  <input
                    id="auth-password"
                    type="password"
                    placeholder="Minimum 6 znaków"
                    value={authValues.password}
                    onChange={(event) =>
                      setAuthDraft((previous) => ({ ...previous, password: event.target.value }))
                    }
                  />
                </div>
              </div>

              {isRegister ? (
                <>
                  <div className="auth-divider">Workspace</div>

                  <div className="workspace-choice-cards">
                    <button
                      type="button"
                      className={`workspace-choice-card ${authValues.workspaceMode === 'create' ? 'active' : ''}`}
                      onClick={() =>
                        setAuthDraft((previous) => ({ ...previous, workspaceMode: 'create' }))
                      }
                    >
                      Nowy zespół
                    </button>
                    <button
                      type="button"
                      className={`workspace-choice-card ${authValues.workspaceMode === 'join' ? 'active' : ''}`}
                      onClick={() =>
                        setAuthDraft((previous) => ({ ...previous, workspaceMode: 'join' }))
                      }
                    >
                      Dołącz z kodu
                    </button>
                  </div>

                  {authValues.workspaceMode === 'create' ? (
                    <div className="auth-input-group">
                      <label htmlFor="workspace-name">Nazwa nowej przestrzeni (Workspace)</label>
                      <div className="auth-input-wrapper">
                        <Users />
                        <input
                          id="workspace-name"
                          placeholder="np. Zespół Sprzedaży"
                          value={authValues.workspaceName}
                          onChange={(event) =>
                            setAuthDraft((previous) => ({
                              ...previous,
                              workspaceName: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="auth-input-group">
                      <label htmlFor="invite-code">Kod zaproszenia</label>
                      <div className="auth-input-wrapper">
                        <KeyRound />
                        <input
                          id="invite-code"
                          placeholder="Wprowadź kod z maila"
                          value={authValues.workspaceCode}
                          onChange={(event) =>
                            setAuthDraft((previous) => ({
                              ...previous,
                              workspaceCode: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : null}

              <button type="submit" className="auth-submit-btn">
                {isRegister ? 'Wejdz do aplikacji' : 'Zaloguj się'}
                <ArrowRight size={18} />
              </button>

              {authError ? (
                <div className="inline-alert error mt-4" style={{ marginTop: '1rem' }}>
                  {authError}
                </div>
              ) : null}
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
