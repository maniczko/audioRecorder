import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const progressTokens = new Map<
  string,
  { recordingId: string; userId: string; expiresAt: number }
>();

export function createProgressToken(recordingId: string, userId: string, ttlMs = DEFAULT_TTL_MS) {
  const token = crypto.randomBytes(32).toString('base64url');
  progressTokens.set(token, {
    recordingId: String(recordingId || ''),
    userId: String(userId || ''),
    expiresAt: Date.now() + ttlMs,
  });
  return token;
}

export function verifyProgressToken(token: string, recordingId: string) {
  const value = String(token || '').trim();
  const entry = progressTokens.get(value);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    progressTokens.delete(value);
    return null;
  }

  if (entry.recordingId !== String(recordingId || '')) {
    return null;
  }

  return { user_id: entry.userId, recording_id: entry.recordingId, progress_token: true };
}

export function resetProgressTokensForTests() {
  progressTokens.clear();
}
