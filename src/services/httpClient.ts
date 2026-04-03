import { API_BASE_URL, apiBaseUrlConfigured } from './config';
import { readLegacySession, readWorkspacePersistedSession } from '../lib/sessionStorage';
import { getHostedRuntimeBuildId, isHostedPreviewHost } from '../runtime/browserRuntime';

const unauthorizedHandlers = new Set();
let previewRuntimeStatus = 'unknown';
let buildIdMismatchLogged = false;
let previewBuildMismatch = false;
const HOSTED_PREVIEW_STALE_MESSAGE =
  'Hostowany preview jest nieaktualny wzgledem backendu. Odswiez strone lub otworz najnowszy deploy.';

export function onUnauthorized(handler) {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

export function getPreviewRuntimeStatus() {
  return previewRuntimeStatus;
}

export function setPreviewRuntimeStatus(status = 'unknown') {
  previewRuntimeStatus = String(status || 'unknown');
}

export function resetPreviewRuntimeStatus() {
  previewRuntimeStatus = 'unknown';
}

export function isPreviewRuntimeBuildMismatch() {
  return previewBuildMismatch;
}

function buildUrl(path) {
  const safePath = String(path || '').startsWith('/') ? path : `/${String(path || '')}`;
  if (!apiBaseUrlConfigured()) {
    throw new Error(
      'Remote API is not configured. Set VITE_API_BASE_URL or REACT_APP_API_BASE_URL first.'
    );
  }

  return `${API_BASE_URL}${safePath}`;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

function readSessionToken() {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const session = readLegacySession() || readWorkspacePersistedSession();
    return String(session?.token || '');
  } catch (error) {
    console.error('Unable to read auth token from storage.', error);
    return '';
  }
}

function isHostedPreviewRuntime() {
  return typeof window !== 'undefined' && isHostedPreviewHost(window.location.hostname);
}

function isTransportFailureMessage(message = '') {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('upstream') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed') ||
    normalized.includes('bad gateway') ||
    normalized.includes('target connection error') ||
    normalized.includes('application failed to respond') ||
    normalized.includes('router_external_target_connection_error') ||
    normalized.includes('aborted') ||
    normalized.includes('the operation was aborted')
  );
}

function normalizeApiErrorMessage(message = '', status?: number) {
  if (previewRuntimeStatus === 'stale_runtime') {
    return HOSTED_PREVIEW_STALE_MESSAGE;
  }

  if (status === 507) {
    return 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.';
  }

  if (status === 429) {
    return 'Zbyt wiele prob. Sprobuj ponownie za chwile.';
  }

  if (status === 501) {
    return 'Funkcja niedostepna na serwerze.';
  }

  if (status === 502 || status === 503) {
    return 'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.';
  }

  if (status === 401 && String(message).includes('Brak tokenu autoryzacyjnego')) {
    return 'Sesja wygasla albo token nie zostal odtworzony. Odswiez sesje logowania.';
  }

  if (isTransportFailureMessage(message)) {
    return 'Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.';
  }

  return String(message || '');
}

// ── Module-level health probe deduplication ──────────────────────
// Multiple useWorkspaceData instances fire probes concurrently.
// Singleton promise ensures only ONE network probe runs at a time.
let pendingProbe: Promise<any> | null = null;
let probeCooldownUntil = 0;
const PROBE_COOLDOWN_MS = 10_000;

export function resetProbeDedup() {
  pendingProbe = null;
  probeCooldownUntil = 0;
}

export async function probeRemoteApiHealth(fetchImpl = fetch, maxRetries = 3) {
  if (Date.now() < probeCooldownUntil) {
    throw new Error('Health probe cooldown active');
  }
  if (pendingProbe) return pendingProbe;

  pendingProbe = _probeRemoteApiHealthImpl(fetchImpl, maxRetries)
    .catch((err) => {
      probeCooldownUntil = Date.now() + PROBE_COOLDOWN_MS;
      throw err;
    })
    .finally(() => {
      pendingProbe = null;
    });
  return pendingProbe;
}

async function _probeRemoteApiHealthImpl(fetchImpl = fetch, maxRetries = 3) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetchImpl(buildUrl('/health'), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000);
          console.warn(
            `[httpClient] Health probe retry ${attempt + 1}/${maxRetries} after HTTP ${response.status}`
          );
          await delay(delayMs);
          continue;
        }
        setPreviewRuntimeStatus('backend_unreachable');
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await parseResponse(response);
      const frontendBuildId = getHostedRuntimeBuildId();
      const backendGitSha = String(payload?.gitSha || '').trim();
      previewBuildMismatch =
        Boolean(isHostedPreviewRuntime() && frontendBuildId && backendGitSha) &&
        frontendBuildId !== backendGitSha;
      if (
        isHostedPreviewRuntime() &&
        frontendBuildId &&
        backendGitSha &&
        frontendBuildId !== backendGitSha &&
        !buildIdMismatchLogged
      ) {
        buildIdMismatchLogged = true;
        console.warn(
          `[Preview] Build ID mismatch: frontend=${frontendBuildId.slice(0, 8)} backend=${backendGitSha.slice(0, 8)}. This is expected when Railway and Vercel deploy at different times.`
        );
      }

      setPreviewRuntimeStatus('healthy');
      return payload;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error as Error;

      const msg = String((error as any)?.message || '').toLowerCase();
      const isRetryable =
        msg.includes('abort') ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('load failed');
      if (isRetryable && attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000);
        console.warn(
          `[httpClient] Health probe retry ${attempt + 1}/${maxRetries} after: ${(error as any)?.message}`
        );
        await delay(delayMs);
        continue;
      }

      previewBuildMismatch = false;
      if (String((error as any)?.message || '').includes('nieaktualny wzgledem backendu')) {
        setPreviewRuntimeStatus('stale_runtime');
      } else {
        setPreviewRuntimeStatus('backend_unreachable');
      }
      throw error;
    }
  }

  // All retries exhausted
  previewBuildMismatch = false;
  setPreviewRuntimeStatus('backend_unreachable');
  throw lastError || new Error('Health probe failed after all retries');
}

interface ApiOptions extends RequestInit {
  body?: any;
  parseAs?: 'json' | 'text' | 'raw';
  retries?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 4
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 502, 503, 504 (server errors)
      if (!response.ok && [502, 503, 504].includes(response.status)) {
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 15000); // exponential backoff, max 15s
          console.warn(
            `[httpClient] Retry ${attempt + 1}/${maxRetries} after HTTP ${response.status}`
          );
          await delay(delayMs);
          continue;
        }
      }

      return response;
    } catch (error: any) {
      lastError = error;

      // Check if it's a network error that should be retried
      const errorMessage = String(error?.message || '').toLowerCase();
      const isRetryable =
        errorMessage.includes('failed to fetch') ||
        errorMessage.includes('networkerror') ||
        errorMessage.includes('load failed') ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('upstream') ||
        errorMessage.includes('bad gateway');

      if (isRetryable && attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 15000); // exponential backoff, max 15s
        console.warn(
          `[httpClient] Retry ${attempt + 1}/${maxRetries} after network error: ${error?.message}`
        );
        await delay(delayMs);
        continue;
      }

      // Don't retry on non-retryable errors
      break;
    }
  }

  // Throw the last error
  if (lastError) {
    throw lastError;
  }

  throw new Error('Request failed after all retries');
}

export async function apiRequest(path: string, options: ApiOptions = {}) {
  const { body, headers, parseAs = 'json', retries = 3, ...rest } = options;
  const token = readSessionToken();
  const requestInit: RequestInit = {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof Blob) ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  };

  if (body !== undefined) {
    requestInit.body =
      body instanceof Blob || typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetchWithRetry(buildUrl(path), requestInit, retries);
  } catch (error: any) {
    const normalizedMessage = normalizeApiErrorMessage(error?.message || 'Failed to fetch');
    const normalizedError = new Error(normalizedMessage);
    (normalizedError as any).cause = error;
    throw normalizedError;
  }

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandlers.forEach((h: any) => h());
    }
    let message = `HTTP ${response.status}`;
    try {
      const errorBody = await parseResponse(response);
      message =
        (typeof errorBody === 'object' && errorBody?.message) ||
        (typeof errorBody === 'string' && errorBody) ||
        message;
    } catch (_) {
      // ignore parse errors
    }
    const error = new Error(normalizeApiErrorMessage(message, response.status)) as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  const payload = parseAs === 'raw' ? response : await parseResponse(response);
  return payload;
}
