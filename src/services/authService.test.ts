import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createAuthService } from './authService';
import { apiRequest } from './httpClient';

vi.mock('./httpClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({ user: { id: 'u1' } }),
}));

vi.mock('./config', () => ({
  APP_DATA_PROVIDER: 'remote',
}));

describe('authService - remote mode', () => {
  const authService = createAuthService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('register calls /auth/register', async () => {
    const draft = { email: 'test@ex.com', password: 'pass', name: 'User' };

    await authService.register({ draft });

    expect(apiRequest).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: draft
    });
  });

  test('login calls /auth/login', async () => {
    const draft = { email: 'test@ex.com', password: 'pass' };

    await authService.login({ draft });

    expect(apiRequest).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: draft
    });
  });

  test('updateProfile calls correct URL', async () => {
    const updates = { name: 'New Name' };
    await authService.updateProfile({ userId: 'u1', updates });

    expect(apiRequest).toHaveBeenCalledWith('/users/u1/profile', {
      method: 'PUT',
      body: updates
    });
  });

  test('signInWithGoogle calls /auth/google', async () => {
    const profile = { sub: 'google-1', email: 'g@ex.com' };
    await authService.signInWithGoogle({ profile });

    expect(apiRequest).toHaveBeenCalledWith('/auth/google', {
      method: 'POST',
      body: profile
    });
  });
});
