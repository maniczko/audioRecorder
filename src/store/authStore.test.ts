import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPasswordWithCode: vi.fn(),
  updateUserProfile: vi.fn(),
  changeUserPassword: vi.fn(),
  upsertGoogleUser: vi.fn(),
  setUsers: vi.fn(),
  setWorkspaces: vi.fn(),
  setSession: vi.fn(),
  buildProfileDraft: vi.fn(() => ({ name: '', role: '', company: '' })),
}));

// Mock the entire authService module to return a mock service
vi.mock('../services/authService', () => ({
  createAuthService: () => ({
    mode: 'local',
    register: mocks.registerUser,
    login: mocks.loginUser,
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPasswordWithCode,
    updateProfile: mocks.updateUserProfile,
    changePassword: mocks.changeUserPassword,
    signInWithGoogle: mocks.upsertGoogleUser,
  }),
}));

// Mock the workspaceStore
vi.mock('./workspaceStore', () => ({
  useWorkspaceStore: {
    users: [],
    workspaces: [],
    setUsers: mocks.setUsers,
    setWorkspaces: mocks.setWorkspaces,
    setSession: mocks.setSession,
    getState() {
      return this;
    },
  },
}));

// Mock appState
vi.mock('../lib/appState', () => ({
  buildProfileDraft: mocks.buildProfileDraft,
}));

describe('authStore', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.registerUser.mockReset();
    mocks.loginUser.mockReset();
    mocks.setUsers.mockReset();
    mocks.setWorkspaces.mockReset();
    mocks.setSession.mockReset();
    mocks.buildProfileDraft.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('submitAuth persists the remote session token for follow-up api requests', async () => {
    mocks.registerUser.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com' },
      workspaces: [{ id: 'ws1' }],
    });

    const { useAuthStore } = await import('./authStore');

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

    expect(mocks.registerUser).toHaveBeenCalled();
    expect(useAuthStore.getState().authError).toBe('');
  });

  test('subsequent login overwrites stale legacy token', async () => {
    mocks.loginUser.mockResolvedValue({
      user: { id: 'u1', email: 'a@b.com' },
      workspaces: [{ id: 'ws1' }],
    });

    const { useAuthStore } = await import('./authStore');

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

    expect(mocks.loginUser).toHaveBeenCalled();
  });

  test('submitAuth sets authError on failure', async () => {
    mocks.registerUser.mockRejectedValue(new Error('Email juz istnieje.'));

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
