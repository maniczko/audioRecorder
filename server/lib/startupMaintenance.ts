import fs from 'node:fs';
import path from 'node:path';
import type { logger as loggerType } from '../logger.ts';
import { classifyDiskSpace, DISK_SPACE_BLOCK_UPLOAD_BYTES } from './diskSpace.ts';

type LoggerLike = typeof loggerType;

interface DatabaseConfigLike {
  VOICELOG_DATABASE_URL?: string;
  DATABASE_URL?: string;
  VOICELOG_DB_PATH?: string;
}

interface StartupDatabaseLike {
  init: () => Promise<void>;
  checkHealth: () => Promise<{ ok: boolean; status: string; type?: string }>;
  resetOrphanedJobs: () => Promise<number>;
}

export function warnIfUsingDefaultLocalDatabase(config: DatabaseConfigLike, logger: LoggerLike) {
  const hasExternalDatabase = Boolean(config.VOICELOG_DATABASE_URL || config.DATABASE_URL);
  const hasLocalDatabasePath = Boolean(config.VOICELOG_DB_PATH);

  if (!hasExternalDatabase && !hasLocalDatabasePath) {
    logger.warn(
      '[Bootstrap] DATABASE_URL nie jest ustawione. Serwer uruchomi sie na lokalnym SQLite z domyslna sciezka.'
    );
  }
}

function removeFilesInDir(dir: string, shouldRemove?: (fileName: string) => boolean) {
  if (!fs.existsSync(dir)) {
    return 0;
  }

  let deletedCount = 0;

  for (const file of fs.readdirSync(dir)) {
    if (shouldRemove && !shouldRemove(file)) {
      continue;
    }

    try {
      fs.unlinkSync(path.join(dir, file));
      deletedCount++;
    } catch (_) {
      // Best effort cleanup only.
    }
  }

  return deletedCount;
}

export function cleanupStartupTemporaryFiles(uploadDir: string, logger: LoggerLike) {
  if (!fs.existsSync(uploadDir)) {
    return 0;
  }

  const isTopLevelTempFile = (file: string) =>
    file.startsWith('temp_') || file.startsWith('chunk_') || file.startsWith('preprocess_');

  const deletedCount =
    removeFilesInDir(uploadDir, isTopLevelTempFile) +
    removeFilesInDir(path.join(uploadDir, 'chunks')) +
    removeFilesInDir(path.join(uploadDir, '.cache', 'preprocessed'));

  if (deletedCount > 0) {
    logger.info(
      `[Bootstrap] Cleared ${deletedCount} temporary audio files from ${uploadDir} (incl. chunks & cache) to free up disk space.`
    );
  }

  return deletedCount;
}

export async function checkStartupDiskSpace(uploadDir: string, logger: LoggerLike) {
  if (!fs.statfsSync) {
    return;
  }

  const stats = fs.statfsSync(uploadDir);
  const freeBytes = stats.bavail * stats.bsize;
  const freeGB = (freeBytes / 1024 / 1024 / 1024).toFixed(2);
  const diskSpace = classifyDiskSpace(freeBytes);

  if (diskSpace.severity === 'critical') {
    logger.error(`[Bootstrap] CRITICAL: Disk space critically low! Only ${freeGB}GB free.`);
    logger.error(
      '[Bootstrap] Please clean up disk space or the server will fail to accept recordings.'
    );
    logger.info('[Bootstrap] Attempting automatic disk cleanup...');

    try {
      const { cleanupDisk } = await import('../scripts/cleanup-disk.ts');
      const result = cleanupDisk();
      logger.info(
        `[Bootstrap] Cleanup result: ${result.deletedCount} files deleted, ${(result.freedBytes / 1024 / 1024).toFixed(2)} MB freed`
      );
    } catch (cleanupError) {
      logger.error('[Bootstrap] Automatic cleanup failed:', cleanupError);
    }
    return;
  }

  if (diskSpace.severity === 'warning') {
    logger.warn(
      `[Bootstrap] WARNING: Disk space low. ${freeGB}GB free. Uploads are still accepted above ${(DISK_SPACE_BLOCK_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB free, but cleanup is recommended before the server reaches the hard limit.`,
      {},
      { sentry: false }
    );
    return;
  }

  logger.info(`[Bootstrap] Disk space OK: ${freeGB}GB free.`);
}

export async function runStartupMaintenance(uploadDir: string, logger: LoggerLike) {
  try {
    cleanupStartupTemporaryFiles(uploadDir, logger);
    await checkStartupDiskSpace(uploadDir, logger);
  } catch (error) {
    logger.warn('[Bootstrap] Unable to check disk space:', error);
  }
}

export async function runDatabaseStartupChecks(db: StartupDatabaseLike, logger: LoggerLike) {
  await db.init();

  const dbHealth = await db.checkHealth();
  if (!dbHealth.ok) {
    logger.error(`[Bootstrap] Database health check FAILED: ${dbHealth.status}`);
  } else {
    logger.info(`[Bootstrap] Database health check OK (${dbHealth.type})`);
  }

  try {
    const orphanCount = await db.resetOrphanedJobs();
    if (orphanCount > 0) {
      logger.warn(
        `[Bootstrap] Reset ${orphanCount} orphaned transcription job(s) from previous instance.`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : error;
    logger.error('[Bootstrap] Failed to reset orphaned jobs:', message);
  }
}
