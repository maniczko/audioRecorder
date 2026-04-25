import fs from 'node:fs';
import path from 'node:path';
import type { logger as loggerType } from '../logger.ts';

type LoggerLike = typeof loggerType;
type TimerLike = ReturnType<typeof setInterval>;

export const CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
export const STALE_TEMP_FILE_MAX_AGE_MS = 60 * 60 * 1000;

interface PeriodicCleanupOptions {
  uploadDir: string;
  logger: LoggerLike;
  nowMs?: number;
  maxAgeMs?: number;
  triggerGc?: () => boolean;
}

interface StartPeriodicCleanupOptions {
  uploadDir: string;
  logger: LoggerLike;
  intervalMs?: number;
  setIntervalFn?: typeof setInterval;
}

function cleanDir(
  dir: string,
  nowMs: number,
  maxAgeMs: number,
  shouldConsider?: (fileName: string) => boolean
) {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  let cleaned = 0;

  for (const file of fs.readdirSync(dir)) {
    if (shouldConsider && !shouldConsider(file)) {
      continue;
    }

    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isFile() && nowMs - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    } catch (_) {
      // Best effort cleanup only.
    }
  }

  return cleaned;
}

export function runPeriodicTempCleanup({
  uploadDir,
  logger,
  nowMs = Date.now(),
  maxAgeMs = STALE_TEMP_FILE_MAX_AGE_MS,
  triggerGc = () => {
    if (typeof global.gc !== 'function') {
      return false;
    }
    global.gc();
    return true;
  },
}: PeriodicCleanupOptions) {
  const isTopLevelTempFile = (file: string) =>
    file.startsWith('temp_') || file.startsWith('preprocess_');

  const cleaned =
    cleanDir(uploadDir, nowMs, maxAgeMs, isTopLevelTempFile) +
    cleanDir(path.join(uploadDir, 'chunks'), nowMs, maxAgeMs) +
    cleanDir(path.join(uploadDir, '.cache', 'preprocessed'), nowMs, maxAgeMs);

  if (cleaned > 0) {
    logger.info(`[Cleanup] Periodic: removed ${cleaned} stale temp files.`);
  }

  const gcTriggered = triggerGc();
  if (gcTriggered) {
    logger.info('[Cleanup] Periodic: triggered garbage collection.');
  }

  return { cleaned, gcTriggered };
}

export function startPeriodicTempCleanup({
  uploadDir,
  logger,
  intervalMs = CLEANUP_INTERVAL_MS,
  setIntervalFn = setInterval,
}: StartPeriodicCleanupOptions): TimerLike {
  const cleanupTimer = setIntervalFn(() => {
    try {
      runPeriodicTempCleanup({ uploadDir, logger });
    } catch (error) {
      logger.warn('[Cleanup] Periodic cleanup error:', error);
    }
  }, intervalMs);

  cleanupTimer.unref?.();
  return cleanupTimer;
}
