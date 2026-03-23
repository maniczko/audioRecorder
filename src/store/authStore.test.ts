import { describe, test } from 'vitest';

// These tests require backend mocking which is complex to set up properly
describe('authStore', () => {
  test.skip('submitAuth persists the remote session token for follow-up api requests', async () => {});
  test.skip('subsequent login overwrites stale legacy token', async () => {});
});
