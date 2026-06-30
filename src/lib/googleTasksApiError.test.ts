/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchGoogleTaskLists } from './google';

describe('Google Tasks API errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('includes Google API reason when task lists request is forbidden', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 403,
              message: 'Google Tasks API has not been used in project.',
              errors: [
                {
                  domain: 'usageLimits',
                  reason: 'accessNotConfigured',
                  message: 'Google Tasks API has not been used in project.',
                },
              ],
              status: 'PERMISSION_DENIED',
            },
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
    );

    const error = await fetchGoogleTaskLists('token').catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      status: 403,
      reason: 'accessNotConfigured',
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/accessNotConfigured/);
  });
});
