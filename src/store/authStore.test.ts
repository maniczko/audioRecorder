import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.unmock('./authStore');
vi.unmock('./workspaceStore');

import { useAuthStore } from './authStore';
import { useWorkspaceStore } from './workspaceStore';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock('../services/authService', () => ({
  createAuthService: () => mocks,
}));

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useWorkspaceStore.setState({ users: [], workspaces: [], session: null });
    useAuthStore.setState({
      authMode: 'register',
      authDraft: {
        name: '',
        role: '',
        company: '',
        email: '',
        password: '',
        workspaceMode: 'create',
        workspaceName: '',
        workspaceCode: '',
      },
      authError: '',
      googleAuthMessage: '',
      resetDraft: { email: '', code: '', newPassword: '', confirmPassword: '' },
      resetMessage: '',
      resetPreviewCode: '',
      resetExpiresAt: '',
      profileMessage: '',
      passwordDraft: { currentPassword: '', newPassword: '', confirmPassword: '' },
      securityMessage: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('submitAuth persists user workspace and token after registration', async () => {
    mocks.register.mockResolvedValue({
      user: { id: 'u1', email: 'a@example.com' },
      users: [{ id: 'u1', email: 'a@example.com' }],
      workspaces: [{ id: 'ws1', memberIds: ['u1'] }],
      workspaceId: 'ws1',
      token: 'token-1',
    });
    useAuthStore.getState().setAuthDraft({
      name: 'Alice',
      email: 'a@example.com',
      password: 'pass123',
      workspaceName: 'Team',
    });

    await useAuthStore.getState().submitAuth();

    expect(mocks.register).toHaveBeenCalledWith(
      expect.objectContaining({ draft: expect.objectContaining({ email: 'a@example.com' }) })
    );
    expect(useWorkspaceStore.getState().session).toEqual({
      userId: 'u1',
      workspaceId: 'ws1',
      token: 'token-1',
    });
  });

  test('submitAuth normalizes technical login errors for users', async () => {
    mocks.login.mockRejectedValue(new Error('(ENOTFOUND) tenant/user postgres.example not found'));
    useAuthStore.getState().setAuthMode('login');
    useAuthStore.getState().setAuthDraft({ email: 'missing@example.com', password: 'bad' });

    await useAuthStore.getState().submitAuth();

    expect(useAuthStore.getState().authError).toBe(
      'Logowanie jest chwilowo niedostępne. Spróbuj ponownie za chwilę.'
    );
    expect(useAuthStore.getState().authError).not.toMatch(/ENOTFOUND|postgres|tenant/i);
  });

  test('submitAuth rejects remote auth responses without backend token', async () => {
    (mocks as any).mode = 'remote';
    mocks.login.mockResolvedValue({
      user: { id: 'u1', email: 'a@example.com' },
      users: [{ id: 'u1', email: 'a@example.com' }],
      workspaces: [{ id: 'ws1', memberIds: ['u1'] }],
      workspaceId: 'ws1',
    });
    useAuthStore.getState().setAuthMode('login');
    useAuthStore.getState().setAuthDraft({ email: 'a@example.com', password: 'pass123' });

    await useAuthStore.getState().submitAuth();

    expect(useWorkspaceStore.getState().session).toBeNull();
    expect(useAuthStore.getState().authError).toContain('tokenu backendu');
    (mocks as any).mode = undefined;
  });

  test('setAuthDraft merges partial updates without dropping existing fields', () => {
    useAuthStore.getState().setAuthDraft({ email: 'a@example.com' });
    useAuthStore.getState().setAuthDraft({ name: 'Alice' });

    expect(useAuthStore.getState().authDraft).toMatchObject({
      email: 'a@example.com',
      name: 'Alice',
      workspaceMode: 'create',
    });
  });

  test('requestResetCode stores recovery metadata and clears stale errors', async () => {
    useWorkspaceStore.setState({ users: [{ id: 'u1', email: 'a@example.com' }] });
    mocks.requestPasswordReset.mockResolvedValue({
      users: [{ id: 'u1', email: 'a@example.com' }],
      recoveryCode: '123456',
      expiresAt: '2026-05-19T12:00:00.000Z',
    });
    useAuthStore.setState({ authError: 'old' });
    useAuthStore.getState().setResetDraft({ email: 'a@example.com' });

    await useAuthStore.getState().requestResetCode();

    expect(useAuthStore.getState()).toMatchObject({
      authError: '',
      resetPreviewCode: '123456',
      resetExpiresAt: '2026-05-19T12:00:00.000Z',
    });
  });

  test('updatePassword does nothing without a current user', async () => {
    await useAuthStore.getState().updatePassword(null);

    expect(mocks.changePassword).not.toHaveBeenCalled();
  });
});
