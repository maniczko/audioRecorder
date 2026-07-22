import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import PasswordResetForm from './PasswordResetForm';

function renderForm(overrides = {}) {
  const props = {
    resetValues: {
      email: '',
      code: '',
      newPassword: '',
      confirmPassword: '',
    },
    resetMessage: '',
    resetPreviewCode: '',
    resetExpiresAt: '',
    setResetDraft: vi.fn(),
    requestResetCode: vi.fn(),
    completeReset: vi.fn(),
    onBackToLogin: vi.fn(),
    passwordResetEnabled: true,
    ...overrides,
  };

  render(<PasswordResetForm {...props} />);
  return props;
}

describe('PasswordResetForm', () => {
  test('updates reset email draft', () => {
    const props = renderForm();

    fireEvent.change(screen.getByLabelText('Adres email'), {
      target: { value: 'anna@example.com' },
    });

    expect(props.setResetDraft).toHaveBeenCalledWith(expect.any(Function));
    expect(props.setResetDraft.mock.calls[0][0]({})).toEqual({ email: 'anna@example.com' });
  });

  test('runs request and completion actions when enabled', () => {
    const props = renderForm();

    fireEvent.click(screen.getByRole('button', { name: /wyślij kod resetu/i }));
    fireEvent.click(screen.getByRole('button', { name: /zmień hasło/i }));

    expect(props.requestResetCode).toHaveBeenCalledTimes(1);
    expect(props.completeReset).toHaveBeenCalledTimes(1);
  });

  test('does not run actions when reset is disabled', () => {
    renderForm({ passwordResetEnabled: false });

    expect(screen.getByText(/reset hasła jest obecnie niedostępny/i)).toBeInTheDocument();

    const sendButton = screen.getByRole('button', { name: /wyślij kod resetu/i });
    const resetButton = screen.getByRole('button', { name: /zmień hasło/i });
    fireEvent.click(sendButton);
    fireEvent.click(resetButton);

    expect(sendButton).toBeDisabled();
    expect(resetButton).toBeDisabled();
  });

  test('shows preview code and back-to-login action', () => {
    const props = renderForm({ resetPreviewCode: '123456' });

    expect(screen.getByText(/Twój lokalny kod resetu:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /wróć do logowania/i }));

    expect(props.onBackToLogin).toHaveBeenCalledTimes(1);
  });
});
