import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadTranscriptionModule() {
  vi.resetModules();
  process.env.VOICELOG_STT_PROVIDER = 'groq';
  process.env.GROQ_API_KEY = 'groq-key';
  process.env.OPENAI_API_KEY = 'openai-key';
  process.env.VOICELOG_OPENAI_API_KEY = 'openai-key';
  process.env.VOICELOG_OPENAI_BASE_URL = 'https://api.openai.test/v1';
  process.env.VOICELOG_STT_MODEL_FULL = 'gpt-4o-transcribe';
  process.env.VOICELOG_STT_FALLBACK_PROVIDER = 'openai';
  return import('../transcription.ts');
}

describe('transcription quality fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.VOICELOG_STT_PROVIDER;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.VOICELOG_OPENAI_API_KEY;
    delete process.env.VOICELOG_OPENAI_BASE_URL;
    delete process.env.VOICELOG_STT_MODEL_FULL;
    delete process.env.VOICELOG_STT_FALLBACK_PROVIDER;
    vi.doUnmock('../lib/httpClient.ts');
    vi.doUnmock('node:child_process');
  });

  it('retries suspicious Groq gibberish with OpenAI gpt-4o-transcribe', async () => {
    const httpClientSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          text: 'Wspolpraca w Wroclawiu',
          segments: [
            {
              text: 'Wspolpraca w Wroclawiu',
              start: 9,
              end: 11,
              avg_logprob: -0.2,
              no_speech_prob: 0.05,
            },
          ],
        }),
      json: async () => ({}),
    } as any);
    vi.doMock('../lib/httpClient.ts', () => ({ httpClient: httpClientSpy }));
    const transcription = await loadTranscriptionModule();

    const result = await transcription.maybeRetryPoorQualityWithOpenAi({
      sttResult: {
        providerId: 'groq',
        providerLabel: 'Groq Whisper',
        model: 'whisper-large-v3',
        attempts: [],
        payload: {
          text: 'u \u8b1d\u8b1d.',
          segments: [
            {
              text: 'u \u8b1d\u8b1d.',
              start: 9,
              end: 9.5,
              avg_logprob: -2,
              no_speech_prob: 0.8,
            },
          ],
        },
      },
      request: {
        buffer: Buffer.from('audio'.repeat(200)),
        filename: 'chunk.wav',
        contentType: 'audio/wav',
        fields: { language: 'pl', model: 'whisper-large-v3' },
      },
      audioQuality: { qualityLabel: 'fair' },
    });

    expect(result.providerId).toBe('openai');
    expect(result.payload.text).toBe('Wspolpraca w Wroclawiu');
    const [, options] = httpClientSpy.mock.calls[0];
    const body = options?.body as FormData;
    expect(body.get('model')).toBe('gpt-4o-transcribe');
    expect(body.get('language')).toBe('pl');
  }, 15000);

  it('uses OpenAI gpt-4o-transcribe retry for poor quality audio when retry is clean', async () => {
    const httpClientSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          text: 'Slychac poprawiony fragment spotkania',
          segments: [
            {
              text: 'Slychac poprawiony fragment spotkania',
              start: 2,
              end: 5,
              avg_logprob: -0.25,
              no_speech_prob: 0.05,
            },
          ],
        }),
      json: async () => ({}),
    } as any);
    vi.doMock('../lib/httpClient.ts', () => ({ httpClient: httpClientSpy }));
    const transcription = await loadTranscriptionModule();

    const result = await transcription.maybeRetryPoorQualityWithOpenAi({
      sttResult: {
        providerId: 'groq',
        providerLabel: 'Groq Whisper',
        model: 'whisper-large-v3',
        attempts: [],
        payload: {
          text: 'Slychac fragment',
          segments: [
            {
              text: 'Slychac fragment',
              start: 2,
              end: 5,
              avg_logprob: -1.2,
              no_speech_prob: 0.4,
            },
          ],
        },
      },
      request: {
        buffer: Buffer.from('audio'.repeat(200)),
        filename: 'chunk.wav',
        contentType: 'audio/wav',
        fields: { language: 'pl', model: 'whisper-large-v3' },
      },
      audioQuality: { qualityLabel: 'poor' },
    });

    expect(result.providerId).toBe('openai');
    expect(result.payload.text).toBe('Slychac poprawiony fragment spotkania');
    const [, options] = httpClientSpy.mock.calls[0];
    expect((options?.body as FormData).get('model')).toBe('gpt-4o-transcribe');
  });

  it('runs a segment-level second pass only for low-confidence artifacts', async () => {
    const { EventEmitter } = await import('node:events');
    vi.doMock('node:child_process', () => ({
      exec: vi.fn(),
      spawn: vi.fn(() => {
        const child: any = new EventEmitter();
        child.stdout = new EventEmitter();
        process.nextTick(() => {
          child.stdout.emit('data', Buffer.alloc(1024, 1));
          child.emit('close', 0);
        });
        return child;
      }),
    }));
    const httpClientSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          text: 'Wspolpraca w Wroclawiu',
          logprobs: [{ token: 'Wspolpraca', logprob: -0.2 }],
        }),
      json: async () => ({}),
    } as any);
    vi.doMock('../lib/httpClient.ts', () => ({ httpClient: httpClientSpy }));
    const transcription = await loadTranscriptionModule();

    const result = await transcription.retryLowConfidenceSegmentsWithOpenAi({
      filePath: 'meeting.wav',
      fields: { language: 'pl', model: 'gpt-4o-transcribe', prompt: 'VoiceLog, Wroclaw' },
      segments: [
        {
          id: 'seg_bad',
          text: 'u \u8b1d\u8b1d.',
          timestamp: 9,
          endTimestamp: 10,
          verificationStatus: 'low-confidence',
          verificationScore: 0.2,
          verificationReasons: ['brak czytelnych slow lacinskich'],
        },
        {
          id: 'seg_good',
          text: 'Ten fragment jest poprawny',
          timestamp: 12,
          endTimestamp: 14,
          verificationStatus: 'verified',
          verificationScore: 0.9,
        },
      ],
    });

    expect(result.diagnostics).toMatchObject({ attempted: 1, improved: 1, skipped: 1 });
    expect(result.segments[0]).toMatchObject({
      text: 'Wspolpraca w Wroclawiu',
      verificationStatus: 'verified',
    });
    expect(result.segments[1].text).toBe('Ten fragment jest poprawny');
    const [, options] = httpClientSpy.mock.calls[0];
    const body = options?.body as FormData;
    expect(body.get('model')).toBe('gpt-4o-transcribe');
    expect(body.get('language')).toBe('pl');
    expect(body.get('prompt')).toBe('VoiceLog, Wroclaw');
  });
});
