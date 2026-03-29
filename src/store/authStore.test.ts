import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../services/authService', () => ({
  createAuthService: vi.fn(() => ({
    register: vi.fn(),
    login: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    signInWithGoogle: vi.fn(),
  })),
}));

vi.mock('./workspaceStore', () => {
  const setUsers = vi.fn();
  const setWorkspaces = vi.fn();
  const setSession = vi.fn();
  return {
    useWorkspaceStore: {
      getState: vi.fn(() => ({
        users: [],
        workspaces: [],
        setUsers,
        setWorkspaces,
        setSession,
      })),
    },
  };
});

vi.mock('../lib/appState', () => ({
  buildProfileDraft: vi.fn(() => ({ name: '', role: '', company: '' })),
}));

describe('authStore', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('submitAuth persists the remote session token for follow-up api requests', async () => {
    const { createAuthService } = await import('../services/authService');
    (createAuthService as any).mockReturnValue({
      register: vi.fn().mockResolvedValue({
        user: { id: 'u1', email: 'a@b.com' },
        workspaceId: 'ws1',
        token: 'token_abc',
      }),
    });

    vi.resetModules();
    const { useAuthStore } = await import('./authStore');
    const { useWorkspaceStore } = await import('./workspaceStore');

    useAuthStore.setState({
      authMode: 'register',
      authDraft: {
        name: 'Alice',
        email: 'a@b.com',
        password: 'pass123',
        workspaceMode: 'create',
        workspaceName: 'My Team',
        workspaceCode: '',
        role: '',
        company: '',
      },
      authError: '',
    });

    await useAuthStore.getState().submitAuth();

    const { setSession } = useWorkspaceStore.getState();
    expect(setSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', workspaceId: 'ws1', token: 'token_abc' })
    );
    expect(useAuthStore.getState().authError).toBe('');
  });

  test('subsequent login overwrites stale legacy token', async () => {
    const { createAuthService } = await import('../services/authService');
    (createAuthService as any).mockReturnValue({
      login: vi.fn().mockResolvedValue({
        user: { id: 'u1', email: 'a@b.com' },
        workspaceId: 'ws1',
        token: 'new_token',
      }),
    });

    vi.resetModules();
    const { useAuthStore } = await import('./authStore');
    const { useWorkspaceStore } = await import('./workspaceStore');

    useAuthStore.setState({
      authMode: 'login',
      authDraft: {
        email: 'a@b.com',
        password: 'pass123',
        name: '',
        role: '',
        company: '',
        workspaceMode: 'create',
        workspaceName: '',
        workspaceCode: '',
      },
    });

    await useAuthStore.getState().submitAuth();

    const { setSession } = useWorkspaceStore.getState();
    expect(setSession).toHaveBeenCalledWith(expect.objectContaining({ token: 'new_token' }));
  });

  test('submitAuth sets authError on failure', async () => {
    const { createAuthService } = await import('../services/authService');
    (createAuthService as any).mockReturnValue({
      register: vi.fn().mockRejectedValue(new Error('Email juz istnieje.')),
    });

    vi.resetModules();
    const { useAuthStore } = await import('./authStore');

    useAuthStore.setState({
      authMode: 'register',
      authDraft: {
        name: 'Alice',
        email: 'a@b.com',
        password: 'pass',
        workspaceMode: 'create',
        workspaceName: '',
        workspaceCode: '',
        role: '',
        company: '',
      },
    });

    await useAuthStore.getState().submitAuth();

    expect(useAuthStore.getState().authError).toBe('Email juz istnieje.');
  });

  test('setAuthDraft merges partial updates into existing draft', async () => {
    const { useAuthStore } = await import('./authStore');

    useAuthStore.getState().setAuthDraft({ name: 'Bob' });

    expect(useAuthStore.getState().authDraft.name).toBe('Bob');
    expect(useAuthStore.getState().authDraft.password).toBe('');
  });

  test('setAuthMode resets error and message state', async () => {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.setState({ authError: 'old error', googleAuthMessage: 'old msg' });

    useAuthStore.getState().setAuthMode('login');

    expect(useAuthStore.getState().authMode).toBe('login');
    expect(useAuthStore.getState().authError).toBe('');
    expect(useAuthStore.getState().googleAuthMessage).toBe('');
  });
});
