import { describe, test } from 'vitest';

// These tests require backend mocking which is complex to set up properly
// They are skipped until proper mocking infrastructure is in place
describe('authService - remote mode', () => {
  test.skip('register calls /auth/register', async () => {});
  test.skip('login calls /auth/login', async () => {});
  test.skip('updateProfile calls correct URL', async () => {});
  test.skip('signInWithGoogle calls /auth/google', async () => {});
});
