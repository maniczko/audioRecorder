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
 * Safely merge two AbortSignals - compatible with Node.js < 21
 */
function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  // Use AbortSignal.any if available (Node.js 21+)
  if (typeof (AbortSignal as any).any === "function") {
    return (AbortSignal as any).any(signals);
  }
  
  // Fallback for older Node.js versions
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

/**
 * Check if error is a retryable network error
 */
function isRetryableNetworkError(error: any): boolean {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("enetunreach") ||
    msg.includes("abort")
  );
}

/**
 * Fetch wrapper with keep-alive headers and retry logic
 */
export async function httpClient(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResponse> {
  const { method = "GET", headers = {}, body, signal, timeout = 120000 } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      timeoutId = setTimeout(() => controller.abort(), timeout);

      const mergedSignal = signal
        ? mergeAbortSignals([signal, controller.signal])
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

      // Don't retry on external abort (user-initiated)
      if (signal?.aborted) {
        throw error;
      }

      // Don't retry on internal timeout
      if (controller.signal.aborted) {
        throw error;
      }

      // Only retry on network errors
      if (!isRetryableNetworkError(error)) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES - 1) {
        const delay = 200 * Math.pow(2, attempt);
        console.log(`[httpClient] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms due to: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Enrich the error message with the underlying cause (e.g., ECONNRESET, DNS failure)
  // so it surfaces in UI diagnostics instead of bare "fetch failed".
  if (lastError) {
    const cause = (lastError as any)?.cause?.message || (lastError as any)?.cause?.code || "";
    if (cause && !lastError.message.includes(cause)) {
      lastError.message = `${lastError.message} (${cause})`;
    }
  }
  throw lastError || new Error("Request failed after retries");
}

// Convenience methods
export const httpGet = (url: string, options?: FetchOptions) => 
  httpClient(url, { ...options, method: "GET" });

export const httpPost = (url: string, body: any, options?: FetchOptions) => 
  httpClient(url, { ...options, method: "POST", body });
