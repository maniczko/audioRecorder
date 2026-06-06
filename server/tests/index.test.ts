import { describe, test, expect, vi } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  initSentry: vi.fn(),
}));

vi.mock('../sentry.ts', () => ({
  initSentry: sentryMocks.initSentry,
}));

describe('index.ts', () => {
  test('exports bootstrap function without initializing telemetry on import', async () => {
    const { bootstrap } = await import('../index.js');

    expect(typeof bootstrap).toBe('function');
    expect(sentryMocks.initSentry).not.toHaveBeenCalled();
  }, 15000);
});
