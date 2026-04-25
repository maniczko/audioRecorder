import type { AuthMode } from './authValues';

interface AuthModeTabsProps {
  authMode: AuthMode;
  onChange: (mode: AuthMode) => void;
}

export default function AuthModeTabs({ authMode, onChange }: AuthModeTabsProps) {
  return (
    <div className="auth-mode-tabs">
      <button
        type="button"
        className={`auth-mode-tab ${authMode === 'login' ? 'active' : ''}`}
        onClick={() => onChange('login')}
      >
        Logowanie
      </button>
      <button
        type="button"
        className={`auth-mode-tab ${authMode === 'register' ? 'active' : ''}`}
        onClick={() => onChange('register')}
      >
        Rejestracja
      </button>
    </div>
  );
}
