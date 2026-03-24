import fs from "node:fs";
import path from "node:path";
import { httpClient } from "../lib/httpClient.ts";

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
  id: "openai" | "groq";
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
  const audioBuffer = request.buffer || (request.filePath ? fs.readFileSync(request.filePath) : null);
  if (!audioBuffer) {
    throw new Error("Brakuje audio buffer albo filePath dla STT request.");
  }
  if (audioBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error("Plik audio przekracza limit 24 MB dla API transkrypcji.");
  }
  return audioBuffer;
}

function createFormData(request: SttAudioRequest) {
  const audioBuffer = ensureAudioBuffer(request);
  const form = new FormData();
  const safeFilename = request.filename || (request.filePath ? path.basename(request.filePath) : "audio.wav");

  form.append(
    "file",
    new File([audioBuffer], safeFilename, { type: request.contentType || "application/octet-stream" }) as any
  );

  Object.entries(request.fields || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        form.append(`${key}[]`, String(entry));
      });
      return;
    }

    form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
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

  // [320] Use HTTP client with keep-alive and connection pooling
  const response = await httpClient(`${provider.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: createFormData(request),
    timeout: 120000,
  });

  const rawBody = await response.text();
  if (!response.ok) {
    const payload = parseJsonResponse(rawBody);
    throw new Error(payload?.error?.message || `STT audio request failed with status ${response.status}.`);
  }

  return parseJsonResponse(rawBody);
}

function createProvider(config: {
  id: "openai" | "groq";
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
  preferredProvider: "openai" | "groq";
  fallbackProvider?: "openai" | "groq" | "none";
  openAiApiKey?: string;
  openAiBaseUrl?: string;
  groqApiKey?: string;
  openAiModel?: string;
  groqModel?: string;
}) {
  const registry = {
    openai: createProvider({
      id: "openai",
      label: "OpenAI STT",
      apiKey: input.openAiApiKey || "",
      baseUrl: input.openAiBaseUrl || "https://api.openai.com/v1",
      defaultModel: input.openAiModel || "gpt-4o-transcribe",
    }),
    groq: createProvider({
      id: "groq",
      label: "Groq Whisper",
      apiKey: input.groqApiKey || "",
      baseUrl: "https://api.groq.com/openai/v1",
      defaultModel: input.groqModel || "whisper-large-v3",
    }),
  } as const;

  const sequence: SttProvider[] = [];
  sequence.push(registry[input.preferredProvider]);
  if (input.fallbackProvider && input.fallbackProvider !== "none" && input.fallbackProvider !== input.preferredProvider) {
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

  const finalError = lastError || new Error("Brak skonfigurowanego providera STT.");
  (finalError as any).sttAttempts = attempts;
  throw finalError;
}
