import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGoogleCertCacheForTests, verifyGoogleIdToken } from '../../lib/googleIdToken';

const CLIENT_ID = 'client-id.apps.googleusercontent.com';
const KID = 'kid-1';

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createSignedToken(
  privateKey: crypto.KeyObject,
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {}
) {
  const header = { alg: 'RS256', kid: KID, typ: 'JWT', ...headerOverrides };
  const payload = {
    aud: CLIENT_ID,
    iss: 'https://accounts.google.com',
    exp: Math.floor(Date.now() / 1000) + 300,
    email_verified: true,
    email: 'verified@example.com',
    sub: 'google-sub',
    name: 'Verified User',
    given_name: 'Verified',
    picture: 'https://example.com/avatar.png',
    ...payloadOverrides,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64Url(signer.sign(privateKey))}`;
}

describe('verifyGoogleIdToken', () => {
  let privateKey: crypto.KeyObject;
  let cert: string;

  beforeEach(() => {
    resetGoogleCertCacheForTests();
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = pair.privateKey;
    cert = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ [KID]: cert }),
      }))
    );
  });

  afterEach(() => {
    resetGoogleCertCacheForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns verified profile fields from a valid signed token', async () => {
    const token = createSignedToken(privateKey);

    await expect(verifyGoogleIdToken(token, CLIENT_ID)).resolves.toEqual({
      email: 'verified@example.com',
      sub: 'google-sub',
      name: 'Verified User',
      given_name: 'Verified',
      picture: 'https://example.com/avatar.png',
    });
  });

  it('rejects missing token and missing client configuration', async () => {
    await expect(verifyGoogleIdToken('', CLIENT_ID)).rejects.toMatchObject({ statusCode: 400 });
    await expect(verifyGoogleIdToken('a.b.c')).rejects.toMatchObject({ statusCode: 500 });
  });

  it('rejects malformed jwt payloads', async () => {
    await expect(verifyGoogleIdToken('not-a-jwt', CLIENT_ID)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(verifyGoogleIdToken('bad.bad.bad', CLIENT_ID)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects unsupported headers and unknown key ids', async () => {
    await expect(
      verifyGoogleIdToken(createSignedToken(privateKey, {}, { alg: 'HS256' }), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });

    await expect(
      verifyGoogleIdToken(createSignedToken(privateKey, {}, { kid: 'missing' }), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects failed cert fetches and invalid signatures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({}),
      }))
    );
    await expect(
      verifyGoogleIdToken(createSignedToken(privateKey), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });

    resetGoogleCertCacheForTests();
    const otherPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ [KID]: cert }),
      }))
    );
    await expect(
      verifyGoogleIdToken(createSignedToken(otherPair.privateKey), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects invalid claims', async () => {
    await expect(
      verifyGoogleIdToken(createSignedToken(privateKey, { aud: 'wrong' }), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      verifyGoogleIdToken(createSignedToken(privateKey, { iss: 'https://evil.example' }), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      verifyGoogleIdToken(createSignedToken(privateKey, { exp: 1 }), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      verifyGoogleIdToken(createSignedToken(privateKey, { email_verified: false }), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });
    await expect(
      verifyGoogleIdToken(createSignedToken(privateKey, { email: '' }), CLIENT_ID)
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('accepts the accounts.google.com issuer and string email_verified claim', async () => {
    const token = createSignedToken(privateKey, {
      iss: 'accounts.google.com',
      email_verified: 'true',
      name: undefined,
      given_name: undefined,
      picture: undefined,
    });

    await expect(verifyGoogleIdToken(token, CLIENT_ID)).resolves.toEqual({
      email: 'verified@example.com',
      sub: 'google-sub',
      name: undefined,
      given_name: undefined,
      picture: undefined,
    });
  });
});
