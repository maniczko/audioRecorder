import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { SEGMENT_PART_MAX_BYTES } from '../../lib/mediaStoragePolicy.ts';

type PipelineModule = typeof import('../../lib/mediaStoragePipeline.ts');

const testState = {
  execFileCalls: 0,
};

type ExecFileMock = (
  command: string,
  args: string[],
  options: unknown,
  callback: (error?: unknown, result?: { stdout?: string }) => void
) => void;

function getMockFsState() {
  return {
    setExistsSync: (value: boolean) => {
      (global as any).__TEST_FS_STATE__ = {
        ...(global as any).__TEST_FS_STATE__,
        existsSync: value,
      };
      (global as any).__mockFs?.existsSync?.mockReturnValue(value);
    },
  };
}

async function createWorkDir() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'media-storage-pipeline-test-'));
  return tempDir;
}

async function withPipelineModule(
  options: {
    testRuntime?: boolean;
    execFile?: ExecFileMock;
    downloadAudioToFile?: (...args: any[]) => Promise<void>;
    rm?: (...args: any[]) => Promise<void>;
    fsPromises?: {
      readdir?: (path: string) => Promise<string[]>;
      stat?: (path: string) => Promise<{ size: number }>;
    };
  } = {}
): Promise<{
  module: PipelineModule;
  execFile: ExecFileMock;
  downloadAudioToFile: (...args: any[]) => Promise<void>;
  rm: (...args: any[]) => Promise<void>;
}> {
  if (options.testRuntime === false) {
    process.env.VITEST = '';
  } else {
    process.env.VITEST = '1';
  }
  process.env.NODE_ENV = options.testRuntime === false ? 'production' : 'test';

  vi.clearAllMocks();
  vi.resetModules();
  vi.doUnmock('node:fs/promises');
  vi.doUnmock('node:child_process');
  vi.doUnmock('../../lib/supabaseStorage.js');

  const execFile = options.execFile
    ? vi.fn(options.execFile)
    : vi.fn(
        (
          _command: string,
          _args: string[],
          _options: unknown,
          callback: (error?: unknown, result?: { stdout?: string }) => void
        ) => {
          callback?.(null, { stdout: '0' });
        }
      );
  const downloadAudioToFile = options.downloadAudioToFile
    ? vi.fn(options.downloadAudioToFile)
    : vi.fn(async () => {});
  const rm = options.rm ? vi.fn(options.rm) : null;
  const readdir = options.fsPromises?.readdir ? vi.fn(options.fsPromises.readdir) : null;
  const stat = options.fsPromises?.stat ? vi.fn(options.fsPromises.stat) : null;

  vi.doMock('node:child_process', () => ({
    execFile,
  }));

  vi.doMock('../../lib/supabaseStorage.js', () => ({
    downloadAudioToFile,
  }));
  if (rm || readdir || stat) {
    vi.doMock('node:fs/promises', async () => {
      const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
      return {
        ...actual,
        ...(rm ? { rm } : {}),
        ...(readdir ? { readdir } : {}),
        ...(stat ? { stat } : {}),
      };
    });
  }

  const module = await import('../../lib/mediaStoragePipeline.ts');

  return {
    module,
    execFile,
    downloadAudioToFile,
    rm: rm || (async () => {}),
  };
}

describe('mediaStoragePipeline', () => {
  const fsState = getMockFsState();

  beforeEach(() => {
    fsState.setExistsSync(true);
    process.env.NODE_ENV = 'test';
    process.env.VITEST = '1';
    testState.execFileCalls = 0;
  });

  afterEach(async () => {
    fsState.setExistsSync(true);
    process.env.NODE_ENV = 'test';
    process.env.VITEST = '1';
    testState.execFileCalls = 0;
  });

  test('normalizes audio in test runtime by copying source file unchanged', async () => {
    const { module } = await withPipelineModule({ testRuntime: true });
    const workDir = await createWorkDir();
    const sourcePath = path.join(workDir, 'source.webm');
    const payload = Buffer.from('audio-source-data');
    await writeFile(sourcePath, payload);

    const result = await module.normalizeAudioForStorage({
      sourcePath,
      workDir,
      recordingId: 'rec#1',
    });

    expect(result.durationMs).toBe(0);
    expect(result.contentType).toBe('audio/webm');
    expect(result.sizeBytes).toBe(payload.length);
    const copied = await readFile(result.path);
    expect(copied).toEqual(payload);
    expect(path.basename(result.path)).toContain('rec_1');

    await rm(workDir, { recursive: true, force: true });
  });

  test('normalizes audio in non-test runtime using ffmpeg/ffprobe command flow', async () => {
    const workDir = await createWorkDir();
    const sourcePath = path.join(workDir, 'source.webm');
    await writeFile(sourcePath, Buffer.from('audio-source-data'));

    const execFile = vi.fn((command: string, args: string[], _options: unknown, callback) => {
      testState.execFileCalls += 1;
      if (command.includes('ffprobe')) {
        callback?.(null, { stdout: '12.6' });
        return;
      }

      const outputPath = args.at(-1);
      if (outputPath) {
        writeFile(outputPath, Buffer.from('normalized-audio'))
          .then(() => {
            callback?.(null, { stdout: '' });
          })
          .catch((error) => {
            callback?.(error as unknown);
          });
        return;
      }
      callback?.(null, { stdout: '' });
    });

    const { module } = await withPipelineModule({
      testRuntime: false,
      execFile,
    });

    const result = await module.normalizeAudioForStorage({
      sourcePath,
      workDir,
      recordingId: 'rec normalize',
      signal: new AbortController().signal,
    });

    expect(testState.execFileCalls).toBe(2);
    expect(execFile).toHaveBeenCalledTimes(2);
    const [firstCall] = execFile.mock.calls;
    const [secondCall] = execFile.mock.calls.slice(1);
    expect(firstCall[0]).toMatch(/ffmpeg$/);
    expect(secondCall[0]).toMatch(/ffprobe$/);
    expect(result.durationMs).toBe(Math.round(12.6 * 1000));
    expect(result.sizeBytes).toBeGreaterThan(0);

    await rm(workDir, { recursive: true, force: true });
  });

  test('wraps normalization failures in MediaStoragePipelineError and preserves cause', async () => {
    const { module } = await withPipelineModule({
      testRuntime: false,
      execFile: (_command, _args, _options, callback) => {
        callback?.(new Error('ffmpeg-failed'));
      },
    });
    const workDir = await createWorkDir();
    const sourcePath = path.join(workDir, 'source.webm');
    await writeFile(sourcePath, Buffer.from('audio-source-data'));

    await expect(
      module.normalizeAudioForStorage({
        sourcePath,
        workDir,
        recordingId: 'rec',
      })
    ).rejects.toMatchObject({
      name: 'MediaStoragePipelineError',
      code: 'audio_normalization_failed',
      status: 422,
      cause: expect.any(Error),
    });

    await rm(workDir, { recursive: true, force: true });
  });

  test('creates byte-based parts when test runtime flag is active', async () => {
    const { module } = await withPipelineModule({ testRuntime: true });
    const workDir = await createWorkDir();
    const normalizedPath = path.join(workDir, 'normalized.webm');
    await writeFile(
      normalizedPath,
      Buffer.concat([Buffer.alloc(SEGMENT_PART_MAX_BYTES + 1), Buffer.from('tail')])
    );

    const parts = await module.splitNormalizedAudioIntoParts({
      normalizedPath,
      workDir,
      recordingId: 'rec valid',
      durationMs: 5000,
    });

    expect(parts).toHaveLength(2);
    expect(parts.map((part) => part.index)).toEqual([0, 1]);
    expect(parts[0].startMs).toBe(0);
    expect(parts[0].endMs).toBe(2500);
    expect(parts[1].startMs).toBe(2500);
    expect(parts[1].endMs).toBe(5000);
    expect(parts.every((part) => part.contentType === 'audio/webm')).toBe(true);

    const written = await Promise.all(parts.map((part) => stat(part.localPath)));
    expect(written[0].size).toBeGreaterThan(0);
    expect(written[1].size).toBeGreaterThan(0);

    await rm(workDir, { recursive: true, force: true });
  });

  test('falls back to safe duration when test input duration is zero', async () => {
    const { module } = await withPipelineModule({ testRuntime: true });
    const workDir = await createWorkDir();
    const normalizedPath = path.join(workDir, 'normalized.webm');
    await writeFile(
      normalizedPath,
      Buffer.concat([Buffer.alloc(SEGMENT_PART_MAX_BYTES + 1), Buffer.from('tail')])
    );

    const parts = await module.splitNormalizedAudioIntoParts({
      normalizedPath,
      workDir,
      recordingId: 'rec empty',
      durationMs: 0,
    });

    expect(parts[0].startMs).toBe(0);
    expect(parts[1].startMs).toBeGreaterThan(0);

    await rm(workDir, { recursive: true, force: true });
  });

  test('segments normalized audio in production-like mode with successful ffmpeg output', async () => {
    const workDir = await createWorkDir();
    const normalizedPath = path.join(workDir, 'normalized.webm');
    await writeFile(normalizedPath, Buffer.from('normalized-audio'));

    const execFile = vi.fn((_command: string, args: string[], _options: unknown, callback) => {
      testState.execFileCalls += 1;
      const last = args.at(-1);
      if (typeof last !== 'string') {
        callback?.(null, { stdout: '' });
        return;
      }

      const segmentPrefix = `${path.basename(last).replace('%03d.webm', '')}`;
      const outputBase = path.join(path.dirname(last), segmentPrefix);
      if (last.includes('%03d')) {
        Promise.all([
          writeFile(`${outputBase}000.webm`, Buffer.from('segment-000')),
          writeFile(`${outputBase}001.webm`, Buffer.from('segment-001')),
        ])
          .then(() => {
            callback?.(null, { stdout: '' });
          })
          .catch((error) => {
            callback?.(error as unknown);
          });
        return;
      }

      callback?.(null, { stdout: '' });
    });

    const { module } = await withPipelineModule({
      testRuntime: false,
      execFile,
    });
    const parts = await module.splitNormalizedAudioIntoParts({
      normalizedPath,
      workDir,
      recordingId: 'rec test',
      durationMs: 4000,
    });

    expect(parts).toHaveLength(2);
    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          index: 0,
          startMs: 0,
          endMs: 2000,
          sizeBytes: 11,
        }),
        expect.objectContaining({
          index: 1,
          startMs: 2000,
          endMs: 4000,
          sizeBytes: 11,
        }),
      ])
    );
    expect(execFile).toHaveBeenCalledTimes(1);

    await rm(workDir, { recursive: true, force: true });
  });

  test('retries split when oversized segment is created and succeeds after retry', async () => {
    const workDir = await createWorkDir();
    const normalizedPath = path.join(workDir, 'normalized.webm');
    await writeFile(normalizedPath, Buffer.from('normalized-audio'));
    const generatedPrefixes: string[] = [];

    const execFile = vi.fn((_command: string, args: string[], _options: unknown, callback) => {
      testState.execFileCalls += 1;
      const last = args.at(-1);
      if (typeof last !== 'string') {
        callback?.(null, { stdout: '' });
        return;
      }
      const segmentPrefix = `${path.basename(last).replace('%03d.webm', '')}`;
      const outputBase = path.join(path.dirname(last), segmentPrefix);
      generatedPrefixes.push(outputBase);
      writeFile(
        `${outputBase}000.webm`,
        testState.execFileCalls === 1
          ? Buffer.alloc(SEGMENT_PART_MAX_BYTES + 1, 1)
          : Buffer.from('small')
      )
        .then(() => {
          callback?.(null, { stdout: '' });
        })
        .catch((error) => {
          callback?.(error as unknown);
        });
    });

    const { module } = await withPipelineModule({
      testRuntime: false,
      execFile,
    });
    const parts = await module.splitNormalizedAudioIntoParts({
      normalizedPath,
      workDir,
      recordingId: 'rec-retry',
      durationMs: 2000,
    });

    expect(execFile).toHaveBeenCalledTimes(2);
    expect(parts).toHaveLength(1);
    expect(parts[0].startMs).toBe(0);
    expect(parts[0].endMs).toBe(2000);
    expect(generatedPrefixes[0]).toBeTruthy();
    expect(generatedPrefixes[1]).toBeTruthy();

    await expect(readFile(`${generatedPrefixes[0]}000.webm`)).rejects.toThrow();

    await rm(workDir, { recursive: true, force: true });
  });

  test('throws audio_segmentation_failed when ffmpeg does not create any segment files', async () => {
    const { module } = await withPipelineModule({
      testRuntime: false,
      execFile: (_command, _args, _options, callback) => callback?.(null, { stdout: '' }),
    });
    const workDir = await createWorkDir();
    const normalizedPath = path.join(workDir, 'normalized.webm');
    await writeFile(normalizedPath, Buffer.from('normalized-audio'));

    await expect(
      module.splitNormalizedAudioIntoParts({
        normalizedPath,
        workDir,
        recordingId: 'rec-empty',
        durationMs: 2000,
      })
    ).rejects.toMatchObject({
      name: 'MediaStoragePipelineError',
      code: 'audio_segmentation_failed',
      message: 'Nie udalo sie podzielic audio na czesci.',
    });

    await rm(workDir, { recursive: true, force: true });
  });

  test('throws audio_segmentation_failed when oversized part remains after retries', async () => {
    const workDir = await createWorkDir();
    const normalizedPath = path.join(workDir, 'normalized.webm');
    await writeFile(normalizedPath, Buffer.from('normalized-audio'));
    const generatedFiles: string[] = [];

    const execFile = vi.fn((_command: string, args: string[], _options: unknown, callback) => {
      const last = args.at(-1);
      if (typeof last === 'string') {
        try {
          const segmentPrefix = `${path.basename(last).replace('%03d.webm', '')}`;
          const outputBase = path.join(path.dirname(last), segmentPrefix);
          const outputPath = `${outputBase}000.webm`;
          generatedFiles.push(outputPath);
          callback?.(null, { stdout: '' });
        } catch (error) {
          callback?.(error as unknown);
        }
        return;
      }
      callback?.(null, { stdout: '' });
    });

    const { module } = await withPipelineModule({
      testRuntime: false,
      execFile,
      rm: async () => {},
      fsPromises: {
        readdir: async () => generatedFiles.map((filePath) => path.basename(filePath)),
        stat: async () => ({ size: SEGMENT_PART_MAX_BYTES + 10 }),
      },
    });
    let thrown: unknown;
    try {
      await module.splitNormalizedAudioIntoParts({
        normalizedPath,
        workDir,
        recordingId: 'rec-oversize',
        durationMs: 2000,
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      name: 'MediaStoragePipelineError',
      code: 'audio_segmentation_failed',
      message: 'Po podziale jedna z czesci audio nadal przekracza limit.',
    });
    expect(execFile).toHaveBeenCalledTimes(3);

    await rm(workDir, { recursive: true, force: true });
  });

  test('materializes segmented manifest in production runtime with ffmpeg concat branch', async () => {
    const workDir = await createWorkDir();
    const asset = {
      file_path: 'storage/recording-manifest.webm',
      id: 'recording_3',
      media_manifest_json: JSON.stringify({
        version: 1,
        storageMode: 'segmented',
        recordingId: 'recording_3',
        workspaceId: 'ws',
        sourceSizeBytes: 2,
        normalizedSizeBytes: 2,
        durationMs: 1200,
        contentType: 'audio/webm',
        parts: [
          {
            index: 0,
            path: 'part-first',
            startMs: 0,
            endMs: 600,
            sizeBytes: 5,
            contentType: 'audio/webm',
          },
          {
            index: 1,
            path: 'part-second',
            startMs: 600,
            endMs: 1200,
            sizeBytes: 5,
            contentType: 'audio/webm',
          },
        ],
      }),
    };
    fsState.setExistsSync(false);

    const execFile = vi.fn((_command: string, _args: string[], _options: unknown, callback) => {
      callback?.(null, { stdout: '' });
    });
    const downloadAudioToFile = vi.fn(async (source: string, target: string) => {
      if (source === 'part-first') {
        await writeFile(target, Buffer.from('AAA'));
      } else {
        await writeFile(target, Buffer.from('BBBB'));
      }
    });

    const { module } = await withPipelineModule({
      testRuntime: false,
      execFile,
      downloadAudioToFile,
    });
    const result = await module.materializeAssetToLocal(asset, { workDir });

    expect(downloadAudioToFile).toHaveBeenNthCalledWith(
      1,
      'part-first',
      expect.stringContaining('temp_part_')
    );
    expect(downloadAudioToFile).toHaveBeenNthCalledWith(
      2,
      'part-second',
      expect.stringContaining('temp_part_')
    );
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(result.localPath).toContain(workDir);

    await result.cleanup();
    await expect(readFile(result.localPath)).rejects.toThrow();
    await rm(workDir, { recursive: true, force: true });
  });

  test('falls back to ffprobe error handling with duration 0 when ffprobe fails', async () => {
    const workDir = await createWorkDir();
    const sourcePath = path.join(workDir, 'source.webm');
    await writeFile(sourcePath, Buffer.from('audio-source-data'));
    const execFile = vi.fn((_command: string, args: string[], _options: unknown, callback) => {
      if (String(args?.at(-1)).includes('%03d.webm')) {
        callback?.(null, { stdout: '' });
        return;
      }
      if (_command.includes('ffprobe')) {
        callback?.(new Error('ffprobe error'));
        return;
      }
      const outputPath = args.at(-1);
      if (typeof outputPath === 'string') {
        writeFile(outputPath, Buffer.from('normalized-audio'))
          .then(() => {
            callback?.(null, { stdout: '' });
          })
          .catch((error) => {
            callback?.(error as unknown);
          });
      } else {
        callback?.(null, { stdout: '' });
      }
    });
    const { module } = await withPipelineModule({ testRuntime: false, execFile });

    const result = await module.normalizeAudioForStorage({
      sourcePath,
      workDir,
      recordingId: 'rec fallback',
      signal: new AbortController().signal,
    });

    expect(result.durationMs).toBe(0);
    expect(result.sizeBytes).toBeGreaterThan(0);

    await rm(workDir, { recursive: true, force: true });
  });

  test('supports empty recordingId in production segment splitting for randomized safe path', async () => {
    const workDir = await createWorkDir();
    const normalizedPath = path.join(workDir, 'normalized.webm');
    await writeFile(normalizedPath, Buffer.from('normalized-audio'));
    const execFile = vi.fn((_command: string, args: string[], _options: unknown, callback) => {
      const last = args.at(-1);
      if (typeof last !== 'string') {
        callback?.(null, { stdout: '' });
        return;
      }
      const segmentPrefix = `${path.basename(last).replace('%03d.webm', '')}`;
      const outputBase = path.join(path.dirname(last), segmentPrefix);
      writeFile(`${outputBase}000.webm`, Buffer.from('segment-000'))
        .then(() => {
          callback?.(null, { stdout: '' });
        })
        .catch((error) => {
          callback?.(error as unknown);
        });
    });

    const { module } = await withPipelineModule({ testRuntime: false, execFile });
    const parts = await module.splitNormalizedAudioIntoParts({
      normalizedPath,
      workDir,
      recordingId: '',
      durationMs: 0,
    });

    expect(parts[0].startMs).toBe(0);
    expect(parts).toHaveLength(1);
    expect(parts[0].sizeBytes).toBe(11);
    await rm(workDir, { recursive: true, force: true });
  });

  test('returns local file immediately when path exists on disk', async () => {
    const { module } = await withPipelineModule();
    const workDir = await createWorkDir();
    const rawLocalPath = path.join(workDir, 'local.webm');
    await writeFile(rawLocalPath, Buffer.from('local-audio'));

    const result = await module.materializeAssetToLocal(
      {
        file_path: rawLocalPath,
      },
      {
        workDir,
        purpose: 'audio',
      }
    );

    expect(result.localPath).toBe(rawLocalPath);

    await result.cleanup();
    await expect(readFile(rawLocalPath)).resolves.toBeDefined();
    await rm(workDir, { recursive: true, force: true });
  });

  test('returns error when audio path is missing', async () => {
    const { module } = await withPipelineModule();
    const workDir = await createWorkDir();

    await expect(module.materializeAssetToLocal({}, { workDir, purpose: 'audio' })).rejects.toThrow(
      'Brak sciezki pliku audio.'
    );

    await rm(workDir, { recursive: true, force: true });
  });

  test('throws when audio path is absolute but file is not actually available', async () => {
    const { module } = await withPipelineModule();
    const workDir = await createWorkDir();
    fsState.setExistsSync(false);
    const absolutePath = path.join(process.cwd(), 'audio-not-found.webm');

    await expect(
      module.materializeAssetToLocal(
        {
          file_path: absolutePath,
          id: 'abs-missing',
        },
        { workDir }
      )
    ).rejects.toMatchObject({
      message: 'Plik audio nie jest dostepny.',
    });

    await rm(workDir, { recursive: true, force: true });
  });

  test('materializes segmented manifest in test runtime and concatenates parts in order', async () => {
    const workDir = await createWorkDir();
    const asset = {
      file_path: 'storage/recording_1.webm',
      id: 'recording_1',
      media_manifest_json: JSON.stringify({
        version: 1,
        storageMode: 'segmented',
        recordingId: 'recording_1',
        workspaceId: 'ws',
        sourceSizeBytes: 2,
        normalizedSizeBytes: 2,
        durationMs: 1200,
        contentType: 'audio/webm',
        parts: [
          {
            index: 1,
            path: 'part-second',
            startMs: 600,
            endMs: 1200,
            sizeBytes: 5,
            contentType: 'audio/webm',
          },
          {
            index: 0,
            path: 'part-first',
            startMs: 0,
            endMs: 600,
            sizeBytes: 5,
            contentType: 'audio/webm',
          },
        ],
      }),
    };
    fsState.setExistsSync(false);

    const { module, downloadAudioToFile } = await withPipelineModule({
      testRuntime: true,
      downloadAudioToFile: async (source: string, target: string) => {
        if (source === 'part-first') {
          await writeFile(target, Buffer.from('AAA'));
        } else {
          await writeFile(target, Buffer.from('BBBB'));
        }
      },
    });

    const result = await module.materializeAssetToLocal(asset, { workDir, purpose: 'audio' });
    const output = await readFile(result.localPath);

    expect(downloadAudioToFile).toHaveBeenCalledTimes(2);
    expect(downloadAudioToFile).toHaveBeenNthCalledWith(
      1,
      'part-first',
      expect.stringContaining('temp_part_')
    );
    expect(downloadAudioToFile).toHaveBeenNthCalledWith(
      2,
      'part-second',
      expect.stringContaining('temp_part_')
    );
    expect(output.toString()).toBe('AAABBBB');

    await result.cleanup();
    await expect(readFile(result.localPath)).rejects.toThrow();
    await rm(workDir, { recursive: true, force: true });
  });

  test('downloads remote path to local file when no local manifest exists', async () => {
    fsState.setExistsSync(false);
    const workDir = await createWorkDir();
    const remotePath = 'remote/recording.webm';
    const asset = {
      file_path: remotePath,
      id: 'recording-remote',
    };

    const { module, downloadAudioToFile } = await withPipelineModule({
      testRuntime: true,
      downloadAudioToFile: async (_source: string, target: string) => {
        await writeFile(target, Buffer.from('downloaded'));
      },
    });

    const result = await module.materializeAssetToLocal(asset, { workDir, purpose: 'audio' });

    expect(downloadAudioToFile).toHaveBeenCalledWith(remotePath, expect.stringContaining(workDir));
    expect(result.localPath).toContain(workDir);

    await result.cleanup();
    await expect(readFile(result.localPath)).rejects.toThrow();
    await rm(workDir, { recursive: true, force: true });
  });

  test('returns null for malformed media manifest inputs', async () => {
    const { module } = await withPipelineModule();

    expect(
      module.parseAssetMediaManifest({
        media_manifest_json: '{invalid-json',
      })
    ).toBeNull();
    expect(
      module.parseAssetMediaManifest({
        mediaManifestJson: '{invalid-json',
      })
    ).toBeNull();
  });

  test('parses asset media manifest from snake_case and camelCase payloads', async () => {
    const { module } = await withPipelineModule();

    const fromSnake = module.parseAssetMediaManifest({
      media_manifest_json: JSON.stringify({
        version: 1,
        storageMode: 'segmented',
        recordingId: 'rec',
        workspaceId: 'ws',
        sourceSizeBytes: 1,
        normalizedSizeBytes: 1,
        durationMs: 10,
        contentType: 'audio/webm',
        parts: [],
      }),
    });
    const fromCamel = module.parseAssetMediaManifest({
      mediaManifestJson: {
        version: 1,
        storageMode: 'segmented',
        recordingId: 'rec',
        workspaceId: 'ws',
        sourceSizeBytes: 1,
        normalizedSizeBytes: 1,
        durationMs: 10,
        contentType: 'audio/webm',
        parts: [],
      },
    });

    expect(fromSnake).toEqual(
      expect.objectContaining({
        version: 1,
        storageMode: 'segmented',
      })
    );
    expect(fromCamel).toEqual(
      expect.objectContaining({
        version: 1,
        storageMode: 'segmented',
      })
    );
  });

  test('buildManifestForUploadedParts delegates to policy builder behavior', async () => {
    const { module } = await withPipelineModule();
    const manifest = module.buildManifestForUploadedParts({
      recordingId: 'recording_1',
      workspaceId: 'workspace_1',
      sourceSizeBytes: 400,
      normalizedSizeBytes: 300,
      durationMs: 1000,
      parts: [
        {
          index: 0,
          path: 'part-000.webm',
          startMs: 0,
          endMs: 1000,
          sizeBytes: 300,
          contentType: 'audio/webm',
        },
      ],
    });

    expect(manifest.storageMode).toBe('segmented');
    expect(manifest.parts).toHaveLength(1);
    expect(manifest.parts[0].transcription?.status).toBe('pending');
  });

  test('creates MediaStoragePipelineError with and without optional cause', async () => {
    const { module } = await withPipelineModule();
    const withCause = new module.MediaStoragePipelineError(
      'audio_normalization_failed',
      'custom failure',
      400,
      new Error('inner')
    );
    const withoutCause = new module.MediaStoragePipelineError(
      'audio_segmentation_failed',
      'seg fail'
    );

    expect(withCause).toMatchObject({
      name: 'MediaStoragePipelineError',
      code: 'audio_normalization_failed',
      status: 400,
      message: 'custom failure',
      cause: expect.any(Error),
    });
    expect(withoutCause).toMatchObject({
      name: 'MediaStoragePipelineError',
      code: 'audio_segmentation_failed',
      status: 422,
      message: 'seg fail',
    });
    expect((withoutCause as any).cause).toBeUndefined();
  });

  test('reports remote paths when file path is not local', async () => {
    const { module } = await withPipelineModule();
    fsState.setExistsSync(false);
    expect(module.isRemoteStoragePath('storage/asset.webm')).toBe(true);
    expect(module.isRemoteStoragePath(path.join(process.cwd(), 'audio.webm'))).toBe(false);
    fsState.setExistsSync(true);
    expect(module.isRemoteStoragePath('relative/local.webm')).toBe(false);
    fsState.setExistsSync(false);
    expect(module.isRemoteStoragePath('relative/local.webm')).toBe(true);
    expect(module.isRemoteStoragePath('C:\\audio\\audio.webm')).toBe(false);
  });
});
