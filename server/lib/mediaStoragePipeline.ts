import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  mkdir,
  rm,
  copyFile,
  readFile,
  writeFile,
  appendFile,
  stat,
  readdir,
} from 'node:fs/promises';
import { config } from '../config.ts';
import {
  SEGMENT_MAX_DURATION_MS,
  SEGMENT_PART_MAX_BYTES,
  STORAGE_CONTENT_TYPE,
  STORAGE_EXTENSION,
  buildSegmentedMediaManifest,
  type MediaManifest,
  type MediaManifestPart,
  parseMediaManifest,
} from './mediaStoragePolicy.ts';

export class MediaStoragePipelineError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 422, cause?: unknown) {
    super(message);
    this.name = 'MediaStoragePipelineError';
    this.status = status;
    this.code = code;
    if (cause !== undefined) {
      (this as any).cause = cause;
    }
  }
}

export type AudioValidationCode = 'audio_invalid_or_empty' | 'audio_too_short';

export interface AudioValidationResult {
  ok: true;
  code: 'audio_valid';
  filePath: string;
  contentType?: string;
  sizeBytes: number;
  durationMs: number;
  audioStreamCount: number;
}

function isTestRuntime() {
  return Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
}

function safeId(value: string) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_') || crypto.randomUUID();
}

function deriveFfprobeBinary(ffmpegBinary: string) {
  if (!ffmpegBinary) return 'ffprobe';
  const parsed = path.parse(ffmpegBinary);
  return path.join(parsed.dir, `${parsed.name.replace(/ffmpeg$/i, 'ffprobe')}${parsed.ext}`);
}

async function runFfmpeg(args: string[], signal?: AbortSignal) {
  const { promisify } = await import('node:util');
  const childProcess = await import('node:child_process');
  const execFileAsync = promisify((childProcess as any).execFile);
  await execFileAsync(config.FFMPEG_BINARY || 'ffmpeg', args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 8,
    signal,
  } as any);
}

async function probeDurationMs(filePath: string): Promise<number> {
  if (isTestRuntime()) return 0;
  try {
    const { promisify } = await import('node:util');
    const childProcess = await import('node:child_process');
    const execFileAsync = promisify((childProcess as any).execFile);
    const { stdout } = await execFileAsync(
      deriveFfprobeBinary(config.FFMPEG_BINARY || 'ffmpeg'),
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { windowsHide: true, maxBuffer: 1024 * 1024 } as any
    );
    const seconds = Number(String(stdout || '').trim());
    return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
  } catch {
    return 0;
  }
}

function parseFfprobeDurationMs(value: unknown): number {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
}

async function probeAudioMetadata(
  filePath: string,
  signal?: AbortSignal
): Promise<{ durationMs: number; audioStreamCount: number }> {
  if (isTestRuntime()) {
    return { durationMs: 0, audioStreamCount: 1 };
  }

  try {
    const { promisify } = await import('node:util');
    const childProcess = await import('node:child_process');
    const execFileAsync = promisify((childProcess as any).execFile);
    const { stdout } = await execFileAsync(
      deriveFfprobeBinary(config.FFMPEG_BINARY || 'ffmpeg'),
      ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', filePath],
      { windowsHide: true, maxBuffer: 1024 * 1024 * 2, signal } as any
    );
    const parsed = JSON.parse(String(stdout || '{}'));
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const audioStreams = streams.filter((stream: any) => stream?.codec_type === 'audio');
    const streamDurationMs = Math.max(
      0,
      ...audioStreams.map((stream: any) => parseFfprobeDurationMs(stream?.duration))
    );
    const formatDurationMs = parseFfprobeDurationMs(parsed?.format?.duration);
    return {
      durationMs: streamDurationMs || formatDurationMs,
      audioStreamCount: audioStreams.length,
    };
  } catch (error) {
    throw new MediaStoragePipelineError(
      'audio_invalid_or_empty',
      'Plik audio jest pusty, uszkodzony albo nie zawiera dekodowalnej sciezki audio.',
      422,
      error
    );
  }
}

function buildAudioValidationError(
  code: AudioValidationCode,
  message: string,
  details: Record<string, unknown>
) {
  const error = new MediaStoragePipelineError(code, message, 422);
  (error as any).audioValidation = {
    ok: false,
    code,
    ...details,
  };
  return error;
}

export async function validateAudioForTranscription(input: {
  filePath: string;
  contentType?: string;
  minDurationMs?: number;
  minSizeBytes?: number;
  signal?: AbortSignal;
}): Promise<AudioValidationResult> {
  const filePath = String(input.filePath || '').trim();
  if (!filePath) {
    throw buildAudioValidationError('audio_invalid_or_empty', 'Brak pliku audio do walidacji.', {
      filePath,
    });
  }

  const stats = await stat(filePath).catch((error) => {
    throw buildAudioValidationError(
      'audio_invalid_or_empty',
      'Plik audio nie istnieje albo nie mozna go odczytac.',
      { filePath, cause: error instanceof Error ? error.message : String(error) }
    );
  });
  const sizeBytes = Number(stats.size || 0);
  const minSizeBytes =
    typeof input.minSizeBytes === 'number' ? input.minSizeBytes : isTestRuntime() ? 1 : 1024;
  if (sizeBytes < minSizeBytes) {
    throw buildAudioValidationError(
      'audio_invalid_or_empty',
      'Plik audio jest pusty albo zbyt maly, zeby go przetworzyc.',
      { filePath, sizeBytes, minSizeBytes }
    );
  }

  const metadata = await probeAudioMetadata(filePath, input.signal);
  if (metadata.audioStreamCount <= 0) {
    throw buildAudioValidationError(
      'audio_invalid_or_empty',
      'Plik nie zawiera dekodowalnej sciezki audio.',
      { filePath, sizeBytes, durationMs: metadata.durationMs, audioStreamCount: 0 }
    );
  }

  const minDurationMs =
    typeof input.minDurationMs === 'number' ? input.minDurationMs : isTestRuntime() ? 0 : 750;
  if (metadata.durationMs > 0 && metadata.durationMs < minDurationMs) {
    throw buildAudioValidationError(
      'audio_too_short',
      'Nagranie jest zbyt krotkie, zeby je transkrybowac.',
      { filePath, sizeBytes, durationMs: metadata.durationMs, minDurationMs }
    );
  }

  return {
    ok: true,
    code: 'audio_valid',
    filePath,
    contentType: input.contentType,
    sizeBytes,
    durationMs: metadata.durationMs,
    audioStreamCount: metadata.audioStreamCount,
  };
}

export async function normalizeAudioForStorage(input: {
  sourcePath: string;
  workDir: string;
  recordingId: string;
  signal?: AbortSignal;
}) {
  await mkdir(input.workDir, { recursive: true });
  const outputPath = path.join(
    input.workDir,
    `${safeId(input.recordingId)}_normalized_${crypto.randomUUID()}${STORAGE_EXTENSION}`
  );

  if (isTestRuntime()) {
    await copyFile(input.sourcePath, outputPath);
  } else {
    try {
      await runFfmpeg(
        [
          '-y',
          '-i',
          input.sourcePath,
          '-vn',
          '-map',
          '0:a:0',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-c:a',
          'libopus',
          '-b:a',
          '48k',
          outputPath,
        ],
        input.signal
      );
    } catch (error) {
      try {
        await rm(outputPath, { force: true });
      } catch (_) {}
      throw new MediaStoragePipelineError(
        'audio_normalization_failed',
        'Nie udalo sie przygotowac audio do transkrypcji.',
        422,
        error
      );
    }
  }

  const [durationMs, stats] = await Promise.all([probeDurationMs(outputPath), stat(outputPath)]);
  return {
    path: outputPath,
    durationMs,
    sizeBytes: stats.size,
    contentType: STORAGE_CONTENT_TYPE,
  };
}

async function splitByBytesForTests(input: {
  normalizedPath: string;
  workDir: string;
  recordingId: string;
  durationMs: number;
}) {
  const buffer = await readFile(input.normalizedPath);
  const parts: Array<MediaManifestPart & { localPath: string }> = [];
  const durationMs =
    input.durationMs > 0
      ? input.durationMs
      : Math.max(
          SEGMENT_MAX_DURATION_MS,
          Math.ceil(buffer.byteLength / SEGMENT_PART_MAX_BYTES) * 1000
        );
  const count = Math.ceil(buffer.byteLength / SEGMENT_PART_MAX_BYTES);
  for (let index = 0; index < count; index += 1) {
    const start = index * SEGMENT_PART_MAX_BYTES;
    const end = Math.min(buffer.byteLength, start + SEGMENT_PART_MAX_BYTES);
    const localPath = path.join(
      input.workDir,
      `${safeId(input.recordingId)}_part_${String(index).padStart(3, '0')}${STORAGE_EXTENSION}`
    );
    await writeFile(localPath, buffer.subarray(start, end));
    const startMs = Math.round((index / count) * durationMs);
    const endMs = index === count - 1 ? durationMs : Math.round(((index + 1) / count) * durationMs);
    parts.push({
      index,
      localPath,
      path: '',
      startMs,
      endMs,
      sizeBytes: end - start,
      contentType: STORAGE_CONTENT_TYPE,
    });
  }
  return parts;
}

async function listSegmentFiles(workDir: string, prefix: string) {
  const files = await readdir(workDir);
  return files
    .filter((fileName) => fileName.startsWith(prefix) && fileName.endsWith(STORAGE_EXTENSION))
    .sort()
    .map((fileName) => path.join(workDir, fileName));
}

export async function splitNormalizedAudioIntoParts(input: {
  normalizedPath: string;
  workDir: string;
  recordingId: string;
  durationMs: number;
  signal?: AbortSignal;
}) {
  await mkdir(input.workDir, { recursive: true });

  if (isTestRuntime()) {
    return splitByBytesForTests(input);
  }

  let segmentSeconds = Math.max(60, Math.floor(SEGMENT_MAX_DURATION_MS / 1000));
  let segmentFiles: string[] = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prefix = `${safeId(input.recordingId)}_part_${crypto.randomUUID().slice(0, 8)}_`;
    const pattern = path.join(input.workDir, `${prefix}%03d${STORAGE_EXTENSION}`);
    await runFfmpeg(
      [
        '-y',
        '-i',
        input.normalizedPath,
        '-map',
        '0:a:0',
        '-c',
        'copy',
        '-f',
        'segment',
        '-segment_time',
        String(segmentSeconds),
        '-reset_timestamps',
        '1',
        pattern,
      ],
      input.signal
    );

    segmentFiles = await listSegmentFiles(input.workDir, prefix);
    const stats = await Promise.all(segmentFiles.map((filePath) => stat(filePath)));
    const largest = Math.max(0, ...stats.map((item) => item.size));
    if (segmentFiles.length > 0 && largest <= SEGMENT_PART_MAX_BYTES) {
      break;
    }
    await Promise.all(segmentFiles.map((filePath) => rm(filePath, { force: true })));
    const ratio = largest > 0 ? SEGMENT_PART_MAX_BYTES / largest : 0.5;
    segmentSeconds = Math.max(60, Math.floor(segmentSeconds * Math.max(0.25, ratio * 0.85)));
  }

  if (!segmentFiles.length) {
    throw new MediaStoragePipelineError(
      'audio_segmentation_failed',
      'Nie udalo sie podzielic audio na czesci.',
      422
    );
  }

  const stats = await Promise.all(segmentFiles.map((filePath) => stat(filePath)));
  const oversized = stats.find((item) => item.size > SEGMENT_PART_MAX_BYTES);
  if (oversized) {
    throw new MediaStoragePipelineError(
      'audio_segmentation_failed',
      'Po podziale jedna z czesci audio nadal przekracza limit.',
      422
    );
  }

  const partDuration =
    input.durationMs > 0
      ? input.durationMs / segmentFiles.length
      : Math.max(1, SEGMENT_MAX_DURATION_MS);
  return segmentFiles.map((localPath, index) => ({
    index,
    localPath,
    path: '',
    startMs: Math.round(index * partDuration),
    endMs: Math.round(
      index === segmentFiles.length - 1 && input.durationMs > 0
        ? input.durationMs
        : (index + 1) * partDuration
    ),
    sizeBytes: stats[index]?.size || 0,
    contentType: STORAGE_CONTENT_TYPE,
  }));
}

function isLocalPath(filePath: string) {
  if (!filePath) return false;
  if (fs.existsSync(filePath)) return true;
  if (path.isAbsolute(filePath)) return true;
  return /^[a-zA-Z]:[\\/]/.test(filePath);
}

export function isRemoteStoragePath(filePath: string) {
  return Boolean(filePath && !isLocalPath(filePath));
}

export function parseAssetMediaManifest(asset: any): MediaManifest | null {
  return parseMediaManifest(asset?.media_manifest_json || asset?.mediaManifestJson || null);
}

export async function materializeAssetToLocal(
  asset: any,
  options: { workDir: string; signal?: AbortSignal; purpose?: string }
) {
  const rawPath = String(asset?.file_path || '').trim();
  if (!rawPath) throw new Error('Brak sciezki pliku audio.');

  if (isLocalPath(rawPath) && fs.existsSync(rawPath)) {
    return { localPath: rawPath, cleanup: async () => {} };
  }

  await mkdir(options.workDir, { recursive: true });
  const safeRecordingId = safeId(String(asset?.id || 'recording'));
  const outputPath = path.join(
    options.workDir,
    `temp_${options.purpose || 'audio'}_${safeRecordingId}_${crypto.randomUUID()}${STORAGE_EXTENSION}`
  );

  const manifest = parseAssetMediaManifest(asset);
  if (manifest?.parts?.length) {
    const { downloadAudioToFile } = await import('./supabaseStorage.js');
    const localParts: string[] = [];
    try {
      for (const part of manifest.parts.sort((a, b) => a.index - b.index)) {
        const localPart = path.join(
          options.workDir,
          `temp_part_${safeRecordingId}_${String(part.index).padStart(3, '0')}_${crypto.randomUUID()}${STORAGE_EXTENSION}`
        );
        await downloadAudioToFile(part.path, localPart);
        localParts.push(localPart);
      }

      if (isTestRuntime()) {
        await writeFile(outputPath, Buffer.alloc(0));
        for (const localPart of localParts) {
          await appendFile(outputPath, await readFile(localPart));
        }
      } else {
        const concatListPath = path.join(
          options.workDir,
          `concat_${safeRecordingId}_${crypto.randomUUID()}.txt`
        );
        const concatList = localParts
          .map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`)
          .join('\n');
        await writeFile(concatListPath, concatList);
        try {
          await runFfmpeg(
            ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', outputPath],
            options.signal
          );
        } finally {
          await rm(concatListPath, { force: true }).catch(() => {});
        }
      }
    } finally {
      await Promise.all(localParts.map((filePath) => rm(filePath, { force: true })));
    }
    return {
      localPath: outputPath,
      cleanup: async () => {
        await rm(outputPath, { force: true }).catch(() => {});
      },
    };
  }

  if (isRemoteStoragePath(rawPath)) {
    const { downloadAudioToFile } = await import('./supabaseStorage.js');
    await downloadAudioToFile(rawPath, outputPath);
    return {
      localPath: outputPath,
      cleanup: async () => {
        await rm(outputPath, { force: true }).catch(() => {});
      },
    };
  }

  throw new Error('Plik audio nie jest dostepny.');
}

export function buildManifestForUploadedParts(input: {
  recordingId: string;
  workspaceId: string;
  sourceSizeBytes: number;
  normalizedSizeBytes: number;
  durationMs: number;
  parts: MediaManifestPart[];
}) {
  return buildSegmentedMediaManifest(input);
}
