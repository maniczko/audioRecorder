export const RECORDING_CONSENT_POLICY_VERSION = 'recording-consent-v1';

export interface RecordingConsentProviderDisclosure {
  id: string;
  label: string;
  enabled: boolean;
}

export interface RecordingConsentDisclosure {
  policyVersion: string;
  title: string;
  summary: string;
  storageNotice: string;
  providerNotice: string;
  auditNotice: string;
  providers: RecordingConsentProviderDisclosure[];
}

export interface RecordingConsentMetadata {
  acceptedAt: string;
  workspaceId: string;
  policyVersion: string;
  disclosureTitle: string;
  providerNotice: string;
  providers: RecordingConsentProviderDisclosure[];
}

const STORAGE_PREFIX = 'voicelog.recordingConsent';

function storageKey(workspaceId: string) {
  return `${STORAGE_PREFIX}.${RECORDING_CONSENT_POLICY_VERSION}.${workspaceId || 'local'}`;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function createRecordingConsentDisclosure(
  options: { remoteMode?: boolean } = {}
): RecordingConsentDisclosure {
  const remoteEnabled = options.remoteMode !== false;
  const providers = [
    { id: 'stt', label: 'transkrypcja mowy na tekst', enabled: remoteEnabled },
    { id: 'diarization', label: 'rozpoznawanie i rozdzielanie mowcow', enabled: remoteEnabled },
    { id: 'llm-analysis', label: 'analiza AI, podsumowania i zadania', enabled: remoteEnabled },
    { id: 'embeddings', label: 'wyszukiwanie semantyczne i embeddingi', enabled: remoteEnabled },
    {
      id: 'image-generation',
      label: 'generowanie obrazow, jesli wlaczone',
      enabled: remoteEnabled,
    },
  ];

  return {
    policyVersion: RECORDING_CONSENT_POLICY_VERSION,
    title: 'Zgoda na nagrywanie i przetwarzanie AI',
    summary:
      'VoiceLog nagra dzwiek spotkania oraz moze utworzyc transkrypt, etykiety mowcow, notatki, zadania i podsumowania.',
    storageNotice:
      'Audio i transkrypty sa przechowywane w wybranej przestrzeni roboczej zgodnie z jej polityka retencji i eksportu.',
    providerNotice: remoteEnabled
      ? 'Dane audio, transkrypty i metadane moga byc przekazywane do skonfigurowanych zewnetrznych dostawcow AI/audio.'
      : 'Tryb lokalny nie wysyla audio do zdalnego STT, ale zgoda pozostaje wymagana dla audytu nagrania.',
    auditNotice:
      'Akceptacja zostanie zapisana z czasem, wersja polityki i lista ujawnionych kategorii dostawcow.',
    providers,
  };
}

export function createRecordingConsentMetadata({
  workspaceId,
  acceptedAt = new Date().toISOString(),
  disclosure = createRecordingConsentDisclosure(),
}: {
  workspaceId?: string | null;
  acceptedAt?: string;
  disclosure?: RecordingConsentDisclosure;
}): RecordingConsentMetadata {
  return {
    acceptedAt,
    workspaceId: String(workspaceId || 'local'),
    policyVersion: disclosure.policyVersion,
    disclosureTitle: disclosure.title,
    providerNotice: disclosure.providerNotice,
    providers: disclosure.providers.filter((provider) => provider.enabled),
  };
}

export function loadRecordingConsent(workspaceId?: string | null): RecordingConsentMetadata | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const parsed = JSON.parse(
      storage.getItem(storageKey(String(workspaceId || 'local'))) || 'null'
    );
    if (
      parsed &&
      parsed.policyVersion === RECORDING_CONSENT_POLICY_VERSION &&
      typeof parsed.acceptedAt === 'string'
    ) {
      return parsed as RecordingConsentMetadata;
    }
  } catch {
    return null;
  }

  return null;
}

export function saveRecordingConsent(metadata: RecordingConsentMetadata) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(storageKey(metadata.workspaceId), JSON.stringify(metadata));
}
