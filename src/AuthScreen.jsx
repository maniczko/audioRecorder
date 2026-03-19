import './styles/auth.css';
import { formatDateTime } from "./lib/storage";
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
  const isRegister = authMode === "register";
  const isForgot = authMode === "forgot";

  return (
    <div className="auth-shell">
      <div className="backdrop-orb backdrop-orb-left" />
      <div className="backdrop-orb backdrop-orb-right" />

      <section className="auth-hero">
        <div className="eyebrow">VoiceLog OS</div>
        <h1>Meeting intelligence z kalendarzem i rozpoznawaniem rozmowcow.</h1>
        <p className="hero-copy">
          Planujesz spotkania, logujesz sie lokalnie albo przez Google, a po nagraniu od razu widzisz kto co mowil,
          jakie byly decyzje i czy odpowiedzi pokrywaja Twoje potrzeby.
        </p>

        <div className="hero-grid">
          <article className="feature-card">
            <h2>Diarization</h2>
            <p>Segmenty sa grupowane po sygnaturze glosu, a nie tylko po ciszy.</p>
          </article>
          <article className="feature-card">
            <h2>Calendar tab</h2>
            <p>Masz miesieczny widok spotkan w stylu Google Calendar i szybkie wejscie do wydarzen.</p>
          </article>
          <article className="feature-card">
            <h2>Need-based insights</h2>
            <p>Do kazdego spotkania zapisujesz, co chcesz z niego wyciagnac, a analiza odpowiada na te potrzeby.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="panel-header">
          <div>
            <div className="eyebrow">Workspace access</div>
            <h2>{isRegister ? "Stworz konto" : isForgot ? "Reset hasla" : "Zaloguj sie"}</h2>
          </div>
          <div className="mode-switch">
            <button type="button" className={isRegister ? "pill active" : "pill"} onClick={() => setAuthMode("register")}>
              Rejestracja
            </button>
            <button type="button" className={authMode === "login" ? "pill active" : "pill"} onClick={() => setAuthMode("login")}>
              Logowanie
            </button>
            <button type="button" className={isForgot ? "pill active" : "pill"} onClick={() => setAuthMode("forgot")}>
              Reset
            </button>
          </div>
        </div>

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

        <div className="auth-divider">
          <span>albo klasycznie</span>
        </div>

        {isForgot ? (
          <div className="auth-form">
            <label>
              <span>Email</span>
              <input
                type="email"
                value={resetDraft.email}
                onChange={(event) => setResetDraft((previous) => ({ ...previous, email: event.target.value }))}
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
                {resetExpiresAt ? ` (wazny do ${formatDateTime(resetExpiresAt)})` : ""}
              </div>
            ) : null}

            <label>
              <span>Kod resetu</span>
              <input
                value={resetDraft.code}
                onChange={(event) => setResetDraft((previous) => ({ ...previous, code: event.target.value }))}
                placeholder="6-cyfrowy kod"
              />
            </label>
            <label>
              <span>Nowe haslo</span>
              <input
                type="password"
                value={resetDraft.newPassword}
                onChange={(event) => setResetDraft((previous) => ({ ...previous, newPassword: event.target.value }))}
                placeholder="minimum 6 znakow"
              />
            </label>
            <label>
              <span>Powtorz nowe haslo</span>
              <input
                type="password"
                value={resetDraft.confirmPassword}
                onChange={(event) =>
                  setResetDraft((previous) => ({ ...previous, confirmPassword: event.target.value }))
                }
                placeholder="powtorz haslo"
              />
            </label>
            {resetMessage ? <div className="inline-alert info">{resetMessage}</div> : null}
            {authError ? <div className="inline-alert error">{authError}</div> : null}
            <button type="button" className="secondary-button" onClick={completeReset}>
              Ustaw nowe haslo
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submitAuth}>
            {isRegister ? (
              <>
                <label>
                  <span>Imie</span>
                  <input
                    value={authDraft.name}
                    onChange={(event) => setAuthDraft((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder="np. Anna Nowak"
                  />
                </label>
                <label>
                  <span>Rola</span>
                  <input
                    value={authDraft.role}
                    onChange={(event) => setAuthDraft((previous) => ({ ...previous, role: event.target.value }))}
                    placeholder="np. Product Manager"
                  />
                </label>
                <label>
                  <span>Firma</span>
                  <input
                    value={authDraft.company}
                    onChange={(event) => setAuthDraft((previous) => ({ ...previous, company: event.target.value }))}
                    placeholder="np. VoiceLog"
                  />
                </label>

                <div className="mode-switch split">
                  <button
                    type="button"
                    className={authDraft.workspaceMode === "join" ? "pill" : "pill active"}
                    onClick={() => setAuthDraft((previous) => ({ ...previous, workspaceMode: "create" }))}
                  >
                    Nowy workspace
                  </button>
                  <button
                    type="button"
                    className={authDraft.workspaceMode === "join" ? "pill active" : "pill"}
                    onClick={() => setAuthDraft((previous) => ({ ...previous, workspaceMode: "join" }))}
                  >
                    Dolacz po kodzie
                  </button>
                </div>

                {authDraft.workspaceMode === "join" ? (
                  <label>
                    <span>Kod workspace</span>
                    <input
                      value={authDraft.workspaceCode}
                      onChange={(event) =>
                        setAuthDraft((previous) => ({ ...previous, workspaceCode: event.target.value }))
                      }
                      placeholder="np. AB12CD"
                    />
                  </label>
                ) : (
                  <label>
                    <span>Nazwa workspace</span>
                    <input
                      value={authDraft.workspaceName}
                      onChange={(event) =>
                        setAuthDraft((previous) => ({ ...previous, workspaceName: event.target.value }))
                      }
                      placeholder="np. Zespol sprzedazy"
                    />
                  </label>
                )}
              </>
            ) : null}

            <label>
              <span>Email</span>
              <input
                type="email"
                value={authDraft.email}
                onChange={(event) => setAuthDraft((previous) => ({ ...previous, email: event.target.value }))}
                placeholder="name@company.com"
              />
            </label>
            <label>
              <span>Haslo</span>
              <input
                type="password"
                value={authDraft.password}
                onChange={(event) => setAuthDraft((previous) => ({ ...previous, password: event.target.value }))}
                placeholder="minimum 6 znakow"
              />
            </label>
            {!isRegister ? (
              <button type="button" className="link-button" onClick={() => setAuthMode("forgot")}>
                Zapomnialem hasla
              </button>
            ) : null}
            {authError ? <div className="inline-alert error">{authError}</div> : null}
            <button type="submit" className="primary-button">
              {isRegister ? "Wejdz do workspace" : "Zaloguj"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
