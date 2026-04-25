import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import AuthCredentialsForm from './AuthCredentialsForm';
import { normalizeAuthDraft } from './authValues';

function renderForm(overrides = {}) {
  const props = {
    authMode: 'login' as const,
    authValues: normalizeAuthDraft({}),
    authError: '',
    setAuthDraft: vi.fn(),
    setAuthMode: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };

  render(<AuthCredentialsForm {...props} />);
  return props;
}

describe('AuthCredentialsForm', () => {
  test('updates email and password draft fields in login mode', () => {
    const props = renderForm();

    fireEvent.change(screen.getByLabelText('Adres email'), {
      target: { value: 'jan@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Hasło'), {
      target: { value: 'secret-123' },
    });

    expect(props.setAuthDraft).toHaveBeenCalledTimes(2);
    expect(props.setAuthDraft.mock.calls[0][0]({})).toEqual({ email: 'jan@example.com' });
    expect(props.setAuthDraft.mock.calls[1][0]({})).toEqual({ password: 'secret-123' });
  });

  test('switches to forgot mode from login form', () => {
    const props = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Zapomniałeś hasła?' }));

    expect(props.setAuthMode).toHaveBeenCalledWith('forgot');
  });

  test('renders registration-only workspace controls', () => {
    renderForm({ authMode: 'register', authValues: normalizeAuthDraft({}) });

    expect(screen.getByLabelText('Imię i nazwisko')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nowy zespół' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dołącz z kodu' })).toBeInTheDocument();
  });
});
