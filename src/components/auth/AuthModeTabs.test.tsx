import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import AuthModeTabs from './AuthModeTabs';

describe('AuthModeTabs', () => {
  test('marks the current auth mode as active', () => {
    render(<AuthModeTabs authMode="register" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Rejestracja' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Logowanie' })).not.toHaveClass('active');
  });

  test('requests login mode when login tab is clicked', () => {
    const onChange = vi.fn();
    render(<AuthModeTabs authMode="register" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Logowanie' }));

    expect(onChange).toHaveBeenCalledWith('login');
  });

  test('requests register mode when register tab is clicked', () => {
    const onChange = vi.fn();
    render(<AuthModeTabs authMode="login" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Rejestracja' }));

    expect(onChange).toHaveBeenCalledWith('register');
  });
});
