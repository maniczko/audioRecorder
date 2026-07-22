import {
  RECORDING_CONSENT_POLICY_VERSION,
  type RecordingConsentProviderDisclosure,
} from '../../src/lib/recordingConsent.ts';
import type { RecordingConsentAuditMetadata } from './types.ts';

export const RECORDING_CONSENT_MAX_AGE_MS = 366 * 24 * 60 * 60 * 1000;

const SUPPORTED_PROVIDER_CATEGORIES = new Set([
  'stt',
  'diarization',
  'llm-analysis',
  'embeddings',
  'image-generation',
]);

export interface ValidatedRecordingConsent extends RecordingConsentAuditMetadata {
  acceptedAt: string;
  workspaceId: string;
  policyVersion: typeof RECORDING_CONSENT_POLICY_VERSION;
  disclosureTitle: string;
  providerNotice: string;
  providers: RecordingConsentProviderDisclosure[];
  actorUserId: string;
}

export interface RecordingConsentValidationOptions {
  workspaceId: string;
  actorUserId: string;
  preserveRecordedActor?: boolean;
  now?: number;
}

export type RecordingConsentValidationResult =
  { valid: true; consent: ValidatedRecordingConsent } | { valid: false; reason: string };

function requiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function normalizeProviders(value: unknown): RecordingConsentProviderDisclosure[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 10) return null;
  const providerIds = new Set<string>();
  const providers: RecordingConsentProviderDisclosure[] = [];

  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') return null;
    const provider = candidate as Record<string, unknown>;
    const id = requiredString(provider.id, 80);
    const label = requiredString(provider.label, 240);
    if (!id || !label || typeof provider.enabled !== 'boolean') return null;
    if (!SUPPORTED_PROVIDER_CATEGORIES.has(id) || providerIds.has(id)) return null;
    providerIds.add(id);
    providers.push({ id, label, enabled: provider.enabled });
  }

  return providers.some((provider) => provider.id === 'stt' && provider.enabled) ? providers : null;
}

export function validateRecordingConsent(
  value: unknown,
  options: RecordingConsentValidationOptions
): RecordingConsentValidationResult {
  if (!value || typeof value !== 'object') {
    return { valid: false, reason: 'missing' };
  }

  const consent = value as Record<string, unknown>;
  const acceptedAt = requiredString(consent.acceptedAt, 80);
  const workspaceId = requiredString(consent.workspaceId, 160);
  const policyVersion = requiredString(consent.policyVersion, 80);
  const disclosureTitle = requiredString(consent.disclosureTitle, 240);
  const providerNotice = requiredString(consent.providerNotice, 1000);
  const actorUserId = requiredString(
    options.preserveRecordedActor ? consent.actorUserId : options.actorUserId,
    160
  );
  const providers = normalizeProviders(consent.providers);
  const acceptedAtMs = acceptedAt ? Date.parse(acceptedAt) : Number.NaN;
  const now = options.now ?? Date.now();

  if (!acceptedAt || !Number.isFinite(acceptedAtMs) || acceptedAtMs > now) {
    return { valid: false, reason: 'timestamp_invalid' };
  }
  if (now - acceptedAtMs > RECORDING_CONSENT_MAX_AGE_MS) {
    return { valid: false, reason: 'expired' };
  }
  if (!workspaceId || workspaceId !== options.workspaceId) {
    return { valid: false, reason: 'workspace_mismatch' };
  }
  if (policyVersion !== RECORDING_CONSENT_POLICY_VERSION) {
    return { valid: false, reason: 'policy_unsupported' };
  }
  if (!disclosureTitle || !providerNotice || !providers || !actorUserId) {
    return { valid: false, reason: 'disclosure_invalid' };
  }

  return {
    valid: true,
    consent: {
      acceptedAt: new Date(acceptedAtMs).toISOString(),
      workspaceId,
      policyVersion: RECORDING_CONSENT_POLICY_VERSION,
      disclosureTitle,
      providerNotice,
      providers,
      actorUserId,
    },
  };
}

export function readRecordingConsentFromAsset(asset: { diarization_json?: unknown }): unknown {
  try {
    const diarization = JSON.parse(String(asset?.diarization_json || '{}'));
    return diarization?.recordingConsent;
  } catch {
    return null;
  }
}
