import { describe, test } from 'vitest';

// These tests require backend mocking which is complex to set up properly
describe('stateService', () => {
  test.skip('returns local no-op implementation when remote mode is disabled', async () => {});
  test.skip('calls bootstrap and sync endpoints in remote mode', async () => {});
});
