import type { Hono } from 'hono';
import { config } from '../config.ts';
import { resolveSttRuntimePolicy } from '../stt/policy.ts';
import { MetricsService } from '../services/MetricsService.ts';
import { normalizeWorkspaceFeatureFlags } from '../../src/shared/contracts.ts';
import type { WorkspaceFeatureFlags, WorkspaceSttProvider } from '../../src/shared/types.ts';
import { isSmtpConfigured } from '../lib/smtp.ts';

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
    | 'imageGeneration'
    | 'retentionFeatures'
    | 'experimentalUi'
    | 'passwordReset';
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
  workspaceFeatureFlags: WorkspaceFeatureFlags;
  degradedCapabilities: CapabilityFlag[];
  telemetry: {
    fallbackModeUsed: boolean;
    fallbackModeCapabilities: CapabilityFlag['id'][];
  };
}

interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  storageReadiness?: StorageReadiness;
  workspaceFeatureFlags?: Partial<WorkspaceFeatureFlags>;
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

function capabilityDisabledByWorkspace(
  capability: CapabilityFlag,
  enabled: boolean
): CapabilityFlag {
  if (enabled) return capability;
  return {
    ...capability,
    enabled: false,
    status: 'unavailable',
    provider: 'none',
    reason: 'Disabled by workspace feature flags.',
    fallbackMode: false,
  };
}

function resolveForcedSttProvider(
  sttProvider: WorkspaceSttProvider,
  availability: { hasOpenAi: boolean; hasGroq: boolean; hasLocalWhisper: boolean }
): CapabilityFlag | null {
  if (sttProvider === 'auto') return null;
  if (sttProvider === 'disabled') {
    return {
      id: 'stt',
      label: 'Transkrypcja STT',
      enabled: false,
      status: 'unavailable',
      provider: 'none',
      reason: 'Disabled by workspace feature flags.',
      fallbackMode: false,
    };
  }
  if (sttProvider === 'local-whisper') {
    return {
      id: 'stt',
      label: 'Transkrypcja STT',
      enabled: false,
      status: 'unavailable',
      provider: 'none',
      reason: 'Workspace local-whisper provider is not wired into the STT pipeline yet.',
      fallbackMode: false,
    };
  }

  const providerConfigured =
    (sttProvider === 'openai' && availability.hasOpenAi) ||
    (sttProvider === 'groq' && availability.hasGroq);

  return {
    id: 'stt',
    label: 'Transkrypcja STT',
    enabled: providerConfigured,
    status: providerConfigured ? 'available' : 'unavailable',
    provider: providerConfigured ? sttProvider : 'none',
    reason: providerConfigured
      ? undefined
      : `Workspace STT provider ${sttProvider} is not configured.`,
    fallbackMode: false,
  };
}

export function resolveProductionCapabilities(
  options: ResolveOptions = {}
): ProductionCapabilitiesPayload {
  const env = options.env || process.env;
  const storageReadiness = options.storageReadiness || DEFAULT_STORAGE_READINESS;
  const workspaceFeatureFlags = normalizeWorkspaceFeatureFlags(options.workspaceFeatureFlags);
  const hasOpenAi = hasValue(env, 'OPENAI_API_KEY') || hasValue(env, 'VOICELOG_OPENAI_API_KEY');
  const hasGroq = hasValue(env, 'GROQ_API_KEY');
  const hasLocalWhisper = isEnabled(env.USE_LOCAL_WHISPER) && hasValue(env, 'WHISPER_CPP_PATH');
  const hasHfToken = hasValue(env, 'HF_TOKEN') || hasValue(env, 'HUGGINGFACE_TOKEN');
  const hasAnthropic = hasValue(env, 'ANTHROPIC_API_KEY');
  const hasGemini = hasValue(env, 'GEMINI_API_KEY');
  const hasSmtp = isSmtpConfigured(env);
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
  stt =
    resolveForcedSttProvider(workspaceFeatureFlags.sttProvider, {
      hasOpenAi,
      hasGroq,
      hasLocalWhisper,
    }) || stt;

  const capabilities: ProductionCapabilitiesPayload['capabilities'] = {
    stt: capabilityDisabledByWorkspace(stt, workspaceFeatureFlags.sttProvider !== 'disabled'),
    diarization: capabilityDisabledByWorkspace(
      {
        id: 'diarization',
        label: 'Diarization',
        enabled: hasHfToken,
        status: hasHfToken ? 'available' : 'unavailable',
        provider: hasHfToken ? 'pyannote' : 'none',
        reason: hasHfToken ? undefined : 'HF_TOKEN or HUGGINGFACE_TOKEN is missing.',
      },
      workspaceFeatureFlags.diarization
    ),
    meetingAnalysis: capabilityDisabledByWorkspace(
      {
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
      workspaceFeatureFlags.meetingAnalysis
    ),
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
    liveTranscription: capabilityDisabledByWorkspace(
      {
        id: 'liveTranscription',
        label: 'Transkrypcja live',
        enabled: true,
        status: 'available',
        provider: 'browser-speech-recognition',
        reason: 'Availability depends on browser support and microphone permission.',
      },
      workspaceFeatureFlags.liveTranscription
    ),
    embeddings: capabilityDisabledByWorkspace(
      {
        id: 'embeddings',
        label: 'Embeddingi',
        enabled: hasOpenAi,
        status: hasOpenAi ? 'available' : 'unavailable',
        provider: hasOpenAi ? 'openai' : 'none',
        reason: hasOpenAi ? undefined : 'OPENAI_API_KEY or VOICELOG_OPENAI_API_KEY is missing.',
      },
      workspaceFeatureFlags.embeddings
    ),
    imageGeneration: capabilityDisabledByWorkspace(
      {
        id: 'imageGeneration',
        label: 'Generowanie obrazow',
        enabled: hasGemini,
        status: hasGemini ? 'available' : 'unavailable',
        provider: hasGemini ? 'gemini' : 'none',
        reason: hasGemini ? undefined : 'GEMINI_API_KEY is missing.',
      },
      workspaceFeatureFlags.imageGeneration
    ),
    retentionFeatures: {
      id: 'retentionFeatures',
      label: 'Retencja i legal hold',
      enabled: workspaceFeatureFlags.retentionFeatures,
      status: workspaceFeatureFlags.retentionFeatures ? 'available' : 'unavailable',
      provider: workspaceFeatureFlags.retentionFeatures ? 'internal' : 'none',
      reason: workspaceFeatureFlags.retentionFeatures
        ? undefined
        : 'Disabled by workspace feature flags.',
    },
    passwordReset: {
      id: 'passwordReset',
      label: 'Reset hasła',
      enabled: hasSmtp,
      status: hasSmtp ? 'available' : 'unavailable',
      provider: hasSmtp ? 'smtp' : 'none',
      reason: hasSmtp ? undefined : 'SMTP is not configured. Password reset is disabled.',
      fallbackMode: false,
    },
    experimentalUi: {
      id: 'experimentalUi',
      label: 'Eksperymentalny UI',
      enabled: workspaceFeatureFlags.experimentalUi,
      status: 'available',
      provider: 'internal',
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
    workspaceFeatureFlags,
    degradedCapabilities,
    telemetry: {
      fallbackModeUsed: fallbackModeCapabilities.length > 0,
      fallbackModeCapabilities,
    },
  };
}

export async function resolveStorageReadiness() {
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
    const storageReadiness = await (options.resolveStorageReadiness || resolveStorageReadiness)();
    const payload = resolveProductionCapabilities({ storageReadiness });

    for (const capabilityId of payload.telemetry.fallbackModeCapabilities) {
      MetricsService.observeCapabilityMode?.(capabilityId, 'fallback');
    }

    return c.json(payload, 200);
  });
}
