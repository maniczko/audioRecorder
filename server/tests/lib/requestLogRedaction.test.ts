import { describe, expect, it } from 'vitest';
import {
  isSensitiveQueryParamName,
  redactSensitiveRequestUrl,
} from '../../lib/requestLogRedaction.ts';

// -----------------------------------------------------------------
// Issue #1235 - request logs must not expose progress/auth tokens
// Date: 2026-06-28
// Bug: token-like query params could be emitted by request logging.
// Fix: redact sensitive query values before logging request targets.
// -----------------------------------------------------------------
describe('Regression: Issue #1235 - request log query redaction', () => {
  it('redacts token-like query params while preserving safe params', () => {
    const result = redactSensitiveRequestUrl(
      '/media/recordings/rec-1/progress?progressToken=secret-token&stage=stt&api_key=secret-key'
    );

    expect(result).toBe(
      '/media/recordings/rec-1/progress?progressToken=redacted&stage=stt&api_key=redacted'
    );
    expect(result).not.toContain('secret-token');
    expect(result).not.toContain('secret-key');
  });

  it('handles absolute URLs and malformed encoded names defensively', () => {
    expect(
      redactSensitiveRequestUrl(
        'https://api.example.test/path?token=abc&returnTo=%2Fstudio&bad%ZZ=kept'
      )
    ).toBe('https://api.example.test/path?token=redacted&returnTo=%2Fstudio&bad%ZZ=kept');
  });

  it('keeps URLs without query strings and redacts query strings with fragments', () => {
    expect(redactSensitiveRequestUrl('/media/recordings/rec-1/progress')).toBe(
      '/media/recordings/rec-1/progress'
    );
    expect(redactSensitiveRequestUrl('/path?token=abc&stage=stt#section')).toBe(
      '/path?token=redacted&stage=stt#section'
    );
  });

  it('handles empty query parts and sensitive params without values', () => {
    expect(redactSensitiveRequestUrl('/path?stage=stt&&token&secret=abc')).toBe(
      '/path?stage=stt&&token=redacted&secret=redacted'
    );
  });

  it('classifies common token, secret, and credential query names as sensitive', () => {
    expect(isSensitiveQueryParamName('')).toBe(false);
    expect(isSensitiveQueryParamName('progressToken')).toBe(true);
    expect(isSensitiveQueryParamName('refresh_token')).toBe(true);
    expect(isSensitiveQueryParamName('api-key')).toBe(true);
    expect(isSensitiveQueryParamName('clientSecret')).toBe(true);
    expect(isSensitiveQueryParamName('signature')).toBe(true);
    expect(isSensitiveQueryParamName('stage')).toBe(false);
  });
});
