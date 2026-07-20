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
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByLabelText(/has/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zalog/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logowanie/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejestracja/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rejestr/i })).toBeInTheDocument();
  });

  it('renders register fields and workspace mode controls', async () => {
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

    await userEvent.click(screen.getByRole('button', { name: /rejestracja/i }));

    expect(screen.getByLabelText(/imi?.*nazw|imie.*nazw/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nowy zesp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dolac|do.*kodu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wejd?|wejdz/i })).toBeInTheDocument();
  });

  it('renders password reset controls in forgotten mode', async () => {
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

    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wyslij kod resetu|reset/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logowania/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /wyslij kod resetu|reset/i }));
    expect(requestResetCodeMock).toHaveBeenCalledTimes(1);

    expect(screen.getByLabelText('Kod resetu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zmień hasło|zmien haslo/i })).toBeInTheDocument();
    expect(completeResetMock).not.toHaveBeenCalled();
  });

  it('prevents submit for weak register password', async () => {
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

    await userEvent.type(screen.getByLabelText(/imi?.*nazw|imie.*nazw/i), 'Jan K.');
    await userEvent.type(screen.getByLabelText(/adres email/i), 'jan@example.com');
    await userEvent.type(screen.getByLabelText(/has/i), '123');
    await userEvent.click(screen.getByRole('button', { name: /wejd?|wejdz/i }));

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
