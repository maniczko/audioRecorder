import type { Hono } from 'hono';
import { config } from '../config.ts';
import { resolveSttRuntimePolicy } from '../stt/policy.ts';
import { MetricsService } from '../services/MetricsService.ts';

export type CapabilityStatus = 'available' | 'degraded' | 'unavailable';
export type ProductionStatus = 'ready' | 'degraded';

export interface CapabilityFlag {
  id:
    | 'stt'
    | 'diarization'
    | 'meetingAnalysis'
    | 'supabaseStorage'
    | 'liveTranscription'
    | 'embeddings'
    | 'imageGeneration';
  label: string;
  enabled: boolean;
  status: CapabilityStatus;
  provider: string;
  reason?: string;
  fallbackMode?: boolean;
}

export interface StorageReadiness {
  configured: boolean;
  ready: boolean;
  bucket: string;
  status: string;
  error?: string;
}

export interface ProductionCapabilitiesPayload {
  ok: boolean;
  status: ProductionStatus;
  generatedAt: string;
  capabilities: Record<CapabilityFlag['id'], CapabilityFlag>;
  degradedCapabilities: CapabilityFlag[];
  telemetry: {
    fallbackModeUsed: boolean;
    fallbackModeCapabilities: CapabilityFlag['id'][];
  };
}

interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  storageReadiness?: StorageReadiness;
  now?: Date;
}

interface RegisterOptions {
  resolveStorageReadiness?: () => Promise<StorageReadiness>;
}

const DEFAULT_STORAGE_READINESS: StorageReadiness = {
  configured: false,
  ready: false,
  bucket: 'recordings',
  status: 'missing_config',
};

function hasValue(env: NodeJS.ProcessEnv, key: string) {
  return Boolean(String(env[key] || '').trim());
}

function isEnabled(value: unknown) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value || '')
      .trim()
      .toLowerCase()
  );
}

function makeConfigLike(env: NodeJS.ProcessEnv) {
  return {
    ...config,
    VOICELOG_STT_POLICY: (env.VOICELOG_STT_POLICY || config.VOICELOG_STT_POLICY) as any,
    VOICELOG_STT_PROVIDER: (env.VOICELOG_STT_PROVIDER || config.VOICELOG_STT_PROVIDER) as any,
    VOICELOG_STT_FALLBACK_PROVIDER: (env.VOICELOG_STT_FALLBACK_PROVIDER ||
      config.VOICELOG_STT_FALLBACK_PROVIDER) as any,
    VOICELOG_PROCESSING_MODE_DEFAULT: (env.VOICELOG_PROCESSING_MODE_DEFAULT ||
      config.VOICELOG_PROCESSING_MODE_DEFAULT) as any,
    VOICELOG_STT_MODEL_FAST: env.VOICELOG_STT_MODEL_FAST || config.VOICELOG_STT_MODEL_FAST,
    VOICELOG_STT_MODEL_FULL: env.VOICELOG_STT_MODEL_FULL || config.VOICELOG_STT_MODEL_FULL,
    AUDIO_LANGUAGE: env.AUDIO_LANGUAGE || config.AUDIO_LANGUAGE,
  };
}

function sanitizeReason(value?: string) {
  return String(value || '').replace(/(sk|gsk|hf|key|secret|token)[-_a-z0-9]+/gi, '[redacted]');
}

export function resolveProductionCapabilities(
  options: ResolveOptions = {}
): ProductionCapabilitiesPayload {
  const env = options.env || process.env;
  const storageReadiness = options.storageReadiness || DEFAULT_STORAGE_READINESS;
  const hasOpenAi = hasValue(env, 'OPENAI_API_KEY') || hasValue(env, 'VOICELOG_OPENAI_API_KEY');
  const hasGroq = hasValue(env, 'GROQ_API_KEY');
  const hasLocalWhisper = isEnabled(env.USE_LOCAL_WHISPER) && hasValue(env, 'WHISPER_CPP_PATH');
  const hasHfToken = hasValue(env, 'HF_TOKEN') || hasValue(env, 'HUGGINGFACE_TOKEN');
  const hasAnthropic = hasValue(env, 'ANTHROPIC_API_KEY');
  const hasGemini = hasValue(env, 'GEMINI_API_KEY');
  const meetingAnalysisFlag = isEnabled(env.VOICELOG_ENABLE_MEETING_ANALYSIS);
  const sttPolicy = resolveSttRuntimePolicy(makeConfigLike(env), { hasOpenAi, hasGroq });

  let stt: CapabilityFlag;
  if (hasOpenAi || hasGroq || hasLocalWhisper) {
    const primaryMissing = sttPolicy.provider === 'openai' && !hasOpenAi && hasGroq;
    stt = {
      id: 'stt',
      label: 'Transkrypcja STT',
      enabled: true,
      status: primaryMissing ? 'degraded' : 'available',
      provider: primaryMissing
        ? 'groq'
        : hasLocalWhisper && !hasOpenAi && !hasGroq
          ? 'local-whisper'
          : sttPolicy.provider,
      reason: primaryMissing
        ? 'Primary STT provider is missing; fallback provider is active.'
        : undefined,
      fallbackMode: primaryMissing || (hasLocalWhisper && !hasOpenAi && !hasGroq),
    };
  } else {
    stt = {
      id: 'stt',
      label: 'Transkrypcja STT',
      enabled: false,
      status: 'unavailable',
      provider: 'none',
      reason: 'No STT provider is configured.',
    };
  }

  const capabilities: ProductionCapabilitiesPayload['capabilities'] = {
    stt,
    diarization: {
      id: 'diarization',
      label: 'Diarization',
      enabled: hasHfToken,
      status: hasHfToken ? 'available' : 'unavailable',
      provider: hasHfToken ? 'pyannote' : 'none',
      reason: hasHfToken ? undefined : 'HF_TOKEN or HUGGINGFACE_TOKEN is missing.',
    },
    meetingAnalysis: {
      id: 'meetingAnalysis',
      label: 'Analiza spotkan',
      enabled: meetingAnalysisFlag && hasAnthropic,
      status: meetingAnalysisFlag && hasAnthropic ? 'available' : 'degraded',
      provider: meetingAnalysisFlag && hasAnthropic ? 'anthropic' : 'local-fallback',
      reason:
        meetingAnalysisFlag && hasAnthropic
          ? undefined
          : 'Anthropic analysis is disabled or missing; local fallback is active.',
      fallbackMode: !(meetingAnalysisFlag && hasAnthropic),
    },
    supabaseStorage: {
      id: 'supabaseStorage',
      label: 'Magazyn audio',
      enabled: storageReadiness.ready === true,
      status: storageReadiness.ready === true ? 'available' : 'unavailable',
      provider: storageReadiness.ready === true ? 'supabase-storage' : 'local-filesystem',
      reason:
        storageReadiness.ready === true
          ? undefined
          : sanitizeReason(
              storageReadiness.error ||
                (storageReadiness.configured
                  ? `Supabase Storage is ${storageReadiness.status}.`
                  : 'Supabase Storage is not configured.')
            ),
      fallbackMode: storageReadiness.ready !== true,
    },
    liveTranscription: {
      id: 'liveTranscription',
      label: 'Transkrypcja live',
      enabled: true,
      status: 'available',
      provider: 'browser-speech-recognition',
      reason: 'Availability depends on browser support and microphone permission.',
    },
    embeddings: {
      id: 'embeddings',
      label: 'Embeddingi',
      enabled: hasOpenAi,
      status: hasOpenAi ? 'available' : 'unavailable',
      provider: hasOpenAi ? 'openai' : 'none',
      reason: hasOpenAi ? undefined : 'OPENAI_API_KEY or VOICELOG_OPENAI_API_KEY is missing.',
    },
    imageGeneration: {
      id: 'imageGeneration',
      label: 'Generowanie obrazow',
      enabled: hasGemini,
      status: hasGemini ? 'available' : 'unavailable',
      provider: hasGemini ? 'gemini' : 'none',
      reason: hasGemini ? undefined : 'GEMINI_API_KEY is missing.',
    },
  };

  const degradedCapabilities = Object.values(capabilities).filter(
    (capability) => capability.status !== 'available'
  );
  const fallbackModeCapabilities = Object.values(capabilities)
    .filter((capability) => capability.fallbackMode === true)
    .map((capability) => capability.id);

  return {
    ok: degradedCapabilities.length === 0,
    status: degradedCapabilities.length === 0 ? 'ready' : 'degraded',
    generatedAt: (options.now || new Date()).toISOString(),
    capabilities,
    degradedCapabilities,
    telemetry: {
      fallbackModeUsed: fallbackModeCapabilities.length > 0,
      fallbackModeCapabilities,
    },
  };
}

async function defaultStorageReadiness() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return DEFAULT_STORAGE_READINESS;
  }

  return import('../lib/supabaseStorage.ts')
    .then((module) => module.checkSupabaseStorageReadiness())
    .catch((error: any) => ({
      configured: true,
      ready: false,
      bucket: 'recordings',
      status: 'bucket_unavailable',
      error: error?.message || String(error),
    }));
}

export function registerCapabilitiesRoute(app: Hono<any>, options: RegisterOptions = {}) {
  app.get('/api/capabilities', async (c) => {
    const storageReadiness = await (options.resolveStorageReadiness || defaultStorageReadiness)();
    const payload = resolveProductionCapabilities({ storageReadiness });

    for (const capabilityId of payload.telemetry.fallbackModeCapabilities) {
      MetricsService.observeCapabilityMode?.(capabilityId, 'fallback');
    }

    return c.json(payload, 200);
  });
}
