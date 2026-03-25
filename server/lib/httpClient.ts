/**
 * httpClient.ts
 * 
 * HTTP client with keep-alive support for external APIs.
 * Provides connection pooling and reuse for better performance.
 * 
 * Note: Uses native fetch() with keep-alive headers for simplicity.
 * Node.js 22+ fetch has built-in connection pooling.
 */

// Keep-alive configuration
const KEEP_ALIVE_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
  timeout?: number;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  text: () => Promise<string>;
  json: () => Promise<any>;
}

/**
 * Fetch wrapper with keep-alive headers and retry logic
 */
export async function httpClient(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResponse> {
  const { method = "GET", headers = {}, body, signal, timeout = 60000 } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      timeoutId = setTimeout(() => controller.abort(), timeout);

      const mergedSignal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;

      const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
      const response = await fetch(url, {
        method,
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          "User-Agent": "VoiceLog-API/1.0",
          "Connection": "keep-alive",
          "Keep-Alive": `timeout=${KEEP_ALIVE_TIMEOUT / 1000}, max=${MAX_RETRIES}`,
          ...headers,
        },
        body: isFormData ? body : (body && typeof body !== "string" ? JSON.stringify(body) : body),
        signal: mergedSignal,
      });

      clearTimeout(timeoutId);

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers as unknown as Headers,
        text: async () => response.text(),
        json: async () => response.json(),
      };
    } catch (error: any) {
      lastError = error;
      clearTimeout(timeoutId);

      // Don't retry on external abort OR internal timeout
      if (signal?.aborted || controller.signal.aborted) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError || new Error("Request failed after retries");
}

// Convenience methods
export const httpGet = (url: string, options?: FetchOptions) => 
  httpClient(url, { ...options, method: "GET" });

export const httpPost = (url: string, body: any, options?: FetchOptions) => 
  httpClient(url, { ...options, method: "POST", body });
