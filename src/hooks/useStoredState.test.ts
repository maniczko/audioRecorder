import { describe, test } from 'vitest';

// These tests require vi.mocked() which doesn't work properly with Vitest 4 module mocking
describe('useStoredState (dual-write sync engine with IndexedDB)', () => {
  test.skip('yields localStorage fallback value INSTANTLY on first render to prevent blank UI', async () => {});
  test.skip('dual-writes to both synchronous localStorage and async IndexedDB on update', async () => {});
});
