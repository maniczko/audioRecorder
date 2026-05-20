import { config } from '../config.ts';

export type SttQualityPolicy = 'premium' | 'fast' | 'cost';
export type SttProviderId = 'openai' | 'groq';

export interface SttRuntimePolicy {
  policy: SttQualityPolicy;
  provider: SttProviderId;
  fallbackProvider: SttProviderId | 'none';
  processingMode: 'fast' | 'full';
  fullModel: string;
  fastModel: string;
  language: string;
}

export function resolveSttRuntimePolicy(
  configLike: Partial<typeof config> = config,
  availability: { hasOpenAi?: boolean; hasGroq?: boolean } = {}
): SttRuntimePolicy {
  const policy = (configLike.VOICELOG_STT_POLICY || 'premium') as SttQualityPolicy;
  const hasGroq = availability.hasGroq === true;

  if (policy === 'fast') {
    return {
      policy,
      provider: hasGroq
        ? 'groq'
        : ((configLike.VOICELOG_STT_PROVIDER || 'openai') as SttProviderId),
      fallbackProvider: hasGroq ? 'openai' : 'none',
      processingMode: 'fast',
      fullModel: configLike.VOICELOG_STT_MODEL_FULL || 'gpt-4o-transcribe',
      fastModel: configLike.VOICELOG_STT_MODEL_FAST || 'whisper-1',
      language: configLike.AUDIO_LANGUAGE || 'pl',
    };
  }

  if (policy === 'cost') {
    return {
      policy,
      provider: hasGroq ? 'groq' : 'openai',
      fallbackProvider: 'none',
      processingMode: (configLike.VOICELOG_PROCESSING_MODE_DEFAULT || 'full') as 'fast' | 'full',
      fullModel: configLike.VOICELOG_STT_MODEL_FULL || 'gpt-4o-transcribe',
      fastModel: configLike.VOICELOG_STT_MODEL_FAST || 'whisper-1',
      language: configLike.AUDIO_LANGUAGE || 'pl',
    };
  }

  return {
    policy: 'premium',
    provider: 'openai',
    fallbackProvider: hasGroq ? 'groq' : 'none',
    processingMode: 'full',
    fullModel: configLike.VOICELOG_STT_MODEL_FULL || 'gpt-4o-transcribe',
    fastModel: configLike.VOICELOG_STT_MODEL_FAST || 'whisper-1',
    language: configLike.AUDIO_LANGUAGE || 'pl',
  };
}
