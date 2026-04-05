import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

describe('postProcessing.ts — LLM correction error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOICELOG_OPENAI_API_KEY = 'sk-test-key';
    process.env.VOICELOG_OPENAI_BASE_URL = 'https://api.openai.test/v1';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns original segments when HTTP response is not ok', async () => {
    vi.resetModules();
    // httpClient mock will retry and eventually fail since no real server
    const { correctTranscriptWithLLM } = await import('../postProcessing.ts');
    const segments = [
      { id: 1, text: 'test segment' },
      { id: 2, text: 'another segment' },
    ];

    const result = await correctTranscriptWithLLM(segments);

    // Should return original segments on error (not crash)
    expect(result).toEqual(segments);
  });

  test('returns original segments when TRANSCRIPT_CORRECTION is false', async () => {
    vi.resetModules();
    delete process.env.VOICELOG_OPENAI_API_KEY;
    process.env.TRANSCRIPT_CORRECTION = 'false';

    const { correctTranscriptWithLLM } = await import('../postProcessing.ts');
    const segments = [{ id: 1, text: 'original' }];

    const result = await correctTranscriptWithLLM(segments);

    expect(result).toEqual(segments);
  });
});
