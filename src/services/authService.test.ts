import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRegisterUser = vi.fn();
const mockLoginUser = vi.fn();
const mockRequestPasswordReset = vi.fn();
const mockResetPasswordWithCode = vi.fn();
const mockUpdateUserProfile = vi.fn();
const mockChangeUserPassword = vi.fn();
const mockUpsertGoogleUser = vi.fn();
const mockApiRequest = vi.fn();

let mockAppDataProvider = 'local';

vi.mock('../lib/auth', () => ({
  registerUser: (...args: any[]) => mockRegisterUser(...args),
  loginUser: (...args: any[]) => mockLoginUser(...args),
  requestPasswordReset: (...args: any[]) => mockRequestPasswordReset(...args),
  resetPasswordWithCode: (...args: any[]) => mockResetPasswordWithCode(...args),
  updateUserProfile: (...args: any[]) => mockUpdateUserProfile(...args),
  changeUserPassword: (...args: any[]) => mockChangeUserPassword(...args),
  upsertGoogleUser: (...args: any[]) => mockUpsertGoogleUser(...args),
}));

vi.mock('./httpClient', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));

vi.mock('./config', () => ({
  get APP_DATA_PROVIDER() {
    return mockAppDataProvider;
  },
}));

import { createAuthService } from './authService';

describe('createAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('local mode', () => {
    beforeEach(() => {
      mockAppDataProvider = 'local';
    });

    it('returns service with mode "local"', () => {
      const service = createAuthService();
      expect(service.mode).toBe('local');
    });

    it('register delegates to registerUser', () => {
      const service = createAuthService();
      const users = [{ id: '1' }];
      const workspaces = [{ id: 'ws1' }];
      const draft = { email: 'a@b.com' };
      mockRegisterUser.mockReturnValue({ success: true });

      const result = service.register({ users, workspaces, draft });
      expect(mockRegisterUser).toHaveBeenCalledWith(users, workspaces, draft);
      expect(result).toEqual({ success: true });
    });

    it('login delegates to loginUser', () => {
      const service = createAuthService();
      const users = [{ id: '1' }];
      const workspaces: any[] = [];
      const draft = { email: 'a@b.com', password: 'pass' };
      mockLoginUser.mockReturnValue({ token: 'abc' });

      const result = service.login({ users, workspaces, draft });
      expect(mockLoginUser).toHaveBeenCalledWith(users, workspaces, draft);
      expect(result).toEqual({ token: 'abc' });
    });

    it('requestPasswordReset delegates to requestPasswordReset', () => {
      const service = createAuthService();
      mockRequestPasswordReset.mockReturnValue({ sent: true });

      service.requestPasswordReset({ users: [], draft: { email: 'x' } });
      expect(mockRequestPasswordReset).toHaveBeenCalledWith([], { email: 'x' });
    });

    it('resetPassword delegates to resetPasswordWithCode', () => {
      const service = createAuthService();
      mockResetPasswordWithCode.mockReturnValue({ ok: true });

      service.resetPassword({ users: [], draft: { code: '1234' } });
      expect(mockResetPasswordWithCode).toHaveBeenCalledWith([], { code: '1234' });
    });

    it('updateProfile wraps updateUserProfile in Promise.resolve', async () => {
      const service = createAuthService();
      mockUpdateUserProfile.mockReturnValue({ name: 'Updated' });

      const result = await service.updateProfile({
        users: [],
        userId: 'u1',
        updates: { name: 'Updated' },
      });
      expect(mockUpdateUserProfile).toHaveBeenCalledWith([], 'u1', { name: 'Updated' });
      expect(result).toEqual({ name: 'Updated' });
    });

    it('changePassword delegates to changeUserPassword', () => {
      const service = createAuthService();
      mockChangeUserPassword.mockReturnValue({ changed: true });

      service.changePassword({ users: [], userId: 'u1', draft: { old: 'x', new: 'y' } });
      expect(mockChangeUserPassword).toHaveBeenCalledWith([], 'u1', { old: 'x', new: 'y' });
    });

    it('signInWithGoogle wraps upsertGoogleUser in Promise.resolve', async () => {
      const service = createAuthService();
      mockUpsertGoogleUser.mockReturnValue({ user: { id: 'g1' } });

      const result = await service.signInWithGoogle({
        users: [],
        workspaces: [],
        profile: { email: 'g@g.com' },
      });
      expect(mockUpsertGoogleUser).toHaveBeenCalledWith([], [], { email: 'g@g.com' });
      expect(result).toEqual({ user: { id: 'g1' } });
    });
  });

  describe('remote mode', () => {
    beforeEach(() => {
      mockAppDataProvider = 'remote';
      mockApiRequest.mockResolvedValue({ ok: true });
    });

    it('returns service with mode "remote"', () => {
      const service = createAuthService();
      expect(service.mode).toBe('remote');
    });

    it('register calls POST /auth/register', async () => {
      const service = createAuthService();
      const draft = { email: 'a@b.com', password: 'pass' };

      await service.register({ draft });
      expect(mockApiRequest).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        body: draft,
      });
    });

    it('login calls POST /auth/login', async () => {
      const service = createAuthService();
      const draft = { email: 'a@b.com', password: 'pass' };

      await service.login({ draft });
      expect(mockApiRequest).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: draft,
      });
    });

    it('requestPasswordReset calls POST /auth/password/reset/request', async () => {
      const service = createAuthService();
      await service.requestPasswordReset({ draft: { email: 'x' } });
      expect(mockApiRequest).toHaveBeenCalledWith('/auth/password/reset/request', {
        method: 'POST',
        body: { email: 'x' },
      });
    });

    it('resetPassword calls POST /auth/password/reset/confirm', async () => {
      const service = createAuthService();
      await service.resetPassword({ draft: { code: '1234' } });
      expect(mockApiRequest).toHaveBeenCalledWith('/auth/password/reset/confirm', {
        method: 'POST',
        body: { code: '1234' },
      });
    });

    it('updateProfile calls PUT /users/:userId/profile', async () => {
      const service = createAuthService();
      await service.updateProfile({ userId: 'u1', updates: { name: 'New' } });
      expect(mockApiRequest).toHaveBeenCalledWith('/users/u1/profile', {
        method: 'PUT',
        body: { name: 'New' },
      });
    });

    it('changePassword calls POST /users/:userId/password', async () => {
      const service = createAuthService();
      await service.changePassword({ userId: 'u1', draft: { old: 'x', new: 'y' } });
      expect(mockApiRequest).toHaveBeenCalledWith('/users/u1/password', {
        method: 'POST',
        body: { old: 'x', new: 'y' },
      });
    });

    it('signInWithGoogle calls POST /auth/google', async () => {
      const service = createAuthService();
      await service.signInWithGoogle({ profile: { email: 'g@g.com' } });
      expect(mockApiRequest).toHaveBeenCalledWith('/auth/google', {
        method: 'POST',
        body: { email: 'g@g.com' },
      });
    });
  });
});
