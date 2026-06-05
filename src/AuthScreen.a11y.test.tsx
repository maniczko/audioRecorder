/**
 * @vitest-environment jsdom
 * AuthScreen Accessibility & UX smoke
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthDraftLike, ResetDraftLike } from './components/auth/authValues';
import AuthScreen from './AuthScreen';

type DraftState<T> = { value: T };

function createDraftSetter<T>(state: DraftState<T>) {
  return (updater: (previous: T) => T) => {
    state.value = updater(state.value);
  };
}

describe('AuthScreen - Accessibility', () => {
  const authDraftState: DraftState<AuthDraftLike> = { value: {} };
  const resetDraftState: DraftState<ResetDraftLike> = { value: {} };
  const setAuthMode = vi.fn();
  const submitAuth = vi.fn();
  const setResetDraft = vi.fn((updater: (previous: ResetDraftLike) => ResetDraftLike) => {
    resetDraftState.value = updater(resetDraftState.value);
  });

  const requestResetCode = vi.fn();
  const completeReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    authDraftState.value = {
      name: '',
      role: '',
      company: '',
      email: '',
      password: '',
      workspaceMode: 'create',
      workspaceName: '',
      workspaceCode: '',
    };
    resetDraftState.value = {
      email: '',
      code: '',
      newPassword: '',
      confirmPassword: '',
    };
  });

  it('renders login fields and labels', () => {
    render(
      <AuthScreen
        authMode="login"
        setAuthMode={setAuthMode}
        authDraft={authDraftState.value}
        authError=""
        setAuthDraft={createDraftSetter(authDraftState)}
        submitAuth={submitAuth}
        setResetDraft={setResetDraft}
        resetDraft={resetDraftState.value}
        requestResetCode={requestResetCode}
        completeReset={completeReset}
      />
    );

    expect(screen.getByRole('heading', { name: /witaj/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/has/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zalog/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logowanie/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejestracja/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejestr/i })).toBeInTheDocument();
  });

  it('renders register fields and workspace mode controls', async () => {
    const user = userEvent.setup();

    render(
      <AuthScreen
        authMode="register"
        setAuthMode={() => {}}
        authDraft={authDraftState.value}
        authError=""
        setAuthDraft={createDraftSetter(authDraftState)}
        submitAuth={submitAuth}
        setResetDraft={setResetDraft}
        resetDraft={resetDraftState.value}
        requestResetCode={requestResetCode}
        completeReset={completeReset}
      />
    );

    expect(screen.getByLabelText(/imie.*nazw/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nowy zesp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dolac|do.*kodu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wejdz/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /dolac|do.*kodu/i }));
    expect(screen.getByLabelText(/kod zaproszenia/i)).toBeInTheDocument();
  });

  it('renders password reset controls in forgotten mode', async () => {
    const user = userEvent.setup();
    const requestResetCodeMock = vi.fn();
    const completeResetMock = vi.fn();

    render(
      <AuthScreen
        authMode="forgot"
        setAuthMode={() => {}}
        authDraft={authDraftState.value}
        authError=""
        setAuthDraft={createDraftSetter(authDraftState)}
        submitAuth={submitAuth}
        setResetDraft={setResetDraft}
        resetDraft={resetDraftState.value}
        requestResetCode={requestResetCodeMock}
        completeReset={completeResetMock}
      />
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wyslij kod resetu|reset/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /wroc do logowania|back to login/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /wyslij kod resetu|reset/i }));
    expect(requestResetCodeMock).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText(/kod z emaila/i), '123456');
    await user.type(screen.getByPlaceholderText(/nowe has/i), 'strong123');
    await user.type(screen.getByPlaceholderText(/powtorz has/i), 'strong123');
    await user.click(screen.getByRole('button', { name: /zmien has/i }));
    expect(completeResetMock).toHaveBeenCalledTimes(1);
  });

  it('prevents submit for weak register password', async () => {
    const user = userEvent.setup();
    const submitAuthMock = vi.fn();

    render(
      <AuthScreen
        authMode="register"
        setAuthMode={() => {}}
        authDraft={authDraftState.value}
        authError=""
        setAuthDraft={createDraftSetter(authDraftState)}
        submitAuth={submitAuthMock}
        setResetDraft={setResetDraft}
        resetDraft={resetDraftState.value}
        requestResetCode={requestResetCode}
        completeReset={completeReset}
      />
    );

    await user.type(screen.getByLabelText(/imie.*nazw/i), 'Jan K.');
    await user.type(screen.getByLabelText(/email/i), 'jan@example.com');
    await user.type(screen.getByLabelText(/has/i), '123');
    await user.click(screen.getByRole('button', { name: /wejdz/i }));

    expect(submitAuthMock).not.toHaveBeenCalled();
  });

  it('shows validation error content', () => {
    render(
      <AuthScreen
        authMode="login"
        setAuthMode={() => {}}
        authDraft={authDraftState.value}
        authError="Invalid credentials"
        setAuthDraft={createDraftSetter(authDraftState)}
        submitAuth={submitAuth}
        setResetDraft={setResetDraft}
        resetDraft={resetDraftState.value}
        requestResetCode={requestResetCode}
        completeReset={completeReset}
      />
    );

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });
});
