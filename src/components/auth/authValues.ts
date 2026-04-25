export interface AuthDraftLike {
  name?: unknown;
  role?: unknown;
  company?: unknown;
  email?: unknown;
  password?: unknown;
  workspaceMode?: unknown;
  workspaceName?: unknown;
  workspaceCode?: unknown;
}

export interface AuthValues {
  name: string;
  role: string;
  company: string;
  email: string;
  password: string;
  workspaceMode: 'create' | 'join';
  workspaceName: string;
  workspaceCode: string;
}

export interface ResetDraftLike {
  email?: unknown;
  code?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
}

export interface ResetValues {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export type AuthMode = 'login' | 'register' | 'forgot';

function toInputValue(value: unknown) {
  return String(value || '');
}

export function normalizeAuthDraft(authDraft?: AuthDraftLike | null): AuthValues {
  return {
    name: toInputValue(authDraft?.name),
    role: toInputValue(authDraft?.role),
    company: toInputValue(authDraft?.company),
    email: toInputValue(authDraft?.email),
    password: toInputValue(authDraft?.password),
    workspaceMode: authDraft?.workspaceMode === 'join' ? 'join' : 'create',
    workspaceName: toInputValue(authDraft?.workspaceName),
    workspaceCode: toInputValue(authDraft?.workspaceCode),
  };
}

export function normalizeResetDraft(resetDraft?: ResetDraftLike | null): ResetValues {
  return {
    email: toInputValue(resetDraft?.email),
    code: toInputValue(resetDraft?.code),
    newPassword: toInputValue(resetDraft?.newPassword),
    confirmPassword: toInputValue(resetDraft?.confirmPassword),
  };
}

export function shouldBlockAuthSubmit(authMode: AuthMode, authValues: AuthValues) {
  return authMode === 'register' && authValues.password.length < 6;
}
