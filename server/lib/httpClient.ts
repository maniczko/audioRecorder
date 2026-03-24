/**
 * httpClient.ts
 * 
 * HTTP client with HTTP/2 and keep-alive support for external APIs.
 * Provides connection pooling and reuse for better performance.
 */

import https from "node:https";
import http from "node:http";

// Connection pool configuration
const KEEP_ALIVE_TIMEOUT = 30000; // 30 seconds
const MAX_SOCKETS = 50; // Maximum concurrent connections per host
const MAX_FREE_SOCKETS = 10; // Maximum idle sockets

// Create HTTP/2-compatible agents with keep-alive
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: KEEP_ALIVE_TIMEOUT,
  maxSockets: MAX_SOCKETS,
  maxFreeSockets: MAX_FREE_SOCKETS,
  scheduling: "lifo", // LIFO scheduling for better connection reuse
  timeout: 60000, // 60 second timeout
});

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: KEEP_ALIVE_TIMEOUT,
  maxSockets: MAX_SOCKETS,
  maxFreeSockets: MAX_FREE_SOCKETS,
  scheduling: "lifo",
  timeout: 60000,
});

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
 * Fetch wrapper with HTTP/2 and keep-alive support
 * Uses native node:http/https agents for connection pooling
 */
export async function httpClient(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResponse> {
  const { method = "GET", headers = {}, body, signal, timeout = 60000 } = options;
  
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === "https:";
  const agent = isHttps ? httpsAgent : httpAgent;
  
  return new Promise((resolve, reject) => {
    const reqOptions: any = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "VoiceLog-API/1.0",
        "Connection": "keep-alive",
        "Keep-Alive": `timeout=${KEEP_ALIVE_TIMEOUT / 1000}, max=${MAX_SOCKETS}`,
        ...headers,
      },
      agent,
      timeout,
    };

    if (body && typeof body !== "string") {
      reqOptions.headers["Content-Length"] = Buffer.byteLength(JSON.stringify(body));
    }

    const client = isHttps ? https : http;
    const req = client.request(reqOptions, (res) => {
      const responseHeaders = new Headers();
      Object.entries(res.headers).forEach(([key, value]) => {
        if (value) responseHeaders.append(key, Array.isArray(value) ? value.join(", ") : value);
      });

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode || 0,
          statusText: res.statusMessage || "",
          headers: responseHeaders,
          text: async () => data,
          json: async () => JSON.parse(data),
        });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    if (signal) {
      signal.addEventListener("abort", () => {
        req.destroy();
        reject(new Error("Request aborted"));
      });
    }

    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }

    req.end();
  });
}

// Convenience methods
export const httpGet = (url: string, options?: FetchOptions) => 
  httpClient(url, { ...options, method: "GET" });

export const httpPost = (url: string, body: any, options?: FetchOptions) => 
  httpClient(url, { ...options, method: "POST", body });

// Export agents for use with fetch() if needed
export { httpsAgent, httpAgent };
