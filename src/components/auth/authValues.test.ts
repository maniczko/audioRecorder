import { normalizeAuthDraft, normalizeResetDraft, shouldBlockAuthSubmit } from './authValues';

describe('authValues', () => {
  test('normalizes missing auth draft fields to form-safe strings', () => {
    expect(normalizeAuthDraft(null)).toEqual({
      name: '',
      role: '',
      company: '',
      email: '',
      password: '',
      workspaceMode: 'create',
      workspaceName: '',
      workspaceCode: '',
    });
  });

  test('preserves join workspace mode when explicitly selected', () => {
    expect(normalizeAuthDraft({ workspaceMode: 'join' }).workspaceMode).toBe('join');
  });

  test('falls back to create workspace mode for unknown values', () => {
    expect(normalizeAuthDraft({ workspaceMode: 'invalid' }).workspaceMode).toBe('create');
  });

  test('normalizes reset draft values', () => {
    expect(
      normalizeResetDraft({
        email: 'anna@example.com',
        code: 123456,
        newPassword: null,
        confirmPassword: undefined,
      })
    ).toEqual({
      email: 'anna@example.com',
      code: '123456',
      newPassword: '',
      confirmPassword: '',
    });
  });

  test('blocks only short registration passwords', () => {
    const values = normalizeAuthDraft({ password: '123' });

    expect(shouldBlockAuthSubmit('register', values)).toBe(true);
    expect(shouldBlockAuthSubmit('login', values)).toBe(false);
    expect(shouldBlockAuthSubmit('forgot', values)).toBe(false);
  });
});
