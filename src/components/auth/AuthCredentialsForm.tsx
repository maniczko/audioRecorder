import type { FormEvent } from 'react';
import { ArrowRight, Briefcase, KeyRound, Lock, Mail, User, Users } from 'lucide-react';
import type { AuthDraftLike, AuthMode, AuthValues } from './authValues';

interface AuthCredentialsFormProps {
  authMode: AuthMode;
  authValues: AuthValues;
  authError?: string;
  setAuthDraft: (updater: (previous: AuthDraftLike) => AuthDraftLike) => void;
  setAuthMode: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function AuthCredentialsForm({
  authMode,
  authValues,
  authError,
  setAuthDraft,
  setAuthMode,
  onSubmit,
}: AuthCredentialsFormProps) {
  const isRegister = authMode === 'register';

  return (
    <form className="auth-form" onSubmit={onSubmit}>
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
                onChange={(event) => {
                  const { value } = event.target;
                  setAuthDraft((previous) => ({ ...previous, name: value }));
                }}
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
                  onChange={(event) => {
                    const { value } = event.target;
                    setAuthDraft((previous) => ({ ...previous, role: value }));
                  }}
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
                  onChange={(event) => {
                    const { value } = event.target;
                    setAuthDraft((previous) => ({ ...previous, company: value }));
                  }}
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
            onChange={(event) => {
              const { value } = event.target;
              setAuthDraft((previous) => ({ ...previous, email: value }));
            }}
          />
        </div>
      </div>

      <div className="auth-input-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
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
            placeholder="Minimum 6 znakĂłw"
            value={authValues.password}
            onChange={(event) => {
              const { value } = event.target;
              setAuthDraft((previous) => ({ ...previous, password: value }));
            }}
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
              onClick={() => setAuthDraft((previous) => ({ ...previous, workspaceMode: 'create' }))}
            >
              Nowy zespół
            </button>
            <button
              type="button"
              className={`workspace-choice-card ${authValues.workspaceMode === 'join' ? 'active' : ''}`}
              onClick={() => setAuthDraft((previous) => ({ ...previous, workspaceMode: 'join' }))}
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
                  onChange={(event) => {
                    const { value } = event.target;
                    setAuthDraft((previous) => ({
                      ...previous,
                      workspaceName: value,
                    }));
                  }}
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
                  onChange={(event) => {
                    const { value } = event.target;
                    setAuthDraft((previous) => ({
                      ...previous,
                      workspaceCode: value,
                    }));
                  }}
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
  );
}
