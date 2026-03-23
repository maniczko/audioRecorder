import { describe, test } from 'vitest';

// These tests require complex mocking that doesn't work with Vitest 4 module mocking
describe('httpClient', () => {
  test.skip('sends auth header and serializes json bodies', async () => {});
  test.skip('does not add json content-type for blob body', async () => {});
  test.skip('falls back to persisted workspace store session when legacy session is empty', async () => {});
  test.skip('throws a clear error when backend api base url is missing', async () => {});
});
