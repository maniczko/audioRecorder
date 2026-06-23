import crypto from 'node:crypto';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

type GoogleCertCache = {
  fetchedAt: number;
  certs: Record<string, string>;
};

export type VerifiedGoogleProfile = {
  email: string;
  sub: string;
  name?: string;
  given_name?: string;
  picture?: string;
};

let certCache: GoogleCertCache | null = null;

function base64UrlToBuffer(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='), 'base64');
}

function decodeJwtPart(part: string) {
  return JSON.parse(base64UrlToBuffer(part).toString('utf8'));
}

async function fetchGoogleCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && now - certCache.fetchedAt < 60 * 60 * 1000) {
    return certCache.certs;
  }

  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) {
    throw Object.assign(new Error('Nie mozna pobrac kluczy Google.'), { statusCode: 401 });
  }

  const certs = (await response.json()) as Record<string, string>;
  certCache = { fetchedAt: now, certs };
  return certs;
}

export function resetGoogleCertCacheForTests() {
  certCache = null;
}

export async function verifyGoogleIdToken(
  idToken: string,
  googleClientId?: string
): Promise<VerifiedGoogleProfile> {
  const token = String(idToken || '').trim();
  if (!token) {
    throw Object.assign(new Error('Brak Google idToken.'), { statusCode: 400 });
  }
  if (!googleClientId) {
    throw Object.assign(new Error('Brak konfiguracji GOOGLE_CLIENT_ID.'), { statusCode: 500 });
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw Object.assign(new Error('Nieprawidlowy Google idToken.'), { statusCode: 401 });
  }

  let header: any;
  let payload: any;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch {
    throw Object.assign(new Error('Nieprawidlowy Google idToken.'), { statusCode: 401 });
  }

  if (header?.alg !== 'RS256' || !header?.kid) {
    throw Object.assign(new Error('Nieprawidlowy podpis Google idToken.'), { statusCode: 401 });
  }

  const certs = await fetchGoogleCerts();
  const cert = certs[String(header.kid)];
  if (!cert) {
    throw Object.assign(new Error('Nieznany klucz Google idToken.'), { statusCode: 401 });
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const validSignature = verifier.verify(cert, base64UrlToBuffer(parts[2]));
  if (!validSignature) {
    throw Object.assign(new Error('Nieprawidlowy podpis Google idToken.'), { statusCode: 401 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.aud !== googleClientId) {
    throw Object.assign(new Error('Nieprawidlowy odbiorca Google idToken.'), { statusCode: 401 });
  }
  if (!GOOGLE_ISSUERS.has(String(payload.iss || ''))) {
    throw Object.assign(new Error('Nieprawidlowy issuer Google idToken.'), { statusCode: 401 });
  }
  if (Number(payload.exp || 0) <= nowSeconds) {
    throw Object.assign(new Error('Google idToken wygasl.'), { statusCode: 401 });
  }
  if (payload.email_verified !== true && payload.email_verified !== 'true') {
    throw Object.assign(new Error('Email Google nie zostal zweryfikowany.'), { statusCode: 401 });
  }
  if (!payload.email || !payload.sub) {
    throw Object.assign(new Error('Google idToken nie zawiera wymaganych danych.'), {
      statusCode: 401,
    });
  }

  return {
    email: String(payload.email),
    sub: String(payload.sub),
    name: payload.name ? String(payload.name) : undefined,
    given_name: payload.given_name ? String(payload.given_name) : undefined,
    picture: payload.picture ? String(payload.picture) : undefined,
  };
}
