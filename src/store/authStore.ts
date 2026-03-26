import { create } from 'zustand';
import { createAuthService } from '../services/authService';
import { useWorkspaceStore } from './workspaceStore';
import { buildProfileDraft } from '../lib/appState';

const EMPTY_AUTH_DRAFT = {
  name: '',
  role: '',
  company: '',
  email: '',
  password: '',
  workspaceMode: 'create',
  workspaceName: '',
  workspaceCode: '',
};
const EMPTY_RESET_DRAFT = { email: '', code: '', newPassword: '', confirmPassword: '' };
const EMPTY_PASSWORD_DRAFT = { currentPassword: '', newPassword: '', confirmPassword: '' };

const authService = createAuthService() as any;

function mergeUserIntoCollection(existingUsers: any[], user: any) {
  if (!user) return existingUsers;
  const nextUsers = Array.isArray(existingUsers) ? [...existingUsers] : [];
  const existingIndex = nextUsers.findIndex((candidate) => candidate.id === user.id);
  if (existingIndex === -1) return [...nextUsers, user];
  nextUsers[existingIndex] = { ...nextUsers[existingIndex], ...user };
  return nextUsers;
}

function resolveDraftUpdate<T extends object>(previous: T, nextValue: T | ((previous: T) => T)) {
  const resolved =
    typeof nextValue === 'function' ? (nextValue as (p: T) => T)(previous) : nextValue;
  if (!resolved || typeof resolved !== 'object') {
    return previous;
  }
  return { ...previous, ...resolved };
}

export const useAuthStore = create<any>((set, get) => ({
  authMode: 'register',
  authDraft: EMPTY_AUTH_DRAFT,
  authError: '',
  googleAuthMessage: '',
  resetDraft: EMPTY_RESET_DRAFT,
  resetMessage: '',
  resetPreviewCode: '',
  resetExpiresAt: '',
  profileDraft: buildProfileDraft(null),
  profileMessage: '',
  passwordDraft: EMPTY_PASSWORD_DRAFT,
  securityMessage: '',

  setAuthMode: (authMode) =>
    set({
      authMode,
      authError: '',
      googleAuthMessage: '',
      resetMessage: '',
      resetPreviewCode: '',
      resetExpiresAt: '',
    }),
  setAuthDraft: (authDraft) =>
    set((state) => ({
      authDraft: resolveDraftUpdate(state.authDraft, authDraft),
    })),
  setAuthError: (err) => set({ authError: err }),
  setGoogleAuthMessage: (msg) => set({ googleAuthMessage: msg }),
  setResetDraft: (draft) =>
    set((state) => ({
      resetDraft: resolveDraftUpdate(state.resetDraft, draft),
    })),
  setProfileDraft: (draft) =>
    set((state) => ({
      profileDraft: resolveDraftUpdate(state.profileDraft, draft),
    })),
  setPasswordDraft: (draft) =>
    set((state) => ({
      passwordDraft: resolveDraftUpdate(state.passwordDraft, draft),
    })),

  submitAuth: async () => {
    set({ authError: '', resetMessage: '' });
    const { authMode, authDraft } = get();
    const { users, workspaces, setUsers, setWorkspaces, setSession } = useWorkspaceStore.getState();

    try {
      const result =
        authMode === 'register'
          ? await authService.register({ users, workspaces, draft: authDraft })
          : await authService.login({ users, workspaces, draft: authDraft });

      if (result.users) setUsers(result.users);
      else if (result.user) setUsers((prev) => mergeUserIntoCollection(prev, result.user));
      if (result.workspaces) setWorkspaces(result.workspaces);
      setSession({
        userId: result.user.id,
        workspaceId: result.workspaceId,
        token: result.token || '',
      });
    } catch (error: any) {
      set({ authError: error.message });
    }
  },

  requestResetCode: async () => {
    set({ authError: '', resetMessage: '' });
    const { resetDraft } = get();
    const { users, setUsers } = useWorkspaceStore.getState();
    try {
      const result = await authService.requestPasswordReset({ users, draft: resetDraft });
      if (result.users) setUsers(result.users);
      set({
        resetPreviewCode: result.recoveryCode || '',
        resetExpiresAt: result.expiresAt || '',
        resetMessage: 'Kod resetu jest gotowy. Ustaw nowe haslo ponizej.',
      });
    } catch (error: any) {
      set({ authError: error.message });
    }
  },

  completeReset: async () => {
    set({ authError: '', resetMessage: '' });
    const { resetDraft } = get();
    const { users, setUsers } = useWorkspaceStore.getState();
    try {
      const nextUsers = await authService.resetPassword({ users, draft: resetDraft });
      if (Array.isArray(nextUsers)) setUsers(nextUsers);
      else if (Array.isArray(nextUsers?.users)) setUsers(nextUsers.users);

      set({
        resetMessage: 'Haslo zostalo zmienione. Mozesz sie teraz zalogowac.',
        resetPreviewCode: '',
        resetExpiresAt: '',
        resetDraft: { ...EMPTY_RESET_DRAFT, email: resetDraft.email },
        authMode: 'login',
      });
    } catch (error: any) {
      set({ authError: error.message });
    }
  },

  handleGoogleProfile: async (profile) => {
    const { users, workspaces, setUsers, setWorkspaces, setSession } = useWorkspaceStore.getState();
    try {
      const result = await authService.signInWithGoogle({ users, workspaces, profile });
      if (result.users) setUsers(result.users);
      else if (result.user) setUsers((prev) => mergeUserIntoCollection(prev, result.user));
      if (result.workspaces) setWorkspaces(result.workspaces);
      setSession({
        userId: result.user.id,
        workspaceId: result.workspaceId,
        token: result.token || '',
      });
      set({ googleAuthMessage: `Zalogowano przez Google jako ${profile.email}.`, authError: '' });
    } catch (error: any) {
      set({ googleAuthMessage: error.message });
    }
  },

  saveProfile: async (currentUser) => {
    if (!currentUser) return;
    set({ securityMessage: '' });
    const { profileDraft } = get();
    const { users, setUsers } = useWorkspaceStore.getState();
    try {
      const result = await authService.updateProfile({
        users,
        userId: currentUser.id,
        updates: profileDraft,
      });
      if (Array.isArray(result)) setUsers(result);
      else if (Array.isArray(result?.users)) setUsers(result.users);
      else if (result?.user) setUsers((prev) => mergeUserIntoCollection(prev, result.user));
      set({ profileMessage: 'Profil zapisany.' });
    } catch (error: any) {
      set({ securityMessage: error.message });
    }
  },

  updatePassword: async (currentUser) => {
    if (!currentUser) return;
    set({ profileMessage: '' });
    const { passwordDraft } = get();
    const { users, setUsers } = useWorkspaceStore.getState();
    try {
      const result = await authService.changePassword({
        users,
        userId: currentUser.id,
        draft: passwordDraft,
      });
      if (Array.isArray(result)) setUsers(result);
      else if (Array.isArray(result?.users)) setUsers(result.users);
      else if (result?.user) setUsers((prev) => mergeUserIntoCollection(prev, result.user));
      set({ passwordDraft: EMPTY_PASSWORD_DRAFT, securityMessage: 'Haslo zostalo zmienione.' });
    } catch (error: any) {
      set({ securityMessage: error.message });
    }
  },
}));
