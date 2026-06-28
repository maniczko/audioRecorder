import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
}));

vi.mock('../../logger.ts', () => ({
  logger: loggerMock,
}));

import { applyRequestMetadata } from '../../http/app-security.ts';

// -----------------------------------------------------------------
// Issue #1235 - request metadata logs must redact token-like query params
// Date: 2026-06-28
// Bug: request metadata could log sensitive query values if a URL with query was logged.
// Fix: sanitize request targets before passing them to the logger.
// -----------------------------------------------------------------
describe('Regression: Issue #1235 - request metadata redaction', () => {
  beforeEach(() => {
    loggerMock.info.mockClear();
  });

  it('logs request targets with sensitive query values redacted', async () => {
    const app = new Hono();
    applyRequestMetadata(app as any);
    app.get('/media/recordings/:recordingId/progress', (c) => c.json({ ok: true }));

    const response = await app.request(
      '/media/recordings/rec-1/progress?progressToken=secret-token&stage=stt&token=session-token'
    );

    expect(response.status).toBe(200);
    expect(loggerMock.info).toHaveBeenCalledTimes(1);
    const [message, metadata] = loggerMock.info.mock.calls[0];
    expect(message).toContain(
      '/media/recordings/rec-1/progress?progressToken=redacted&stage=stt&token=redacted'
    );
    expect(metadata).toMatchObject({
      method: 'GET',
      route: '/media/recordings/rec-1/progress?progressToken=redacted&stage=stt&token=redacted',
      status: 200,
    });
    expect(message).not.toContain('secret-token');
    expect(message).not.toContain('session-token');
    expect(JSON.stringify(metadata)).not.toContain('secret-token');
    expect(JSON.stringify(metadata)).not.toContain('session-token');
  });
});
