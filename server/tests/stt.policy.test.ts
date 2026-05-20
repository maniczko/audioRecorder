import { describe, expect, it } from 'vitest';
import { resolveSttRuntimePolicy } from '../stt/policy.ts';

describe('stt runtime policy', () => {
  it('defaults to premium OpenAI quality path', () => {
    const policy = resolveSttRuntimePolicy(
      {
        VOICELOG_STT_POLICY: 'premium',
        VOICELOG_STT_PROVIDER: 'groq',
        VOICELOG_PROCESSING_MODE_DEFAULT: 'fast',
        VOICELOG_STT_MODEL_FULL: 'gpt-4o-transcribe',
        VOICELOG_STT_MODEL_FAST: 'whisper-1',
        AUDIO_LANGUAGE: 'pl',
      } as any,
      { hasOpenAi: true, hasGroq: true }
    );

    expect(policy).toMatchObject({
      policy: 'premium',
      provider: 'openai',
      fallbackProvider: 'groq',
      processingMode: 'full',
      fullModel: 'gpt-4o-transcribe',
      language: 'pl',
    });
  });

  it('allows fast mode to prefer Groq when configured', () => {
    const policy = resolveSttRuntimePolicy(
      {
        VOICELOG_STT_POLICY: 'fast',
        VOICELOG_STT_PROVIDER: 'openai',
        VOICELOG_STT_MODEL_FULL: 'gpt-4o-transcribe',
        VOICELOG_STT_MODEL_FAST: 'whisper-1',
        AUDIO_LANGUAGE: 'pl',
      } as any,
      { hasOpenAi: true, hasGroq: true }
    );

    expect(policy).toMatchObject({
      policy: 'fast',
      provider: 'groq',
      fallbackProvider: 'openai',
      processingMode: 'fast',
    });
  });
});
