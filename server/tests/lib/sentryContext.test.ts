import { describe, expect, it } from 'vitest';
import {
  sanitizeSentryContext,
  sanitizeSentryValue,
  sentryTagsFromContext,
} from '../../lib/sentryContext.ts';

describe('sentryContext', () => {
  it('returns empty context for missing or non-object input', () => {
    expect(sanitizeSentryContext(undefined)).toEqual({});
    expect(sanitizeSentryContext(null as never)).toEqual({});
    expect(sanitizeSentryContext('not-context' as never)).toEqual({});
  });

  it('redacts sensitive fields recursively while preserving safe ids', () => {
    const sanitized = sanitizeSentryContext({
      requestId: 'req_1',
      workspaceId: 'ws_1',
      recordingId: 'rec_1',
      accessToken: 'secret-token',
      transcriptJson: 'private transcript',
      nested: {
        audioBuffer: Buffer.from('audio'),
        safeValue: true,
      },
      attempts: [
        {
          providerId: 'openai',
          rawPayload: { text: 'secret payload' },
        },
      ],
    });

    expect(sanitized).toMatchObject({
      requestId: 'req_1',
      workspaceId: 'ws_1',
      recordingId: 'rec_1',
      accessToken: '[redacted]',
      transcriptJson: '[redacted]',
      nested: {
        audioBuffer: '[redacted]',
        safeValue: true,
      },
      attempts: [
        {
          providerId: 'openai',
          rawPayload: '[redacted]',
        },
      ],
    });
    expect(JSON.stringify(sanitized)).not.toContain('secret-token');
    expect(JSON.stringify(sanitized)).not.toContain('private transcript');
  });

  it('normalizes Error values without stack traces', () => {
    const error = Object.assign(new Error('STT failed'), {
      code: 'stt_failed',
      statusCode: 502,
    });

    expect(sanitizeSentryValue(error)).toEqual({
      name: 'Error',
      message: 'STT failed',
      code: 'stt_failed',
      statusCode: 502,
    });
  });

  it('stringifies non-plain values and truncates very deep objects', () => {
    const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } };

    expect(sanitizeSentryValue(Symbol('provider'))).toBe('Symbol(provider)');
    expect(sanitizeSentryValue(deep)).toEqual({
      a: {
        b: {
          c: {
            d: {
              e: '[truncated]',
            },
          },
        },
      },
    });
  });

  it('builds searchable tags from populated context keys only', () => {
    const longProvider = 'p'.repeat(240);

    expect(
      sentryTagsFromContext({
        workspaceId: 'ws_1',
        recordingId: 'rec_1',
        jobId: '',
        pipelineStage: 'stt',
        providerId: longProvider,
        errorCode: null,
      })
    ).toEqual({
      workspaceId: 'ws_1',
      recordingId: 'rec_1',
      pipelineStage: 'stt',
      providerId: 'p'.repeat(200),
    });
  });
});
