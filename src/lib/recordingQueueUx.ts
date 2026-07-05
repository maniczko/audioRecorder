import type { RecordingPipelineStatus } from './recordingQueue';

export type RecordingQueueUxStatus =
  | RecordingPipelineStatus
  | 'empty'
  | 'no_audio'
  | 'idle'
  | 'error'
  | 'permission_denied'
  | 'microphone_unavailable'
  | 'storage_quota'
  | 'backend_unavailable'
  | 'offline'
  | 'ai_fallback';

export type RecordingQueueAction =
  'retry' | 'refresh' | 'reimport' | 'delete' | 'export' | 'contact_admin' | 'grant_permission';

export interface RecordingQueueStatusViewInput {
  status?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  retryable?: boolean | null;
  queuedPosition?: number | null;
  processingAgeMs?: number | null;
  backoffUntil?: number | null;
  isOffline?: boolean;
}

export interface RecordingQueueStatusView {
  status: RecordingQueueUxStatus;
  label: string;
  summary: string;
  description: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  role: 'status' | 'alert';
  live: 'polite' | 'assertive';
  busy: boolean;
  actions: RecordingQueueAction[];
  retryable: boolean;
}

export interface RecordingStartViewInput {
  canRecord?: boolean;
  recordPermission?: string | null;
  speechRecognitionSupported?: boolean;
  browserSupportsRecording?: boolean;
}

function normalizeForMatching(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hasBackoff(input: RecordingQueueStatusViewInput) {
  return Number(input.backoffUntil || 0) > Date.now();
}

function deriveStatus(input: RecordingQueueStatusViewInput): RecordingQueueUxStatus {
  const status = String(input.status || 'queued') as RecordingQueueUxStatus;
  const message = normalizeForMatching(input.errorMessage);
  const code = normalizeForMatching(input.errorCode);

  if (input.isOffline || message.includes('browser offline') || message.includes('offline')) {
    return 'offline';
  }
  if (
    code.includes('stt_quota_exceeded') ||
    message.includes('quota') ||
    message.includes('brak miejsca') ||
    message.includes('za malo miejsca')
  ) {
    return 'storage_quota';
  }
  if (
    message.includes('backend unavailable') ||
    message.includes('server unavailable') ||
    message.includes('503') ||
    message.includes('504')
  ) {
    return 'backend_unavailable';
  }
  if (
    [
      'uploading',
      'queued',
      'processing',
      'diarization',
      'review',
      'failed',
      'failed_permanent',
      'done',
      'empty',
      'no_audio',
      'idle',
      'error',
      'permission_denied',
      'microphone_unavailable',
      'ai_fallback',
    ].includes(status)
  ) {
    return status;
  }
  return 'queued';
}

function describeQueuePosition(position: number | null | undefined) {
  const value = Number(position || 0);
  return value > 1 ? ` Jest ${value}. w kolejce.` : '';
}

function describeProcessingAge(ageMs: number | null | undefined) {
  const minutes = Math.floor(Number(ageMs || 0) / 60000);
  return minutes > 0 ? ` Trwa około ${minutes} min.` : '';
}

export function getRecordingQueueStatusView(
  input: RecordingQueueStatusViewInput = {}
): RecordingQueueStatusView {
  const status = deriveStatus(input);
  const retryable = input.retryable !== false;

  const base: Record<RecordingQueueUxStatus, RecordingQueueStatusView> = {
    idle: {
      status: 'idle',
      label: 'Gotowe do nagrania',
      summary: 'Możesz rozpocząć nowe nagranie.',
      description: 'Wybierz nagrywanie albo wgraj plik audio.',
      tone: 'neutral',
      role: 'status',
      live: 'polite',
      busy: false,
      actions: [],
      retryable: false,
    },
    uploading: {
      status: 'uploading',
      label: 'Wysyłanie...',
      summary: 'Wysyłanie audio...',
      description: 'Wysyłamy plik audio do przetwarzania. Nie zamykaj karty do końca uploadu.',
      tone: 'info',
      role: 'status',
      live: 'polite',
      busy: true,
      actions: ['refresh'],
      retryable: false,
    },
    queued: {
      status: 'queued',
      label: 'W kolejce',
      summary: `Nagranie czeka na przetwarzanie.${describeQueuePosition(input.queuedPosition)}`,
      description: `Nagranie jest zapisane i ruszy w tle, gdy zwolni się worker.${describeQueuePosition(input.queuedPosition)}`,
      tone: 'info',
      role: 'status',
      live: 'polite',
      busy: true,
      actions: ['refresh', 'delete'],
      retryable: false,
    },
    processing: {
      status: 'processing',
      label: 'Przetwarzanie...',
      summary: `Transkrypcja w toku...${describeProcessingAge(input.processingAgeMs)}`,
      description: `Przetwarzamy audio w tle. Po odświeżeniu strony status zostanie zachowany.${describeProcessingAge(input.processingAgeMs)}`,
      tone: 'info',
      role: 'status',
      live: 'polite',
      busy: true,
      actions: ['refresh'],
      retryable: false,
    },
    diarization: {
      status: 'diarization',
      label: 'Rozpoznawanie mówców...',
      summary: 'Rozpoznajemy mówców...',
      description: 'Transkrypt jest gotowy, trwa rozpoznawanie mówców i porządkowanie segmentów.',
      tone: 'info',
      role: 'status',
      live: 'polite',
      busy: true,
      actions: ['refresh'],
      retryable: false,
    },
    review: {
      status: 'review',
      label: 'Oczekuje na weryfikację',
      summary: 'Nagranie czeka na krótką weryfikację.',
      description: 'Sprawdź jakość transkryptu i oznaczenia mówców przed dalszą analizą.',
      tone: 'warning',
      role: 'status',
      live: 'polite',
      busy: false,
      actions: ['refresh', 'export'],
      retryable: false,
    },
    done: {
      status: 'done',
      label: 'Transkrypcja gotowa',
      summary: 'Nagranie jest gotowe.',
      description: 'Transkrypt i analiza są dostępne. Możesz eksportować albo wrócić do rozmowy.',
      tone: 'success',
      role: 'status',
      live: 'polite',
      busy: false,
      actions: ['export'],
      retryable: false,
    },
    failed: {
      status: 'failed',
      label: hasBackoff(input) ? 'Ponowienie zaplanowane' : 'Błąd przetwarzania',
      summary: hasBackoff(input)
        ? 'System ponowi przetwarzanie za chwilę.'
        : 'Przetwarzanie nie powiodło się.',
      description: hasBackoff(input)
        ? 'Nagranie zostaje w kolejce. Status odświeży się automatycznie po kolejnej próbie.'
        : input.errorMessage ||
          'Możesz ponowić przetwarzanie. Jeśli błąd wróci, skontaktuj się z administratorem.',
      tone: 'danger',
      role: 'alert',
      live: 'assertive',
      busy: hasBackoff(input),
      actions: retryable ? ['retry', 'contact_admin'] : ['contact_admin'],
      retryable,
    },
    failed_permanent: {
      status: 'failed_permanent',
      label: 'Wymaga ponownego importu',
      summary: 'To nagranie wymaga ponownego importu.',
      description:
        input.errorMessage ||
        'Nie da się bezpiecznie ponowić tego wpisu. Wgraj oryginalny plik ponownie albo usuń wpis z kolejki.',
      tone: 'danger',
      role: 'alert',
      live: 'assertive',
      busy: false,
      actions: ['reimport', 'delete', 'contact_admin'],
      retryable: false,
    },
    empty: {
      status: 'empty',
      label: 'Brak mowy',
      summary: 'Nie wykryto wypowiedzi w nagraniu.',
      description:
        'Audio zostało przetworzone, ale nie wykryto treści do transkrypcji. Sprawdź odtwarzacz albo wgraj plik ponownie.',
      tone: 'warning',
      role: 'status',
      live: 'polite',
      busy: false,
      actions: ['retry', 'reimport', 'delete'],
      retryable: true,
    },
    no_audio: {
      status: 'no_audio',
      label: 'Brak audio',
      summary: 'Plik nie zawiera użytecznej ścieżki audio.',
      description:
        'Nie znaleziono dekodowalnego audio. Wgraj oryginalny plik ponownie albo usuń wpis.',
      tone: 'warning',
      role: 'alert',
      live: 'assertive',
      busy: false,
      actions: ['reimport', 'delete'],
      retryable: false,
    },
    error: {
      status: 'error',
      label: 'Błąd analizy',
      summary: 'Analiza nagrania nie powiodła się.',
      description: input.errorMessage || 'Odśwież status albo ponów przetwarzanie nagrania.',
      tone: 'danger',
      role: 'alert',
      live: 'assertive',
      busy: false,
      actions: retryable ? ['retry', 'refresh'] : ['refresh', 'contact_admin'],
      retryable,
    },
    offline: {
      status: 'offline',
      label: 'Brak połączenia',
      summary: 'Nagranie poczeka, aż wróci internet.',
      description:
        'Przeglądarka jest offline. Po odzyskaniu połączenia odśwież status albo ponów upload.',
      tone: 'warning',
      role: 'alert',
      live: 'assertive',
      busy: false,
      actions: ['refresh', 'retry'],
      retryable: true,
    },
    backend_unavailable: {
      status: 'backend_unavailable',
      label: 'Backend niedostępny',
      summary: 'Serwer przetwarzania chwilowo nie odpowiada.',
      description:
        'Nagranie jest zachowane lokalnie. Odśwież status za chwilę albo skontaktuj się z administratorem, jeśli problem wraca.',
      tone: 'warning',
      role: 'alert',
      live: 'assertive',
      busy: false,
      actions: ['refresh', 'retry', 'contact_admin'],
      retryable: true,
    },
    storage_quota: {
      status: 'storage_quota',
      label: 'Brak miejsca lub limit',
      summary: 'Brakuje miejsca albo przekroczono limit usługi.',
      description:
        'Zwolnij miejsce w przeglądarce, usuń starsze audio albo poproś administratora o sprawdzenie limitów API.',
      tone: 'warning',
      role: 'alert',
      live: 'assertive',
      busy: false,
      actions: ['delete', 'export', 'contact_admin'],
      retryable: false,
    },
    permission_denied: {
      status: 'permission_denied',
      label: 'Mikrofon zablokowany',
      summary: 'Przyznaj dostęp do mikrofonu, żeby nagrywać.',
      description: 'Zmień uprawnienia mikrofonu w przeglądarce i uruchom nagrywanie ponownie.',
      tone: 'warning',
      role: 'alert',
      live: 'assertive',
      busy: false,
      actions: ['grant_permission'],
      retryable: false,
    },
    microphone_unavailable: {
      status: 'microphone_unavailable',
      label: 'Mikrofon niedostępny',
      summary: 'Nie znaleziono obsługi nagrywania w tej przeglądarce.',
      description: 'Podłącz mikrofon, sprawdź ustawienia systemowe albo wgraj gotowy plik audio.',
      tone: 'warning',
      role: 'alert',
      live: 'assertive',
      busy: false,
      actions: ['reimport'],
      retryable: false,
    },
    ai_fallback: {
      status: 'ai_fallback',
      label: 'Tryb ograniczony AI',
      summary: 'Analiza AI działa w trybie fallback.',
      description:
        'Transkrypt pozostaje dostępny, ale część wniosków może wymagać ręcznej weryfikacji albo konfiguracji providera.',
      tone: 'warning',
      role: 'status',
      live: 'polite',
      busy: false,
      actions: ['contact_admin'],
      retryable: false,
    },
  };

  return base[status];
}

export function getRecordingStartView(input: RecordingStartViewInput = {}) {
  if (input.browserSupportsRecording === false) {
    return getRecordingQueueStatusView({ status: 'microphone_unavailable' });
  }
  if (input.canRecord === false) {
    return {
      ...getRecordingQueueStatusView({ status: 'permission_denied' }),
      label: 'Brak uprawnień do nagrywania',
      summary: 'Nie masz uprawnień do nagrywania w tym workspace.',
      description: 'Poproś właściciela workspace o dostęp albo wgraj gotowy plik audio.',
      actions: ['contact_admin'] as RecordingQueueAction[],
    };
  }
  if (input.recordPermission === 'denied') {
    return getRecordingQueueStatusView({ status: 'permission_denied' });
  }
  if (input.speechRecognitionSupported === false) {
    return {
      ...getRecordingQueueStatusView({ status: 'idle' }),
      summary: 'Audio trafi na serwer po zakończeniu nagrania.',
      description:
        'Transkrypcja live jest niedostępna w tej przeglądarce, ale nagranie zostanie przetworzone po zapisaniu.',
    };
  }
  return {
    ...getRecordingQueueStatusView({ status: 'idle' }),
    summary: 'Transkrypcja live włącza się automatycznie.',
  };
}
