const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeRetentionDays(value: unknown, fallback = 365): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.floor(numeric);
  }
  return fallback;
}

export function calculateRetentionCutoff(nowIso: string, retentionDays: unknown): string | null {
  const days = normalizeRetentionDays(retentionDays, 0);
  if (days <= 0) return null;

  const nowMs = Date.parse(String(nowIso || ''));
  if (!Number.isFinite(nowMs)) return null;

  return new Date(nowMs - days * DAY_MS).toISOString();
}

export function isCreatedAtExpiredByRetention({
  createdAt,
  nowIso,
  retentionDays,
}: {
  createdAt: string;
  nowIso: string;
  retentionDays: unknown;
}): boolean {
  const cutoff = calculateRetentionCutoff(nowIso, retentionDays);
  if (!cutoff) return false;
  const createdAtMs = Date.parse(String(createdAt || ''));
  const cutoffMs = Date.parse(cutoff);
  return Number.isFinite(createdAtMs) && Number.isFinite(cutoffMs) && createdAtMs < cutoffMs;
}
