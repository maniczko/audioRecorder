import { describe, expect, it } from 'vitest';
import { AUTH_INFRASTRUCTURE_ERROR_MESSAGE, normalizeAuthErrorMessage } from './authErrorMessages';

describe('normalizeAuthErrorMessage', () => {
  it('keeps actionable auth validation messages unchanged', () => {
    expect(normalizeAuthErrorMessage(new Error('Niepoprawny email lub haslo.'))).toBe(
      'Niepoprawny email lub haslo.'
    );
  });

  it('hides Supabase/Postgres DNS details behind a user-safe login message', () => {
    const message = normalizeAuthErrorMessage(
      new Error('(ENOTFOUND) tenant/user postgres.jfvlwcjmsfewlugdhghq not found')
    );

    expect(message).toBe(AUTH_INFRASTRUCTURE_ERROR_MESSAGE);
    expect(message).not.toMatch(/ENOTFOUND|postgres|tenant\/user/i);
  });
});
