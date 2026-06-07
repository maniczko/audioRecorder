import fs from 'node:fs';
import path from 'node:path';
import { httpClient } from '../lib/httpClient.ts';

export interface SttAudioRequest {
  filePath?: string;
  buffer?: Buffer;
  filename?: string;
  contentType?: string;
  fields?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface SttProviderAttempt {
  providerId: string;
  providerLabel: string;
  model: string;
  success: boolean;
  durationMs: number;
  status?: number;
  errorCode?: string;
  retryable?: boolean;
  retryAfterMs?: number;
  errorMessage?: string;
}

export interface SttProvider {
  id: 'openai' | 'groq';
  label: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  isAvailable(): boolean;
  transcribeAudio(request: SttAudioRequest): Promise<unknown>;
}

export interface SttProviderRunResult {
  payload: any;
  providerId: string;
  providerLabel: string;
  model: string;
  attempts: SttProviderAttempt[];
}

const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024;
const GPT4O_TRANSCRIBE_MODELS = new Set([
  'gpt-4o-transcribe',
  'gpt-4o-mini-transcribe',
  'gpt-4o-mini-transcribe-2025-12-15',
]);

function normalizeArrayField(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function resolveProviderCompatibleFields(
  provider: Pick<SttProvider, 'id' | 'defaultModel'>,
  fields: Record<string, unknown> = {}
) {
  const requestedModel = String(fields.model || provider.defaultModel || '').trim();
  const model =
    provider.id === 'groq' && GPT4O_TRANSCRIBE_MODELS.has(requestedModel)
      ? provider.defaultModel
      : requestedModel || provider.defaultModel;

  const next: Record<string, unknown> = { ...fields, model };

  if (provider.id === 'openai' && GPT4O_TRANSCRIBE_MODELS.has(model)) {
    next.response_format = 'json';
    delete next.timestamp_granularities;

    const include = new Set(normalizeArrayField(next.include));
    include.add('logprobs');
    next.include = [...include];
    return next;
  }

  if (provider.id === 'groq') {
    next.response_format = next.response_format || 'verbose_json';
    const timestampGranularities = normalizeArrayField(next.timestamp_granularities);
    next.timestamp_granularities = timestampGranularities.length
      ? timestampGranularities
      : ['segment', 'word'];
  }

  return next;
}

export function resolveProviderCompatibleRequest(
  provider: Pick<SttProvider, 'id' | 'defaultModel'>,
  request: SttAudioRequest
): SttAudioRequest {
  return {
    ...request,
    fields: resolveProviderCompatibleFields(provider, request.fields || {}),
  };
}

function ensureAudioBuffer(request: SttAudioRequest) {
  const audioBuffer =
    request.buffer || (request.filePath ? fs.readFileSync(request.filePath) : null);
  if (!audioBuffer) {
    throw new Error('Brakuje audio buffer albo filePath dla STT request.');
  }
  if (audioBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error('Plik audio przekracza limit 24 MB dla API transkrypcji.');
  }
  return audioBuffer;
}

const VALID_STT_EXTENSIONS = new Set([
  '.flac',
  '.mp3',
  '.mp4',
  '.mpeg',
  '.mpga',
  '.m4a',
  '.ogg',
  '.opus',
  '.wav',
  '.webm',
]);

function ensureValidSttFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (VALID_STT_EXTENSIONS.has(ext)) return filename;
  // Replace unrecognized extension with .webm so the API accepts it
  return ext ? filename.slice(0, -ext.length) + '.webm' : filename + '.webm';
}

function createFormData(request: SttAudioRequest) {
  const audioBuffer = ensureAudioBuffer(request);
  const audioBytes = Uint8Array.from(audioBuffer);
  const form = new FormData();
  const rawFilename =
    request.filename || (request.filePath ? path.basename(request.filePath) : 'audio.wav');
  const safeFilename = ensureValidSttFilename(rawFilename);

  form.append(
    'file',
    new Blob([audioBytes], {
      type: request.contentType || 'application/octet-stream',
    }),
    safeFilename
  );

  Object.entries(request.fields || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        form.append(`${key}[]`, String(entry));
      });
      return;
    }

    form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });

  return form;
}

function parseJsonResponse(rawBody: string) {
  try {
    return JSON.parse(rawBody);
  } catch (_) {
    return null;
  }
}

function normalizeProviderErrorCode(
  providerId: string,
  status: number,
  payload: any,
  message: string
) {
  const code = String(payload?.error?.code || payload?.error?.type || '').toLowerCase();
  const lowerMessage = String(message || '').toLowerCase();
  if (status === 429) {
    if (
      code.includes('insufficient_quota') ||
      code.includes('quota') ||
      lowerMessage.includes('insufficient_quota') ||
      lowerMessage.includes('quota') ||
      lowerMessage.includes('billing')
    ) {
      return 'stt_quota_exceeded';
    }
    return providerId === 'openai' ? 'stt_rate_limited' : 'stt_provider_rate_limited';
  }
  if (
    status === 400 &&
    (lowerMessage.includes('valid media file') ||
      lowerMessage.includes('invalid file') ||
      lowerMessage.includes('empty') ||
      lowerMessage.includes('decode'))
  ) {
    return 'audio_invalid_or_empty';
  }
  return '';
}

function parseRetryAfterMs(headers: Headers | undefined | null) {
  if (!headers) return 60_000;
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.max(1_000, Math.round(seconds * 1000));
    }
    const dateMs = Date.parse(retryAfter);
    if (Number.isFinite(dateMs)) {
      return Math.max(1_000, dateMs - Date.now());
    }
  }
  for (const key of ['x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens']) {
    const raw = headers.get(key);
    const match = String(raw || '').match(/^(\d+(?:\.\d+)?)(ms|s|m)?$/i);
    if (!match) continue;
    const value = Number(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    if (!Number.isFinite(value) || value <= 0) continue;
    if (unit === 'ms') return Math.round(value);
    if (unit === 'm') return Math.round(value * 60_000);
    return Math.round(value * 1000);
  }
  return 60_000;
}

async function runProviderRequest(provider: SttProvider, request: SttAudioRequest) {
  if (!provider.isAvailable()) {
    throw new Error(`STT provider ${provider.id} nie jest skonfigurowany.`);
  }

  const url = `${provider.baseUrl}/audio/transcriptions`;
  const providerRequest = resolveProviderCompatibleRequest(provider, request);
  const model = (providerRequest.fields as any)?.model || provider.defaultModel;
  console.log(`[stt] ${provider.id} model=${model} → POST ${url}`);

  let response: Awaited<ReturnType<typeof httpClient>>;
  try {
    response = await httpClient(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: createFormData(providerRequest),
      signal: providerRequest.signal,
      timeout: 120000,
    });
  } catch (err: any) {
    const cause = err?.cause?.message || err?.cause?.code || '';
    const detail = cause ? ` (cause: ${cause})` : '';
    console.warn(`[stt] ${provider.id} network error: ${err?.message}${detail} url=${url}`);
    throw err;
  }

  const rawBody = await response.text();
  if (!response.ok) {
    const payload = parseJsonResponse(rawBody);
    const msg =
      payload?.error?.message || `STT audio request failed with status ${response.status}.`;
    const errorCode = normalizeProviderErrorCode(provider.id, response.status, payload, msg);
    console.warn(
      `[stt] ${provider.id} failed: status=${response.status} body=${rawBody.slice(0, 300)}`
    );
    const err: any = new Error(msg);
    err.status = response.status;
    err.providerId = provider.id;
    err.providerLabel = provider.label;
    err.model = model;
    err.errorCode = errorCode;
    err.code = errorCode || err.code;
    err.retryable = errorCode === 'stt_rate_limited' || errorCode === 'stt_provider_rate_limited';
    err.retryAfterMs = err.retryable ? parseRetryAfterMs(response.headers) : undefined;
    throw err;
  }

  return parseJsonResponse(rawBody);
}

function createProvider(config: {
  id: 'openai' | 'groq';
  label: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}): SttProvider {
  return {
    ...config,
    isAvailable() {
      return Boolean(config.apiKey);
    },
    async transcribeAudio(request: SttAudioRequest) {
      return runProviderRequest(this, request);
    },
  };
}

export function resolveConfiguredSttProviders(input: {
  preferredProvider: 'openai' | 'groq';
  fallbackProvider?: 'openai' | 'groq' | 'none';
  openAiApiKey?: string;
  openAiBaseUrl?: string;
  groqApiKey?: string;
  openAiModel?: string;
  groqModel?: string;
}) {
  const registry = {
    openai: createProvider({
      id: 'openai',
      label: 'OpenAI STT',
      apiKey: input.openAiApiKey || '',
      baseUrl: input.openAiBaseUrl || 'https://api.openai.com/v1',
      defaultModel: input.openAiModel || 'gpt-4o-transcribe',
    }),
    groq: createProvider({
      id: 'groq',
      label: 'Groq Whisper',
      apiKey: input.groqApiKey || '',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: input.groqModel || 'whisper-large-v3',
    }),
  } as const;

  const sequence: SttProvider[] = [];
  sequence.push(registry[input.preferredProvider]);
  if (
    input.fallbackProvider &&
    input.fallbackProvider !== 'none' &&
    input.fallbackProvider !== input.preferredProvider
  ) {
    sequence.push(registry[input.fallbackProvider]);
  }

  return sequence.filter((provider, index, all) => provider && all.indexOf(provider) === index);
}

export async function transcribeWithProviders(
  providers: SttProvider[],
  requestFactory: (provider: SttProvider) => SttAudioRequest
): Promise<SttProviderRunResult> {
  const attempts: SttProviderAttempt[] = [];
  let lastError: Error | null = null;

  for (const provider of providers) {
    if (!provider?.isAvailable()) {
      continue;
    }

    const startedAt = performance.now();
    const request = resolveProviderCompatibleRequest(provider, requestFactory(provider));
    try {
      const payload = await provider.transcribeAudio(request);
      attempts.push({
        providerId: provider.id,
        providerLabel: provider.label,
        model: String((request.fields as any)?.model || provider.defaultModel),
        success: true,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return {
        payload,
        providerId: provider.id,
        providerLabel: provider.label,
        model: String((request.fields as any)?.model || provider.defaultModel),
        attempts,
      };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempts.push({
        providerId: provider.id,
        providerLabel: provider.label,
        model: String((request.fields as any)?.model || provider.defaultModel),
        success: false,
        durationMs: Math.round(performance.now() - startedAt),
        status: Number((lastError as any)?.status || 0) || undefined,
        errorCode:
          String((lastError as any)?.errorCode || (lastError as any)?.code || '') || undefined,
        retryable: Boolean((lastError as any)?.retryable),
        retryAfterMs: Number((lastError as any)?.retryAfterMs || 0) || undefined,
        errorMessage: lastError.message,
      });
    }
  }

  const finalError = lastError || new Error('Brak skonfigurowanego providera STT.');
  (finalError as any).sttAttempts = attempts;
  if (!(finalError as any).errorCode && (finalError as any).code) {
    (finalError as any).errorCode = (finalError as any).code;
  }
  throw finalError;
}
