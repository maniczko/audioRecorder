/**
 * @vitest-environment node
 *
 * Tests for postProcessing.ts analyzeAcousticFeatures function.
 * Run in isolation to avoid module state pollution.
 *
 * embedTextChunks is tested via regression tests and audio-pipeline.unit.test.ts.
 */

import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import { EventEmitter } from 'node:events';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSpawn = vi.fn();
vi.mock('node:child_process', () => ({
  spawn: (...args: any[]) => mockSpawn(...args),
  execSync: vi.fn(),
  exec: vi.fn(),
}));

const mockFs = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
};
vi.mock('node:fs', () => ({
  get default() {
    return mockFs;
  },
  existsSync: (...args: any[]) => mockFs.existsSync(...args),
  readFileSync: (...args: any[]) => mockFs.readFileSync(...args),
  unlinkSync: (...args: any[]) => mockFs.unlinkSync(...args),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('postProcessing.ts — analyzeAcousticFeatures', () => {
  beforeAll(() => {
    mockSpawn.mockReset();
    mockFs.existsSync.mockReset();
    mockFs.existsSync.mockReturnValue(true);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('throws when audio file does not exist', async () => {
    mockFs.existsSync.mockImplementation((p: string) => !p.includes('.wav'));

    const { analyzeAcousticFeatures } = await import('../postProcessing.js');

    await expect(analyzeAcousticFeatures('/nonexistent.wav')).rejects.toThrow(
      'Plik audio nie istnieje.'
    );
  });

  test('throws 501 when acoustic_features.py script is missing', async () => {
    mockFs.existsSync.mockImplementation((p: string) => !p.includes('acoustic_features'));

    const { analyzeAcousticFeatures } = await import('../postProcessing.js');

    await expect(analyzeAcousticFeatures('/test.wav')).rejects.toThrow(
      'Analiza akustyczna niedostepna'
    );
  });

  test('returns parsed JSON from Python script stdout', async () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = vi.fn();
    child.stderr.setEncoding = vi.fn();
    mockSpawn.mockReturnValue(child);

    const { analyzeAcousticFeatures } = await import('../postProcessing.js');
    const promise = analyzeAcousticFeatures('/test.wav');

    setTimeout(() => {
      child.stdout.emit('data', '{"pitch": 120, "energy": 0.5}');
      child.emit('close', 0);
    }, 10);

    const result = await promise;
    expect(result).toEqual({ pitch: 120, energy: 0.5 });
  });

  test('rejects when Python script exits with non-zero code', async () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = vi.fn();
    child.stderr.setEncoding = vi.fn();
    mockSpawn.mockReturnValue(child);

    const { analyzeAcousticFeatures } = await import('../postProcessing.js');
    const promise = analyzeAcousticFeatures('/test.wav');

    setTimeout(() => {
      child.stderr.emit('data', 'Script error');
      child.emit('close', 1);
    }, 10);

    await expect(promise).rejects.toThrow('Script error');
  });

  test('rejects when Python script returns invalid JSON', async () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = vi.fn();
    child.stderr.setEncoding = vi.fn();
    mockSpawn.mockReturnValue(child);

    const { analyzeAcousticFeatures } = await import('../postProcessing.js');
    const promise = analyzeAcousticFeatures('/test.wav');

    setTimeout(() => {
      child.stdout.emit('data', 'not valid json {{{');
      child.emit('close', 0);
    }, 10);

    await expect(promise).rejects.toThrow();
  });

  test('rejects when Python script returns error field', async () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = vi.fn();
    child.stderr.setEncoding = vi.fn();
    mockSpawn.mockReturnValue(child);

    const { analyzeAcousticFeatures } = await import('../postProcessing.js');
    const promise = analyzeAcousticFeatures('/test.wav');

    setTimeout(() => {
      child.stdout.emit('data', JSON.stringify({ error: 'Feature extraction failed' }));
      child.emit('close', 0);
    }, 10);

    await expect(promise).rejects.toThrow('Feature extraction failed');
  });

  test('rejects when spawn emits error event', async () => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = vi.fn();
    child.stderr.setEncoding = vi.fn();
    mockSpawn.mockReturnValue(child);

    const { analyzeAcousticFeatures } = await import('../postProcessing.js');
    const promise = analyzeAcousticFeatures('/test.wav');

    setTimeout(() => {
      child.emit('error', new Error('spawn ENOENT'));
    }, 10);

    await expect(promise).rejects.toThrow('spawn ENOENT');
  });
});
