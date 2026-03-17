const fs = require("node:fs");

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimitMap = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

function checkRateLimit(ip, route, max = 10) {
  const key = `${ip}:${route}`;
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }

  entry.count += 1;
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    const error = new Error("Zbyt wiele prob. Sprobuj ponownie za chwile.");
    error.statusCode = 429;
    error.retryAfter = retryAfter;
    throw error;
  }
}

function corsHeaders(requestOrigin, allowedOrigins = "http://localhost:3000") {
  const allowed = allowedOrigins.split(",").map(s => s.trim()).filter(Boolean);
  const allowAny = allowed.includes("*");
  const src = String(requestOrigin || "");
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(src);
  const isVercel = /^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(src);
  
  const origin = isLocalhost || isVercel || allowAny || allowed.includes(src) ? src : allowed[0];
  
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Workspace-Id, X-Meeting-Id, X-Speaker-Name",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

function securityHeaders() {
  return {
    "Content-Security-Policy": "default-src 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sendJson(response, statusCode, payload, origin, allowedOrigins) {
  response.writeHead(statusCode, {
    ...corsHeaders(origin, allowedOrigins),
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, body, origin, allowedOrigins) {
  response.writeHead(statusCode, {
    ...corsHeaders(origin, allowedOrigins),
    ...securityHeaders(),
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function sendNoContent(response, origin, allowedOrigins) {
  response.writeHead(204, { ...corsHeaders(origin, allowedOrigins), ...securityHeaders() });
  response.end();
}

function readJsonBody(request, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    request.on("data", (chunk) => {
      received += chunk.byteLength;
      if (received > maxBytes) {
        const error = new Error("Ładunek JSON przekracza maksymalny rozmiar.");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (e) {
        reject(new Error("Invalid JSON payload."));
      }
    });
    request.on("error", reject);
  });
}

function readBinaryBody(request, maxBytes = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    request.on("data", (chunk) => {
      received += chunk.byteLength;
      if (received > maxBytes) {
        const error = new Error("Przesłany plik przekracza maksymalny rozmiar.");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function getBearerToken(request) {
  const header = String(request.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

module.exports = {
  checkRateLimit,
  sendJson,
  sendText,
  sendNoContent,
  readJsonBody,
  readBinaryBody,
  getBearerToken,
  securityHeaders,
  corsHeaders,
};
