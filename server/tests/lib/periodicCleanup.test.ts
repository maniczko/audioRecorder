import path from 'node:path';
import { afterEach, describe, expect, test, vi, type Mock } from 'vitest';
import type { logger as loggerType } from '../../logger.ts';
import {
  CLEANUP_INTERVAL_MS,
  runPeriodicTempCleanup,
  startPeriodicTempCleanup,
} from '../../lib/periodicCleanup.ts';

type LoggerLike = typeof loggerType;

interface FsMocks {
  existsSync: Mock;
  readdirSync: Mock;
  statSync: Mock;
  unlinkSync: Mock;
}

function fsMocks() {
  return (globalThis as unknown as { __mockFs: FsMocks }).__mockFs;
}

const defaultFsImplementations = {
  existsSync: fsMocks().existsSync.getMockImplementation(),
  readdirSync: fsMocks().readdirSync.getMockImplementation(),
  statSync: fsMocks().statSync.getMockImplementation(),
  unlinkSync: fsMocks().unlinkSync.getMockImplementation(),
};

function createLogger(): LoggerLike {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as LoggerLike;
}

function setupFiles(
  entries: Record<string, { files?: string[]; mtimeMs?: number }>,
  nowMs: number
) {
  const fs = fsMocks();
  fs.existsSync.mockImplementation((dir: string) => Boolean(entries[dir]));
  fs.readdirSync.mockImplementation((dir: string) => entries[dir]?.files || []);
  fs.statSync.mockImplementation((filePath: string) => ({
    isFile: () => true,
    mtimeMs: entries[filePath]?.mtimeMs ?? nowMs,
  }));
}

afterEach(() => {
  const fs = fsMocks();
  fs.existsSync.mockImplementation(defaultFsImplementations.existsSync);
  fs.readdirSync.mockImplementation(defaultFsImplementations.readdirSync);
  fs.statSync.mockImplementation(defaultFsImplementations.statSync);
  fs.unlinkSync.mockImplementation(defaultFsImplementations.unlinkSync);
  vi.clearAllMocks();
});

describe('periodic temp cleanup', () => {
  test('removes stale top-level temp and preprocess files only', () => {
    const logger = createLogger();
    const uploadDir = '/tmp/voicelog-periodic';
    const nowMs = new Date('2026-04-25T12:00:00Z').getTime();
    setupFiles(
      {
        [uploadDir]: {
          files: ['temp_old.webm', 'preprocess_old.wav', 'recording.webm'],
        },
        [path.join(uploadDir, 'temp_old.webm')]: { mtimeMs: nowMs - 90 * 60 * 1000 },
        [path.join(uploadDir, 'preprocess_old.wav')]: { mtimeMs: nowMs - 90 * 60 * 1000 },
        [path.join(uploadDir, 'recording.webm')]: { mtimeMs: nowMs - 90 * 60 * 1000 },
      },
      nowMs
    );

    const result = runPeriodicTempCleanup({
      uploadDir,
      logger,
      nowMs,
      triggerGc: () => false,
    });

    expect(result).toEqual({ cleaned: 2, gcTriggered: false });
    expect(fsMocks().unlinkSync).toHaveBeenCalledWith(path.join(uploadDir, 'temp_old.webm'));
    expect(fsMocks().unlinkSync).toHaveBeenCalledWith(path.join(uploadDir, 'preprocess_old.wav'));
    expect(fsMocks().unlinkSync).not.toHaveBeenCalledWith(path.join(uploadDir, 'recording.webm'));
  });

  test('removes stale files from chunk and preprocessed cache directories', () => {
    const logger = createLogger();
    const uploadDir = '/tmp/voicelog-periodic';
    const chunksDir = path.join(uploadDir, 'chunks');
    const cacheDir = path.join(uploadDir, '.cache', 'preprocessed');
    const nowMs = new Date('2026-04-25T12:00:00Z').getTime();
    setupFiles(
      {
        [uploadDir]: { files: [] },
        [chunksDir]: { files: ['chunk-1.bin'] },
        [cacheDir]: { files: ['cached.wav'] },
        [path.join(chunksDir, 'chunk-1.bin')]: { mtimeMs: nowMs - 90 * 60 * 1000 },
        [path.join(cacheDir, 'cached.wav')]: { mtimeMs: nowMs - 90 * 60 * 1000 },
      },
      nowMs
    );

    const result = runPeriodicTempCleanup({
      uploadDir,
      logger,
      nowMs,
      triggerGc: () => false,
    });

    expect(result.cleaned).toBe(2);
    expect(fsMocks().unlinkSync).toHaveBeenCalledWith(path.join(chunksDir, 'chunk-1.bin'));
    expect(fsMocks().unlinkSync).toHaveBeenCalledWith(path.join(cacheDir, 'cached.wav'));
  });

  test('keeps young files even when their names match cleanup patterns', () => {
    const logger = createLogger();
    const uploadDir = '/tmp/voicelog-periodic';
    const nowMs = new Date('2026-04-25T12:00:00Z').getTime();
    setupFiles(
      {
        [uploadDir]: { files: ['temp_young.webm'] },
        [path.join(uploadDir, 'temp_young.webm')]: { mtimeMs: nowMs - 5 * 60 * 1000 },
      },
      nowMs
    );

    const result = runPeriodicTempCleanup({
      uploadDir,
      logger,
      nowMs,
      triggerGc: () => false,
    });

    expect(result.cleaned).toBe(0);
    expect(fsMocks().unlinkSync).not.toHaveBeenCalled();
  });

  test('reports garbage collection when the injected trigger runs', () => {
    const logger = createLogger();
    const uploadDir = '/tmp/voicelog-periodic';
    setupFiles({ [uploadDir]: { files: [] } }, Date.now());

    const result = runPeriodicTempCleanup({
      uploadDir,
      logger,
      triggerGc: () => true,
    });

    expect(result.gcTriggered).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('[Cleanup] Periodic: triggered garbage collection.');
  });

  test('starts an unrefed interval with the production cadence', () => {
    const logger = createLogger();
    const timer = { unref: vi.fn() };
    const setIntervalFn = vi.fn(() => timer) as unknown as typeof setInterval;

    const startedTimer = startPeriodicTempCleanup({
      uploadDir: '/tmp/uploads',
      logger,
      setIntervalFn,
    });

    expect(startedTimer).toBe(timer);
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), CLEANUP_INTERVAL_MS);
    expect(timer.unref).toHaveBeenCalledTimes(1);
  });
});
