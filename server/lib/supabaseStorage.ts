import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { config } from '../config.js';

const SUPABASE_URL = config.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = config.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseUrlValid = SUPABASE_URL.startsWith('http');
export const supabase =
  supabaseUrlValid && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

const BUCKET_NAME = 'recordings';
let bucketEnsured = false;
let readinessCache: {
  key: string;
  expiresAt: number;
  value: SupabaseStorageReadiness;
} | null = null;

export type SupabaseStorageReadiness = {
  configured: boolean;
  ready: boolean;
  bucket: string;
  status: 'ready' | 'missing_config' | 'invalid_url' | 'client_unavailable' | 'bucket_unavailable';
  error?: string;
};

async function ensureBucket() {
  if (bucketEnsured || !supabase || !supabase.storage) return;
  const { error } = await supabase.storage.createBucket(BUCKET_NAME, { public: false });
  if (error && !error.message?.includes('already exists')) {
    console.warn(`[Supabase Storage] Bucket creation warning: ${error.message}`);
  }
  bucketEnsured = true;
}

function isValidSupabaseProjectUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

export async function checkSupabaseStorageReadiness(options: { force?: boolean } = {}) {
  const cacheKey = `${SUPABASE_URL}|${Boolean(SUPABASE_SERVICE_ROLE_KEY)}`;
  const now = Date.now();
  if (!options.force && readinessCache?.key === cacheKey && readinessCache.expiresAt > now) {
    return readinessCache.value;
  }

  const finish = (value: SupabaseStorageReadiness) => {
    readinessCache = {
      key: cacheKey,
      expiresAt: Date.now() + 30_000,
      value,
    };
    return value;
  };

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return finish({
      configured: false,
      ready: false,
      bucket: BUCKET_NAME,
      status: 'missing_config',
    });
  }

  if (!isValidSupabaseProjectUrl(SUPABASE_URL)) {
    return finish({
      configured: true,
      ready: false,
      bucket: BUCKET_NAME,
      status: 'invalid_url',
    });
  }

  if (!supabase || !supabase.storage) {
    return finish({
      configured: true,
      ready: false,
      bucket: BUCKET_NAME,
      status: 'client_unavailable',
    });
  }

  try {
    await ensureBucket();
    const { error } = await supabase.storage.from(BUCKET_NAME).list('', { limit: 1 });
    if (error) {
      return finish({
        configured: true,
        ready: false,
        bucket: BUCKET_NAME,
        status: 'bucket_unavailable',
        error: error.message,
      });
    }
    return finish({
      configured: true,
      ready: true,
      bucket: BUCKET_NAME,
      status: 'ready',
    });
  } catch (error: any) {
    return finish({
      configured: true,
      ready: false,
      bucket: BUCKET_NAME,
      status: 'bucket_unavailable',
      error: error?.message || String(error),
    });
  }
}

/**
 * Uploads a buffer to Supabase Storage.
 * Returns null if Supabase is not configured. Production callers must treat
 * that as a hard configuration failure, not a local filesystem fallback.
 */
export async function uploadAudioToStorage(
  recordingId: string,
  buffer: Buffer,
  contentType: string,
  extension: string
): Promise<string | null> {
  if (!supabase || !supabase.storage) {
    return null; // Supabase not configured or missing storage — caller falls back to local fs
  }

  await ensureBucket();

  const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeRecordingId}${extension}`;

  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  return data.path;
}

export async function uploadAudioFileToStorage(
  recordingId: string,
  filePath: string,
  contentType: string,
  extension: string
): Promise<string | null> {
  if (!supabase || !supabase.storage) {
    return null;
  }

  await ensureBucket();

  const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeRecordingId}${extension}`;
  const body = fs.createReadStream(filePath);
  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, body as any, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  return data.path;
}

export async function uploadBufferToStoragePath(
  storagePath: string,
  buffer: Buffer | Uint8Array | string,
  contentType: string
): Promise<string | null> {
  if (!supabase || !supabase.storage) {
    return null;
  }

  await ensureBucket();

  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  return data.path;
}

export async function uploadAudioFileToStoragePath(
  storagePath: string,
  filePath: string,
  contentType: string
): Promise<string | null> {
  if (!supabase || !supabase.storage) {
    return null;
  }

  await ensureBucket();

  const body = fs.createReadStream(filePath);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, body as any, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  return data.path;
}

/**
 * Downloads a file from Supabase Storage.
 * @param path The storage path of the file.
 * @returns The file content as an ArrayBuffer.
 */
export async function downloadAudioFromStorage(path: string): Promise<ArrayBuffer> {
  if (!supabase || !supabase.storage) {
    throw new Error('Supabase Storage not available (client or storage module missing).');
  }

  const { data, error } = await supabase.storage.from('recordings').download(path);

  if (error) {
    throw new Error(`Failed to download from Supabase Storage: ${error.message}`);
  }

  return await data.arrayBuffer();
}

/**
 * Checks whether an audio object can be addressed in Supabase Storage without
 * downloading the full recording into memory.
 */
export async function audioExistsInStorage(path: string): Promise<boolean> {
  if (!supabase || !supabase.storage) {
    throw new Error('Supabase Storage not available (client or storage module missing).');
  }

  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(path, 60);
  return Boolean(!error && data?.signedUrl);
}

/**
 * Downloads a file from Supabase Storage directly to a local file path.
 * Uses signed URL + fetch streaming to avoid buffering entire file into Node.js heap.
 * Critical for large audio files on memory-constrained environments (Railway).
 */
export async function downloadAudioToFile(storagePath: string, destPath: string): Promise<void> {
  if (!supabase || !supabase.storage) {
    throw new Error('Supabase Storage not available (client or storage module missing).');
  }

  // Create a short-lived signed URL (60s) and stream via fetch — avoids Blob buffering
  const { data: signedData, error: signedError } = await supabase.storage
    .from('recordings')
    .createSignedUrl(storagePath, 60);

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `Failed to create signed URL for Supabase Storage: ${signedError?.message || 'no URL returned'}`
    );
  }

  const response = await fetch(signedData.signedUrl);
  if (!response.ok) {
    throw new Error(`Failed to download from Supabase Storage: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error('Supabase Storage returned empty response body.');
  }

  const webStream = response.body;
  const nodeReadable = Readable.fromWeb(webStream as any);
  const dest = createWriteStream(destPath);
  await pipeline(nodeReadable, dest);
}

/**
 * Deletes a file from Supabase Storage.
 * @param path The storage path of the file.
 */
export async function deleteAudioFromStorage(path: string): Promise<void> {
  if (!supabase || !supabase.storage) {
    throw new Error('Supabase Storage not available (client or storage module missing).');
  }

  const { error } = await supabase.storage.from('recordings').remove([path]);

  if (error) {
    // We log but don't throw to prevent blocking the DB deletion if the file is already gone
    console.warn(`[Supabase Storage] Failed to delete file ${path}:`, error.message);
  }
}

export async function deleteAudioPathsFromStorage(paths: string[]): Promise<void> {
  if (!paths.length) return;
  if (!supabase || !supabase.storage) {
    throw new Error('Supabase Storage not available (client or storage module missing).');
  }

  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const { error } = await supabase.storage.from(BUCKET_NAME).remove(uniquePaths);

  if (error) {
    console.warn(`[Supabase Storage] Failed to delete ${uniquePaths.length} files:`, error.message);
  }
}
