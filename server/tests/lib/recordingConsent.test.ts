import { describe, expect, test } from 'vitest';
import {
  RECORDING_CONSENT_MAX_AGE_MS,
  readRecordingConsentFromAsset,
  validateRecordingConsent,
} from '../../lib/recordingConsent.ts';

const now = Date.parse('2026-07-22T08:00:00.000Z');

function consent(overrides: Record<string, unknown> = {}) {
  return {
    acceptedAt: '2026-07-21T08:00:00.000Z',
    workspaceId: 'workspace_1',
    policyVersion: 'recording-consent-v1',
    disclosureTitle: 'Zgoda na nagrywanie i przetwarzanie AI',
    providerNotice: 'Dane audio moga byc przetwarzane przez dostawcow AI.',
    providers: [{ id: 'stt', label: 'Transkrypcja', enabled: true }],
    ...overrides,
  };
}

function validate(value: unknown, overrides: Record<string, unknown> = {}) {
  return validateRecordingConsent(value, {
    workspaceId: 'workspace_1',
    actorUserId: 'actor_1',
    now,
    ...overrides,
  });
}

describe('recording consent validation', () => {
  test('accepts a current disclosure and stamps the authenticated actor', () => {
    expect(validate(consent())).toEqual({
      valid: true,
      consent: expect.objectContaining({
        actorUserId: 'actor_1',
        workspaceId: 'workspace_1',
        policyVersion: 'recording-consent-v1',
      }),
    });
  });

  test('rejects an absent disclosure', () => {
    expect(validate(null)).toEqual({ valid: false, reason: 'missing' });
  });

  test('rejects a disclosure issued for another workspace', () => {
    expect(validate(consent({ workspaceId: 'workspace_other' }))).toEqual({
      valid: false,
      reason: 'workspace_mismatch',
    });
  });

  test('rejects a future or expired acceptance timestamp', () => {
    expect(validate(consent({ acceptedAt: '2026-07-22T08:00:01.000Z' }))).toEqual({
      valid: false,
      reason: 'timestamp_invalid',
    });
    expect(
      validate(
        consent({ acceptedAt: new Date(now - RECORDING_CONSENT_MAX_AGE_MS - 1).toISOString() })
      )
    ).toEqual({ valid: false, reason: 'expired' });
  });

  test('rejects an unsupported policy version or malformed provider categories', () => {
    expect(validate(consent({ policyVersion: 'recording-consent-v0' }))).toEqual({
      valid: false,
      reason: 'policy_unsupported',
    });
    expect(
      validate(consent({ providers: [{ id: 'stt', label: 'Transkrypcja', enabled: false }] }))
    ).toEqual({
      valid: false,
      reason: 'disclosure_invalid',
    });
  });

  test('preserves the originally recorded actor during retry validation', () => {
    const result = validate(consent({ actorUserId: 'actor_original' }), {
      preserveRecordedActor: true,
      actorUserId: 'actor_retrying',
    });

    expect(result).toEqual({
      valid: true,
      consent: expect.objectContaining({ actorUserId: 'actor_original' }),
    });
  });

  test('reads consent only from valid diarization JSON', () => {
    expect(
      readRecordingConsentFromAsset({
        diarization_json: JSON.stringify({ recordingConsent: consent() }),
      })
    ).toEqual(consent());
    expect(readRecordingConsentFromAsset({ diarization_json: '{bad-json' })).toBeNull();
  });
});
