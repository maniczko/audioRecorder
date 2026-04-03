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
  const form = new FormData();
  const rawFilename =
    request.filename || (request.filePath ? path.basename(request.filePath) : 'audio.wav');
  const safeFilename = ensureValidSttFilename(rawFilename);

  form.append(
    'file',
    new Blob([audioBuffer], {
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

async function runProviderRequest(provider: SttProvider, request: SttAudioRequest) {
  if (!provider.isAvailable()) {
    throw new Error(`STT provider ${provider.id} nie jest skonfigurowany.`);
  }

  const url = `${provider.baseUrl}/audio/transcriptions`;
  const model = (request.fields as any)?.model || provider.defaultModel;
  console.log(`[stt] ${provider.id} model=${model} → POST ${url}`);

  let response: Awaited<ReturnType<typeof httpClient>>;
  try {
    response = await httpClient(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: createFormData(request),
      signal: request.signal,
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
    console.warn(
      `[stt] ${provider.id} failed: status=${response.status} body=${rawBody.slice(0, 300)}`
    );
    const err: any = new Error(msg);
    err.status = response.status;
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
    try {
      const payload = await provider.transcribeAudio(requestFactory(provider));
      attempts.push({
        providerId: provider.id,
        providerLabel: provider.label,
        model: String((requestFactory(provider).fields as any)?.model || provider.defaultModel),
        success: true,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return {
        payload,
        providerId: provider.id,
        providerLabel: provider.label,
        model: String((requestFactory(provider).fields as any)?.model || provider.defaultModel),
        attempts,
      };
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempts.push({
        providerId: provider.id,
        providerLabel: provider.label,
        model: String((requestFactory(provider).fields as any)?.model || provider.defaultModel),
        success: false,
        durationMs: Math.round(performance.now() - startedAt),
        errorMessage: lastError.message,
      });
    }
  }

  const finalError = lastError || new Error('Brak skonfigurowanego providera STT.');
  (finalError as any).sttAttempts = attempts;
  throw finalError;
}
