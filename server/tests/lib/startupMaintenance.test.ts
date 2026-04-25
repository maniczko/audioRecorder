import path from 'node:path';
import { afterEach, describe, expect, test, vi, type Mock } from 'vitest';
import type { logger as loggerType } from '../../logger.ts';
import {
  cleanupStartupTemporaryFiles,
  runDatabaseStartupChecks,
  warnIfUsingDefaultLocalDatabase,
} from '../../lib/startupMaintenance.ts';

type LoggerLike = typeof loggerType;

interface FsMocks {
  existsSync: Mock;
  readdirSync: Mock;
  unlinkSync: Mock;
}

function fsMocks() {
  return (globalThis as unknown as { __mockFs: FsMocks }).__mockFs;
}

const defaultFsImplementations = {
  existsSync: fsMocks().existsSync.getMockImplementation(),
  readdirSync: fsMocks().readdirSync.getMockImplementation(),
  unlinkSync: fsMocks().unlinkSync.getMockImplementation(),
};

function createLogger(): LoggerLike {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerLike;
}

afterEach(() => {
  const fs = fsMocks();
  fs.existsSync.mockImplementation(defaultFsImplementations.existsSync);
  fs.readdirSync.mockImplementation(defaultFsImplementations.readdirSync);
  fs.unlinkSync.mockImplementation(defaultFsImplementations.unlinkSync);
  vi.clearAllMocks();
});

describe('startup maintenance', () => {
  test('warns when no external or explicit local database path is configured', () => {
    const logger = createLogger();

    warnIfUsingDefaultLocalDatabase({}, logger);

    expect(logger.warn).toHaveBeenCalledWith(
      '[Bootstrap] DATABASE_URL nie jest ustawione. Serwer uruchomi sie na lokalnym SQLite z domyslna sciezka.'
    );
  });

  test('does not warn when an external database is configured', () => {
    const logger = createLogger();

    warnIfUsingDefaultLocalDatabase({ DATABASE_URL: 'postgres://example' }, logger);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('removes startup temp files from upload, chunks, and preprocessed cache dirs', () => {
    const logger = createLogger();
    const fs = fsMocks();
    const uploadDir = '/tmp/voicelog-startup';
    const chunksDir = path.join(uploadDir, 'chunks');
    const cacheDir = path.join(uploadDir, '.cache', 'preprocessed');
    fs.existsSync.mockImplementation(() => true);
    fs.readdirSync.mockImplementation((dir: string) => {
      if (dir === uploadDir) {
        return ['temp_recording.webm', 'recording.webm'];
      }
      if (dir === chunksDir) {
        return ['chunk-1.bin'];
      }
      if (dir === cacheDir) {
        return ['preprocessed.wav'];
      }
      return [];
    });

    const deletedCount = cleanupStartupTemporaryFiles(uploadDir, logger);

    expect(deletedCount).toBe(3);
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(uploadDir, 'temp_recording.webm'));
    expect(fs.unlinkSync).not.toHaveBeenCalledWith(path.join(uploadDir, 'recording.webm'));
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(chunksDir, 'chunk-1.bin'));
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(cacheDir, 'preprocessed.wav'));
  });

  test('runs database init, health check, and orphan reset in startup order', async () => {
    const events: string[] = [];
    const logger = createLogger();
    const db = {
      init: vi.fn(async () => {
        events.push('init');
      }),
      checkHealth: vi.fn(async () => {
        events.push('health');
        return { ok: true, status: 'ok', type: 'sqlite' };
      }),
      resetOrphanedJobs: vi.fn(async () => {
        events.push('reset');
        return 2;
      }),
    };

    await runDatabaseStartupChecks(db, logger);

    expect(events).toEqual(['init', 'health', 'reset']);
    expect(logger.info).toHaveBeenCalledWith('[Bootstrap] Database health check OK (sqlite)');
    expect(logger.warn).toHaveBeenCalledWith(
      '[Bootstrap] Reset 2 orphaned transcription job(s) from previous instance.'
    );
  });

  test('logs failed orphan resets without blocking startup', async () => {
    const logger = createLogger();
    const db = {
      init: vi.fn(async () => {}),
      checkHealth: vi.fn(async () => ({ ok: false, status: 'down' })),
      resetOrphanedJobs: vi.fn(async () => {
        throw new Error('reset failed');
      }),
    };

    await runDatabaseStartupChecks(db, logger);

    expect(logger.error).toHaveBeenCalledWith('[Bootstrap] Database health check FAILED: down');
    expect(logger.error).toHaveBeenCalledWith(
      '[Bootstrap] Failed to reset orphaned jobs:',
      'reset failed'
    );
  });
});
