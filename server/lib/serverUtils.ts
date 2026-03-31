const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuta
const rateLimitMap = new Map();

// Czyszczenie starych wpisów co 5 minut
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  },
  5 * 60 * 1000
).unref();

/**
 * Sprawdza limit żądań dla danego IP i route.
 * Różne limity dla różnych typów endpointów:
 * - auth: 5 żądań/min (logowanie, rejestracja)
 * - api: 30 żądań/min (zwykłe API)
 * - upload: 10 żądań/min (przesyłanie plików)
 * - stt: 5 żądań/min (transkrypcja - kosztowne)
 */
export function checkRateLimit(ip: string, route: string, max?: number) {
  // Bypass rate limiting in tests to allow heavy automated suite runs
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return { limit: 9999, remaining: 9999, resetAt: Date.now() + 60000 };
  }

  // Domyślne limity w zależności od typu endpointu
  const defaultLimits: Record<string, number> = {
    auth: 5,
    login: 5,
    register: 5,
    reset: 3,
    upload: 10,
    media: 10,
    transcribe: 5,
    stt: 5,
    analyze: 5,
    ai: 10,
  };

  const limit = max ?? defaultLimits[route] ?? 30; // Domyślnie 30 dla innych endpointów

  const key = `${ip}:${route}`;
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }

  entry.count += 1;
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    const error = new Error(
      `Zbyt wiele prob. Limit: ${limit} żądań/min. Sprobuj ponownie za ${retryAfter}s.`
    ) as any;
    error.statusCode = 429;
    error.retryAfter = retryAfter;
    error.headers = {
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': entry.resetAt.toString(),
    };

    // Log as WARN, not ERROR - rate limiting is expected behavior, not a bug
    console.warn(
      `[RATE LIMIT] ${ip} exceeded ${limit} req/min on /${route}. Retry after ${retryAfter}s`
    );

    throw error;
  }

  // Zwróć informacje o limicie w nagłówkach (dla sukcesu)
  return {
    limit,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

export function corsHeaders(requestOrigin: string, allowedOrigins = 'http://localhost:3000') {
  const allowed = allowedOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAny = allowed.includes('*');
  const src = String(requestOrigin || '');
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(src);
  const isVercel = /^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(src);

  const origin = isLocalhost || isVercel || allowAny || allowed.includes(src) ? src : allowed[0];

  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Workspace-Id, X-Meeting-Id, X-Speaker-Name',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}

export function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

export function sendJson(
  response: any,
  statusCode: number,
  payload: any,
  origin: string,
  allowedOrigins: string
) {
  response.writeHead(statusCode, {
    ...corsHeaders(origin, allowedOrigins),
    ...securityHeaders(),
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

export function sendText(
  response: any,
  statusCode: number,
  body: string,
  origin: string,
  allowedOrigins: string
) {
  response.writeHead(statusCode, {
    ...corsHeaders(origin, allowedOrigins),
    ...securityHeaders(),
    'Content-Type': 'text/plain; charset=utf-8',
  });
  response.end(body);
}

export function sendNoContent(response: any, origin: string, allowedOrigins: string) {
  response.writeHead(204, { ...corsHeaders(origin, allowedOrigins), ...securityHeaders() });
  response.end();
}

export function readJsonBody(request: any, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let chunks: any[] = [];
    let received = 0;

    const cleanup = () => {
      chunks = [];
      received = 0;
    };

    request.on('data', (chunk: any) => {
      received += chunk.byteLength;
      if (received > maxBytes) {
        const error = new Error('Ładunek JSON przekracza maksymalny rozmiar.') as any;
        error.statusCode = 413;
        cleanup();
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(new Error('Invalid JSON payload.'));
      } finally {
        cleanup();
      }
    });
    request.on('error', (err: any) => {
      cleanup();
      reject(err);
    });
    request.on('close', () => {
      if (!request.complete) {
        cleanup();
        reject(new Error('Request closed or aborted by client'));
      }
    });
  });
}

export function readBinaryBody(request: any, maxBytes = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let chunks: any[] = [];
    let received = 0;

    const cleanup = () => {
      chunks = [];
      received = 0;
    };

    request.on('data', (chunk: any) => {
      received += chunk.byteLength;
      if (received > maxBytes) {
        request.removeAllListeners('data');
        request.resume();
        const error = new Error('Przesłany plik przekracza maksymalny rozmiar.') as any;
        error.statusCode = 413;
        cleanup();
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      const buf = Buffer.concat(chunks);
      cleanup();
      resolve(buf);
    });
    request.on('error', (err: any) => {
      cleanup();
      reject(err);
    });
    request.on('close', () => {
      if (!request.complete) {
        cleanup();
        reject(new Error('Request closed or aborted by client'));
      }
    });
  });
}

export function getBearerToken(request: any) {
  const header = String(request.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}
