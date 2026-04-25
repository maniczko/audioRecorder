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

  test('runs request and completion actions', () => {
    const props = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Wyślij kod resetu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zmień hasło' }));

    expect(props.requestResetCode).toHaveBeenCalledTimes(1);
    expect(props.completeReset).toHaveBeenCalledTimes(1);
  });

  test('shows preview code and back-to-login action', () => {
    const props = renderForm({ resetPreviewCode: '123456' });

    expect(screen.getByText(/Twój lokalny kod resetu:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wróć do logowania' }));

    expect(props.onBackToLogin).toHaveBeenCalledTimes(1);
  });
});
