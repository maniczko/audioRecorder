function normalizeTransportErrorText(message: unknown) {
  return String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const TRANSPORT_ERROR_PATTERNS = [
  'upstream',
  'failed to fetch',
  'networkerror',
  'load failed',
  'bad gateway',
  'http 502',
  'http 503',
  'http 504',
  'target connection error',
  'application failed to respond',
  'router_external_target_connection_error',
  'name not resolved',
  'internet disconnected',
  'health probe cooldown active',
  'aborted',
  'the operation was aborted',
  'timeout exceeded when trying to connect',
  'connection timeout',
  'timed out while waiting for the backend',
  'backend jest chwilowo niedostepny',
  'backend niedostepny przez dluzszy czas',
  'hostowany preview nie moze polaczyc sie z backendem',
];

export function isTransportErrorMessage(message: unknown) {
  const normalized = normalizeTransportErrorText(message);
  return TRANSPORT_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function isConnectionTimeoutErrorMessage(message: unknown) {
  const normalized = normalizeTransportErrorText(message);
  return (
    normalized.includes('timeout exceeded when trying to connect') ||
    normalized.includes('connection timeout') ||
    normalized.includes('timed out while waiting for the backend')
  );
}
