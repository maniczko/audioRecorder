// server/config.ts
import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Sentry from '@sentry/node';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import fs2 from 'node:fs';
import path2 from 'node:path';
import os from 'node:os';
import fs10 from 'node:fs';
import path11 from 'node:path';
import { fileURLToPath as fileURLToPath6 } from 'node:url';
import { fileURLToPath as fileURLToPath7 } from 'node:url';
import http from 'node:http';
import { getRequestListener } from '@hono/node-server';
import fs3 from 'node:fs';
import path3 from 'node:path';
import crypto2 from 'node:crypto';
import os2 from 'node:os';
import { Pool } from 'pg';
import { fileURLToPath as fileURLToPath2 } from 'node:url';
import { Worker } from 'node:worker_threads';

// server/app.ts
import { Hono as Hono6 } from 'hono';

// server/routes/middleware.ts
import { getConnInfo } from '@hono/node-server/conninfo';
import crypto3 from 'node:crypto';
import { z as z2 } from 'zod';

// server/routes/auth.ts
import { Hono } from 'hono';
import { z as z3 } from 'zod';
import { zValidator } from '@hono/zod-validator';

// server/routes/digest.ts
import { Hono as Hono2 } from 'hono';

// server/routes/workspaces.ts
import fs4 from 'node:fs';
import crypto4 from 'node:crypto';
import path4 from 'node:path';
import { Hono as Hono3 } from 'hono';

// server/lib/ragAnswer.ts
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

// server/routes/media.ts
import { existsSync, createReadStream, createWriteStream, statSync, mkdirSync } from 'node:fs';
import { unlink, writeFile, stat } from 'node:fs/promises';
import path5 from 'node:path';
import crypto5 from 'node:crypto';
import { finished } from 'node:stream/promises';
import { Hono as Hono4 } from 'hono';
import { streamSSE } from 'hono/streaming';
import { Hono as Hono5 } from 'hono';

// server/services/MetricsService.ts
import client from 'prom-client';
import { EventEmitter } from 'node:events';
import { Document as Document2 } from '@langchain/core/documents';

// server/lib/ragVectorStore.ts
import crypto6 from 'node:crypto';
import { Document } from '@langchain/core/documents';
import { VectorStore } from '@langchain/core/vectorstores';
import fs9 from 'node:fs';
import path10 from 'node:path';
import crypto10 from 'node:crypto';
import { fileURLToPath as fileURLToPath5 } from 'node:url';
import fs6 from 'node:fs';
import path7 from 'node:path';
import os3 from 'node:os';
import crypto7 from 'node:crypto';
import { fileURLToPath as fileURLToPath3 } from 'node:url';
import { promisify } from 'node:util';
import { spawn, exec } from 'node:child_process';

// server/stt/providers.ts
import fs5 from 'node:fs';
import path6 from 'node:path';
import fs7 from 'node:fs';
import path8 from 'node:path';
import crypto8 from 'node:crypto';
import { promisify as promisify2 } from 'node:util';
import { exec as exec2 } from 'node:child_process';
import fs8 from 'node:fs';
import path9 from 'node:path';
import crypto9 from 'node:crypto';
import { fileURLToPath as fileURLToPath4 } from 'node:url';
import { promisify as promisify3 } from 'node:util';
import { spawn as spawn2, exec as exec3 } from 'node:child_process';

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __require = /* @__PURE__ */ ((x) =>
  typeof require !== 'undefined'
    ? require
    : typeof Proxy !== 'undefined'
      ? new Proxy(x, {
          get: (a, b) => (typeof require !== 'undefined' ? require : a)[b],
        })
      : x)(function (x) {
  if (typeof require !== 'undefined') return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) =>
  function __init() {
    return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])((fn = 0))), res);
  };
var __export = (target, all) => {
  for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
};
function optionalEnumValue(val) {
  if (val == null) return void 0;
  const normalized = String(val).trim().toLowerCase();
  return normalized ? normalized : void 0;
}
function validateRequiredApiKeys() {
  const errors = [];
  const warnings = [];
  const hasOpenAI = Boolean(config.OPENAI_API_KEY);
  const hasGroq = Boolean(config.GROQ_API_KEY);
  const hasLocalWhisper = config.USE_LOCAL_WHISPER && Boolean(config.WHISPER_CPP_PATH);
  if (!hasOpenAI && !hasGroq && !hasLocalWhisper) {
    errors.push(
      'Missing STT provider. Configure one of:\n  - OPENAI_API_KEY (OpenAI Whisper)\n  - GROQ_API_KEY (Groq Whisper)\n  - WHISPER_CPP_PATH + USE_LOCAL_WHISPER=true (Local offline processing)'
    );
  }
  if (!config.HF_TOKEN && !config.HUGGINGFACE_TOKEN) {
    warnings.push(
      'Missing HF_TOKEN. Speaker diarization will be disabled.\n  Get a token at: https://huggingface.co/settings/tokens'
    );
  }
  if (errors.length > 0) {
    console.error('\n\u274C Configuration errors:\n');
    errors.forEach((err) =>
      console.error(`  - ${err}
`)
    );
    console.error('Please fix these errors and restart the server.\n');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }
  if (warnings.length > 0) {
    console.warn('\n\u26A0\uFE0F  Configuration warnings:\n');
    warnings.forEach((warn) =>
      console.warn(`  - ${warn}
`)
    );
  }
  if (process.env.NODE_ENV === 'development' || config.DEBUG) {
    console.log('\n\u2705 Configuration loaded successfully:');
    console.log(
      `  - STT Provider: ${config.VOICELOG_STT_PROVIDER} ${hasOpenAI ? '(OpenAI)' : hasGroq ? '(Groq)' : ''}`
    );
    console.log(
      `  - Diarization: ${config.HF_TOKEN || config.HUGGINGFACE_TOKEN ? 'pyannote (HF token set)' : 'disabled'}`
    );
    console.log(`  - Processing mode: ${config.VOICELOG_PROCESSING_MODE_DEFAULT}`);
    console.log(`  - Debug: ${config.DEBUG}`);
    console.log('');
  }
}
var __filename, __dirname, envSchema, _env, config;
var init_config = __esm({
  'server/config.ts'() {
    __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
    envSchema = z.object({
      NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
      PORT: z.preprocess((val) => Number(val), z.number()).default(4e3),
      VOICELOG_API_PORT: z.preprocess((val) => (val ? Number(val) : void 0), z.number().optional()),
      VOICELOG_API_HOST: z.string().default('0.0.0.0'),
      VOICELOG_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
      VOICELOG_TRUST_PROXY: z.preprocess((val) => val === 'true', z.boolean()).default(false),
      DATABASE_URL: z.string().optional(),
      VOICELOG_DATABASE_URL: z.string().optional(),
      VOICELOG_DB_PATH: z.string().optional(),
      VOICELOG_UPLOAD_DIR: z.string().optional(),
      VOICELOG_SESSION_TTL_HOURS: z.preprocess(
        (val) => (val ? Number(val) : void 0),
        z.number().optional()
      ),
      SUPABASE_URL: z.string().optional(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
      SENTRY_DSN: z.string().optional(),
      OPENAI_API_KEY: z.string().optional(),
      VOICELOG_OPENAI_API_KEY: z.string().optional(),
      VOICELOG_OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
      OPENAI_BASE_URL: z.string().optional(),
      LANGSMITH_TRACING: z.string().optional(),
      LANGSMITH_API_KEY: z.string().optional(),
      LANGSMITH_PROJECT: z.string().optional(),
      GROQ_API_KEY: z.string().optional(),
      VOICELOG_STT_PROVIDER: z.preprocess(
        optionalEnumValue,
        z.enum(['openai', 'groq']).default('openai')
      ),
      VOICELOG_STT_FALLBACK_PROVIDER: z.preprocess(
        optionalEnumValue,
        z.enum(['openai', 'groq', 'none']).default('none')
      ),
      STT_CONCURRENCY_LIMIT: z
        .preprocess((val) => (val ? Number(val) : void 0), z.number().optional())
        .default(3),
      VOICELOG_PROCESSING_MODE_DEFAULT: z.enum(['fast', 'full']).default('fast'),
      VOICELOG_STT_MODEL_FAST: z.string().default('whisper-tiny'),
      // Fast mode: whisper-tiny for 3x speedup
      VOICELOG_STT_MODEL_FULL: z.string().default('whisper-1'),
      // Full mode: whisper-1 for accuracy
      VOICELOG_CHUNK_OVERLAP_SECONDS: z
        .preprocess((val) => (val ? Number(val) : void 0), z.number().int().min(0).optional())
        .default(5),
      VOICELOG_ADAPTIVE_OVERLAP: z.preprocess((val) => val === 'true', z.boolean()).default(true),
      // Enable adaptive overlap based on speech density
      VOICELOG_ENABLE_CHUNK_VAD: z.preprocess((val) => val === 'true', z.boolean()).default(false),
      VOICELOG_ENABLE_POSTPROCESS: z
        .preprocess((val) => val !== 'false', z.boolean())
        .default(true),
      ANTHROPIC_API_KEY: z.string().optional(),
      ANTHROPIC_MODEL: z.string().default('claude-3-5-haiku-latest'),
      HF_TOKEN: z.string().optional(),
      HUGGINGFACE_TOKEN: z.string().optional(),
      FFMPEG_BINARY: z.string().default('ffmpeg'),
      PYTHON_BINARY: z.string().default('python'),
      // Local Whisper configuration (for offline processing)
      WHISPER_CPP_PATH: z.string().optional(),
      WHISPER_MODEL_PATH: z.string().optional(),
      WHISPER_THREADS: z.string().default('4'),
      USE_LOCAL_WHISPER: z.preprocess((val) => val === 'true', z.boolean()).default(false),
      DIARIZATION_MODEL: z.string().default('pyannote/speaker-diarization-3.1'),
      SPEAKER_IDENTIFICATION_MODEL: z.string().default('microsoft/wavlm-base-plus-sv'),
      VERIFICATION_MODEL: z.string().default('gpt-4o-transcribe'),
      VOICELOG_DIARIZER: z.enum(['pyannote', 'openai', 'auto']).default('auto'),
      AUDIO_LANGUAGE: z.string().default('pl'),
      AUDIO_PREPROCESS: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
      VOICELOG_SILENCE_REMOVE: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
      VOICELOG_PER_SPEAKER_NORM: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
      TRANSCRIPT_CORRECTION: z.preprocess((val) => val === 'true', z.boolean()).default(false),
      VAD_ENABLED: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
      WHISPER_PROMPT: z.string().optional(),
      DEBUG: z.preprocess((val) => val === 'true', z.boolean()).default(false),
    });
    _env = envSchema.safeParse(process.env);
    if (!_env.success) {
      console.error('\u274C Invalid environment variables:', _env.error.format());
      process.exit(1);
    }
    config = _env.data;
  },
});

// server/logger.ts
var logger_exports = {};
__export(logger_exports, {
  logger: () => logger,
});
var IS_PROD, logger;
var init_logger = __esm({
  'server/logger.ts'() {
    init_config();
    IS_PROD = config.NODE_ENV === 'production' || config.NODE_ENV === 'staging';
    if (config.SENTRY_DSN) {
      Sentry.init({
        dsn: config.SENTRY_DSN,
        environment: config.NODE_ENV || 'development',
        tracesSampleRate: 1,
        debug: !IS_PROD,
      });
    }
    logger = {
      info: (msg, meta = {}) => {
        console.log(`[INFO] ${msg}`, Object.keys(meta).length ? meta : '');
      },
      warn: (msg, meta = {}) => {
        console.warn(`[WARN] ${msg}`, Object.keys(meta).length ? meta : '');
        if (process.env.SENTRY_DSN) {
          Sentry.captureMessage(msg, 'warning');
        }
      },
      error: (msg, err = null) => {
        console.error(`[ERROR] ${msg}`, err || '');
        if (process.env.SENTRY_DSN && err instanceof Error) {
          Sentry.captureException(err);
        } else if (process.env.SENTRY_DSN) {
          Sentry.captureMessage(msg, 'error');
        }
      },
    };
  },
});

// server/lib/supabaseStorage.ts
var supabaseStorage_exports = {};
__export(supabaseStorage_exports, {
  deleteAudioFromStorage: () => deleteAudioFromStorage,
  downloadAudioFromStorage: () => downloadAudioFromStorage,
  supabase: () => supabase,
  uploadAudioFileToStorage: () => uploadAudioFileToStorage,
  uploadAudioToStorage: () => uploadAudioToStorage,
});
async function ensureBucket() {
  if (bucketEnsured || !supabase) return;
  const { error } = await supabase.storage.createBucket(BUCKET_NAME, { public: false });
  if (error && !error.message?.includes('already exists')) {
    console.warn(`[Supabase Storage] Bucket creation warning: ${error.message}`);
  }
  bucketEnsured = true;
}
async function uploadAudioToStorage(recordingId, buffer, contentType, extension) {
  if (!supabase) {
    return null;
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
async function uploadAudioFileToStorage(recordingId, filePath, contentType, extension) {
  if (!supabase) {
    return null;
  }
  await ensureBucket();
  const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${safeRecordingId}${extension}`;
  const body = fs.createReadStream(filePath);
  const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }
  return data.path;
}
async function downloadAudioFromStorage(path12) {
  if (!supabase) {
    throw new Error('Supabase credentials not configured.');
  }
  const { data, error } = await supabase.storage.from('recordings').download(path12);
  if (error) {
    throw new Error(`Failed to download from Supabase Storage: ${error.message}`);
  }
  return await data.arrayBuffer();
}
async function deleteAudioFromStorage(path12) {
  if (!supabase) {
    throw new Error('Supabase credentials not configured.');
  }
  const { error } = await supabase.storage.from('recordings').remove([path12]);
  if (error) {
    console.warn(`[Supabase Storage] Failed to delete file ${path12}:`, error.message);
  }
}
var SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, supabaseUrlValid, supabase, BUCKET_NAME, bucketEnsured;
var init_supabaseStorage = __esm({
  'server/lib/supabaseStorage.ts'() {
    init_config();
    SUPABASE_URL = config.SUPABASE_URL || '';
    SUPABASE_SERVICE_ROLE_KEY = config.SUPABASE_SERVICE_ROLE_KEY || '';
    supabaseUrlValid = SUPABASE_URL.startsWith('http');
    supabase =
      supabaseUrlValid && SUPABASE_SERVICE_ROLE_KEY
        ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
        : null;
    BUCKET_NAME = 'recordings';
    bucketEnsured = false;
  },
});

// server/speakerEmbedder.ts
var speakerEmbedder_exports = {};
__export(speakerEmbedder_exports, {
  addToAverageEmbedding: () => addToAverageEmbedding,
  computeEmbedding: () => computeEmbedding,
  cosineSimilarity: () => cosineSimilarity,
  matchSpeakerToProfile: () => matchSpeakerToProfile,
});
async function getEmbeddingModels() {
  if (modelCache && processorCache) return { model: modelCache, processor: processorCache };
  try {
    const { AutoModel, AutoProcessor, env } = await import('@xenova/transformers');
    env.allowLocalModels = true;
    env.use_env_vars = true;
    const threads = Math.max(1, Math.floor(os.cpus().length / 2));
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.numThreads = threads;
    }
    modelCache = await AutoModel.from_pretrained('Xenova/wavlm-base-plus-sv', {
      quantized: true,
      dtype: 'int8',
      // Explicit INT8
    });
    processorCache = await AutoProcessor.from_pretrained('Xenova/wavlm-base-plus-sv');
    return { model: modelCache, processor: processorCache };
  } catch (err) {
    console.error('[speakerEmbedder] Failed to load WavLM models:', err.message);
    return null;
  }
}
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}
function addToAverageEmbedding(existing, existingCount, newEmbedding) {
  if (!existing?.length) return newEmbedding;
  if (!newEmbedding?.length) return existing;
  const len = Math.min(existing.length, newEmbedding.length);
  const avg = new Array(len);
  for (let i = 0; i < len; i++) {
    avg[i] = (existing[i] * existingCount + newEmbedding[i]) / (existingCount + 1);
  }
  let sqSum = 0;
  for (let i = 0; i < avg.length; i++) sqSum += avg[i] * avg[i];
  const norm = Math.sqrt(sqSum) || 1e-8;
  return avg.map((v) => v / norm);
}
function decodeAudioToFloat32(inputPath) {
  const tmpPath = path2.join(os.tmpdir(), `spkemb_${Date.now()}.raw`);
  try {
    execSync(
      `"${FFMPEG_BINARY}" -y -i "${inputPath}" -threads 4 -ar 16000 -ac 1 -f f32le "${tmpPath}"`,
      { stdio: 'pipe', timeout: 3e4 }
    );
    const buf = fs2.readFileSync(tmpPath);
    const float32 = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return float32;
  } catch (err) {
    console.warn('[speakerEmbedder] ffmpeg decode failed:', err.message);
    return null;
  } finally {
    try {
      fs2.unlinkSync(tmpPath);
    } catch (_) {}
  }
}
async function computeEmbedding(audioFilePath) {
  const models = await getEmbeddingModels();
  if (!models) return null;
  const pcm = decodeAudioToFloat32(audioFilePath);
  if (!pcm || pcm.length < 160) return null;
  try {
    const inputs = await models.processor(pcm, 16e3);
    const output = await models.model(inputs);
    const arr = Array.from(output.embeddings.data);
    let sqSum = 0;
    for (let i = 0; i < arr.length; i++) {
      sqSum += arr[i] * arr[i];
    }
    const norm = Math.sqrt(sqSum) || 1e-8;
    return arr.map((v) => v / norm);
  } catch (err) {
    console.error('[speakerEmbedder] Embedding computation failed:', err.message);
    return null;
  }
}
async function matchSpeakerToProfile(audioFilePath, voiceProfiles) {
  if (!voiceProfiles || !voiceProfiles.length) return null;
  const embedding = await computeEmbedding(audioFilePath);
  if (!embedding) return null;
  let best = null;
  let bestScore = 0;
  for (const profile of voiceProfiles) {
    const threshold =
      typeof profile.threshold === 'number' && profile.threshold > 0
        ? profile.threshold
        : SIMILARITY_THRESHOLD;
    let profileEmbedding;
    try {
      profileEmbedding =
        typeof profile.embedding_json === 'string'
          ? JSON.parse(profile.embedding_json)
          : typeof profile.embedding === 'string'
            ? JSON.parse(profile.embedding)
            : profile.embedding;
    } catch (_) {
      continue;
    }
    if (!Array.isArray(profileEmbedding) || !profileEmbedding.length) continue;
    const score = cosineSimilarity(embedding, profileEmbedding);
    if (score >= threshold && score > bestScore) {
      bestScore = score;
      best = { name: profile.speaker_name, confidence: Math.round(score * 100) };
    }
  }
  return best;
}
var SIMILARITY_THRESHOLD, FFMPEG_BINARY, modelCache, processorCache;
var init_speakerEmbedder = __esm({
  'server/speakerEmbedder.ts'() {
    init_config();
    SIMILARITY_THRESHOLD = 0.82;
    FFMPEG_BINARY = config.FFMPEG_BINARY;
    modelCache = null;
    processorCache = null;
  },
});

// server/scripts/cleanup-disk.ts
var cleanup_disk_exports = {};
__export(cleanup_disk_exports, {
  cleanupDisk: () => cleanupDisk,
});
function getFileAgeHours(filePath) {
  try {
    const stats = fs10.statSync(filePath);
    const ageMs = Date.now() - stats.mtimeMs;
    return ageMs / (1e3 * 60 * 60);
  } catch {
    return 0;
  }
}
function cleanDirectory(dirPath, maxAgeHours = MAX_AGE_HOURS) {
  if (!fs10.existsSync(dirPath)) {
    console.log(`[Cleanup] Directory does not exist: ${dirPath}`);
    return 0;
  }
  let deletedCount = 0;
  let freedBytes = 0;
  try {
    const files = fs10.readdirSync(dirPath);
    for (const file of files) {
      if (file === '.gitkeep' || file === '.DS_Store') {
        continue;
      }
      const filePath = path11.join(dirPath, file);
      try {
        const stats = fs10.statSync(filePath);
        if (stats.isFile()) {
          const ageHours = getFileAgeHours(filePath);
          if (ageHours > maxAgeHours) {
            fs10.unlinkSync(filePath);
            deletedCount++;
            freedBytes += stats.size;
            console.log(
              `[Cleanup] Deleted: ${file} (${(stats.size / 1024).toFixed(2)} KB, ${ageHours.toFixed(1)}h old)`
            );
          }
        }
      } catch (error) {}
    }
  } catch (error) {
    console.error(`[Cleanup] Error reading ${dirPath}:`, error.message);
  }
  return { deletedCount, freedBytes };
}
function getDiskUsage() {
  try {
    const statfs = fs10.statfsSync ? fs10.statfsSync('.') : null;
    if (statfs) {
      const freeBytes = statfs.bavail * statfs.bsize;
      const totalBytes = statfs.blocks * statfs.bsize;
      const usedBytes = totalBytes - freeBytes;
      return {
        freeGB: (freeBytes / 1024 / 1024 / 1024).toFixed(2),
        usedGB: (usedBytes / 1024 / 1024 / 1024).toFixed(2),
        totalGB: (totalBytes / 1024 / 1024 / 1024).toFixed(2),
        usagePercent: ((usedBytes / totalBytes) * 100).toFixed(1),
      };
    }
  } catch {}
  return null;
}
function cleanupDisk() {
  console.log('\n\u{1F9F9} Starting disk cleanup...');
  const diskBefore = getDiskUsage();
  if (diskBefore) {
    console.log(
      `\u{1F4CA} Disk usage before cleanup: ${diskBefore.usedGB}GB / ${diskBefore.totalGB}GB (${diskBefore.usagePercent}%)`
    );
    console.log(`\u{1F4CA} Free space: ${diskBefore.freeGB}GB
`);
  }
  let totalDeleted = 0;
  let totalFreed = 0;
  for (const dir of DIRECTORIES_TO_CLEAN) {
    console.log(`[Cleanup] Cleaning: ${dir}`);
    const result = cleanDirectory(dir);
    totalDeleted += result.deletedCount;
    totalFreed += result.freedBytes;
  }
  const diskAfter = getDiskUsage();
  if (diskAfter) {
    console.log(`
\u{1F4CA} Disk usage after cleanup: ${diskAfter.usedGB}GB / ${diskAfter.totalGB}GB (${diskAfter.usagePercent}%)`);
    console.log(`\u{1F4CA} Free space: ${diskAfter.freeGB}GB`);
  }
  console.log(`
\u2705 Cleanup complete: ${totalDeleted} files deleted, ${(totalFreed / 1024 / 1024).toFixed(2)} MB freed`);
  return {
    deletedCount: totalDeleted,
    freedBytes: totalFreed,
    diskBefore,
    diskAfter,
  };
}
var __dirname6, DIRECTORIES_TO_CLEAN, MAX_AGE_HOURS;
var init_cleanup_disk = __esm({
  'server/scripts/cleanup-disk.ts'() {
    __dirname6 = path11.dirname(fileURLToPath6(import.meta.url));
    DIRECTORIES_TO_CLEAN = [
      './server/data/uploads',
      './server/data/temp',
      './server/data/chunks',
      './server/data/preprocess',
      '/tmp',
    ];
    MAX_AGE_HOURS = 24;
    if (process.env.RAILWAY === 'true' || process.env.NODE_ENV === 'production') {
      cleanupDisk();
    }
  },
});

// server/index.ts
init_logger();

// server/database.ts
init_logger();
init_config();

// server/runtime.ts
function resolveServerPort(configLike) {
  return Number(configLike.PORT || configLike.VOICELOG_API_PORT) || 4e3;
}
var PROCESS_BUILD_TIME = /* @__PURE__ */ new Date().toISOString();
function resolveBuildMetadata(envLike = process.env, fallbackVersion = '0.1.0') {
  const gitSha = String(
    envLike.RAILWAY_GIT_COMMIT_SHA ||
      envLike.VERCEL_GIT_COMMIT_SHA ||
      envLike.GITHUB_SHA ||
      'unknown'
  );
  const buildTime = String(envLike.BUILD_TIME || envLike.APP_BUILD_TIME || PROCESS_BUILD_TIME);
  const appVersion = String(envLike.APP_VERSION || envLike.npm_package_version || fallbackVersion);
  const runtime =
    envLike.RAILWAY_ENVIRONMENT || envLike.RAILWAY_PROJECT_ID
      ? 'railway'
      : envLike.VERCEL
        ? 'vercel'
        : 'node';
  return {
    gitSha,
    buildTime,
    appVersion,
    runtime,
  };
}

// server/database.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path3.dirname(__filename2);
var ENOSPC_MESSAGE = 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.';
function _resolveWritableUploadDir(preferredDir) {
  const normalizedPreferred = path3.resolve(preferredDir);
  const candidates = Array.from(
    /* @__PURE__ */ new Set([
      normalizedPreferred,
      path3.resolve(process.cwd(), 'server', 'data', 'uploads'),
      path3.resolve(process.cwd(), '.tmp', 'uploads'),
      path3.join(os2.tmpdir(), 'voicelog', 'uploads'),
    ])
  );
  let lastError = null;
  for (const candidate of candidates) {
    try {
      fs3.mkdirSync(candidate, { recursive: true });
      const probePath = path3.join(candidate, `.write-probe-${process.pid}-${Date.now()}`);
      fs3.writeFileSync(probePath, '');
      fs3.unlinkSync(probePath);
      if (candidate !== normalizedPreferred) {
        logger.warn(
          `[database] Upload dir ${normalizedPreferred} is not writable, falling back to ${candidate}.`
        );
      }
      return candidate;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`No writable upload directory available. Preferred: ${normalizedPreferred}`);
}
function _cleanupOldLocalFiles(uploadDir) {
  try {
    const files = fs3
      .readdirSync(uploadDir)
      .map((f) => ({ name: f, mtime: fs3.statSync(path3.join(uploadDir, f)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime);
    const toDelete = files.slice(0, Math.max(1, Math.floor(files.length * 0.2)));
    for (const file of toDelete) {
      try {
        fs3.unlinkSync(path3.join(uploadDir, file.name));
      } catch (error) {
        logger.warn(`[database] Failed to delete old file ${file.name}:`, error.message);
      }
    }
    logger.warn(`[database] Zwolniono miejsce: usunieto ${toDelete.length} starych plikow audio.`);
  } catch (error) {
    logger.warn('[database] Failed to cleanup old local files:', error.message);
  }
}
function _writeLocalAudioFile(uploadDir, filename, buffer) {
  fs3.mkdirSync(uploadDir, { recursive: true });
  const localPath = path3.join(uploadDir, filename);
  try {
    fs3.writeFileSync(localPath, buffer);
    return localPath;
  } catch (err) {
    if (err.code === 'ENOSPC') {
      logger.warn('[database] ENOSPC przy zapisie audio \u2014 probuje zwolnic miejsce i ponowic.');
      _cleanupOldLocalFiles(uploadDir);
      try {
        fs3.writeFileSync(localPath, buffer);
        return localPath;
      } catch (retryErr) {
        if (retryErr.code === 'ENOSPC') {
          const noSpaceErr = new Error(ENOSPC_MESSAGE);
          noSpaceErr.code = 'ENOSPC';
          throw noSpaceErr;
        }
        throw retryErr;
      }
    }
    throw err;
  }
}
var Database = class {
  type;
  uploadDir;
  sessionTtlHours;
  pool;
  msgId;
  callbacks;
  worker;
  sqliteInitPromise;
  constructor(dbConfig = {}) {
    const {
      type = 'sqlite',
      dbPath = ':memory:',
      uploadDir = './uploads',
      sessionTtlHours = 24 * 30,
      connectionString,
    } = dbConfig;
    this.type = connectionString ? 'postgres' : type;
    this.uploadDir = _resolveWritableUploadDir(uploadDir);
    this.sessionTtlHours = sessionTtlHours;
    if (this.type === 'postgres') {
      this.pool = new Pool({ connectionString });
      console.log('[DB] Using PostgreSQL (Supabase)');
    } else {
      if (dbPath !== ':memory:') {
        fs3.mkdirSync(path3.dirname(dbPath), { recursive: true });
      }
      this.msgId = 0;
      this.callbacks = /* @__PURE__ */ new Map();
      const ext = __filename2.endsWith('.ts') ? '.ts' : '.js';
      this.worker = new Worker(path3.join(__dirname2, `sqliteWorker${ext}`));
      this.worker.on('message', (msg) => {
        const { id, result, error } = msg;
        const cb = this.callbacks.get(id);
        if (cb) {
          this.callbacks.delete(id);
          if (error) cb.reject(new Error(error));
          else cb.resolve(result);
        }
      });
      this.worker.on('error', (err) => console.error('SQLite Worker Error:', err));
      this.sqliteInitPromise = this._sendToWorker('init', null, null, dbPath);
      console.log('[DB] Using local async SQLite Worker at:', dbPath);
    }
    fs3.mkdirSync(this.uploadDir, { recursive: true });
  }
  async init() {
    if (this.type !== 'postgres') {
      await this.sqliteInitPromise;
    }
    await this._createSchema();
  }
  _sendToWorker(type, sql, params = null, dbPath = null) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, sql, params, dbPath });
    });
  }
  async _query(sql, params = []) {
    if (this.type === 'postgres') {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      const res = await this.pool.query(pgSql, params);
      return res.rows;
    } else {
      return this._sendToWorker('query', sql, params);
    }
  }
  async _get(sql, params = []) {
    if (this.type === 'postgres') {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      const res = await this.pool.query(pgSql, params);
      return res.rows[0] || null;
    } else {
      const result = await this._sendToWorker('get', sql, params);
      return result || null;
    }
  }
  async _execute(sql, params = []) {
    if (this.type === 'postgres') {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      await this.pool.query(pgSql, params);
    } else {
      await this._sendToWorker('execute', sql, params);
    }
  }
  async _createSchema() {
    await this._execute(`
      CREATE TABLE IF NOT EXISTS server_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const migrationsDir = path3.join(__dirname2, 'migrations');
    if (!fs3.existsSync(migrationsDir)) return;
    const files = fs3
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const row = await this._get('SELECT version FROM server_migrations WHERE version = ?', [
        file,
      ]);
      if (!row) {
        if (logger && logger.info) logger.info(`Applying migration: ${file}`);
        const sql = fs3.readFileSync(path3.join(migrationsDir, file), 'utf8');
        const queries = sql
          .split(';')
          .map((q) => q.trim())
          .filter((q) => q && q.replace(/--[^\n]*/g, '').trim());
        for (const q of queries) {
          if (q.length > 0) {
            try {
              await this._execute(q);
            } catch (err) {
              if (logger && logger.error)
                logger.error(`Migration error in ${file} query: ${q}`, err);
              throw err;
            }
          }
        }
        await this._execute('INSERT INTO server_migrations (version, applied_at) VALUES (?, ?)', [
          file,
          /* @__PURE__ */ new Date().toISOString(),
        ]);
      }
    }
  }
  nowIso() {
    return /* @__PURE__ */ new Date().toISOString();
  }
  _buildPipelineMetadata() {
    const build = resolveBuildMetadata(process.env, '0.1.0');
    return {
      pipelineVersion: build.appVersion,
      pipelineGitSha: build.gitSha,
      pipelineBuildTime: build.buildTime,
    };
  }
  _normalizeQualityMetrics(existingMetrics = {}) {
    const attemptCount = Math.max(0, Number(existingMetrics?.attemptCount) || 0);
    const retryCount = Math.max(0, Number(existingMetrics?.retryCount) || 0);
    const failureCount = Math.max(0, Number(existingMetrics?.failureCount) || 0);
    const failureRate = attemptCount > 0 ? failureCount / attemptCount : 0;
    return {
      ...existingMetrics,
      attemptCount,
      retryCount,
      failureCount,
      failureRate,
    };
  }
  _mergeQualityMetrics(existingMetrics = {}, nextMetrics = {}) {
    const normalizedExisting = this._normalizeQualityMetrics(existingMetrics);
    const normalizedNext = this._normalizeQualityMetrics(nextMetrics);
    const attemptCount = Math.max(normalizedExisting.attemptCount, normalizedNext.attemptCount);
    const retryCount = Math.max(normalizedExisting.retryCount, normalizedNext.retryCount);
    const failureCount = Math.max(normalizedExisting.failureCount, normalizedNext.failureCount);
    return {
      ...normalizedExisting,
      ...normalizedNext,
      attemptCount,
      retryCount,
      failureCount,
      failureRate: attemptCount > 0 ? failureCount / attemptCount : 0,
    };
  }
  // --- Internal Utilities ---
  _safeJsonParse(raw, fallbackValue) {
    if (!raw) return fallbackValue;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallbackValue;
    }
  }
  _clean(value) {
    return String(value || '').trim();
  }
  _normalizeEmail(email) {
    return this._clean(email).toLowerCase();
  }
  _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
  }
  _normalizeWorkspaceCode(code) {
    return this._clean(code).replace(/\s+/g, '').toUpperCase();
  }
  _generateId(prefix) {
    return `${prefix}_${crypto2.randomUUID().replace(/-/g, '')}`;
  }
  _generateInviteCode() {
    return crypto2.randomBytes(4).toString('hex').toUpperCase();
  }
  _hashPassword(secret, salt = crypto2.randomBytes(16).toString('hex')) {
    const derived = crypto2.scryptSync(String(secret || ''), salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }
  _verifyPassword(secret, storedHash) {
    const [salt, expected] = String(storedHash || '').split(':');
    if (!salt || !expected) return false;
    const actual = crypto2.scryptSync(String(secret || ''), salt, 64).toString('hex');
    const actualBuf = Buffer.from(actual, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (actualBuf.length !== expectedBuf.length) return false;
    return crypto2.timingSafeEqual(actualBuf, expectedBuf);
  }
  _hashRecoveryCode(code) {
    return crypto2
      .createHash('sha256')
      .update(String(code || ''))
      .digest('hex');
  }
  _pickProfileDraft(draft = {}, email = '') {
    return {
      role: this._clean(draft.role),
      company: this._clean(draft.company),
      timezone: this._clean(draft.timezone) || 'Europe/Warsaw',
      googleEmail: this._clean(draft.googleEmail) || this._normalizeEmail(email),
      phone: this._clean(draft.phone),
      location: this._clean(draft.location),
      team: this._clean(draft.team),
      bio: this._clean(draft.bio),
      avatarUrl: this._clean(draft.avatarUrl),
      preferredInsights: Array.isArray(draft.preferredInsights)
        ? draft.preferredInsights.filter(Boolean)
        : String(draft.preferredInsights || '')
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
      notifyDailyDigest: Boolean(draft.notifyDailyDigest ?? true),
      autoTaskCapture: Boolean(draft.autoTaskCapture ?? true),
      preferredTaskView: draft.preferredTaskView === 'kanban' ? 'kanban' : 'list',
    };
  }
  _buildUserFromRow(row) {
    const profile = this._safeJsonParse(row.profile_json, {});
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      provider: row.provider,
      googleSub: row.google_sub,
      googleEmail: row.google_email || profile.googleEmail || row.email,
      role: profile.role || '',
      company: profile.company || '',
      timezone: profile.timezone || 'Europe/Warsaw',
      phone: profile.phone || '',
      location: profile.location || '',
      team: profile.team || '',
      bio: profile.bio || '',
      avatarUrl: profile.avatarUrl || '',
      preferredInsights: Array.isArray(profile.preferredInsights) ? profile.preferredInsights : [],
      notifyDailyDigest: Boolean(profile.notifyDailyDigest ?? true),
      autoTaskCapture: Boolean(profile.autoTaskCapture ?? true),
      preferredTaskView: profile.preferredTaskView === 'kanban' ? 'kanban' : 'list',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  async _buildWorkspaceFromRow(row, currentUserId = '') {
    const members = await this._query(
      'SELECT user_id, member_role FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC',
      [row.id]
    );
    const memberIds = members.map((item) => item.user_id);
    const memberRoles = members.reduce((result, item) => {
      result[item.user_id] = item.member_role;
      return result;
    }, {});
    const currentMember = currentUserId
      ? members.find((item) => item.user_id === currentUserId)
      : null;
    return {
      id: row.id,
      name: row.name,
      ownerUserId: row.owner_user_id,
      inviteCode: row.invite_code,
      memberIds,
      memberRoles,
      memberRole: currentMember?.member_role || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  // --- Public Methods ---
  async workspaceMembers(workspaceId) {
    const rows = await this._query(
      `
        SELECT users.*, workspace_members.member_role AS workspace_member_role
        FROM workspace_members
        JOIN users ON users.id = workspace_members.user_id
        WHERE workspace_members.workspace_id = ?
        ORDER BY LOWER(users.name) ASC
      `,
      [workspaceId]
    );
    return rows.map((row) => this._buildUserFromRow(row));
  }
  async workspaceIdsForUser(userId) {
    const rows = await this._query(
      'SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY joined_at ASC',
      [userId]
    );
    return rows.map((row) => row.workspace_id);
  }
  async accessibleWorkspaces(userId) {
    const rows = await this._query(
      `
        SELECT workspaces.*
        FROM workspace_members
        JOIN workspaces ON workspaces.id = workspace_members.workspace_id
        WHERE workspace_members.user_id = ?
        ORDER BY workspaces.updated_at DESC
      `,
      [userId]
    );
    return Promise.all(rows.map((row) => this._buildWorkspaceFromRow(row, userId)));
  }
  async ensureWorkspaceState(workspaceId) {
    const existing = await this._get(
      'SELECT workspace_id FROM workspace_state WHERE workspace_id = ?',
      [workspaceId]
    );
    if (existing) return;
    const timestamp = this.nowIso();
    await this._execute(
      `
        INSERT INTO workspace_state (
          workspace_id,
          meetings_json,
          manual_tasks_json,
          task_state_json,
          task_boards_json,
          calendar_meta_json,
          vocabulary_json,
          updated_at
        )
        VALUES (?, '[]', '[]', '{}', '{}', '{}', '[]', ?)
      `,
      [workspaceId, timestamp]
    );
  }
  async getWorkspaceState(workspaceId) {
    let row = await this._get('SELECT * FROM workspace_state WHERE workspace_id = ?', [
      workspaceId,
    ]);
    if (!row) {
      await this.ensureWorkspaceState(workspaceId);
      row = await this._get('SELECT * FROM workspace_state WHERE workspace_id = ?', [workspaceId]);
    }
    return {
      meetings: this._safeJsonParse(row.meetings_json, []),
      manualTasks: this._safeJsonParse(row.manual_tasks_json, []),
      taskState: this._safeJsonParse(row.task_state_json, {}),
      taskBoards: this._safeJsonParse(row.task_boards_json, {}),
      calendarMeta: this._safeJsonParse(row.calendar_meta_json, {}),
      vocabulary: this._safeJsonParse(row.vocabulary_json, []),
      updatedAt: row.updated_at,
    };
  }
  async saveWorkspaceState(
    workspaceId,
    payload = {
      meetings: [],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
    }
  ) {
    await this.ensureWorkspaceState(workspaceId);
    const timestamp = this.nowIso();
    await this._execute(
      `
        UPDATE workspace_state
        SET meetings_json = ?,
            manual_tasks_json = ?,
            task_state_json = ?,
            task_boards_json = ?,
            calendar_meta_json = ?,
            vocabulary_json = ?,
            updated_at = ?
        WHERE workspace_id = ?
      `,
      [
        JSON.stringify(Array.isArray(payload.meetings) ? payload.meetings : []),
        JSON.stringify(Array.isArray(payload.manualTasks) ? payload.manualTasks : []),
        JSON.stringify(
          payload.taskState && typeof payload.taskState === 'object' ? payload.taskState : {}
        ),
        JSON.stringify(
          payload.taskBoards && typeof payload.taskBoards === 'object' ? payload.taskBoards : {}
        ),
        JSON.stringify(
          payload.calendarMeta && typeof payload.calendarMeta === 'object'
            ? payload.calendarMeta
            : {}
        ),
        JSON.stringify(Array.isArray(payload.vocabulary) ? payload.vocabulary : []),
        timestamp,
        workspaceId,
      ]
    );
    await this._execute('UPDATE workspaces SET updated_at = ? WHERE id = ?', [
      timestamp,
      workspaceId,
    ]);
    return this.getWorkspaceState(workspaceId);
  }
  async createSession(userId, workspaceId) {
    const timestamp = this.nowIso();
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1e3).toISOString();
    const token = crypto2.randomBytes(48).toString('hex');
    await this._execute('DELETE FROM sessions WHERE expires_at <= ?', [timestamp]);
    await this._execute(
      `
        INSERT INTO sessions (token, user_id, workspace_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      [token, userId, workspaceId, timestamp, expiresAt]
    );
    return { token, expiresAt };
  }
  async getSession(token) {
    const row = await this._get('SELECT * FROM sessions WHERE token = ?', [token]);
    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this._execute('DELETE FROM sessions WHERE token = ?', [token]);
      return null;
    }
    return row;
  }
  async getMembership(workspaceId, userId) {
    return this._get('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [
      workspaceId,
      userId,
    ]);
  }
  async selectWorkspaceForUser(userId, preferredWorkspaceId = '') {
    const workspaceIds = await this.workspaceIdsForUser(userId);
    if (!workspaceIds.length) return '';
    if (preferredWorkspaceId && workspaceIds.includes(preferredWorkspaceId)) {
      return preferredWorkspaceId;
    }
    return workspaceIds[0];
  }
  async buildSessionPayload(userId, workspaceId) {
    const [userRow, nextWorkspaceId] = await Promise.all([
      this._get('SELECT * FROM users WHERE id = ?', [userId]),
      this.selectWorkspaceForUser(userId, workspaceId),
    ]);
    if (!userRow || !nextWorkspaceId) {
      throw new Error('Unable to build session payload.');
    }
    const [users, workspaces, state] = await Promise.all([
      this.workspaceMembers(nextWorkspaceId),
      this.accessibleWorkspaces(userId),
      this.getWorkspaceState(nextWorkspaceId),
    ]);
    return {
      user: this._buildUserFromRow(userRow),
      users,
      workspaces,
      workspaceId: nextWorkspaceId,
      state,
    };
  }
  async registerUser(draft) {
    const errorWithStatus = (msg, code = 400) => {
      const e = new Error(msg);
      e.statusCode = code;
      return e;
    };
    const email = this._normalizeEmail(draft.email);
    const password = String(draft.password || '');
    const name = this._clean(draft.name);
    const workspaceMode = draft.workspaceMode === 'join' ? 'join' : 'create';
    const inviteCode = this._normalizeWorkspaceCode(draft.workspaceCode);
    const requestedWorkspaceName = this._clean(draft.workspaceName);
    if (!email || !password || !name) throw errorWithStatus('Uzupelnij imie, email i haslo.');
    if (!this._isValidEmail(email)) throw errorWithStatus('Podaj poprawny adres email.');
    if (password.length < 6) throw errorWithStatus('Haslo musi miec przynajmniej 6 znakow.');
    const existingUser = await this._get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) throw errorWithStatus('Konto z takim adresem juz istnieje.', 409);
    const timestamp = this.nowIso();
    const userId = this._generateId('user');
    let workspaceId = '';
    let memberRole = 'member';
    await this._execute('BEGIN');
    try {
      await this._execute(
        `
          INSERT INTO users (
            id, email, password_hash, name, provider, google_sub, google_email,
            recovery_code_hash, recovery_code_expires_at, profile_json, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 'local', '', ?, '', '', ?, ?, ?)
        `,
        [
          userId,
          email,
          this._hashPassword(password),
          name,
          email,
          JSON.stringify(this._pickProfileDraft(draft, email)),
          timestamp,
          timestamp,
        ]
      );
      if (workspaceMode === 'join') {
        if (!inviteCode) throw errorWithStatus('Podaj kod workspace, aby dolaczyc.', 400);
        const workspace = await this._get('SELECT * FROM workspaces WHERE invite_code = ?', [
          inviteCode,
        ]);
        if (!workspace) throw errorWithStatus('Nie znaleziono workspace o takim kodzie.', 404);
        workspaceId = workspace.id;
        await this._execute(
          "INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'member', ?)",
          [workspaceId, userId, timestamp]
        );
      } else {
        workspaceId = this._generateId('workspace');
        memberRole = 'owner';
        await this._execute(
          'INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            workspaceId,
            requestedWorkspaceName || `${name} workspace`,
            userId,
            this._generateInviteCode(),
            timestamp,
            timestamp,
          ]
        );
        await this._execute(
          "INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)",
          [workspaceId, userId, timestamp]
        );
        await this.ensureWorkspaceState(workspaceId);
      }
      if (workspaceMode === 'join') await this.ensureWorkspaceState(workspaceId);
      await this._execute('COMMIT');
    } catch (error) {
      await this._execute('ROLLBACK');
      throw error;
    }
    const session = await this.createSession(userId, workspaceId);
    const payload = await this.buildSessionPayload(userId, workspaceId);
    payload.user.workspaceMemberRole =
      memberRole || (await this.getMembership(workspaceId, userId))?.member_role || 'member';
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }
  async loginUser(draft) {
    const errorWithStatus = (msg, code = 401) => {
      const e = new Error(msg);
      e.statusCode = code;
      return e;
    };
    const email = this._normalizeEmail(draft.email);
    const password = String(draft.password || '');
    const preferredWorkspaceId = this._clean(draft.workspaceId);
    if (!email || !password) throw errorWithStatus('Uzupelnij email i haslo.', 400);
    const row = await this._get('SELECT * FROM users WHERE email = ?', [email]);
    if (row && !row.password_hash) {
      throw errorWithStatus('To konto korzysta z logowania Google. Uzyj przycisku Google.', 400);
    }
    if (!row || !row.password_hash || !this._verifyPassword(password, row.password_hash)) {
      throw errorWithStatus('Niepoprawny email lub haslo.', 401);
    }
    const workspaceId = await this.selectWorkspaceForUser(row.id, preferredWorkspaceId);
    if (!workspaceId)
      throw errorWithStatus('To konto nie jest jeszcze przypiete do zadnego workspace.', 403);
    if (preferredWorkspaceId && workspaceId !== preferredWorkspaceId) {
      throw errorWithStatus('Nie masz dostepu do wybranego workspace.', 403);
    }
    const [session, payload] = await Promise.all([
      this.createSession(row.id, workspaceId),
      this.buildSessionPayload(row.id, workspaceId),
    ]);
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }
  async requestPasswordReset(draft) {
    const email = this._normalizeEmail(draft.email);
    const genericExpiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    const row = await this._get('SELECT * FROM users WHERE email = ?', [email]);
    if (!row || !row.password_hash) return { expiresAt: genericExpiresAt };
    const recoveryCode = String(Math.floor(1e5 + Math.random() * 9e5));
    const expiresAt = genericExpiresAt;
    await this._execute(
      'UPDATE users SET recovery_code_hash = ?, recovery_code_expires_at = ?, updated_at = ? WHERE id = ?',
      [this._hashRecoveryCode(recoveryCode), expiresAt, this.nowIso(), row.id]
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset requested for ${email} (expires ${expiresAt})`);
    }
    return { expiresAt };
  }
  async resetPasswordWithCode(draft) {
    const email = this._normalizeEmail(draft.email);
    const code = this._clean(draft.code);
    const newPassword = String(draft.newPassword || '');
    const confirmPassword = String(draft.confirmPassword || '');
    const row = await this._get('SELECT * FROM users WHERE email = ?', [email]);
    if (!row) throw new Error('Nie znaleziono konta z takim adresem.');
    if (!code || !newPassword || !confirmPassword)
      throw new Error('Uzupelnij email, kod i oba pola hasla.');
    if (newPassword.length < 6) throw new Error('Nowe haslo musi miec przynajmniej 6 znakow.');
    if (newPassword !== confirmPassword) throw new Error('Nowe hasla nie sa identyczne.');
    if (!row.recovery_code_hash || !row.recovery_code_expires_at)
      throw new Error('Najpierw popros o kod resetu.');
    if (new Date(row.recovery_code_expires_at).getTime() <= Date.now())
      throw new Error('Kod resetu wygasl. Wygeneruj nowy.');
    if (this._hashRecoveryCode(code) !== row.recovery_code_hash)
      throw new Error('Kod resetu jest niepoprawny.');
    await this._execute(
      "UPDATE users SET password_hash = ?, recovery_code_hash = '', recovery_code_expires_at = '', updated_at = ? WHERE id = ?",
      [this._hashPassword(newPassword), this.nowIso(), row.id]
    );
    return { success: true };
  }
  async upsertGoogleUser(profile) {
    const email = this._normalizeEmail(profile.email);
    if (!email) throw new Error('Brakuje adresu email z Google.');
    const timestamp = this.nowIso();
    let row = await this._get('SELECT * FROM users WHERE email = ? OR google_sub = ?', [
      email,
      this._clean(profile.sub),
    ]);
    let workspaceId = '';
    await this._execute('BEGIN');
    try {
      if (row) {
        const currentProfile = this._safeJsonParse(row.profile_json, {});
        const nextProfile = {
          ...currentProfile,
          avatarUrl: this._clean(profile.picture) || currentProfile.avatarUrl || '',
          googleEmail: email,
        };
        await this._execute(
          "UPDATE users SET email = ?, name = ?, provider = 'google', google_sub = ?, google_email = ?, profile_json = ?, updated_at = ? WHERE id = ?",
          [
            email,
            this._clean(profile.name) || row.name,
            this._clean(profile.sub),
            email,
            JSON.stringify(nextProfile),
            timestamp,
            row.id,
          ]
        );
        workspaceId = await this.selectWorkspaceForUser(row.id);
      } else {
        const userId = this._generateId('user');
        workspaceId = this._generateId('workspace');
        await this._execute(
          `
          INSERT INTO users (
            id, email, password_hash, name, provider, google_sub, google_email,
            recovery_code_hash, recovery_code_expires_at, profile_json, created_at, updated_at
          )
          VALUES (?, ?, NULL, ?, 'google', ?, ?, '', '', ?, ?, ?)`,
          [
            userId,
            email,
            this._clean(profile.name) || this._clean(profile.given_name) || 'Google user',
            this._clean(profile.sub),
            email,
            JSON.stringify(
              this._pickProfileDraft(
                { avatarUrl: this._clean(profile.picture), googleEmail: email },
                email
              )
            ),
            timestamp,
            timestamp,
          ]
        );
        await this._execute(
          'INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            workspaceId,
            `${this._clean(profile.given_name) || this._clean(profile.name) || 'Google'} workspace`,
            userId,
            this._generateInviteCode(),
            timestamp,
            timestamp,
          ]
        );
        await this._execute(
          "INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)",
          [workspaceId, userId, timestamp]
        );
        await this.ensureWorkspaceState(workspaceId);
        row = await this._get('SELECT * FROM users WHERE id = ?', [userId]);
      }
      await this._execute('COMMIT');
    } catch (error) {
      await this._execute('ROLLBACK');
      throw error;
    }
    const actualUserId =
      row?.id || (await this._get('SELECT id FROM users WHERE email = ?', [email]))?.id;
    const actualWorkspaceId = workspaceId || (await this.selectWorkspaceForUser(actualUserId));
    const [session, payload] = await Promise.all([
      this.createSession(actualUserId, actualWorkspaceId),
      this.buildSessionPayload(actualUserId, actualWorkspaceId),
    ]);
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }
  async updateUserProfile(userId, updates = {}) {
    const row = await this._get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!row) throw new Error('Nie znaleziono konta.');
    const currentProfile = this._safeJsonParse(row.profile_json, {});
    const nextProfile = {
      ...currentProfile,
      ...this._pickProfileDraft({ ...currentProfile, ...updates }, row.email),
    };
    const nextName = this._clean(updates.name) || row.name;
    await this._execute(
      'UPDATE users SET name = ?, google_email = ?, profile_json = ?, updated_at = ? WHERE id = ?',
      [
        nextName,
        nextProfile.googleEmail || row.google_email || row.email,
        JSON.stringify(nextProfile),
        this.nowIso(),
        userId,
      ]
    );
    return this._buildUserFromRow(await this._get('SELECT * FROM users WHERE id = ?', [userId]));
  }
  async changeUserPassword(userId, draft) {
    const row = await this._get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!row) throw new Error('Nie znaleziono konta.');
    if (!row.password_hash) throw new Error('Haslem tego konta zarzadza Google.');
    const currentPassword = String(draft.currentPassword || '');
    const newPassword = String(draft.newPassword || '');
    const confirmPassword = String(draft.confirmPassword || '');
    if (!currentPassword || !newPassword || !confirmPassword)
      throw new Error('Uzupelnij wszystkie pola hasla.');
    if (newPassword.length < 6) throw new Error('Nowe haslo musi miec przynajmniej 6 znakow.');
    if (newPassword !== confirmPassword) throw new Error('Nowe hasla nie sa identyczne.');
    if (!this._verifyPassword(currentPassword, row.password_hash))
      throw new Error('Aktualne haslo jest niepoprawne.');
    await this._execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      this._hashPassword(newPassword),
      this.nowIso(),
      userId,
    ]);
    return { success: true };
  }
  async upsertMediaAsset({
    recordingId,
    workspaceId,
    meetingId = '',
    contentType,
    buffer,
    createdByUserId,
  }) {
    const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeRecordingId) throw new Error('Nieprawid\u0142owy identyfikator nagrania.');
    const baseMime = String(contentType || '')
      .toLowerCase()
      .split(';')[0]
      .trim();
    const extension =
      {
        'audio/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/mp4': '.m4a',
        'audio/wav': '.wav',
        'audio/ogg': '.ogg',
        'audio/flac': '.flac',
        'audio/x-m4a': '.m4a',
        'audio/mp3': '.mp3',
      }[baseMime] || '.webm';
    let storagePath;
    try {
      const { uploadAudioToStorage: uploadAudioToStorage2 } = await Promise.resolve().then(
        () => (init_supabaseStorage(), supabaseStorage_exports)
      );
      const result = await uploadAudioToStorage2(safeRecordingId, buffer, contentType, extension);
      if (result) {
        storagePath = result;
      } else {
        storagePath = _writeLocalAudioFile(
          this.uploadDir,
          `${safeRecordingId}${extension}`,
          buffer
        );
      }
    } catch (err) {
      if (err.code === 'ENOSPC' || String(err.message).includes('Brak miejsca na dysku')) {
        throw err;
      }
      logger.warn('[database] Supabase upload failed, falling back to local:', {
        message: err.message,
      });
      storagePath = _writeLocalAudioFile(this.uploadDir, `${safeRecordingId}${extension}`, buffer);
    }
    const existing = await this._get('SELECT id FROM media_assets WHERE id = ?', [recordingId]);
    const timestamp = this.nowIso();
    if (existing) {
      await this._execute(
        'UPDATE media_assets SET workspace_id = ?, meeting_id = ?, file_path = ?, content_type = ?, size_bytes = ?, updated_at = ? WHERE id = ?',
        [
          workspaceId,
          meetingId,
          storagePath,
          contentType,
          buffer.byteLength,
          timestamp,
          recordingId,
        ]
      );
    } else {
      await this._execute(
        `
        INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, transcription_status, transcript_json, diarization_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', '[]', '{}', ?, ?)`,
        [
          recordingId,
          workspaceId,
          meetingId,
          createdByUserId,
          storagePath,
          contentType || 'application/octet-stream',
          buffer.byteLength,
          timestamp,
          timestamp,
        ]
      );
    }
    return this.getMediaAsset(recordingId);
  }
  async upsertMediaAssetFromPath({
    recordingId,
    workspaceId,
    meetingId = '',
    contentType,
    filePath,
    createdByUserId,
  }) {
    const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeRecordingId) throw new Error('Nieprawidlowy identyfikator nagrania.');
    if (!filePath || !fs3.existsSync(filePath)) throw new Error('Plik zrodlowy nie istnieje.');
    const baseMime = String(contentType || '')
      .toLowerCase()
      .split(';')[0]
      .trim();
    const extension =
      {
        'audio/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/mp4': '.m4a',
        'audio/wav': '.wav',
        'audio/ogg': '.ogg',
        'audio/flac': '.flac',
        'audio/x-m4a': '.m4a',
        'audio/mp3': '.mp3',
      }[baseMime] || '.webm';
    const fileStats = await fs3.promises.stat(filePath);
    let storagePath;
    try {
      const { uploadAudioFileToStorage: uploadAudioFileToStorage2 } = await Promise.resolve().then(
        () => (init_supabaseStorage(), supabaseStorage_exports)
      );
      const result = await uploadAudioFileToStorage2(
        safeRecordingId,
        filePath,
        contentType,
        extension
      );
      if (result) {
        storagePath = result;
      } else {
        fs3.mkdirSync(this.uploadDir, { recursive: true });
        storagePath = path3.join(this.uploadDir, `${safeRecordingId}${extension}`);
        if (path3.resolve(storagePath) !== path3.resolve(filePath)) {
          await fs3.promises.copyFile(filePath, storagePath);
        }
      }
    } catch (err) {
      if (err.code === 'ENOSPC' || String(err.message).includes('Brak miejsca na dysku')) {
        throw err;
      }
      logger.warn('[database] Supabase upload from path failed, falling back to local:', {
        message: err.message,
      });
      fs3.mkdirSync(this.uploadDir, { recursive: true });
      storagePath = path3.join(this.uploadDir, `${safeRecordingId}${extension}`);
      if (path3.resolve(storagePath) !== path3.resolve(filePath)) {
        await fs3.promises.copyFile(filePath, storagePath);
      }
    }
    const existing = await this._get('SELECT id FROM media_assets WHERE id = ?', [recordingId]);
    const timestamp = this.nowIso();
    if (existing) {
      await this._execute(
        'UPDATE media_assets SET workspace_id = ?, meeting_id = ?, file_path = ?, content_type = ?, size_bytes = ?, updated_at = ? WHERE id = ?',
        [workspaceId, meetingId, storagePath, contentType, fileStats.size, timestamp, recordingId]
      );
    } else {
      await this._execute(
        `
        INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, transcription_status, transcript_json, diarization_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', '[]', '{}', ?, ?)`,
        [
          recordingId,
          workspaceId,
          meetingId,
          createdByUserId,
          storagePath,
          contentType || 'application/octet-stream',
          fileStats.size,
          timestamp,
          timestamp,
        ]
      );
    }
    return this.getMediaAsset(recordingId);
  }
  async getMediaAsset(recordingId) {
    return this._get('SELECT * FROM media_assets WHERE id = ?', [recordingId]);
  }
  async deleteMediaAsset(recordingId, workspaceId) {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset || asset.workspace_id !== workspaceId) return;
    if (asset.file_path && !asset.file_path.includes(path3.sep)) {
      const { deleteAudioFromStorage: deleteAudioFromStorage2 } = await Promise.resolve().then(
        () => (init_supabaseStorage(), supabaseStorage_exports)
      );
      await deleteAudioFromStorage2(asset.file_path);
    } else if (asset.file_path) {
      try {
        fs3.unlinkSync(asset.file_path);
      } catch (error) {
        logger.warn(
          `[database] Failed to delete legacy audio file ${asset.file_path}:`,
          error.message
        );
      }
    }
    await this._execute('DELETE FROM media_assets WHERE id = ? AND workspace_id = ?', [
      recordingId,
      workspaceId,
    ]);
  }
  async saveAudioQualityDiagnostics(recordingId, audioQuality) {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset) return null;
    const diarization = this._safeJsonParse(asset.diarization_json, {});
    const nextPayload =
      audioQuality && typeof audioQuality === 'object'
        ? {
            ...diarization,
            audioQuality,
          }
        : { ...diarization };
    await this._execute(
      'UPDATE media_assets SET diarization_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(nextPayload), this.nowIso(), recordingId]
    );
    return this.getMediaAsset(recordingId);
  }
  async updateTranscriptionMetadata(recordingId, updates = {}) {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset) return null;
    const diarization = this._safeJsonParse(asset.diarization_json, {});
    await this._execute(
      'UPDATE media_assets SET diarization_json = ?, updated_at = ? WHERE id = ?',
      [
        JSON.stringify({
          ...diarization,
          ...updates,
        }),
        this.nowIso(),
        recordingId,
      ]
    );
    return this.getMediaAsset(recordingId);
  }
  async markTranscriptionProcessing(recordingId) {
    const existing = await this.getMediaAsset(recordingId);
    const existingDiarization = this._safeJsonParse(existing?.diarization_json, {});
    const existingQualityMetrics = this._normalizeQualityMetrics(
      existingDiarization?.qualityMetrics || {}
    );
    const nextQualityMetrics = this._mergeQualityMetrics(existingQualityMetrics, {
      attemptCount: existingQualityMetrics.attemptCount + 1,
      retryCount:
        existingQualityMetrics.attemptCount > 0
          ? existingQualityMetrics.retryCount + 1
          : existingQualityMetrics.retryCount,
    });
    await this._execute(
      "UPDATE media_assets SET transcription_status = 'processing', diarization_json = ?, updated_at = ? WHERE id = ?",
      [
        JSON.stringify({
          ...existingDiarization,
          qualityMetrics: nextQualityMetrics,
        }),
        this.nowIso(),
        recordingId,
      ]
    );
    return this.getMediaAsset(recordingId);
  }
  async saveTranscriptionResult(recordingId, result = {}) {
    const existing = await this.getMediaAsset(recordingId);
    const existingDiarization = this._safeJsonParse(existing?.diarization_json, {});
    const defaultPipelineMetadata = this._buildPipelineMetadata();
    const pipelineMetadata = {
      pipelineVersion: result.pipelineVersion || defaultPipelineMetadata.pipelineVersion,
      pipelineGitSha: result.pipelineGitSha || defaultPipelineMetadata.pipelineGitSha,
      pipelineBuildTime: result.pipelineBuildTime || defaultPipelineMetadata.pipelineBuildTime,
    };
    const qualityMetrics = this._mergeQualityMetrics(
      existingDiarization?.qualityMetrics || {},
      result.qualityMetrics || {}
    );
    const diarizationPayload =
      result.diarization && typeof result.diarization === 'object'
        ? {
            ...result.diarization,
            enhancementsPending: Boolean(result.enhancementsPending),
            postprocessStage: result.postprocessStage || '',
            reviewSummary: result.reviewSummary || null,
            transcriptOutcome: result.transcriptOutcome || 'normal',
            emptyReason: result.emptyReason || '',
            userMessage: result.userMessage || '',
            audioQuality: result.audioQuality || existingDiarization.audioQuality || null,
            transcriptionDiagnostics: result.transcriptionDiagnostics || null,
            qualityMetrics,
            ...pipelineMetadata,
          }
        : {
            enhancementsPending: Boolean(result.enhancementsPending),
            postprocessStage: result.postprocessStage || '',
            reviewSummary: result.reviewSummary || null,
            transcriptOutcome: result.transcriptOutcome || 'normal',
            emptyReason: result.emptyReason || '',
            userMessage: result.userMessage || '',
            audioQuality: result.audioQuality || existingDiarization.audioQuality || null,
            transcriptionDiagnostics: result.transcriptionDiagnostics || null,
            qualityMetrics,
            ...pipelineMetadata,
          };
    await this._execute(
      'UPDATE media_assets SET transcription_status = ?, transcript_json = ?, diarization_json = ?, updated_at = ? WHERE id = ?',
      [
        this._clean(result.pipelineStatus) || 'completed',
        JSON.stringify(Array.isArray(result.segments) ? result.segments : []),
        JSON.stringify(diarizationPayload),
        this.nowIso(),
        recordingId,
      ]
    );
    return this.getMediaAsset(recordingId);
  }
  async markTranscriptionFailure(
    recordingId,
    errorMessage,
    transcriptionDiagnostics = null,
    audioQuality = null
  ) {
    const existing = await this.getMediaAsset(recordingId);
    const existingDiarization = this._safeJsonParse(existing?.diarization_json, {});
    const existingQualityMetrics = this._normalizeQualityMetrics(
      existingDiarization?.qualityMetrics || {}
    );
    const qualityMetrics = this._mergeQualityMetrics(existingQualityMetrics, {
      failureCount: existingQualityMetrics.failureCount + 1,
    });
    await this._execute(
      "UPDATE media_assets SET transcription_status = 'failed', diarization_json = ?, updated_at = ? WHERE id = ?",
      [
        JSON.stringify({
          errorMessage: this._clean(errorMessage),
          audioQuality: audioQuality || existingDiarization.audioQuality || null,
          transcriptionDiagnostics: transcriptionDiagnostics || null,
          qualityMetrics,
          ...this._buildPipelineMetadata(),
        }),
        this.nowIso(),
        recordingId,
      ]
    );
    return this.getMediaAsset(recordingId);
  }
  async queueTranscription(recordingId, updates = {}) {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset) throw new Error('Nie znaleziono nagrania.');
    const existingDiarization = this._safeJsonParse(asset.diarization_json, {});
    const preservedDiarization = {
      ...(existingDiarization?.audioQuality && typeof existingDiarization.audioQuality === 'object'
        ? { audioQuality: existingDiarization.audioQuality }
        : {}),
      ...(existingDiarization?.qualityMetrics &&
      typeof existingDiarization.qualityMetrics === 'object'
        ? { qualityMetrics: this._normalizeQualityMetrics(existingDiarization.qualityMetrics) }
        : {}),
    };
    await this._execute(
      "UPDATE media_assets SET workspace_id = ?, meeting_id = ?, content_type = ?, transcription_status = 'queued', transcript_json = '[]', diarization_json = ?, updated_at = ? WHERE id = ?",
      [
        this._clean(updates.workspaceId) || asset.workspace_id,
        this._clean(updates.meetingId) || asset.meeting_id,
        this._clean(updates.contentType) || asset.content_type,
        JSON.stringify(preservedDiarization),
        this.nowIso(),
        recordingId,
      ]
    );
    return {
      diarization: { segments: [], speakerNames: {}, speakerCount: 0, confidence: 0 },
      segments: [],
      speakerNames: {},
      speakerCount: 0,
      confidence: 0,
      pipelineStatus: 'queued',
    };
  }
  async updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole) {
    const nextRole = ['owner', 'admin', 'member', 'viewer'].includes(memberRole)
      ? memberRole
      : 'member';
    await this._execute(
      'UPDATE workspace_members SET member_role = ? WHERE workspace_id = ? AND user_id = ?',
      [nextRole, workspaceId, targetUserId]
    );
    return this.getMembership(workspaceId, targetUserId);
  }
  async saveVoiceProfile({ id, userId, workspaceId, speakerName, audioPath, embedding }) {
    const timestamp = this.nowIso();
    await this._execute(
      'INSERT INTO voice_profiles (id, user_id, workspace_id, speaker_name, audio_path, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, workspaceId, speakerName, audioPath, JSON.stringify(embedding || []), timestamp]
    );
    return this._get('SELECT * FROM voice_profiles WHERE id = ?', [id]);
  }
  async upsertVoiceProfile({ id, userId, workspaceId, speakerName, audioPath, embedding }) {
    const MAX_SAMPLES = 5;
    const existing = await this._get(
      'SELECT * FROM voice_profiles WHERE workspace_id = ? AND LOWER(speaker_name) = LOWER(?)',
      [workspaceId, speakerName.trim()]
    );
    if (existing) {
      const existingCount = existing.sample_count || 1;
      if (existingCount < MAX_SAMPLES) {
        const { addToAverageEmbedding: addToAverageEmbedding2 } = await Promise.resolve().then(
          () => (init_speakerEmbedder(), speakerEmbedder_exports)
        );
        let existingEmb = [];
        try {
          existingEmb = JSON.parse(existing.embedding_json || '[]');
        } catch (error) {
          logger.warn(
            `[database] Failed to parse embedding JSON for profile ${existing.id}:`,
            error.message
          );
        }
        const averaged = embedding?.length
          ? addToAverageEmbedding2(existingEmb, existingCount, embedding)
          : existingEmb;
        await this._execute(
          'UPDATE voice_profiles SET embedding_json = ?, sample_count = ?, audio_path = ? WHERE id = ?',
          [JSON.stringify(averaged), existingCount + 1, audioPath, existing.id]
        );
      }
      return {
        ...(await this._get('SELECT * FROM voice_profiles WHERE id = ?', [existing.id])),
        isUpdate: true,
      };
    }
    const timestamp = this.nowIso();
    await this._execute(
      'INSERT INTO voice_profiles (id, user_id, workspace_id, speaker_name, audio_path, embedding_json, sample_count, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      [
        id,
        userId,
        workspaceId,
        speakerName.trim(),
        audioPath,
        JSON.stringify(embedding || []),
        timestamp,
      ]
    );
    return this._get('SELECT * FROM voice_profiles WHERE id = ?', [id]);
  }
  async updateVoiceProfileThreshold(id, workspaceId, threshold) {
    const clamped = Math.max(0.5, Math.min(0.99, threshold));
    await this._execute(
      'UPDATE voice_profiles SET threshold = ? WHERE id = ? AND workspace_id = ?',
      [clamped, id, workspaceId]
    );
    return this._get('SELECT * FROM voice_profiles WHERE id = ?', [id]);
  }
  async getWorkspaceVoiceProfiles(workspaceId) {
    return this._query(
      'SELECT * FROM voice_profiles WHERE workspace_id = ? ORDER BY created_at DESC',
      [workspaceId]
    );
  }
  async deleteVoiceProfile(id, workspaceId) {
    const row = await this._get('SELECT * FROM voice_profiles WHERE id = ? AND workspace_id = ?', [
      id,
      workspaceId,
    ]);
    if (row && row.audio_path) {
      try {
        fs3.unlinkSync(row.audio_path);
      } catch (error) {
        logger.warn(
          `[database] Failed to delete voice profile audio ${row.audio_path}:`,
          error.message
        );
      }
    }
    await this._execute('DELETE FROM voice_profiles WHERE id = ? AND workspace_id = ?', [
      id,
      workspaceId,
    ]);
  }
  async getHealth() {
    return { ok: true };
  }
  async updateMeetingTasks(draft) {}
  // --- RAG (Retrieval-Augmented Generation) ---
  async saveRagChunk(chunk) {
    await this._execute(
      `INSERT INTO rag_chunks (id, workspace_id, recording_id, speaker_name, text, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        chunk.id,
        chunk.workspaceId,
        chunk.recordingId,
        chunk.speakerName,
        chunk.text,
        JSON.stringify(chunk.embedding),
        chunk.createdAt,
      ]
    );
  }
  async saveRagChunks(chunks) {
    if (!Array.isArray(chunks) || !chunks.length) return;
    await this._execute('BEGIN');
    try {
      for (const chunk of chunks) {
        await this.saveRagChunk(chunk);
      }
      await this._execute('COMMIT');
    } catch (error) {
      await this._execute('ROLLBACK');
      throw error;
    }
  }
  async getAllRagChunksForWorkspace(workspaceId) {
    return this._query(`SELECT * FROM rag_chunks WHERE workspace_id = ?`, [String(workspaceId)]);
  }
};
var defaultInstance = null;
function initDatabase(dbConfig) {
  defaultInstance = new Database(dbConfig);
  return defaultInstance;
}
function getDatabase() {
  if (!defaultInstance) {
    const DATA_DIR = path3.resolve(__dirname2, 'data');
    const DB_PATH = config.VOICELOG_DB_PATH
      ? path3.resolve(config.VOICELOG_DB_PATH)
      : path3.join(DATA_DIR, 'voicelog.sqlite');
    const UPLOAD_DIR = config.VOICELOG_UPLOAD_DIR
      ? path3.resolve(config.VOICELOG_UPLOAD_DIR)
      : path3.join(DATA_DIR, 'uploads');
    const SESSION_TTL_HOURS = Math.max(1, config.VOICELOG_SESSION_TTL_HOURS || 24 * 30);
    const IS_TEST = process.env.NODE_ENV === 'test' || config.NODE_ENV === 'test';
    const CONNECTION_STRING = !IS_TEST ? config.VOICELOG_DATABASE_URL || config.DATABASE_URL : null;
    return initDatabase({
      type: CONNECTION_STRING ? 'postgres' : 'sqlite',
      dbPath: IS_TEST ? ':memory:' : DB_PATH,
      uploadDir: UPLOAD_DIR,
      sessionTtlHours: SESSION_TTL_HOURS,
      connectionString: CONNECTION_STRING,
    });
  }
  return defaultInstance;
}

// server/lib/serverUtils.ts
var RATE_LIMIT_WINDOW_MS = 60 * 1e3;
var rateLimitMap = /* @__PURE__ */ new Map();
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  },
  5 * 60 * 1e3
).unref();
function checkRateLimit(ip, route, max) {
  const defaultLimits = {
    auth: 5,
    login: 5,
    register: 5,
    reset: 3,
    upload: 10,
    media: 10,
    transcribe: 5,
    stt: 5,
    analyze: 5,
    ai: 10,
  };
  const limit = max ?? defaultLimits[route] ?? 30;
  const key = `${ip}:${route}`;
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1e3);
    const error = new Error(
      `Zbyt wiele prob. Limit: ${limit} \u017C\u0105da\u0144/min. Sprobuj ponownie za ${retryAfter}s.`
    );
    error.statusCode = 429;
    error.retryAfter = retryAfter;
    error.headers = {
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': entry.resetAt.toString(),
    };
    throw error;
  }
  return {
    limit,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}
function corsHeaders(requestOrigin, allowedOrigins = 'http://localhost:3000') {
  const allowed = allowedOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAny = allowed.includes('*');
  const src = String(requestOrigin || '');
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(src);
  const isVercel = /^https:\/\/[a-z0-9.-]+\.vercel\.app$/i.test(src);
  const origin = isLocalhost || isVercel || allowAny || allowed.includes(src) ? src : allowed[0];
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Workspace-Id, X-Meeting-Id, X-Speaker-Name',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  };
}
function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

// server/routes/middleware.ts
function createMiddlewares(services) {
  const { authService, workspaceService, config: config2 } = services;
  const applyRateLimit =
    (route, max = 10) =>
    async (c, next) => {
      let socketIp = 'unknown';
      try {
        const conn = getConnInfo(c);
        socketIp = conn?.remote?.address || 'unknown';
      } catch (_) {}
      const clientIp = config2.trustProxy
        ? c.req.header('x-forwarded-for')?.split(',')[0].trim() || socketIp
        : socketIp;
      checkRateLimit(clientIp, route, max);
      await next();
    };
  const authMiddleware = async (c, next) => {
    if (c.req.method === 'OPTIONS') {
      await next();
      return;
    }
    const authHeader = c.req.header('Authorization') || '';
    const queryToken = String(c.req.query?.('token') || '').trim();
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = bearerToken || queryToken;
    if (!token) {
      return c.json({ message: 'Brak tokenu autoryzacyjnego.' }, 401);
    }
    const session = await authService.getSession(token);
    if (!session) {
      return c.json({ message: 'Sesja wygasla lub jest nieprawidlowa.' }, 401);
    }
    c.set('session', session);
    await next();
  };
  const ensureWorkspaceAccess = async (c, workspaceId) => {
    const session = c.get('session');
    const membership = await workspaceService.getMembership(workspaceId, session.user_id);
    if (!membership) {
      const err = new Error('Nie masz dostepu do tego workspace.');
      err.statusCode = 403;
      throw err;
    }
    return membership;
  };
  return { applyRateLimit, authMiddleware, ensureWorkspaceAccess };
}

// server/http/app-security.ts
init_logger();
function buildCorsHeaders(origin, allowedOrigins) {
  return corsHeaders(origin || '', allowedOrigins);
}
function applyAppCors(app, _allowedOrigins) {
  app.use('*', async (c, next) => {
    const requestOrigin = c.req.header('origin') || '';
    const cors = buildCorsHeaders(requestOrigin, _allowedOrigins);
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': cors['Access-Control-Allow-Origin'],
          'Access-Control-Allow-Headers': cors['Access-Control-Allow-Headers'],
          'Access-Control-Allow-Methods': cors['Access-Control-Allow-Methods'],
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
          Vary: cors['Vary'],
        },
      });
    }
    await next();
    c.header('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin']);
    c.header('Access-Control-Allow-Headers', cors['Access-Control-Allow-Headers']);
    c.header('Access-Control-Allow-Methods', cors['Access-Control-Allow-Methods']);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', cors['Vary']);
  });
}
function applyRequestMetadata(app) {
  app.use('*', async (c, next) => {
    const reqId = crypto3.randomUUID();
    c.set('reqId', reqId);
    const start = performance.now();
    await next();
    c.res.headers.set('X-Request-Id', reqId);
    const durationMs = performance.now() - start;
    logger.info(
      `[REQ] ${c.req.method} ${c.req.path} - ${c.res.status} [${durationMs.toFixed(1)}ms]`,
      {
        requestId: reqId,
        method: c.req.method,
        route: c.req.path,
        status: c.res.status,
        durationMs: durationMs.toFixed(2),
      }
    );
  });
}
function applySecurityHeaders(app) {
  app.use('*', async (c, next) => {
    const headers = securityHeaders();
    c.header('Content-Security-Policy', headers['Content-Security-Policy']);
    c.header('X-Content-Type-Options', headers['X-Content-Type-Options']);
    c.header('X-Frame-Options', headers['X-Frame-Options']);
    await next();
  });
}
function registerNotFoundHandler(app) {
  app.notFound((c) => {
    const requestOrigin = c.req.header('origin');
    if (requestOrigin) {
      c.header('Access-Control-Allow-Origin', requestOrigin);
      c.header('Access-Control-Allow-Credentials', 'true');
    }
    return c.json({ message: 'Not found.' }, 404);
  });
}
function registerAppErrorHandler(app) {
  app.onError((err, c) => {
    console.error('APP ERROR STACK', err.stack);
    const requestOrigin = c.req.header('origin');
    if (requestOrigin) {
      c.header('Access-Control-Allow-Origin', requestOrigin);
      c.header('Access-Control-Allow-Credentials', 'true');
    }
    if (err.name === 'ContextError' || err instanceof z2.ZodError || err?.statusCode === 422) {
      return c.json({ message: 'Invalid payload.', errors: err?.errors || err.message }, 422);
    }
    const statusCode = err?.statusCode || err?.status || 500;
    if (statusCode === 429 && err?.retryAfter) {
      c.header('Retry-After', String(err.retryAfter));
    }
    return c.json({ message: err.message || 'Unexpected server error.' }, statusCode);
  });
}
function createAuthRoutes(services, middlewares) {
  const router = new Hono();
  const { authService } = services;
  const { applyRateLimit, authMiddleware, ensureWorkspaceAccess } = middlewares;
  const allowedOrigins = services.config?.allowedOrigins || 'http://localhost:3000';
  router.use('*', async (c, next) => {
    if (c.req.method !== 'OPTIONS') {
      await next();
      return;
    }
    const requestOrigin = c.req.header('origin') || '';
    const headers = corsHeaders(requestOrigin, allowedOrigins);
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'],
        'Access-Control-Allow-Headers': headers['Access-Control-Allow-Headers'],
        'Access-Control-Allow-Methods': headers['Access-Control-Allow-Methods'],
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
        Vary: headers['Vary'],
      },
    });
  });
  const registerSchema = z3.object({
    email: z3.string().email(),
    password: z3.string().min(6),
    name: z3.string().min(1),
    workspaceName: z3.string().optional(),
    workspaceMode: z3.string().optional(),
    workspaceCode: z3.string().optional(),
  });
  router.post(
    '/register',
    applyRateLimit('auth'),
    zValidator('json', registerSchema),
    async (c) => {
      const data = c.req.valid('json');
      const result = await authService.registerUser(data);
      return c.json(result, 201);
    }
  );
  const loginSchema = z3.object({
    email: z3.string().email(),
    password: z3.string().min(1),
    workspaceId: z3.string().optional(),
  });
  router.post(
    '/login',
    applyRateLimit('auth-login', 20),
    zValidator('json', loginSchema),
    async (c) => {
      const data = c.req.valid('json');
      const result = await authService.loginUser(data);
      return c.json(result, 200);
    }
  );
  const resetReqSchema = z3.object({ email: z3.string().email() });
  router.post(
    '/password/reset/request',
    applyRateLimit('auth'),
    zValidator('json', resetReqSchema),
    async (c) => {
      const data = c.req.valid('json');
      const result = await authService.requestPasswordReset(data);
      return c.json(result, 200);
    }
  );
  const resetConfirmSchema = z3.object({
    email: z3.string().email(),
    code: z3.string().min(1),
    newPassword: z3.string().min(6),
    confirmPassword: z3.string().min(6),
  });
  router.post(
    '/password/reset/confirm',
    applyRateLimit('auth'),
    zValidator('json', resetConfirmSchema),
    async (c) => {
      const data = c.req.valid('json');
      const result = await authService.resetPasswordWithCode(data);
      return c.json(result, 200);
    }
  );
  const googleSchema = z3.object({
    email: z3.string().email(),
    sub: z3.string(),
    name: z3.string().optional(),
    given_name: z3.string().optional(),
    picture: z3.string().optional(),
  });
  router.post('/google', applyRateLimit('auth'), zValidator('json', googleSchema), async (c) => {
    const data = c.req.valid('json');
    const result = await authService.upsertGoogleUser(data);
    return c.json(result, 200);
  });
  router.get('/session', authMiddleware, async (c) => {
    const session = c.get('session');
    const workspaceId = c.req.query('workspaceId') || session.workspace_id;
    await ensureWorkspaceAccess(c, workspaceId);
    return c.json(await authService.buildSessionPayload(session.user_id, workspaceId), 200);
  });
  return router;
}
function isoDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}
function isCompletedTask(task) {
  const status = String(task?.status || '').toLowerCase();
  return status === 'done' || status === 'completed' || status === 'closed';
}
function buildWorkspaceDigest(state, workspaceName = '') {
  const today = isoDateOnly(/* @__PURE__ */ new Date());
  const nowTime = Date.now();
  const upcomingLimit = nowTime + 7 * 24 * 60 * 60 * 1e3;
  const tasks = Array.isArray(state?.manualTasks) ? state.manualTasks : [];
  const meetings = Array.isArray(state?.meetings) ? state.meetings : [];
  const overdueTasks = tasks
    .filter(
      (task) =>
        !isCompletedTask(task) &&
        task.dueDate &&
        isoDateOnly(task.dueDate) &&
        isoDateOnly(task.dueDate) < today
    )
    .sort((left, right) => String(left.dueDate || '').localeCompare(String(right.dueDate || '')))
    .slice(0, 5);
  const todayTasks = tasks
    .filter((task) => !isCompletedTask(task) && isoDateOnly(task.dueDate) === today)
    .slice(0, 5);
  const upcomingMeetings = meetings
    .filter((meeting) => {
      const startsAt = new Date(meeting.startsAt || '').getTime();
      return Number.isFinite(startsAt) && startsAt >= nowTime && startsAt <= upcomingLimit;
    })
    .sort((left, right) => String(left.startsAt || '').localeCompare(String(right.startsAt || '')))
    .slice(0, 5);
  return {
    workspaceName,
    overdueTasks,
    todayTasks,
    upcomingMeetings,
    hasContent: overdueTasks.length > 0 || todayTasks.length > 0 || upcomingMeetings.length > 0,
  };
}
function renderDigestText(userName, digests) {
  const lines = [`Czesc ${userName || '!'}`, '', 'Oto Twoj dzienny digest:'];
  digests.forEach((digest) => {
    lines.push('');
    lines.push(digest.workspaceName ? `Workspace: ${digest.workspaceName}` : 'Workspace');
    lines.push(`- Zalegle zadania: ${digest.overdueTasks.length}`);
    digest.overdueTasks.forEach((task) =>
      lines.push(`  - ${task.title}${task.dueDate ? ` (${task.dueDate})` : ''}`)
    );
    lines.push(`- Zadania na dzis: ${digest.todayTasks.length}`);
    digest.todayTasks.forEach((task) => lines.push(`  - ${task.title}`));
    lines.push(`- Nadchodzace spotkania: ${digest.upcomingMeetings.length}`);
    digest.upcomingMeetings.forEach((meeting) =>
      lines.push(`  - ${meeting.title}${meeting.startsAt ? ` (${meeting.startsAt})` : ''}`)
    );
  });
  return lines.join('\n');
}
function renderDigestHtml(userName, digests) {
  const sections = digests
    .map(
      (digest) => `
      <section style="margin: 0 0 20px;">
        <h3 style="margin: 0 0 8px;">${digest.workspaceName || 'Workspace'}</h3>
        <p><strong>Zalegle zadania:</strong> ${digest.overdueTasks.length}</p>
        <ul>${digest.overdueTasks.map((task) => `<li>${task.title}${task.dueDate ? ` <small>${task.dueDate}</small>` : ''}</li>`).join('')}</ul>
        <p><strong>Zadania na dzis:</strong> ${digest.todayTasks.length}</p>
        <ul>${digest.todayTasks.map((task) => `<li>${task.title}</li>`).join('')}</ul>
        <p><strong>Nadchodzace spotkania:</strong> ${digest.upcomingMeetings.length}</p>
        <ul>${digest.upcomingMeetings.map((meeting) => `<li>${meeting.title}${meeting.startsAt ? ` <small>${meeting.startsAt}</small>` : ''}</li>`).join('')}</ul>
      </section>
    `
    )
    .join('');
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 16px;">Dzienny digest${userName ? ` dla ${userName}` : ''}</h2>
      ${sections || '<p>Brak nowych zadan i spotkan.</p>'}
    </div>
  `;
}
async function buildMailer() {
  const host = String(process.env.VOICELOG_SMTP_HOST || '').trim();
  const user = String(process.env.VOICELOG_SMTP_USER || '').trim();
  const pass = String(process.env.VOICELOG_SMTP_PASS || '').trim();
  if (!host || !user || !pass) {
    return null;
  }
  const { createTransport } = await import('nodemailer');
  return createTransport({
    host,
    port: Number(process.env.VOICELOG_SMTP_PORT || 587),
    secure: String(process.env.VOICELOG_SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
}
function createDigestRoutes(services, middlewares) {
  const router = new Hono2();
  const { applyRateLimit } = middlewares;
  const workspaceService = services.workspaceService;
  const db = workspaceService?.db;
  router.get('/daily', applyRateLimit('digest-daily', 5), async (c) => {
    if (!db) {
      return c.json({ mode: 'no-db', sent: 0, skipped: 0, digests: [] }, 200);
    }
    const users = await db._query('SELECT * FROM users', []);
    const mailer = await buildMailer();
    const fromAddress = String(
      process.env.VOICELOG_SMTP_FROM || process.env.VOICELOG_SMTP_USER || 'no-reply@voicelog.local'
    ).trim();
    const previews = [];
    let sent = 0;
    let skipped = 0;
    for (const row of users || []) {
      const profile = (() => {
        try {
          return JSON.parse(String(row.profile_json || '{}'));
        } catch (_) {
          return {};
        }
      })();
      if (!Boolean(profile.notifyDailyDigest ?? true)) {
        skipped += 1;
        continue;
      }
      const accessibleWorkspaces = await db.accessibleWorkspaces(row.id);
      const digests = [];
      for (const workspace of accessibleWorkspaces || []) {
        const state = await workspaceService.getWorkspaceState(workspace.id);
        const digest = buildWorkspaceDigest(state, workspace.name);
        if (digest.hasContent) {
          digests.push(digest);
        }
      }
      if (!digests.length) {
        skipped += 1;
        continue;
      }
      const subject = `Dzienny digest - ${/* @__PURE__ */ new Date().toLocaleDateString('pl-PL')}`;
      const text = renderDigestText(row.name || row.email || 'Uzytkownik', digests);
      const html = renderDigestHtml(row.name || row.email || 'Uzytkownik', digests);
      previews.push({ userId: row.id, email: row.email, subject, digestCount: digests.length });
      if (!mailer) {
        skipped += 1;
        continue;
      }
      await mailer.sendMail({
        from: fromAddress,
        to: row.email,
        subject,
        text,
        html,
      });
      sent += 1;
    }
    return c.json(
      {
        mode: mailer ? 'smtp' : 'preview',
        sent,
        skipped,
        digests: previews,
      },
      200
    );
  });
  return router;
}

// src/shared/contracts.ts
function normalizeWorkspaceState(input = {}) {
  const payload = {
    meetings: Array.isArray(input.meetings) ? input.meetings : [],
    manualTasks: Array.isArray(input.manualTasks) ? input.manualTasks : [],
    taskState: input.taskState && typeof input.taskState === 'object' ? input.taskState : {},
    taskBoards: input.taskBoards && typeof input.taskBoards === 'object' ? input.taskBoards : {},
    calendarMeta:
      input.calendarMeta && typeof input.calendarMeta === 'object' ? input.calendarMeta : {},
    vocabulary: Array.isArray(input.vocabulary) ? input.vocabulary : [],
    updatedAt: String(input.updatedAt || ''),
  };
  return payload;
}
function applyCollectionDelta(previous = [], delta) {
  if (!delta) {
    return previous;
  }
  if (Array.isArray(delta)) {
    return delta;
  }
  const current = [...previous];
  const byId = /* @__PURE__ */ new Map();
  current.forEach((item, index) => {
    const id = String(item?.id || '');
    if (id) {
      byId.set(id, index);
    }
  });
  const removeIds = Array.isArray(delta.removeIds) ? delta.removeIds : [];
  if (removeIds.length) {
    const removeSet = new Set(removeIds.map((id) => String(id)));
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const id = String(current[i]?.id || '');
      if (id && removeSet.has(id)) {
        current.splice(i, 1);
      }
    }
  }
  (Array.isArray(delta.upsert) ? delta.upsert : []).forEach((item) => {
    const id = String(item?.id || '');
    if (!id) {
      current.push(item);
      return;
    }
    const existingIndex = byId.get(id);
    if (existingIndex === void 0) {
      byId.set(id, current.length);
      current.push(item);
      return;
    }
    current[existingIndex] = item;
  });
  return current;
}
function applyObjectDelta(previous = {}, delta) {
  if (!delta) {
    return previous;
  }
  const next = { ...previous };
  Object.entries(delta).forEach(([key, value]) => {
    if (value === null) {
      delete next[key];
      return;
    }
    next[key] = value;
  });
  return next;
}
function applyWorkspaceStateDelta(previous = {}, delta = {}) {
  const current = normalizeWorkspaceState(previous);
  return normalizeWorkspaceState({
    meetings: applyCollectionDelta(current.meetings, delta.meetings),
    manualTasks: applyCollectionDelta(current.manualTasks, delta.manualTasks),
    taskState: applyObjectDelta(current.taskState, delta.taskState),
    taskBoards: applyObjectDelta(current.taskBoards, delta.taskBoards),
    calendarMeta: applyObjectDelta(current.calendarMeta, delta.calendarMeta),
    vocabulary: Array.isArray(delta.vocabulary) ? delta.vocabulary : current.vocabulary,
    updatedAt: current.updatedAt,
  });
}
function normalizePipelineStatus(value) {
  if (value === 'completed') return 'done';
  if (
    value === 'uploading' ||
    value === 'queued' ||
    value === 'processing' ||
    value === 'diarization' ||
    value === 'review' ||
    value === 'failed' ||
    value === 'done'
  ) {
    return value;
  }
  return 'queued';
}
function normalizeTranscriptionStatusPayload(asset) {
  let diarization = {};
  let segments = [];
  try {
    diarization = JSON.parse(String(asset?.diarization_json || '{}'));
  } catch (_) {}
  try {
    segments = JSON.parse(String(asset?.transcript_json || '[]'));
  } catch (_) {}
  return {
    recordingId: String(asset?.id || ''),
    pipelineStatus: normalizePipelineStatus(String(asset?.transcription_status || '')),
    enhancementsPending: Boolean(diarization?.enhancementsPending),
    postprocessStage: String(diarization?.postprocessStage || ''),
    transcriptOutcome: diarization?.transcriptOutcome || 'normal',
    emptyReason: diarization?.emptyReason || '',
    userMessage: diarization?.userMessage || '',
    pipelineVersion: diarization?.pipelineVersion || '',
    pipelineGitSha: diarization?.pipelineGitSha || '',
    pipelineBuildTime: diarization?.pipelineBuildTime || '',
    audioQuality:
      diarization?.audioQuality && typeof diarization.audioQuality === 'object'
        ? diarization.audioQuality
        : null,
    transcriptionDiagnostics:
      diarization?.transcriptionDiagnostics &&
      typeof diarization.transcriptionDiagnostics === 'object'
        ? diarization.transcriptionDiagnostics
        : null,
    qualityMetrics:
      diarization?.qualityMetrics && typeof diarization.qualityMetrics === 'object'
        ? diarization.qualityMetrics
        : null,
    segments: Array.isArray(segments) ? segments : [],
    diarization: diarization && typeof diarization === 'object' ? diarization : {},
    speakerNames: diarization?.speakerNames || {},
    speakerCount: diarization?.speakerCount || 0,
    confidence: diarization?.confidence || 0,
    reviewSummary: diarization?.reviewSummary || null,
    errorMessage: diarization?.errorMessage || '',
    updatedAt: String(asset?.updated_at || ''),
  };
}
function getOpenAiKey(config2) {
  return String(config2?.VOICELOG_OPENAI_API_KEY || config2?.OPENAI_API_KEY || '').trim();
}
function getOpenAiBaseUrl(config2) {
  return String(
    config2?.VOICELOG_OPENAI_BASE_URL || config2?.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  ).replace(/\/$/, '');
}
function toMessageText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String(part.text || '');
        return '';
      })
      .join('');
  }
  return String(content || '');
}
function buildRagContext(chunks) {
  return (Array.isArray(chunks) ? chunks : [])
    .map(
      (chunk) =>
        `[Spotkanie: ${chunk.recording_id || 'unknown'}] ${chunk.speaker_name || 'Nieznany'}: ${chunk.text || ''}`
    )
    .join('\n');
}
async function generateRagAnswer({ question, chunks, config: config2, workspaceId = '' }) {
  const apiKey = getOpenAiKey(config2);
  if (!apiKey) {
    throw new Error('Brak klucza API do RAG LLMa.');
  }
  const contextStr = buildRagContext(chunks);
  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    apiKey,
    configuration: {
      baseURL: getOpenAiBaseUrl(config2),
    },
  });
  const response = await model.invoke(
    [
      new SystemMessage(
        'Jestes asystentem wiedzy bazy RAG. Udziel krotkiej, konkretnej odpowiedzi bazujac WYLACZNIE na ponizszym archiwalnym kontekscie ze spotkan klienta. Jezeli pytanie wykracza poza kontekst, powiedz, ze nie wiesz.'
      ),
      new HumanMessage(`Kontekst ze spotkan:
${contextStr}

Pytanie uzytkownika: ${question}`),
    ],
    {
      tags: ['rag', 'answer'],
      metadata: {
        workspaceId,
        chunkCount: Array.isArray(chunks) ? chunks.length : 0,
      },
    }
  );
  return toMessageText(response.content).trim() || 'Blad RAG.';
}

// server/routes/workspaces.ts
function createWorkspacesRoutes(services, middlewares) {
  const router = new Hono3();
  const { authService, workspaceService, transcriptionService, config: config2 } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;
  router.use('/users/*', authMiddleware);
  router.put('/users/:userId/profile', async (c) => {
    const session = c.get('session');
    const userId = c.req.param('userId');
    if (session.user_id !== userId)
      return c.json({ message: 'Mozesz edytowac tylko swoj profil.' }, 403);
    const workspaceId = c.req.query('workspaceId') || session.workspace_id;
    const body = await c.req.json().catch(() => ({}));
    const user = await authService.updateUserProfile(userId, body);
    const payload = await authService.buildSessionPayload(session.user_id, workspaceId);
    return c.json({ user, users: payload.users }, 200);
  });
  router.post('/users/:userId/password', async (c) => {
    const session = c.get('session');
    const userId = c.req.param('userId');
    if (session.user_id !== userId)
      return c.json({ message: 'Mozesz zmienic tylko swoje haslo.' }, 403);
    const body = await c.req.json().catch(() => ({}));
    return c.json(await authService.changeUserPassword(userId, body), 200);
  });
  router.use('/state/*', authMiddleware);
  router.get('/state/bootstrap', async (c) => {
    const session = c.get('session');
    const workspaceId = c.req.query('workspaceId') || session.workspace_id;
    await ensureWorkspaceAccess(c, workspaceId);
    return c.json(await authService.buildSessionPayload(session.user_id, workspaceId), 200);
  });
  router.put('/state/workspaces/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    await ensureWorkspaceAccess(c, workspaceId);
    const body = await c.req.json().catch(() => ({}));
    return c.json(
      {
        workspaceId,
        state: await workspaceService.saveWorkspaceState(workspaceId, body),
      },
      200
    );
  });
  router.patch('/state/workspaces/:workspaceId', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    await ensureWorkspaceAccess(c, workspaceId);
    const delta = await c.req.json().catch(() => ({}));
    const currentState = normalizeWorkspaceState(
      await workspaceService.getWorkspaceState(workspaceId)
    );
    const mergedState = applyWorkspaceStateDelta(currentState, delta);
    return c.json(
      {
        workspaceId,
        state: await workspaceService.saveWorkspaceState(workspaceId, mergedState),
      },
      200
    );
  });
  router.use('/workspaces/*', authMiddleware);
  router.put('/workspaces/:workspaceId/members/:targetUserId/role', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    const targetUserId = c.req.param('targetUserId');
    const membership = await ensureWorkspaceAccess(c, workspaceId);
    if (!['owner', 'admin'].includes(membership.member_role)) {
      return c.json({ message: 'Tylko owner lub admin moze zmieniac role.' }, 403);
    }
    const body = await c.req.json().catch(() => ({}));
    return c.json(
      await workspaceService.updateWorkspaceMemberRole(workspaceId, targetUserId, body.memberRole),
      200
    );
  });
  router.post('/workspaces/:workspaceId/rag/ask', async (c) => {
    const workspaceId = c.req.param('workspaceId');
    await ensureWorkspaceAccess(c, workspaceId);
    const body = await c.req.json().catch(() => ({}));
    const question = String(body.question || '').trim();
    if (!question) return c.json({ answer: 'Zadaj konkretne pytanie.' }, 400);
    const topChunks = await transcriptionService.queryRAG(workspaceId, question);
    if (!topChunks || topChunks.length === 0) {
      return c.json({ answer: 'Brak danych z archiwalnych spotkan na ten temat.' }, 200);
    }
    try {
      const answer = await generateRagAnswer({
        question,
        chunks: topChunks,
        config: config2,
        workspaceId,
      });
      return c.json({ answer });
    } catch (err) {
      return c.json({ answer: `Blad LLM: ${err.message}` }, 500);
    }
  });
  router.use('/voice-profiles', authMiddleware);
  router.use('/voice-profiles/*', authMiddleware);
  router.get('/voice-profiles', async (c) => {
    const session = c.get('session');
    const profiles = (await workspaceService.getWorkspaceVoiceProfiles(session.workspace_id)).map(
      (p) => ({
        id: p.id,
        speakerName: p.speaker_name,
        userId: p.user_id,
        createdAt: p.created_at,
        sampleCount: p.sample_count || 1,
        threshold: typeof p.threshold === 'number' ? p.threshold : 0.82,
      })
    );
    const payload = { profiles };
    return c.json(payload, 200);
  });
  router.post('/voice-profiles', applyRateLimit('voice-profiles'), async (c) => {
    const session = c.get('session');
    const speakerName = String(c.req.header('X-Speaker-Name') || '').slice(0, 120);
    if (!speakerName.trim()) return c.json({ message: 'Brakuje naglowka X-Speaker-Name.' }, 400);
    const bufferArray = await c.req.arrayBuffer();
    if (bufferArray.byteLength > 1 * 1024 * 1024)
      return c.json({ message: 'Plik audio przekracza maksymalny rozmiar limitu 1MB.' }, 413);
    const buffer = Buffer.from(bufferArray);
    if (!buffer || buffer.byteLength < 1e3)
      return c.json({ message: 'Plik audio jest za krotki.' }, 400);
    const contentType = c.req.header('content-type') || 'audio/webm';
    const profileId = `vp_${crypto4.randomUUID().replace(/-/g, '')}`;
    const ext = contentType.includes('mp4')
      ? '.m4a'
      : contentType.includes('wav')
        ? '.wav'
        : '.webm';
    const audioPath = path4.join(config2.uploadDir, `${profileId}${ext}`);
    fs4.writeFileSync(audioPath, buffer);
    const embedding = await transcriptionService.computeEmbedding(audioPath);
    const profile = await workspaceService.upsertVoiceProfile({
      id: profileId,
      userId: session.user_id,
      workspaceId: session.workspace_id,
      speakerName: speakerName.trim(),
      audioPath,
      embedding: embedding || [],
    });
    const sampleCount = profile.sample_count || 1;
    const status = sampleCount > 1 ? 200 : 201;
    return c.json(
      {
        id: profile.id,
        speakerName: profile.speaker_name,
        hasEmbedding: (embedding || []).length > 0,
        createdAt: profile.created_at,
        sampleCount,
        threshold: typeof profile.threshold === 'number' ? profile.threshold : 0.82,
        isUpdate: Boolean(profile.isUpdate),
      },
      status
    );
  });
  router.patch('/voice-profiles/:id/threshold', async (c) => {
    const session = c.get('session');
    const body = await c.req.json().catch(() => ({}));
    const threshold = Number(body.threshold);
    if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 0.99) {
      return c.json({ message: 'threshold musi byc liczba w zakresie 0.50-0.99.' }, 400);
    }
    const updated = await workspaceService.updateVoiceProfileThreshold(
      c.req.param('id'),
      session.workspace_id,
      threshold
    );
    if (!updated) return c.json({ message: 'Profil nie znaleziony.' }, 404);
    return c.json({ id: updated.id, threshold: updated.threshold }, 200);
  });
  router.delete('/voice-profiles/:id', async (c) => {
    const session = c.get('session');
    await workspaceService.deleteVoiceProfile(c.req.param('id'), session.workspace_id);
    return new Response(null, { status: 204 });
  });
  return router;
}
function checkDiskSpace(uploadDir, minBytes = 100 * 1024 * 1024) {
  try {
    const fs11 = __require('node:fs');
    const stats = fs11.statfsSync ? fs11.statfsSync(uploadDir) : null;
    if (stats) {
      const freeBytes = stats.bavail * stats.bsize;
      return { ok: freeBytes >= minBytes, freeBytes };
    }
    return { ok: true };
  } catch (error) {
    console.warn('[checkDiskSpace] Unable to check disk space:', error);
    return { ok: true };
  }
}
async function cleanupOldChunks(uploadDir, maxAgeHours = 24) {
  const chunksDir = path5.join(uploadDir, 'chunks');
  if (!existsSync(chunksDir)) {
    return { deleted: 0, bytesFreed: 0 };
  }
  const now = Date.now();
  const maxAge = maxAgeHours * 60 * 60 * 1e3;
  let deleted = 0;
  let bytesFreed = 0;
  try {
    const files = __require('node:fs').readdirSync(chunksDir);
    for (const file of files) {
      if (!file.endsWith('.chunk')) continue;
      const filePath = path5.join(chunksDir, file);
      const stats = statSync(filePath);
      const age = now - stats.mtimeMs;
      if (age > maxAge) {
        bytesFreed += stats.size;
        await unlink(filePath);
        deleted++;
      }
    }
    if (deleted > 0) {
      const { logger: logger2 } = await Promise.resolve().then(
        () => (init_logger(), logger_exports)
      );
      logger2.info(`[Cleanup] Deleted ${deleted} old chunk files, freed ${bytesFreed} bytes`);
    }
  } catch (error) {
    console.warn('[cleanupOldChunks] Error:', error);
  }
  return { deleted, bytesFreed };
}
function createMediaRoutes(services, middlewares) {
  const router = new Hono4();
  const { transcriptionService, config: config2 } = services;
  const { authMiddleware, applyRateLimit, ensureWorkspaceAccess } = middlewares;
  const startTranscriptionPipeline =
    typeof transcriptionService.startTranscriptionPipeline === 'function'
      ? transcriptionService.startTranscriptionPipeline.bind(transcriptionService)
      : async (recordingId, asset, options) => {
          await transcriptionService.queueTranscription(recordingId, options);
          await transcriptionService.ensureTranscriptionJob(recordingId, asset, options);
          return transcriptionService.getMediaAsset(recordingId);
        };
  const uploadDir = config2.uploadDir || process.env.VOICELOG_UPLOAD_DIR || './server/data/uploads';
  function resolveProcessingMode(input) {
    return input === 'full' || input === 'fast'
      ? input
      : config2.VOICELOG_PROCESSING_MODE_DEFAULT || 'fast';
  }
  function scheduleAudioQuality(recordingId, asset) {
    Promise.resolve()
      .then(async () => {
        const audioQuality = await transcriptionService.analyzeAudioQuality(asset.file_path, {
          contentType: asset.content_type,
        });
        await transcriptionService.saveAudioQualityDiagnostics(recordingId, audioQuality);
      })
      .catch((error) => {
        console.warn(
          `[mediaRoutes] Audio quality analysis failed for ${recordingId}:`,
          error?.message || error
        );
      });
  }
  async function assembleChunksToTempFile(chunksDir, safeId, total) {
    const tempPath = path5.join(chunksDir, `${safeId}_assembled_${crypto5.randomUUID()}.bin`);
    mkdirSync(path5.dirname(tempPath), { recursive: true });
    const output = createWriteStream(tempPath);
    try {
      for (let i = 0; i < total; i += 1) {
        const chunkPath = path5.join(chunksDir, `${safeId}_${i}.chunk`);
        if (!existsSync(chunkPath)) {
          throw new Error(`Brakuje chunka ${i} z ${total}.`);
        }
        await new Promise((resolve, reject) => {
          const input = createReadStream(chunkPath);
          input.on('error', reject);
          output.on('error', reject);
          input.on('end', resolve);
          input.pipe(output, { end: false });
        });
      }
      output.end();
      await finished(output);
      return tempPath;
    } catch (error) {
      output.destroy();
      try {
        await unlink(tempPath);
      } catch (_) {}
      throw error;
    }
  }
  router.use('/recordings', authMiddleware);
  router.use('/recordings/*', authMiddleware);
  router.put('/recordings/:recordingId/audio', async (c) => {
    const uploadStart = performance.now();
    const reqId = c.get('reqId');
    const session = c.get('session');
    const recordingId = c.req.param('recordingId');
    const workspaceId = c.req.header('X-Workspace-Id') || '';
    const meetingId = c.req.header('X-Meeting-Id') || '';
    if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);
    const buffer = await c.req.arrayBuffer();
    if (buffer.byteLength > 100 * 1024 * 1024)
      return c.json({ message: 'Przes\u0142any plik przekracza maksymalny rozmiar.' }, 413);
    let asset;
    try {
      asset = await transcriptionService.upsertMediaAsset({
        recordingId,
        workspaceId,
        meetingId,
        contentType: c.req.header('content-type') || 'application/octet-stream',
        buffer: Buffer.from(buffer),
        createdByUserId: session.user_id,
      });
    } catch (uploadErr) {
      if (
        uploadErr.code === 'ENOSPC' ||
        String(uploadErr.message).includes('Brak miejsca na dysku')
      ) {
        return c.json(
          { message: 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.' },
          507
        );
      }
      throw uploadErr;
    }
    scheduleAudioQuality(recordingId, asset);
    const { logger: logger2 } = await Promise.resolve().then(() => (init_logger(), logger_exports));
    logger2.info(`[Metrics] Uploaded audio chunk`, {
      requestId: reqId,
      recordingId,
      sizeBytes: asset.size_bytes,
      durationMs: (performance.now() - uploadStart).toFixed(2),
    });
    return c.json(
      {
        id: asset.id,
        workspaceId: asset.workspace_id,
        sizeBytes: asset.size_bytes,
        audioQuality: null,
      },
      200
    );
  });
  router.get('/recordings/:recordingId/audio', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    const ALLOWED = /* @__PURE__ */ new Set([
      'audio/webm',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/ogg',
      'audio/flac',
      'application/octet-stream',
    ]);
    const safeType = ALLOWED.has(String(asset.content_type || '').toLowerCase())
      ? asset.content_type
      : 'application/octet-stream';
    if (asset.file_path && !asset.file_path.includes(path5.sep)) {
      try {
        const { downloadAudioFromStorage: downloadAudioFromStorage2 } =
          await Promise.resolve().then(() => (init_supabaseStorage(), supabaseStorage_exports));
        const arrayBuffer = await downloadAudioFromStorage2(asset.file_path);
        c.header('Content-Type', safeType);
        c.header('Content-Length', String(arrayBuffer.byteLength));
        c.header('Content-Disposition', 'attachment');
        return c.body(arrayBuffer, 200);
      } catch (err) {
        return c.json(
          {
            message: 'B\u0142\u0105d podczas pobierania nagrania z remote storage.',
            error: err.message,
          },
          500
        );
      }
    } else {
      if (!existsSync(asset.file_path)) return c.json({ message: 'Plik audio nie istnieje.' }, 404);
      const stream = createReadStream(asset.file_path);
      c.header('Content-Type', safeType);
      c.header('Content-Length', String(statSync(asset.file_path).size));
      c.header('Content-Disposition', 'attachment');
      return c.body(stream, 200);
    }
  });
  router.get('/recordings', async (c) => {
    const workspaceId = c.req.query('workspaceId');
    if (!workspaceId) return c.json({ message: 'Brakuje workspaceId.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);
    const recordings = await transcriptionService.getMediaRecordings(workspaceId);
    return c.json({ recordings: recordings || [] }, 200);
  });
  router.delete('/recordings/:recordingId', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    try {
      await transcriptionService.deleteMediaAsset(recordingId, asset.workspace_id);
      return c.body(null, 204);
    } catch (err) {
      return c.json(
        { message: 'B\u0142\u0105d podczas usuwania nagrania.', error: err.message },
        500
      );
    }
  });
  router.post('/recordings/:recordingId/transcribe', async (c) => {
    const recordingId = c.req.param('recordingId');
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, body.workspaceId || asset.workspace_id);
    const result = await startTranscriptionPipeline(recordingId, asset, {
      ...body,
      processingMode: resolveProcessingMode(body.processingMode),
      requestId: c.get('reqId'),
    });
    return c.json(normalizeTranscriptionStatusPayload(result), 202);
  });
  router.post('/recordings/:recordingId/retry-transcribe', async (c) => {
    const recordingId = c.req.param('recordingId');
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    if (!asset.file_path) {
      return c.json({ message: 'Brak \u015Bcie\u017Cki pliku do ponownego przetworzenia.' }, 409);
    }
    if (asset.file_path.includes(path5.sep) && !existsSync(asset.file_path)) {
      return c.json({ message: 'Lokalny plik audio nie istnieje.' }, 409);
    }
    const result = await startTranscriptionPipeline(recordingId, asset, {
      workspaceId: asset.workspace_id,
      meetingId: asset.meeting_id,
      contentType: asset.content_type,
      processingMode: resolveProcessingMode(body.processingMode),
      requestId: c.get('reqId'),
    });
    return c.json(normalizeTranscriptionStatusPayload(result), 202);
  });
  router.get('/recordings/:recordingId/transcribe', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    return c.json(normalizeTranscriptionStatusPayload(asset), 200);
  });
  router.get('/recordings/:recordingId/progress', async (c) => {
    const recordingId = c.req.param('recordingId');
    return streamSSE(c, async (stream) => {
      let active = true;
      const progressCallback = async (data) => {
        if (!active) return;
        await stream.writeSSE({
          data: JSON.stringify(data),
          event: 'progress',
        });
      };
      transcriptionService.on(`progress-${recordingId}`, progressCallback);
      const pingId = setInterval(async () => {
        if (active) {
          await stream
            .writeSSE({ data: JSON.stringify({ ping: 'stay-alive' }), event: 'ping' })
            .catch(() => {});
        }
      }, 15e3);
      c.req.raw.signal.addEventListener('abort', () => {
        active = false;
        clearInterval(pingId);
        transcriptionService.removeListener(`progress-${recordingId}`, progressCallback);
      });
      await new Promise(() => {});
    });
  });
  router.post('/recordings/:recordingId/normalize', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    await transcriptionService.normalizeRecording(asset.file_path, { signal: c.req.raw.signal });
    return c.json({ ok: true }, 200);
  });
  router.post('/recordings/:recordingId/voice-profiles/from-speaker', async (c) => {
    const session = c.get('session');
    const recordingId = c.req.param('recordingId');
    const body = await c.req.json().catch(() => ({}));
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    try {
      const profile = await transcriptionService.createVoiceProfileFromSpeaker(
        asset,
        body.speakerId,
        body.speakerName,
        session.user_id,
        {}
      );
      return c.json(profile, 201);
    } catch (err) {
      return c.json({ message: err.message }, 400);
    }
  });
  router.post('/recordings/:recordingId/voice-coaching', async (c) => {
    const recordingId = c.req.param('recordingId');
    const body = await c.req.json().catch(() => ({}));
    if (body.speakerId === void 0 || body.speakerId === null)
      return c.json({ message: 'Brakuje speakerId.' }, 400);
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    const coaching = await transcriptionService.generateVoiceCoaching(
      asset,
      String(body.speakerId),
      body?.segments || [],
      {}
    );
    return c.json({ coaching }, 200);
  });
  router.post('/recordings/:recordingId/acoustic-features', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    const payload = await transcriptionService.getSpeakerAcousticFeatures(asset, {
      signal: c.req.raw.signal,
    });
    return c.json(payload, 200);
  });
  router.post('/recordings/:recordingId/rediarize', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    let stored = [];
    try {
      stored = JSON.parse(asset.transcript_json || '[]');
    } catch (_) {}
    if (!stored.length) return c.json({ message: 'Brak transkrypcji.' }, 400);
    const whisperLike = stored
      .map((s) => ({ text: s.text, start: s.timestamp, end: s.endTimestamp || s.timestamp }))
      .filter((s) => s.text);
    const diarization = await transcriptionService.diarizeFromTranscript(whisperLike);
    if (!diarization) return c.json({ message: 'Diaryzacja nie powiodla sie.' }, 422);
    const updated = diarization.segments.map((seg, idx) => ({
      ...(stored[idx] || {}),
      id: stored[idx]?.id || seg.id,
      text: seg.text,
      timestamp: seg.timestamp,
      endTimestamp: seg.endTimestamp,
      speakerId: seg.speakerId,
      rawSpeakerLabel: seg.rawSpeakerLabel,
    }));
    await transcriptionService.saveTranscriptionResult(recordingId, {
      segments: updated,
      diarization,
      pipelineStatus: 'completed',
    });
    return c.json(
      {
        speakerCount: diarization.speakerCount,
        speakerNames: diarization.speakerNames,
        segments: updated,
      },
      200
    );
  });
  router.post('/recordings/:recordingId/sketchnote', async (c) => {
    const recordingId = c.req.param('recordingId');
    const asset = await transcriptionService.getMediaAsset(recordingId);
    if (!asset) return c.json({ message: 'Nie znaleziono nagrania.' }, 404);
    await ensureWorkspaceAccess(c, asset.workspace_id);
    let diarization = {};
    try {
      diarization = JSON.parse(asset.diarization_json || '{}');
    } catch (_) {}
    const body = await c.req.json().catch(() => ({}));
    const summaryText =
      body?.summary || diarization?.reviewSummary?.summary || diarization?.summary;
    if (!summaryText)
      return c.json({ message: 'Brak podsumowania do wygenerowania sketchnotki.' }, 400);
    const asList = (value) =>
      (Array.isArray(value) ? value : [])
        .map((item) =>
          String(
            typeof item === 'object'
              ? item?.title || item?.text || item?.value || item?.label || ''
              : item || ''
          ).trim()
        )
        .filter(Boolean);
    const decisions = asList(body?.decisions || diarization?.decisions);
    const actionItems = asList(body?.actionItems || diarization?.actionItems || diarization?.tasks);
    const followUps = asList(body?.followUps || diarization?.followUps);
    const risks = asList(body?.risks || diarization?.risks);
    const blockers = asList(body?.blockers || diarization?.blockers);
    const quotes = asList(body?.keyQuotes || diarization?.keyQuotes).slice(0, 2);
    if (!process.env.GEMINI_API_KEY) {
      return c.json({ message: 'Brak klucza GEMINI_API_KEY w konfiguracji \u015Brodowiska.' }, 400);
    }
    try {
      const { logger: logger2 } = await Promise.resolve().then(
        () => (init_logger(), logger_exports)
      );
      logger2.info(`Generating Gemini 3 Pro Image sketchnote for recording ${recordingId}...`);
      const prompt = `Create a polished hand-drawn sketchnote poster in Polish that summarizes this meeting.
Style requirements:
- white or warm paper background
- bold black hand-lettered headings
- thick marker outlines
- soft yellow highlights
- a few doodles, arrows, speech bubbles, sticky-note callouts
- clear hierarchy with 4-6 large visual zones
- generous spacing and strong visual rhythm
- readable Polish text with large headings
- thick black contours and marker shading
- feel like a real workshop whiteboard/sketchnote, not a generic infographic
- use a friendly, handcrafted, imperfect look
- balance text blocks, icons, and bubbles like a social-media sketchnote
- do not make it look corporate or sterile

Layout suggestion:
- top left: bold title block
- top right: small icon cluster or quick theme callout
- middle: 2 or 3 boxed sections for key content
- lower area: action plan / next steps / risks
- add doodle arrows connecting the sections

Content to include:
Meeting summary:
${summaryText.substring(0, 1200)}

Decisions:
${decisions.length ? decisions.map((item) => `- ${item}`).join('\n') : '- none'}

Action items:
${actionItems.length ? actionItems.map((item) => `- ${item}`).join('\n') : '- none'}

Next steps:
${followUps.length ? followUps.map((item) => `- ${item}`).join('\n') : '- none'}

Risks / blockers:
${[...risks, ...blockers].length ? [...risks, ...blockers].map((item) => `- ${item}`).join('\n') : '- none'}

Key quotes:
${quotes.length ? quotes.map((item) => `- ${item}`).join('\n') : '- none'}

Important:
- make it look like a handcrafted visual note
- do not use photorealism
- do not include tiny unreadable text
- use a 4:3 composition
- prioritize visual clarity over dense text`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig: {
                aspectRatio: '4:3',
                imageSize: '4K',
              },
              thinkingConfig: {
                thinkingLevel: 'medium',
              },
            },
          }),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        logger2.error('Gemini image gen error:', err);
        return c.json({ message: 'Blad generowania obrazu Gemini.' }, 500);
      }
      const data = await res.json();
      const inlineImage = data.candidates?.[0]?.content?.parts?.find(
        (part) => part?.inlineData?.data
      )?.inlineData;
      if (!inlineImage?.data) {
        return c.json({ message: 'Model Gemini nie wygenerowa\u0142 obrazu.' }, 500);
      }
      const mimeType = String(inlineImage.mimeType || 'image/png').trim() || 'image/png';
      const imageUrl = `data:${mimeType};base64,${inlineImage.data}`;
      if (imageUrl) {
        diarization.sketchnoteUrl = imageUrl;
        if (typeof transcriptionService._execute === 'function') {
          await transcriptionService._execute(
            'UPDATE media_assets SET diarization_json = ?, updated_at = ? WHERE id = ?',
            [JSON.stringify(diarization), /* @__PURE__ */ new Date().toISOString(), recordingId]
          );
        }
      }
      return c.json({ sketchnoteUrl: imageUrl }, 200);
    } catch (e) {
      console.error('Sketchnote generation exception:', e);
      return c.json({ message: 'Blad wywolywania API Gemini.' }, 500);
    }
  });
  router.post('/analyze', applyRateLimit('analyze'), async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await transcriptionService.analyzeMeetingWithOpenAI(body);
    return c.json(result || { mode: 'no-key' }, 200);
  });
  router.get('/recordings/:recordingId/audio/chunk-status', async (c) => {
    const recordingId = c.req.param('recordingId');
    const workspaceId = c.req.header('X-Workspace-Id') || '';
    if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);
    const total = parseInt(c.req.query('total') || '', 10);
    if (isNaN(total) || total <= 0) {
      return c.json({ message: 'Brakuje poprawnego parametru total.' }, 400);
    }
    const chunksDir = path5.join(config2.uploadDir, 'chunks');
    const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!existsSync(chunksDir)) {
      return c.json({ nextIndex: 0, uploaded: 0, total, resumable: false }, 200);
    }
    let nextIndex = 0;
    for (let i = 0; i < total; i++) {
      const chunkPath = path5.join(chunksDir, `${safeId}_${i}.chunk`);
      if (!existsSync(chunkPath)) {
        break;
      }
      nextIndex = i + 1;
    }
    return c.json(
      {
        nextIndex,
        uploaded: nextIndex,
        total,
        resumable: nextIndex > 0 && nextIndex < total,
      },
      200
    );
  });
  router.put('/recordings/:recordingId/audio/chunk', async (c) => {
    const recordingId = c.req.param('recordingId');
    const workspaceId = c.req.header('X-Workspace-Id') || '';
    if (!workspaceId) return c.json({ message: 'Brakuje X-Workspace-Id.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);
    const index = parseInt(c.req.query('index') || '', 10);
    const total = parseInt(c.req.query('total') || '', 10);
    if (isNaN(index) || isNaN(total) || index < 0 || total <= 0 || index >= total) {
      return c.json({ message: 'Nieprawid\u0142owe parametry chunka (index/total).' }, 400);
    }
    if (total > 600) return c.json({ message: 'Za du\u017Co chunk\xF3w (max 600, ~1.2GB).' }, 400);
    const buffer = await c.req.arrayBuffer();
    if (buffer.byteLength > 3 * 1024 * 1024)
      return c.json({ message: 'Chunk jest zbyt du\u017Cy (max 3MB).' }, 413);
    const diskSpace = checkDiskSpace(uploadDir, 50 * 1024 * 1024);
    if (!diskSpace.ok) {
      const { logger: logger2 } = await Promise.resolve().then(
        () => (init_logger(), logger_exports)
      );
      logger2.error(`[ENOSPC] Disk space critically low: ${diskSpace.freeBytes} bytes free`);
      return c.json(
        {
          message:
            'Brak miejsca na dysku serwera. Zwolnij miejsce lub skontaktuj z administratorem.',
          freeBytes: diskSpace.freeBytes,
        },
        507
      );
    }
    const chunksDir = path5.join(config2.uploadDir, 'chunks');
    mkdirSync(chunksDir, { recursive: true });
    const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const chunkPath = path5.join(chunksDir, `${safeId}_${index}.chunk`);
    try {
      await writeFile(chunkPath, Buffer.from(buffer));
    } catch (writeErr) {
      if (writeErr.code === 'ENOSPC') {
        const { logger: logger2 } = await Promise.resolve().then(
          () => (init_logger(), logger_exports)
        );
        logger2.error(
          `[ENOSPC] Failed to write chunk ${index}/${total} for recording ${recordingId}`
        );
        try {
          await unlink(chunkPath);
        } catch (_) {}
        return c.json({ message: 'Brak miejsca na dysku podczas zapisu chunka.' }, 507);
      }
      throw writeErr;
    }
    return c.json({ index, total }, 200);
  });
  router.post('/recordings/:recordingId/audio/finalize', async (c) => {
    const recordingId = c.req.param('recordingId');
    const session = c.get('session');
    const body = await c.req.json().catch(() => ({}));
    const workspaceId = body.workspaceId || c.req.header('X-Workspace-Id') || '';
    const meetingId = body.meetingId || c.req.header('X-Meeting-Id') || '';
    const contentType = body.contentType || 'application/octet-stream';
    const total = parseInt(body.total || '0', 10);
    if (!workspaceId) return c.json({ message: 'Brakuje workspaceId.' }, 400);
    if (!total || total <= 0)
      return c.json({ message: 'Brakuje total w ciele \u017C\u0105dania.' }, 400);
    await ensureWorkspaceAccess(c, workspaceId);
    const chunksDir = path5.join(config2.uploadDir, 'chunks');
    const safeId = String(recordingId).replace(/[^a-zA-Z0-9_-]/g, '_');
    let assembledPath = '';
    try {
      assembledPath = await assembleChunksToTempFile(chunksDir, safeId, total);
    } catch (error) {
      return c.json({ message: error?.message || 'Nie udalo sie zlozyc chunkow.' }, 400);
    }
    const fullStats = await stat(assembledPath);
    if (fullStats.size > 500 * 1024 * 1024) {
      try {
        await unlink(assembledPath);
      } catch (_) {}
      return c.json(
        {
          message:
            'Z\u0142o\u017Cony plik przekracza maksymalny rozmiar 500MB. Skompresuj nagranie do formatu WebM lub MP3.',
        },
        413
      );
    }
    let asset;
    try {
      asset = await transcriptionService.upsertMediaAssetFromPath({
        recordingId,
        workspaceId,
        meetingId,
        contentType,
        filePath: assembledPath,
        createdByUserId: session.user_id,
      });
    } catch (err) {
      try {
        await unlink(assembledPath);
      } catch (_) {}
      if (err.code === 'ENOSPC' || String(err.message).includes('Brak miejsca na dysku')) {
        return c.json(
          { message: 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.' },
          507
        );
      }
      throw err;
    }
    for (let i = 0; i < total; i++) {
      try {
        await unlink(path5.join(chunksDir, `${safeId}_${i}.chunk`));
      } catch (_) {}
    }
    try {
      await unlink(assembledPath);
    } catch (_) {}
    scheduleAudioQuality(recordingId, asset);
    return c.json(
      {
        id: asset.id,
        workspaceId: asset.workspace_id,
        sizeBytes: asset.size_bytes,
        audioQuality: null,
      },
      200
    );
  });
  router.get('/disk-space/status', async (c) => {
    const diskSpace = checkDiskSpace(uploadDir, 0);
    return c.json({
      ok: diskSpace.ok,
      freeBytes: diskSpace.freeBytes || null,
      freeMB: diskSpace.freeBytes ? Math.round(diskSpace.freeBytes / 1024 / 1024) : null,
      timestamp: /* @__PURE__ */ new Date().toISOString(),
    });
  });
  router.post('/disk-space/cleanup', async (c) => {
    const session = c.get('session');
    if (!session || session.role !== 'admin') {
      return c.json({ message: 'Wymagane uprawnienia administratora.' }, 403);
    }
    const maxAgeHours = parseInt(c.req.query('maxAge') || '24', 10);
    const result = await cleanupOldChunks(uploadDir, Math.min(maxAgeHours, 168));
    return c.json({
      success: true,
      deleted: result.deleted,
      bytesFreed: result.bytesFreed,
      mbFreed: Math.round(result.bytesFreed / 1024 / 1024),
    });
  });
  return router;
}
function createTranscribeRoutes(services, middlewares) {
  const router = new Hono4();
  const { transcriptionService, config: config2 } = services;
  const { authMiddleware, applyRateLimit } = middlewares;
  router.post('/live', authMiddleware, applyRateLimit('live-transcribe', 60), async (c) => {
    const contentType = c.req.header('content-type') || 'audio/webm';
    const bufferArray = await c.req.arrayBuffer();
    if (bufferArray.byteLength > 5 * 1024 * 1024)
      return c.json({ message: 'Payload too large' }, 413);
    const buffer = Buffer.from(bufferArray);
    if (!buffer || buffer.byteLength < 500) return c.json({ text: '' }, 200);
    const ext = contentType.includes('mp4')
      ? '.m4a'
      : contentType.includes('wav')
        ? '.wav'
        : '.webm';
    const tmpPath = path5.join(
      config2.uploadDir,
      `live_${crypto5.randomUUID().replace(/-/g, '')}${ext}`
    );
    try {
      await writeFile(tmpPath, buffer);
      const text = await transcriptionService.transcribeLiveChunk(tmpPath, contentType, {});
      return c.json({ text }, 200);
    } finally {
      try {
        await unlink(tmpPath);
      } catch (_) {}
    }
  });
  return router;
}

// server/routes/ai.ts
init_config();
var ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
async function callAnthropic(body) {
  if (!config.ANTHROPIC_API_KEY) return null;
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  return res.json();
}
function normalizeSearchItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item?.id || ''),
      title: String(item?.title || '').trim(),
      subtitle: String(item?.subtitle || '').trim(),
      type: String(item?.type || '').trim(),
      group: String(item?.group || '').trim(),
    }))
    .filter((item) => Boolean(item.id) && Boolean(item.title));
}
function createAiRoutes(middlewares) {
  const router = new Hono5();
  const { applyRateLimit } = middlewares;
  router.post('/person-profile', applyRateLimit('ai-person-profile', 20), async (c) => {
    if (!config.ANTHROPIC_API_KEY) return c.json({ mode: 'no-key' }, 200);
    const { personName, meetings = [], allSegments = [] } = await c.req.json().catch(() => ({}));
    if (!personName || !Array.isArray(allSegments) || allSegments.length < 5) {
      return c.json({ mode: 'no-key' }, 200);
    }
    const lines = allSegments
      .slice(0, 100)
      .map((s) => `[${s.meetingTitle || 'Spotkanie'}] ${s.text}`)
      .join('\n');
    const prompt = [
      `You are an expert business psychologist. Analyze the communication patterns of "${personName}".`,
      `Base your analysis ONLY on their actual statements below from ${meetings.length} meeting(s).`,
      `Respond in Polish for all text fields. Return valid JSON only \u2014 no prose outside the JSON.`,
      ``,
      `Statements by ${personName}:`,
      lines,
      ``,
      `Return exactly this JSON shape (all fields required):`,
      `{"disc":{"D":65,"I":45,"S":70,"C":55},"discStyle":"SC \u2014 stabilny i sumienny","discDescription":"2-zdaniowy opis dominuj\u0105cego stylu.","values":[{"value":"bezpiecze\u0144stwo","icon":"\u{1F6E1}\uFE0F","quote":"cytat z wypowiedzi"}],"communicationStyle":"analytical","decisionStyle":"data-driven","conflictStyle":"collaborative","listeningStyle":"active","stressResponse":"Jak reaguje pod presj\u0105.","workingWithTips":["Wskaz\xF3wka 1","Wskaz\xF3wka 2","Wskaz\xF3wka 3"],"communicationDos":["Co robi\u0107"],"communicationDonts":["Czego unika\u0107"],"redFlags":["Ewentualny wzorzec"],"coachingNote":"Jedna obserwacja."}`,
    ].join('\n');
    try {
      const payload = await callAnthropic({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = payload?.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed = JSON.parse(match[0]);
      return c.json(
        {
          mode: 'anthropic',
          meetingsAnalyzed: meetings.length,
          generatedAt: /* @__PURE__ */ new Date().toISOString(),
          ...parsed,
        },
        200
      );
    } catch (err) {
      console.error('[ai/person-profile] error:', err.message);
      return c.json({ mode: 'no-key' }, 200);
    }
  });
  router.post('/suggest-tasks', applyRateLimit('ai-suggest-tasks', 20), async (c) => {
    if (!config.ANTHROPIC_API_KEY) return c.json({ tasks: [] }, 200);
    const { transcript = [], people = [] } = await c.req.json().catch(() => ({}));
    const transcriptText = (Array.isArray(transcript) ? transcript : [])
      .map(
        (seg) =>
          `[${seg.speakerName || `Speaker ${Number(seg.speakerId || 0) + 1}`}]: ${seg.text || ''}`
      )
      .join('\n');
    if (!transcriptText.trim()) return c.json({ tasks: [] }, 200);
    const peopleList = (Array.isArray(people) ? people : [])
      .map((p) => p.name || p.email || '')
      .filter(Boolean)
      .join(', ');
    const systemPrompt =
      'Jestes asystentem spotkaniowym. Analizujesz transkrypcje spotkan i wyodrebniasz z nich konkretne zadania do wykonania. Odpowiadasz WYLACZNIE prawidlowym JSONem bez zadnego dodatkowego tekstu, bez markdown, bez komentarzy.';
    const userPrompt = `${
      peopleList
        ? `Uczestnicy spotkania: ${peopleList}

`
        : ''
    }Transkrypcja:
${transcriptText}

Wygeneruj JSON z lista zadan ktore jasno wynikaja z tej transkrypcji (decyzje, zobowiazania, follow-upy). Format:
{
  "tasks": [
    {
      "title": "krotki tytul zadania (max 80 znakow)",
      "description": "szczegolowy opis co trzeba zrobic",
      "owner": "imie osoby z transkryptu lub null jezeli nie wspomniano",
      "dueDate": "YYYY-MM-DD lub null jezeli brak terminu",
      "priority": "high|medium|low",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Zasady:
- Tylko zadania ktore jasno wynikaja z transkrypcji
- Priorytet high = pilne/wazne sygnaly jezykowe
- Maksymalnie 10 zadan
- Odpowiedz WYLACZNIE JSONem`;
    try {
      const payload = await callAnthropic({
        model: 'claude-sonnet-4-6',
        // use more capable model for task extraction
        max_tokens: 2e3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = (payload?.content || []).find((b) => b.type === 'text')?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed = JSON.parse(match[0]);
      return c.json({ tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [] }, 200);
    } catch (err) {
      console.error('[ai/suggest-tasks] error:', err.message);
      return c.json({ tasks: [] }, 200);
    }
  });
  router.post('/search', applyRateLimit('ai-search', 20), async (c) => {
    if (!config.ANTHROPIC_API_KEY) {
      return c.json({ mode: 'no-key', matches: [] }, 200);
    }
    const { query = '', items = [] } = await c.req.json().catch(() => ({}));
    const normalizedQuery = String(query || '').trim();
    const normalizedItems = normalizeSearchItems(items);
    if (normalizedQuery.length < 2 || !normalizedItems.length) {
      return c.json({ mode: 'no-key', matches: [] }, 200);
    }
    const prompt = [
      'You are helping with semantic search in a command palette.',
      'Return the most relevant items for the user query.',
      'Respond in valid JSON only, no prose.',
      '',
      `Query: ${normalizedQuery}`,
      '',
      'Items:',
      ...normalizedItems
        .slice(0, 20)
        .map(
          (item, index) =>
            `${index + 1}. id=${item.id} | title=${item.title} | subtitle=${item.subtitle || ''} | type=${item.type || ''} | group=${item.group || ''}`
        ),
      '',
      'Return exactly this JSON shape:',
      '{"matches":[{"id":"item-id","reason":"short reason","score":92}]}',
      'Rules:',
      '- Return up to 5 matches.',
      '- Only use ids from the provided items list.',
      '- Prefer semantic relevance over exact substring matches.',
      '- Keep reasons short.',
    ].join('\n');
    try {
      const payload = await callAnthropic({
        model: config.ANTHROPIC_MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = payload?.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed = JSON.parse(match[0]);
      const itemsById = new Map(normalizedItems.map((item) => [item.id, item]));
      const matches = (Array.isArray(parsed.matches) ? parsed.matches : [])
        .map((entry) => {
          const source = itemsById.get(String(entry.id || ''));
          if (!source) return null;
          return {
            ...source,
            reason: String(entry.reason || '').trim(),
            score: typeof entry.score === 'number' ? entry.score : 0,
          };
        })
        .filter(Boolean)
        .slice(0, 5);
      const response = { mode: 'anthropic', matches };
      return c.json(response, 200);
    } catch (err) {
      console.error('[ai/search] error:', err.message);
      return c.json({ mode: 'no-key', matches: [] }, 200);
    }
  });
  return router;
}

// server/http/health.ts
function registerHealthRoute(app) {
  app.get('/health', (c) => {
    const build = resolveBuildMetadata(process.env, '0.1.0');
    return c.json({
      ok: true,
      status: 'ok',
      uptime: process.uptime(),
      gitSha: build.gitSha,
      buildTime: build.buildTime,
      appVersion: build.appVersion,
      runtime: build.runtime,
    });
  });
}
var globalObj = global;
if (!globalObj.__metricsCollected) {
  client.collectDefaultMetrics();
  globalObj.__metricsCollected = true;
}
var pipelineStageDuration =
  globalObj.__pipelineStageDuration ||
  new client.Summary({
    name: 'voicelog_pipeline_stage_duration_ms',
    help: 'Duration of pipeline stages in ms',
    labelNames: ['stage'],
    percentiles: [0.5, 0.9, 0.95, 0.99],
  });
if (!globalObj.__pipelineStageDuration) {
  globalObj.__pipelineStageDuration = pipelineStageDuration;
}
var stageStats = {};
var MetricsService = {
  observeStageDuration(stage, durationMs) {
    if (!stageStats[stage]) {
      stageStats[stage] = [];
    }
    stageStats[stage].push(durationMs);
    if (stageStats[stage].length > 1e3) {
      stageStats[stage].shift();
    }
    pipelineStageDuration.labels(stage).observe(durationMs);
  },
  async getPrometheusMetrics() {
    return await client.register.metrics();
  },
  getJsonSummary() {
    const result = {};
    for (const [stage, times] of Object.entries(stageStats)) {
      if (times.length === 0) continue;
      const sorted = [...times].sort((a, b) => a - b);
      const count = sorted.length;
      const getPercentile = (p) => {
        const index = Math.floor((count - 1) * p);
        return sorted[index];
      };
      result[stage] = {
        count,
        min: sorted[0],
        max: sorted[count - 1],
        p50: getPercentile(0.5) || 0,
        p95: getPercentile(0.95) || 0,
        p99: getPercentile(0.99) || 0,
        avg: times.reduce((a, b) => a + b, 0) / count,
      };
    }
    return result;
  },
};

// server/http/app-routes.ts
function registerAppRoutes(app, services, middlewares) {
  registerHealthRoute(app);
  app.get('/metrics', async (c) => {
    const metrics = await MetricsService.getPrometheusMetrics();
    return c.text(metrics);
  });
  app.get('/api/admin/metrics', (c) => {
    const summary = MetricsService.getJsonSummary();
    return c.json(summary);
  });
  app.get('/api/admin/heapdump', async (c) => {
    const v8 = await import('node:v8');
    const path12 = await import('node:path');
    const filename = `heap-${Date.now()}.heapsnapshot`;
    const filepath = path12.join(process.cwd(), filename);
    v8.writeHeapSnapshot(filepath);
    return c.json({ message: 'Heap snapshot created', file: filepath });
  });
  app.route('/auth', createAuthRoutes(services, middlewares));
  app.route('/', createWorkspacesRoutes(services, middlewares));
  app.route('/media', createMediaRoutes(services, middlewares));
  app.route('/transcribe', createTranscribeRoutes(services, middlewares));
  app.route('/digest', createDigestRoutes(services, middlewares));
  app.route('/ai', createAiRoutes(middlewares));
}

// server/app.ts
function createApp(services, mockedMiddlewares) {
  const { config: config2 } = services;
  const app = new Hono6();
  applyAppCors(app, config2.allowedOrigins || 'http://localhost:3000');
  applyRequestMetadata(app);
  applySecurityHeaders(app);
  registerAppErrorHandler(app);
  registerNotFoundHandler(app);
  const middlewares = mockedMiddlewares || createMiddlewares(services);
  registerAppRoutes(app, services, middlewares);
  return app;
}

// server/index.ts
init_config();

// server/services/AuthService.ts
var AuthService = class {
  db;
  constructor(db) {
    this.db = db;
  }
  async registerUser(draft) {
    return await this.db.registerUser(draft);
  }
  async loginUser(draft) {
    return await this.db.loginUser(draft);
  }
  async requestPasswordReset(draft) {
    return await this.db.requestPasswordReset(draft);
  }
  async resetPasswordWithCode(draft) {
    return await this.db.resetPasswordWithCode(draft);
  }
  async upsertGoogleUser(profile) {
    return await this.db.upsertGoogleUser(profile);
  }
  async getSession(token) {
    return await this.db.getSession(token);
  }
  async updateUserProfile(userId, updates) {
    return await this.db.updateUserProfile(userId, updates);
  }
  async changeUserPassword(userId, draft) {
    return await this.db.changeUserPassword(userId, draft);
  }
  async buildSessionPayload(userId, workspaceId) {
    return await this.db.buildSessionPayload(userId, workspaceId);
  }
};

// server/services/WorkspaceService.ts
var WorkspaceService = class {
  db;
  constructor(db) {
    this.db = db;
  }
  async getWorkspaceState(workspaceId) {
    return await this.db.getWorkspaceState(workspaceId);
  }
  async saveWorkspaceState(workspaceId, payload) {
    return await this.db.saveWorkspaceState(workspaceId, payload);
  }
  async updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole) {
    return await this.db.updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole);
  }
  async getMembership(workspaceId, userId) {
    return await this.db.getMembership(workspaceId, userId);
  }
  async getWorkspaceVoiceProfiles(workspaceId) {
    return await this.db.getWorkspaceVoiceProfiles(workspaceId);
  }
  async getWorkspaceMemberNames(workspaceId) {
    const members = await this.db.workspaceMembers(workspaceId);
    return members.map((u) => u.name);
  }
  async saveVoiceProfile(data) {
    return await this.db.saveVoiceProfile(data);
  }
  async upsertVoiceProfile(data) {
    return await this.db.upsertVoiceProfile(data);
  }
  async deleteVoiceProfile(id, workspaceId) {
    return await this.db.deleteVoiceProfile(id, workspaceId);
  }
  async updateVoiceProfileThreshold(id, workspaceId, threshold) {
    return await this.db.updateVoiceProfileThreshold(id, workspaceId, threshold);
  }
};

// server/services/TranscriptionService.ts
init_config();
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}
function magnitude(a) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * a[i];
  }
  return Math.sqrt(sum);
}
function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}
function buildDocument(row, score) {
  return new Document({
    pageContent: row.text || '',
    metadata: {
      id: row.id,
      workspaceId: row.workspace_id || '',
      recordingId: row.recording_id || '',
      speakerName: row.speaker_name || '',
      score,
    },
  });
}
var FunctionEmbeddingsAdapter = class {
  embedTextChunks;
  constructor(embedTextChunks2) {
    this.embedTextChunks = embedTextChunks2;
  }
  async embedDocuments(documents) {
    return this.embedTextChunks(documents);
  }
  async embedQuery(document) {
    const [vector] = await this.embedTextChunks([document]);
    return vector || [];
  }
};
var RagVectorStore = class extends VectorStore {
  workspaceId;
  db;
  topK;
  minScore;
  constructor(options) {
    super(new FunctionEmbeddingsAdapter(options.embedTextChunks), {});
    this.workspaceId = options.workspaceId;
    this.db = options.db;
    this.topK = options.topK ?? 15;
    this.minScore = options.minScore ?? 0.1;
  }
  static lc_name() {
    return 'RagVectorStore';
  }
  _vectorstoreType() {
    return 'rag';
  }
  async addVectors(vectors, documents) {
    if (
      !Array.isArray(vectors) ||
      !Array.isArray(documents) ||
      !vectors.length ||
      !documents.length
    ) {
      return [];
    }
    const now = /* @__PURE__ */ new Date().toISOString();
    const payload = documents.map((document, index) => {
      const metadata = document.metadata || {};
      return {
        id: String(metadata.id || `rag_${crypto6.randomUUID().replace(/-/g, '')}`),
        workspaceId: String(metadata.workspaceId || this.workspaceId),
        recordingId: String(metadata.recordingId || metadata.recording_id || ''),
        speakerName: String(metadata.speakerName || metadata.speaker_name || ''),
        text: String(document.pageContent || ''),
        embedding: vectors[index] || [],
        createdAt: String(metadata.createdAt || metadata.created_at || now),
      };
    });
    if (typeof this.db.saveRagChunks === 'function') {
      await this.db.saveRagChunks(payload);
    } else if (typeof this.db.saveRagChunk === 'function') {
      for (const chunk of payload) {
        await this.db.saveRagChunk(chunk);
      }
    }
    return payload.map((chunk) => chunk.id);
  }
  async addDocuments(documents) {
    const vectors = await this.embeddings.embedDocuments(
      documents.map((doc) => String(doc.pageContent || ''))
    );
    return this.addVectors(vectors, documents);
  }
  async similaritySearchVectorWithScore(query, k = this.topK) {
    if (!Array.isArray(query) || query.length === 0) return [];
    const rows = await this.db.getAllRagChunksForWorkspace(this.workspaceId);
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const queryMagnitude = magnitude(query);
    if (queryMagnitude === 0) return [];
    const scored = rows.map((row) => {
      const vec = safeJsonArray(row.embedding_json);
      if (!vec.length) return { row, score: -1 };
      const vecMagnitude = magnitude(vec);
      if (vecMagnitude === 0) return { row, score: -1 };
      const score = dotProduct(query, vec) / (queryMagnitude * vecMagnitude);
      return { row, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter((item) => item.score > this.minScore)
      .slice(0, k)
      .map((item) => [buildDocument(item.row, item.score), item.score]);
  }
};

// server/services/TranscriptionService.ts
var TranscriptionService = class extends EventEmitter {
  db;
  workspaceService;
  audioPipeline;
  speakerEmbedder;
  transcriptionJobs;
  constructor(db, workspaceService, audioPipeline, speakerEmbedder) {
    super();
    this.db = db;
    this.workspaceService = workspaceService;
    this.audioPipeline = audioPipeline;
    this.speakerEmbedder = speakerEmbedder;
    this.transcriptionJobs = /* @__PURE__ */ new Map();
  }
  get pipeline() {
    if (this.audioPipeline && typeof this.audioPipeline.transcribeRecording === 'function') {
      return this.audioPipeline;
    }
    if (this.audioPipeline && Object.keys(this.audioPipeline).length === 0) {
      console.warn(
        '[TranscriptionService] audioPipeline looks like an empty object (circular dep?).'
      );
    }
    if (!this.audioPipeline) {
      throw new Error(
        'Critical: TranscriptionService.audioPipeline is null or undefined. Check bootstrap injection.'
      );
    }
    if (typeof this.audioPipeline.transcribeRecording !== 'function') {
      throw new Error(
        `Critical: TranscriptionService.audioPipeline is missing 'transcribeRecording'. Found: ${typeof this.audioPipeline.transcribeRecording}`
      );
    }
    return this.audioPipeline;
  }
  async upsertMediaAsset(data) {
    return await this.db.upsertMediaAsset(data);
  }
  async upsertMediaAssetFromPath(data) {
    if (typeof this.db.upsertMediaAssetFromPath === 'function') {
      return await this.db.upsertMediaAssetFromPath(data);
    }
    const fs11 = await import('node:fs/promises');
    return await this.db.upsertMediaAsset({
      ...data,
      buffer: await fs11.readFile(data.filePath),
    });
  }
  async getMediaAsset(recordingId) {
    return await this.db.getMediaAsset(recordingId);
  }
  async deleteMediaAsset(recordingId, workspaceId) {
    return await this.db.deleteMediaAsset(recordingId, workspaceId);
  }
  async saveAudioQualityDiagnostics(recordingId, audioQuality) {
    return await this.db.saveAudioQualityDiagnostics(recordingId, audioQuality);
  }
  async updateTranscriptionMetadata(recordingId, updates) {
    if (typeof this.db.updateTranscriptionMetadata !== 'function') {
      return null;
    }
    return await this.db.updateTranscriptionMetadata(recordingId, updates);
  }
  async queueTranscription(recordingId, updates) {
    return await this.db.queueTranscription(recordingId, updates);
  }
  async startTranscriptionPipeline(recordingId, asset, options) {
    await this.queueTranscription(recordingId, options);
    await this.ensureTranscriptionJob(recordingId, asset, options);
    return await this.getMediaAsset(recordingId);
  }
  async markTranscriptionProcessing(recordingId) {
    return await this.db.markTranscriptionProcessing(recordingId);
  }
  async saveTranscriptionResult(recordingId, result) {
    return await this.db.saveTranscriptionResult(recordingId, result);
  }
  async markTranscriptionFailure(
    recordingId,
    errorMessage,
    transcriptionDiagnostics = null,
    audioQuality = null
  ) {
    return await this.db.markTranscriptionFailure(
      recordingId,
      errorMessage,
      transcriptionDiagnostics,
      audioQuality
    );
  }
  async ensureTranscriptionJob(recordingId, asset, options) {
    if (!recordingId || this.transcriptionJobs.has(recordingId)) {
      return;
    }
    const jobPromise = Promise.resolve()
      .then(async () => {
        const startSTT = performance.now();
        const reqId = options.requestId || 'internal-stt';
        const { logger: logger2 } = await Promise.resolve().then(
          () => (init_logger(), logger_exports)
        );
        const processingMode =
          options.processingMode === 'full' || options.processingMode === 'fast'
            ? options.processingMode
            : config.VOICELOG_PROCESSING_MODE_DEFAULT;
        const shouldRunPostprocess =
          processingMode === 'fast' && config.VOICELOG_ENABLE_POSTPROCESS;
        let localSourcePath = '';
        let cleanupLocalSource = async () => {};
        logger2.info('[Pipeline] Starting transcription job.', {
          requestId: reqId,
          recordingId,
          processingMode,
        });
        const markProcessingPromise = this.markTranscriptionProcessing(recordingId);
        const [wsState, memberNames, voiceProfiles] = await Promise.all([
          this.db.getWorkspaceState(asset.workspace_id),
          this.workspaceService.getWorkspaceMemberNames(asset.workspace_id),
          this.db.getWorkspaceVoiceProfiles(asset.workspace_id),
        ]);
        await markProcessingPromise;
        if (typeof this.pipeline.materializeAssetToLocal === 'function') {
          const materialized = await this.pipeline.materializeAssetToLocal(asset, {
            signal: options.signal,
          });
          localSourcePath = materialized?.localPath || '';
          cleanupLocalSource =
            typeof materialized?.cleanup === 'function' ? materialized.cleanup : cleanupLocalSource;
        }
        const sharedOptions = {
          ...options,
          processingMode,
          localSourcePath,
          participants: [...(options.participants || []), ...memberNames],
          vocabulary: [
            ...(options.vocabulary ? [options.vocabulary] : []),
            ...(wsState.vocabulary || []),
          ].join(', '),
          voiceProfiles,
          onProgress: (payload) => {
            this.emit(`progress-${recordingId}`, payload);
          },
        };
        const result = await this.pipeline.transcribeRecording(asset, {
          ...sharedOptions,
          skipEarlyPyannote: processingMode !== 'full',
          skipChunkVAD: processingMode !== 'full' || !config.VOICELOG_ENABLE_CHUNK_VAD,
          skipVoiceProfileMatch: processingMode !== 'full',
        });
        const isEmptyTranscript = result?.transcriptOutcome === 'empty';
        this.emit(`progress-${recordingId}`, {
          progress: 100,
          enhancementsPending: Boolean(result?.enhancementsPending),
          postprocessStage: result?.postprocessStage || '',
          message: isEmptyTranscript
            ? result?.userMessage || 'Nie wykryto wypowiedzi w nagraniu.'
            : 'Trener wymowy gotowy! (Zakonczono)',
        });
        await this.saveTranscriptionResult(recordingId, {
          ...result,
          pipelineStatus: 'completed',
        });
        if (shouldRunPostprocess && !isEmptyTranscript) {
          this.runEnhancementPostProcess(
            recordingId,
            asset,
            {
              ...sharedOptions,
              processingMode: 'full',
            },
            cleanupLocalSource
          ).catch((err) => {
            console.error('[Pipeline] Background post-process failed:', err?.message || err);
          });
        } else {
          await cleanupLocalSource();
        }
        logger2.info('[Metrics] Pipeline completed successfully.', {
          requestId: reqId,
          recordingId,
          durationMs: (performance.now() - startSTT).toFixed(2),
          confidence: result.diarization?.confidence || 0,
        });
        if (!isEmptyTranscript && result.segments && result.segments.length > 0) {
          this.vectorizeTranscriptionResultToRAG(
            asset.workspace_id,
            recordingId,
            result.segments
          ).catch((err) => {
            console.error('[RAG] Background vectorization failed:', err);
          });
        }
      })
      .catch(async (error) => {
        try {
          await this.markTranscriptionFailure(
            recordingId,
            error?.message || String(error || 'Unknown pipeline error'),
            error?.transcriptionDiagnostics && typeof error.transcriptionDiagnostics === 'object'
              ? error.transcriptionDiagnostics
              : null,
            error?.audioQuality && typeof error.audioQuality === 'object'
              ? error.audioQuality
              : null
          );
        } catch (markError) {
          console.error(
            '[Pipeline] Failed to mark transcription failure:',
            markError?.message || markError
          );
        }
      })
      .finally(() => {
        this.transcriptionJobs.delete(recordingId);
      });
    this.transcriptionJobs.set(recordingId, jobPromise);
  }
  async runEnhancementPostProcess(recordingId, asset, options, cleanupLocalSource) {
    const reqId = options.requestId || 'internal-stt';
    const { logger: logger2 } = await Promise.resolve().then(() => (init_logger(), logger_exports));
    try {
      await this.updateTranscriptionMetadata(recordingId, {
        enhancementsPending: true,
        postprocessStage: 'running',
      });
      this.emit(`progress-${recordingId}`, {
        progress: 100,
        enhancementsPending: true,
        postprocessStage: 'running',
        message: 'Trwa dopinanie diarization i dopasowania glosow...',
      });
      const fullResult = await this.pipeline.transcribeRecording(asset, {
        ...options,
        processingMode: 'full',
        skipEarlyPyannote: false,
        skipChunkVAD: !config.VOICELOG_ENABLE_CHUNK_VAD,
        skipVoiceProfileMatch: false,
      });
      await this.saveTranscriptionResult(recordingId, {
        ...fullResult,
        pipelineStatus: 'completed',
        enhancementsPending: false,
        postprocessStage: 'done',
      });
      this.emit(`progress-${recordingId}`, {
        progress: 100,
        enhancementsPending: false,
        postprocessStage: 'done',
        message: 'Dodatkowe przetwarzanie zakonczone.',
      });
      logger2.info('[Pipeline] Background post-process completed.', {
        requestId: reqId,
        recordingId,
      });
    } catch (error) {
      await this.updateTranscriptionMetadata(recordingId, {
        enhancementsPending: false,
        postprocessStage: 'failed',
      });
      logger2.warn('[Pipeline] Background post-process failed.', {
        requestId: reqId,
        recordingId,
        message: error?.message || String(error),
      });
    } finally {
      await cleanupLocalSource();
    }
  }
  async normalizeRecording(filePath, options = {}) {
    return this.pipeline.normalizeRecording(filePath, options);
  }
  async analyzeAudioQuality(filePath, options = {}) {
    if (typeof this.pipeline.analyzeAudioQuality !== 'function') {
      throw new Error('Audio pipeline nie wspiera analizy jakosci audio.');
    }
    return this.pipeline.analyzeAudioQuality(filePath, options);
  }
  async generateVoiceCoaching(asset, speakerId, segments, options = {}) {
    return this.pipeline.generateVoiceCoaching(asset, speakerId, segments, options);
  }
  async getSpeakerAcousticFeatures(asset, options = {}) {
    if (typeof this.pipeline.analyzeAcousticFeatures !== 'function') {
      throw new Error('Audio pipeline nie wspiera metryk akustycznych.');
    }
    const fs11 = await import('node:fs/promises');
    let segments = [];
    let diarization = {};
    try {
      segments = JSON.parse(asset.transcript_json || '[]');
    } catch (_) {}
    try {
      diarization = JSON.parse(asset.diarization_json || '{}');
    } catch (_) {}
    if (!segments.length) throw new Error('Brak transkrypcji w bazie.');
    const speakerNames =
      typeof diarization === 'object' && diarization ? diarization.speakerNames || {} : {};
    const uniqueSpeakerIds = [
      ...new Set(segments.map((segment) => String(segment?.speakerId ?? '')).filter(Boolean)),
    ];
    const speakers = new Array(uniqueSpeakerIds.length);
    const concurrency = Math.min(3, Math.max(1, uniqueSpeakerIds.length));
    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < uniqueSpeakerIds.length) {
        const index = cursor;
        cursor += 1;
        const speakerId = uniqueSpeakerIds[index];
        const clipPath = await this.pipeline.extractSpeakerAudioClip(
          asset,
          speakerId,
          segments,
          options
        );
        try {
          const metrics = await this.pipeline.analyzeAcousticFeatures(clipPath, options);
          speakers[index] = {
            speakerId,
            speakerName: String(
              speakerNames?.[speakerId] ||
                segments.find((segment) => String(segment?.speakerId ?? '') === speakerId)
                  ?.speakerName ||
                `Speaker ${Number(speakerId) + 1}`
            ),
            ...metrics,
          };
        } finally {
          try {
            await fs11.unlink(clipPath);
          } catch (_) {}
        }
      }
    });
    await Promise.all(workers);
    return { speakers: speakers.filter(Boolean) };
  }
  async createVoiceProfileFromSpeaker(asset, speakerId, speakerName, userId, options = {}) {
    const fs11 = await import('node:fs');
    const path12 = await import('node:path');
    const crypto11 = await import('node:crypto');
    let segments = [];
    try {
      segments = JSON.parse(asset.transcript_json || '[]');
    } catch (_) {}
    if (!segments.length) throw new Error('Brak transkrypcji w bazie.');
    const clipPath = await this.pipeline.extractSpeakerAudioClip(
      asset,
      speakerId,
      segments,
      options
    );
    try {
      const embedding = await this.computeEmbedding(clipPath);
      const profileId = `vp_${crypto11.randomUUID().replace(/-/g, '')}`;
      const newPath = path12.join(this.db.uploadDir, `${profileId}.wav`);
      fs11.renameSync(clipPath, newPath);
      const profile = await this.workspaceService.saveVoiceProfile({
        id: profileId,
        userId,
        workspaceId: asset.workspace_id,
        speakerName,
        audioPath: newPath,
        embedding: embedding || [],
      });
      return profile;
    } finally {
      try {
        fs11.unlinkSync(clipPath);
      } catch (_) {}
    }
  }
  async diarizeFromTranscript(whisperLike, options = {}) {
    return this.pipeline.diarizeFromTranscript(whisperLike, options);
  }
  async transcribeLiveChunk(tmpPath, contentType, options = {}) {
    return this.pipeline.transcribeLiveChunk(tmpPath, contentType, options);
  }
  async analyzeMeetingWithOpenAI(data) {
    return this.pipeline.analyzeMeetingWithOpenAI(data);
  }
  async computeEmbedding(audioPath) {
    if (!this.speakerEmbedder) {
      const { computeEmbedding: computeEmbedding2 } = await Promise.resolve().then(
        () => (init_speakerEmbedder(), speakerEmbedder_exports)
      );
      this.speakerEmbedder = { computeEmbedding: computeEmbedding2 };
    }
    return this.speakerEmbedder.computeEmbedding(audioPath);
  }
  async vectorizeTranscriptionResultToRAG(workspaceId, recordingId, segments) {
    if (!this.audioPipeline?.embedTextChunks) return;
    const crypto11 = await import('node:crypto');
    const chunks = [];
    for (let i = 0; i < segments.length; i += 3) {
      const slice = segments.slice(i, i + 3);
      if (!slice.length) continue;
      const text = slice.map((s) => s.text).join(' ');
      if (text.length < 15) continue;
      chunks.push(
        new Document2({
          pageContent: text,
          metadata: {
            id: `rc_${crypto11.randomUUID().replace(/-/g, '')}`,
            workspaceId,
            recordingId,
            recording_id: recordingId,
            speakerName: slice[0].speakerId || 'Nieznany',
            createdAt: /* @__PURE__ */ new Date().toISOString(),
          },
        })
      );
    }
    if (!chunks.length) return;
    const vectorStore = new RagVectorStore({
      workspaceId,
      db: this.db,
      embedTextChunks: this.audioPipeline.embedTextChunks.bind(this.audioPipeline),
    });
    await vectorStore.addDocuments(chunks);
    console.log(`[RAG] Pomyslnie zindeksowano ${chunks.length} wektorow na archiwum spotkania.`);
  }
  async queryRAG(workspaceId, question) {
    if (!this.audioPipeline?.embedTextChunks) return null;
    const vectorStore = new RagVectorStore({
      workspaceId,
      db: this.db,
      embedTextChunks: this.audioPipeline.embedTextChunks.bind(this.audioPipeline),
    });
    const retriever = vectorStore.asRetriever({
      k: 15,
      tags: ['rag', 'retrieval'],
      metadata: { workspaceId, questionLength: question.length },
    });
    const docs = await retriever.invoke(question);
    if (!Array.isArray(docs) || docs.length === 0) return null;
    return docs.map((doc) => ({
      recording_id:
        doc.metadata?.recordingId || doc.metadata?.recording_id || doc.metadata?.id || '',
      speaker_name: doc.metadata?.speakerName || '',
      text: doc.pageContent || '',
      score: doc.metadata?.score || 0,
    }));
  }
};

// server/audioPipeline.ts
var audioPipeline_exports = {};
__export(audioPipeline_exports, {
  analyzeAcousticFeatures: () => analyzeAcousticFeatures,
  analyzeAudioQuality: () => analyzeAudioQuality,
  analyzeMeetingWithOpenAI: () => analyzeMeetingWithOpenAI,
  buildAudioPreprocessCacheKey: () => buildAudioPreprocessCacheKey,
  diarizeFromTranscript: () => diarizeFromTranscript,
  embedTextChunks: () => embedTextChunks,
  extractSpeakerAudioClip: () => extractSpeakerAudioClip,
  generateVoiceCoaching: () => generateVoiceCoaching,
  getPreprocessCachePath: () => getPreprocessCachePath,
  isPreprocessCacheFile: () => isPreprocessCacheFile,
  normalizeRecording: () => normalizeRecording,
  preprocessAudio: () => preprocessAudio,
  transcribeLiveChunk: () => transcribeLiveChunk,
  transcribeRecording: () => transcribeRecording,
});

// server/pipeline.ts
init_config();
init_logger();
init_speakerEmbedder();

// server/stt/modelSelector.ts
init_config();
function getSttModelForProcessingMode(processingMode) {
  if (processingMode === 'fast') {
    return config.VOICELOG_STT_MODEL_FAST || 'whisper-1';
  }
  return config.VOICELOG_STT_MODEL_FULL || 'whisper-1';
}

// server/transcription.ts
init_config();

// server/lib/httpClient.ts
var MAX_RETRIES = 3;
function mergeAbortSignals(signals) {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return controller.signal;
}
function isRetryableNetworkError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('enetunreach') ||
    msg.includes('abort')
  );
}
async function httpClient(url, options = {}) {
  const { method = 'GET', headers = {}, body, signal, timeout = 12e4 } = options;
  let lastError = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    let timeoutId;
    try {
      timeoutId = setTimeout(() => controller.abort(), timeout);
      const mergedSignal = signal
        ? mergeAbortSignals([signal, controller.signal])
        : controller.signal;
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      const response = await fetch(url, {
        method,
        headers: {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        body: isFormData ? body : body && typeof body !== 'string' ? JSON.stringify(body) : body,
        signal: mergedSignal,
      });
      clearTimeout(timeoutId);
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        text: async () => response.text(),
        json: async () => response.json(),
      };
    } catch (error) {
      lastError = error;
      clearTimeout(timeoutId);
      if (signal?.aborted) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw error;
      }
      if (!isRetryableNetworkError(error)) {
        throw error;
      }
      if (attempt < MAX_RETRIES - 1) {
        const delay = 200 * Math.pow(2, attempt);
        console.log(
          `[httpClient] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms due to: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  if (lastError) {
    const cause = lastError?.cause?.message || lastError?.cause?.code || '';
    if (cause && !lastError.message.includes(cause)) {
      lastError.message = `${lastError.message} (${cause})`;
    }
  }
  throw lastError || new Error('Request failed after retries');
}

// server/stt/providers.ts
var MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024;
function ensureAudioBuffer(request) {
  const audioBuffer =
    request.buffer || (request.filePath ? fs5.readFileSync(request.filePath) : null);
  if (!audioBuffer) {
    throw new Error('Brakuje audio buffer albo filePath dla STT request.');
  }
  if (audioBuffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error('Plik audio przekracza limit 24 MB dla API transkrypcji.');
  }
  return audioBuffer;
}
var VALID_STT_EXTENSIONS = /* @__PURE__ */ new Set([
  '.flac',
  '.mp3',
  '.mp4',
  '.mpeg',
  '.mpga',
  '.m4a',
  '.ogg',
  '.opus',
  '.wav',
  '.webm',
]);
function ensureValidSttFilename(filename) {
  const ext = path6.extname(filename).toLowerCase();
  if (VALID_STT_EXTENSIONS.has(ext)) return filename;
  return ext ? filename.slice(0, -ext.length) + '.webm' : filename + '.webm';
}
function createFormData(request) {
  const audioBuffer = ensureAudioBuffer(request);
  const form = new FormData();
  const rawFilename =
    request.filename || (request.filePath ? path6.basename(request.filePath) : 'audio.wav');
  const safeFilename = ensureValidSttFilename(rawFilename);
  form.append(
    'file',
    new File([audioBuffer], safeFilename, {
      type: request.contentType || 'application/octet-stream',
    })
  );
  Object.entries(request.fields || {}).forEach(([key, value]) => {
    if (value === void 0 || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        form.append(`${key}[]`, String(entry));
      });
      return;
    }
    form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  return form;
}
function parseJsonResponse(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch (_) {
    return null;
  }
}
async function runProviderRequest(provider, request) {
  if (!provider.isAvailable()) {
    throw new Error(`STT provider ${provider.id} nie jest skonfigurowany.`);
  }
  const url = `${provider.baseUrl}/audio/transcriptions`;
  const model = request.fields?.model || provider.defaultModel;
  console.log(`[stt] ${provider.id} model=${model} \u2192 POST ${url}`);
  let response;
  try {
    response = await httpClient(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: createFormData(request),
      signal: request.signal,
      timeout: 12e4,
    });
  } catch (err) {
    const cause = err?.cause?.message || err?.cause?.code || '';
    const detail = cause ? ` (cause: ${cause})` : '';
    console.warn(`[stt] ${provider.id} network error: ${err?.message}${detail} url=${url}`);
    throw err;
  }
  const rawBody = await response.text();
  if (!response.ok) {
    const payload = parseJsonResponse(rawBody);
    const msg =
      payload?.error?.message || `STT audio request failed with status ${response.status}.`;
    console.warn(
      `[stt] ${provider.id} failed: status=${response.status} body=${rawBody.slice(0, 300)}`
    );
    throw new Error(msg);
  }
  return parseJsonResponse(rawBody);
}
function createProvider(config2) {
  return {
    ...config2,
    isAvailable() {
      return Boolean(config2.apiKey);
    },
    async transcribeAudio(request) {
      return runProviderRequest(this, request);
    },
  };
}
function resolveConfiguredSttProviders(input) {
  const registry = {
    openai: createProvider({
      id: 'openai',
      label: 'OpenAI STT',
      apiKey: input.openAiApiKey || '',
      baseUrl: input.openAiBaseUrl || 'https://api.openai.com/v1',
      defaultModel: input.openAiModel || 'gpt-4o-transcribe',
    }),
    groq: createProvider({
      id: 'groq',
      label: 'Groq Whisper',
      apiKey: input.groqApiKey || '',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: input.groqModel || 'whisper-large-v3',
    }),
  };
  const sequence = [];
  sequence.push(registry[input.preferredProvider]);
  if (
    input.fallbackProvider &&
    input.fallbackProvider !== 'none' &&
    input.fallbackProvider !== input.preferredProvider
  ) {
    sequence.push(registry[input.fallbackProvider]);
  }
  return sequence.filter((provider, index, all) => provider && all.indexOf(provider) === index);
}
async function transcribeWithProviders(providers, requestFactory) {
  const attempts = [];
  let lastError = null;
  for (const provider of providers) {
    if (!provider?.isAvailable()) {
      continue;
    }
    const startedAt = performance.now();
    try {
      const payload = await provider.transcribeAudio(requestFactory(provider));
      attempts.push({
        providerId: provider.id,
        providerLabel: provider.label,
        model: String(requestFactory(provider).fields?.model || provider.defaultModel),
        success: true,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return {
        payload,
        providerId: provider.id,
        providerLabel: provider.label,
        model: String(requestFactory(provider).fields?.model || provider.defaultModel),
        attempts,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempts.push({
        providerId: provider.id,
        providerLabel: provider.label,
        model: String(requestFactory(provider).fields?.model || provider.defaultModel),
        success: false,
        durationMs: Math.round(performance.now() - startedAt),
        errorMessage: lastError.message,
      });
    }
  }
  const finalError = lastError || new Error('Brak skonfigurowanego providera STT.');
  finalError.sttAttempts = attempts;
  throw finalError;
}

// server/audioPipeline.utils.ts
init_config();
var HALLUCINATION_PATTERNS = [
  // English filler phrases Whisper produces on silence for non-English audio
  /^(thank you\.?|thanks for watching\.?|thanks for watching!|please like and subscribe\.?|see you next time\.?|don't forget to like and subscribe\.?)$/i,
  /^(goodbye\.?|bye\.?|bye bye\.?|good bye\.?|see you\.?|ciao\.?)$/i,
  /^(okay\.?|ok\.?|alright\.?|all right\.?)$/i,
  /^(yes\.?|no\.?|sure\.?|right\.?|correct\.?)$/i,
  // Polish hallucinations
  /^(dziękuję\.?|dziękuję ci\.?|dziękuję za obejrzenie\.?|do widzenia\.?|na razie\.?|hej\.?)$/i,
  /^(tak\.?|nie\.?|dobrze\.?|okej\.?|okej\.?)$/i,
  // Music / non-speech markers
  /\[music\]|\[applause\]|\[laughter\]|\[noise\]|\[silence\]|\[inaudible\]/i,
  /^♪|♪$/,
  // Only punctuation / ellipsis
  /^[.…,;!?]+$/,
  // Very common Whisper repetition artifact on silence
  /^(mm+|hmm+|uhh+|ahh+|ehh+)\.?$/i,
];
var DEFAULT_WHISPER_PROMPT = 'j\u0119zyk polski, spotkanie, dyskusja, pytania, odpowiedzi,';
var VERIFY_CONFIDENCE_THRESHOLD = 0.52;
var VERIFY_SCORE_THRESHOLD = 0.65;
var CHUNK_DURATION_SECONDS = 540;
var CHUNK_OVERLAP_SECONDS = Math.max(0, Number(config.VOICELOG_CHUNK_OVERLAP_SECONDS || 5));
var MAX_FILE_SIZE_BYTES2 = 24 * 1024 * 1024;
function clean(value) {
  return String(value || '').trim();
}
function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);
}
function textSimilarity(left, right) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const denominator = Math.max(leftSet.size, rightSet.size, 1);
  return clamp(intersection / denominator, 0, 1);
}
function hasRepeatedPhrase(text) {
  const tokens = tokenize(text);
  if (tokens.length < 4) {
    return false;
  }
  return new Set(tokens).size <= Math.ceil(tokens.length / 2.4);
}
function isHallucination(text) {
  const t = clean(text);
  if (!t || t.length < 2) return true;
  if (HALLUCINATION_PATTERNS.some((pattern) => pattern.test(t))) return true;
  if (hasRepeatedPhrase(t)) return true;
  return false;
}
function removeConsecutiveDuplicates(segments) {
  const result = [];
  for (const seg of segments) {
    const t = clean(seg.text);
    const isDup = result.slice(-3).some((prev) => textSimilarity(clean(prev.text), t) >= 0.85);
    if (!isDup) result.push(seg);
  }
  return result;
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function tokenEditDistance(left, right) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const substitutionCost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + substitutionCost
      );
    }
  }
  return matrix[left.length][right.length];
}
function computeWerProxy(referenceText, hypothesisText) {
  const referenceTokens = tokenize(referenceText);
  const hypothesisTokens = tokenize(hypothesisText);
  const denominator = Math.max(referenceTokens.length, hypothesisTokens.length, 1);
  if (!referenceTokens.length && !hypothesisTokens.length) {
    return 0;
  }
  const distance = tokenEditDistance(referenceTokens, hypothesisTokens);
  return clamp(distance / denominator, 0, 1);
}
function parseDbNumber(raw, fallback = 0) {
  if (raw == null || raw === '') return fallback;
  const match = String(raw).match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function mergeShortSegments(segments, minDuration = 1.2) {
  if (segments.length < 2) return segments;
  const result = [];
  let pending = null;
  for (const seg of segments) {
    const duration = (seg.endTimestamp || seg.timestamp) - seg.timestamp;
    if (!pending) {
      pending = { ...seg };
      continue;
    }
    if (duration < minDuration && seg.speakerId === pending.speakerId) {
      pending = {
        ...pending,
        text: `${pending.text} ${seg.text}`.trim(),
        endTimestamp: seg.endTimestamp,
        // Keep the lower verification score to preserve review flags
        verificationScore: Math.min(pending.verificationScore ?? 1, seg.verificationScore ?? 1),
        verificationStatus: [pending.verificationStatus, seg.verificationStatus].includes('review')
          ? 'review'
          : 'verified',
      };
    } else {
      result.push(pending);
      pending = { ...seg };
    }
  }
  if (pending) result.push(pending);
  return result;
}
function estimateQualityScore(text) {
  const normalizedText = clean(text);
  let score = 0.82;
  if (!normalizedText) {
    return 0.15;
  }
  if (normalizedText.length < 8) {
    score -= 0.16;
  }
  if (/^(yyy+|eee+|mmm+|hmm+|aaa+)$/i.test(normalizedText)) {
    score -= 0.2;
  }
  if (hasRepeatedPhrase(normalizedText)) {
    score -= 0.12;
  }
  if (/[?]{2,}/.test(normalizedText)) {
    score -= 0.08;
  }
  return clamp(score, 0, 1);
}
function normalizeSpeakerLabel(label, index) {
  const safeLabel = clean(label);
  if (!safeLabel || /^[A-Z]$/i.test(safeLabel) || /^speaker[_ -]?\w*$/i.test(safeLabel)) {
    return `Speaker ${index + 1}`;
  }
  return safeLabel;
}
function getRawWords(payload) {
  if (Array.isArray(payload?.words)) return payload.words;
  if (Array.isArray(payload?.transcript?.words)) return payload.transcript.words;
  if (Array.isArray(payload?.results?.words)) return payload.results.words;
  return [];
}
function synthesizeSegmentsFromWords(payload) {
  const words = getRawWords(payload)
    .map((word, index) => {
      const text = clean(word?.word || word?.text || word?.token || word?.content);
      if (!text) return null;
      const start = Number(word?.start ?? word?.start_time ?? word?.offset ?? 0);
      const end = Number(word?.end ?? word?.end_time ?? word?.offset_end ?? start);
      return {
        text,
        start: Number.isFinite(start) ? start : 0,
        end: Number.isFinite(end) && end > start ? end : start + 0.45,
        index,
      };
    })
    .filter(Boolean);
  if (words.length) {
    const segments = [];
    let current = null;
    const flushCurrent = () => {
      if (!current || !current.words.length) return;
      const joinedText = current.words
        .map((word) => word.text)
        .join(' ')
        .trim();
      if (!joinedText) return;
      const start = current.words[0].start;
      const lastWord = current.words[current.words.length - 1];
      const end = Math.max(start + 0.8, lastWord.end);
      segments.push({
        id: `seg_${cryptoRandomId()}`,
        text: joinedText,
        timestamp: start,
        endTimestamp: end,
        speakerId: 0,
        rawSpeakerLabel: 'speaker_0',
      });
    };
    for (const word of words) {
      if (!current) {
        current = { words: [word] };
        continue;
      }
      const previousWord = current.words[current.words.length - 1];
      const gap = Math.max(0, word.start - previousWord.end);
      const punctuationBreak = /[.!?…:]$/.test(previousWord.text);
      const maxWordCount = current.words.length >= 18;
      const maxDuration = word.end - current.words[0].start >= 12;
      if (gap > 1.2 || punctuationBreak || maxWordCount || maxDuration) {
        flushCurrent();
        current = { words: [word] };
      } else {
        current.words.push(word);
      }
    }
    flushCurrent();
    return {
      segments,
      text: segments
        .map((segment) => segment.text)
        .join(' ')
        .trim(),
    };
  }
  const rawText = clean(payload?.text || payload?.transcript || payload?.results?.text);
  if (!rawText) {
    return { segments: [], text: '' };
  }
  const estimatedDuration = Math.max(1.5, tokenize(rawText).length * 0.42);
  return {
    segments: [
      {
        id: `seg_${cryptoRandomId()}`,
        text: rawText,
        timestamp: 0,
        endTimestamp: estimatedDuration,
        speakerId: 0,
        rawSpeakerLabel: 'speaker_0',
      },
    ],
    text: rawText,
  };
}
function normalizeDiarizedSegments(payload) {
  const rawSegments = Array.isArray(payload?.segments)
    ? payload.segments
    : Array.isArray(payload?.transcript?.segments)
      ? payload.transcript.segments
      : Array.isArray(payload?.utterances)
        ? payload.utterances
        : Array.isArray(payload?.transcript?.utterances)
          ? payload.transcript.utterances
          : [];
  const synthesized = !rawSegments.length ? synthesizeSegmentsFromWords(payload) : null;
  const speakerOrder = /* @__PURE__ */ new Map();
  const speakerNames = {};
  const segments = (rawSegments.length ? rawSegments : synthesized?.segments || [])
    .map((segment, index) => {
      const text = clean(segment.text || segment.transcript || segment.content);
      if (!text) {
        return null;
      }
      const rawSpeakerLabel = clean(
        (segment.speaker !== void 0 && segment.speaker !== null ? String(segment.speaker) : null) ||
          (segment.speaker_label !== void 0 && segment.speaker_label !== null
            ? String(segment.speaker_label)
            : null) ||
          (segment.speakerId !== void 0 && segment.speakerId !== null
            ? String(segment.speakerId)
            : null) ||
          (segment.speaker_id !== void 0 && segment.speaker_id !== null
            ? String(segment.speaker_id)
            : null) ||
          `speaker_${index}`
      );
      if (!speakerOrder.has(rawSpeakerLabel)) {
        const nextSpeakerId = speakerOrder.size;
        speakerOrder.set(rawSpeakerLabel, nextSpeakerId);
        speakerNames[String(nextSpeakerId)] = normalizeSpeakerLabel(rawSpeakerLabel, nextSpeakerId);
      }
      const speakerId = speakerOrder.get(rawSpeakerLabel);
      const start = Number(segment.start ?? segment.start_time ?? segment.offset ?? 0) || 0;
      const providedEnd = Number(segment.end ?? segment.end_time ?? start) || start;
      const estimatedDuration = Math.max(1.5, tokenize(text).length * 0.42);
      const end = providedEnd > start ? providedEnd : start + estimatedDuration;
      return {
        id: clean(segment.id) || `seg_${cryptoRandomId()}`,
        text,
        timestamp: start,
        endTimestamp: Math.max(start, end),
        speakerId,
        rawSpeakerLabel,
      };
    })
    .filter(Boolean);
  return {
    segments,
    speakerNames,
    speakerCount: Object.keys(speakerNames).length,
    text: clean(
      payload?.text ||
        payload?.transcript ||
        synthesized?.text ||
        segments.map((segment) => segment.text).join(' ')
    ),
  };
}
function normalizeVerificationSegments(payload) {
  const rawSegments = Array.isArray(payload?.segments) ? payload.segments : [];
  if (!rawSegments.length) {
    return (synthesizeSegmentsFromWords(payload)?.segments || []).map((segment) => ({
      text: segment.text,
      start: segment.timestamp,
      end: segment.endTimestamp,
      avgLogprob: null,
      noSpeechProb: null,
    }));
  }
  return rawSegments
    .map((segment) => ({
      text: clean(segment.text || segment.transcript),
      start: Number(segment.start ?? segment.start_time ?? 0) || 0,
      end: Number(segment.end ?? segment.end_time ?? 0) || 0,
      avgLogprob: Number.isFinite(Number(segment.avg_logprob)) ? Number(segment.avg_logprob) : null,
      noSpeechProb: Number.isFinite(Number(segment.no_speech_prob))
        ? Number(segment.no_speech_prob)
        : null,
    }))
    .filter((segment) => segment.text);
}
function overlapSeconds(left, right) {
  return Math.max(
    0,
    Math.min(left.endTimestamp, right.end) - Math.max(left.timestamp, right.start)
  );
}
function evaluateAgainstVerificationPass(segment, verificationSegments) {
  const overlaps = verificationSegments.filter(
    (candidate) => overlapSeconds(segment, candidate) > 0.08
  );
  if (!overlaps.length) {
    return {
      whisperConfidence: 0.42,
      alignmentScore: 0.34,
      comparisonText: '',
      reasons: ['brak nakladajacego sie fragmentu w przebiegu weryfikujacym'],
    };
  }
  const weightedLogprobParts = overlaps
    .filter((candidate) => Number.isFinite(candidate.avgLogprob))
    .map((candidate) => {
      const overlap = overlapSeconds(segment, candidate) || 1;
      return {
        overlap,
        weighted: Math.exp(Math.min(0, candidate.avgLogprob)) * overlap,
      };
    });
  const totalOverlap = weightedLogprobParts.reduce((sum, item) => sum + item.overlap, 0);
  const whisperConfidence = totalOverlap
    ? clamp(weightedLogprobParts.reduce((sum, item) => sum + item.weighted, 0) / totalOverlap, 0, 1)
    : 0.68;
  const comparisonText = overlaps.map((candidate) => candidate.text).join(' ');
  const alignmentScore = textSimilarity(segment.text, comparisonText);
  const reasons = [];
  if (whisperConfidence < VERIFY_CONFIDENCE_THRESHOLD) {
    reasons.push('niska pewnosc ASR w przebiegu weryfikujacym');
  }
  if (alignmentScore < 0.45) {
    reasons.push('tekst rozni sie od przebiegu weryfikujacego');
  }
  if (overlaps.some((candidate) => Number(candidate.noSpeechProb || 0) > 0.55)) {
    reasons.push('fragment przypomina cisze lub szum');
  }
  return {
    whisperConfidence,
    alignmentScore,
    comparisonText,
    reasons,
  };
}
function buildVerificationResult(diarizedSegments, verificationSegments) {
  const verifiedSegments = diarizedSegments.map((segment, index) => {
    const qualityScore = estimateQualityScore(segment.text);
    const verification = evaluateAgainstVerificationPass(segment, verificationSegments);
    const previousSegment = diarizedSegments[index - 1];
    const reasons = [...verification.reasons];
    if (previousSegment && normalizeText(previousSegment.text) === normalizeText(segment.text)) {
      reasons.push('duplikat poprzedniego fragmentu');
    }
    if (segment.text.length < 8) {
      reasons.push('bardzo krotki fragment');
    }
    if (hasRepeatedPhrase(segment.text)) {
      reasons.push('powtarzajace sie slowa');
    }
    const verificationScore = clamp(
      qualityScore * 0.22 +
        verification.whisperConfidence * 0.38 +
        verification.alignmentScore * 0.4,
      0,
      1
    );
    return {
      ...segment,
      rawConfidence: verification.whisperConfidence,
      verificationScore,
      verificationStatus: verificationScore >= VERIFY_SCORE_THRESHOLD ? 'verified' : 'review',
      verificationReasons: [...new Set(reasons)],
      verificationEvidence: {
        alignmentScore: verification.alignmentScore,
        whisperConfidence: verification.whisperConfidence,
        comparisonText: verification.comparisonText,
      },
    };
  });
  return {
    verifiedSegments,
    confidence: average(verifiedSegments.map((segment) => segment.verificationScore)),
  };
}
function buildEmptyTranscriptResult(reason, transcriptionDiagnostics = {}, audioQuality = null) {
  const errorMessages = {
    no_segments_from_stt: {
      user: 'API transkrypcji nie zwr\xF3ci\u0142o \u017Cadnych segment\xF3w.',
      detailed: 'Sprawd\u017A jako\u015B\u0107 audio lub spr\xF3buj innego formatu.',
    },
    segments_removed_by_vad: {
      user: 'Wykryto cisz\u0119 - segmenty zosta\u0142y usuni\u0119te.',
      detailed: 'VAD usun\u0105\u0142 wszystkie segmenty jako cisz\u0119.',
    },
    segments_removed_as_hallucinations: {
      user: 'Wykryto zniekszta\u0142cenia - transkrypcja odrzucona.',
      detailed: `WER: ${transcriptionDiagnostics?.wer || 'N/A'}.`,
    },
    all_chunks_discarded_as_too_small: {
      user: 'Plik jest za kr\xF3tki do przetworzenia.',
      detailed: 'Wszystkie chunki zosta\u0142y odrzucone jako za ma\u0142e.',
    },
  };
  const messages = errorMessages[reason] || {
    user: 'Nie wykryto wypowiedzi w nagraniu.',
    detailed: 'Nieznany b\u0142\u0105d przetwarzania.',
  };
  return {
    providerId: 'stt-pipeline',
    providerLabel: 'STT + diarization',
    pipelineStatus: 'completed',
    transcriptOutcome: 'empty',
    emptyReason: reason,
    userMessage: messages.user,
    audioQuality,
    transcriptionDiagnostics: {
      ...transcriptionDiagnostics,
      detailedReason: messages.detailed,
      timestamp: /* @__PURE__ */ new Date().toISOString(),
      suggestions: [
        'Sprawd\u017A jako\u015B\u0107 nagrania (g\u0142o\u015Bno\u015B\u0107, szumy t\u0142a)',
        'Upewnij si\u0119 \u017Ce plik jest w obs\u0142ugiwanym formacie (WAV, MP3, FLAC, WebM)',
        'Je\u015Bli u\u017Cywasz API, sprawd\u017A czy klucz jest poprawny i masz dost\u0119pne \u015Brodki',
        'Spr\xF3buj nagra\u0107 ponownie z lepszym mikrofonem',
        'Dla cichych nagra\u0144 zwi\u0119ksz gain w ustawieniach mikrofonu',
      ].filter((_, i) => i < 3),
    },
    diarization: {
      speakerNames: {},
      speakerCount: 0,
      confidence: 0,
      text: '',
      transcriptOutcome: 'empty',
      emptyReason: reason,
      userMessage: messages.user,
      audioQuality,
      transcriptionDiagnostics,
    },
    segments: [],
    speakerNames: {},
    speakerCount: 0,
    confidence: 0,
    reviewSummary: {
      needsReview: 0,
      approved: 0,
    },
  };
}
function buildWhisperPrompt(options = {}) {
  const {
    meetingTitle,
    participants,
    tags,
    vocabulary,
    basePrompt = DEFAULT_WHISPER_PROMPT,
  } = options || {};
  const parts = [basePrompt];
  if (meetingTitle) {
    parts.push(`Spotkanie: ${String(meetingTitle).trim().slice(0, 80)}.`);
  }
  if (Array.isArray(participants) && participants.length) {
    const names = participants
      .slice(0, 8)
      .map((p) => String(p).trim())
      .filter(Boolean)
      .join(', ');
    if (names) parts.push(`Uczestnicy: ${names}.`);
  }
  if (Array.isArray(tags) && tags.length) {
    const tagList = tags
      .slice(0, 6)
      .map((t) => String(t).trim())
      .filter(Boolean)
      .join(', ');
    if (tagList) parts.push(`Tematy: ${tagList}.`);
  }
  if (vocabulary) {
    parts.push(String(vocabulary).trim().slice(0, 200));
  }
  return parts.join(' ').slice(0, 900);
}
function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Math.random().toString(36).substring(2, 15);
}
function deriveFfprobeBinary(ffmpegBinary) {
  if (/ffmpeg(?:\.exe)?$/i.test(String(ffmpegBinary || ''))) {
    return String(ffmpegBinary).replace(/ffmpeg((?:\.exe)?)$/i, 'ffprobe$1');
  }
  return 'ffprobe';
}

// server/transcription.ts
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path7.dirname(__filename3);
var execPromise = promisify(exec);
var OPENAI_API_KEY = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || '';
var OPENAI_BASE_URL = config.VOICELOG_OPENAI_BASE_URL;
var AUDIO_LANGUAGE = config.AUDIO_LANGUAGE;
var GROQ_API_KEY = config.GROQ_API_KEY || '';
var _sttUseGroq = config.VOICELOG_STT_PROVIDER === 'groq' && !!GROQ_API_KEY;
var VERIFICATION_MODEL = _sttUseGroq ? 'whisper-large-v3' : config.VERIFICATION_MODEL;
var _explicitFallback = config.VOICELOG_STT_FALLBACK_PROVIDER;
var _autoFallback =
  _explicitFallback !== 'none'
    ? _explicitFallback
    : config.VOICELOG_STT_PROVIDER === 'openai' && GROQ_API_KEY
      ? 'groq'
      : config.VOICELOG_STT_PROVIDER === 'groq' && OPENAI_API_KEY
        ? 'openai'
        : 'none';
var STT_PROVIDER_CHAIN = resolveConfiguredSttProviders({
  preferredProvider: config.VOICELOG_STT_PROVIDER,
  fallbackProvider: _autoFallback,
  openAiApiKey: OPENAI_API_KEY,
  openAiBaseUrl: OPENAI_BASE_URL,
  groqApiKey: GROQ_API_KEY,
  openAiModel: config.VERIFICATION_MODEL,
  groqModel: 'whisper-large-v3',
});
if (STT_PROVIDER_CHAIN.length === 0) {
  console.warn('[stt] WARNING: No STT providers configured. Set OPENAI_API_KEY or GROQ_API_KEY.');
} else {
  console.log(
    `[stt] Provider chain: ${STT_PROVIDER_CHAIN.map((p) => p.id).join(' \u2192 ')}${_autoFallback !== _explicitFallback ? ` (auto-detected ${_autoFallback} fallback)` : ''}`
  );
  STT_PROVIDER_CHAIN.forEach((p) =>
    console.log(
      `[stt]   ${p.id}: model=${p.defaultModel} url=${p.baseUrl}/audio/transcriptions key=${p.apiKey ? p.apiKey.slice(0, 8) + '...' : 'MISSING'}`
    )
  );
}
var AUDIO_PREPROCESS = config.AUDIO_PREPROCESS;
var SILENCE_REMOVE = config.VOICELOG_SILENCE_REMOVE;
var FFMPEG_BINARY2 = config.FFMPEG_BINARY;
var VAD_ENABLED = config.VAD_ENABLED;
var VAD_SCRIPT = path7.join(__dirname3, 'vad.py');
var PYTHON_BINARY = config.PYTHON_BINARY;
var DEBUG = process.env.VOICELOG_DEBUG === 'true';
var AUDIO_PREPROCESS_CACHE_VERSION = 'v1';
var MIN_OVERLAP_SECONDS = 0.5;
var MAX_OVERLAP_SECONDS = 2;
var SPEECH_DENSITY_THRESHOLD = 0.6;
function calculateAdaptiveOverlap(speechSegments, baseOverlap) {
  if (!speechSegments || speechSegments.length === 0) {
    return MIN_OVERLAP_SECONDS;
  }
  const totalDuration = speechSegments.reduce(
    (max, seg) => Math.max(max, seg.end || seg.endTimestamp || 0),
    0
  );
  if (totalDuration <= 0) return MIN_OVERLAP_SECONDS;
  const speechDuration = speechSegments.reduce((sum, seg) => {
    const start = seg.start || seg.startTimestamp || 0;
    const end = seg.end || seg.endTimestamp || 0;
    return sum + (end - start);
  }, 0);
  const density = speechDuration / totalDuration;
  if (density >= SPEECH_DENSITY_THRESHOLD) {
    return MAX_OVERLAP_SECONDS;
  } else if (density >= SPEECH_DENSITY_THRESHOLD / 2) {
    return (MIN_OVERLAP_SECONDS + MAX_OVERLAP_SECONDS) / 2;
  } else {
    return MIN_OVERLAP_SECONDS;
  }
}
function getUploadDir() {
  return config.VOICELOG_UPLOAD_DIR || path7.join(__dirname3, 'data', 'uploads');
}
function getPreprocessCacheDir() {
  return path7.join(getUploadDir(), '.cache', 'preprocessed');
}
function buildAudioPreprocessCacheKey(asset, profile) {
  const parts = [
    AUDIO_PREPROCESS_CACHE_VERSION,
    profile,
    clean(asset?.id || ''),
    clean(asset?.file_path || ''),
    clean(asset?.updated_at || asset?.updatedAt || asset?.created_at || asset?.createdAt || ''),
    String(asset?.size_bytes || asset?.sizeBytes || 0),
    clean(asset?.content_type || ''),
  ];
  return crypto7.createHash('sha256').update(parts.join('|')).digest('hex');
}
function getPreprocessCachePath(cacheKey, profile) {
  return path7.join(getPreprocessCacheDir(), `${cacheKey}.${profile}.wav`);
}
function isPathInside(childPath, parentPath) {
  const relative = path7.relative(path7.resolve(parentPath), path7.resolve(childPath));
  return relative !== '' && !relative.startsWith('..') && !path7.isAbsolute(relative);
}
function isPreprocessCacheFile(filePath) {
  return Boolean(filePath && isPathInside(filePath, getPreprocessCacheDir()));
}
function resolveStoredAudioQuality(asset) {
  try {
    const payload = JSON.parse(asset?.diarization_json || '{}');
    return payload?.audioQuality && typeof payload.audioQuality === 'object'
      ? payload.audioQuality
      : null;
  } catch (_) {
    return null;
  }
}
async function analyzeAudioQuality(filePath, options = {}) {
  if (options.signal?.aborted) return { error: 'Aborted' };
  let tempFilePath = '';
  try {
    if (filePath && !filePath.includes(path7.sep) && !filePath.includes('/')) {
      const { downloadAudioFromStorage: downloadAudioFromStorage2 } = await Promise.resolve().then(
        () => (init_supabaseStorage(), supabaseStorage_exports)
      );
      const buffer = await downloadAudioFromStorage2(filePath);
      const baseMime = String(options.contentType || '')
        .toLowerCase()
        .split(';')[0]
        .trim();
      const ext =
        {
          'audio/webm': '.webm',
          'audio/mpeg': '.mp3',
          'audio/mp4': '.m4a',
          'audio/wav': '.wav',
          'audio/ogg': '.ogg',
          'audio/flac': '.flac',
        }[baseMime] || '.webm';
      const uploadDir = getUploadDir();
      tempFilePath = path7.join(uploadDir, `temp_analyze_${crypto7.randomUUID()}${ext}`);
      fs6.mkdirSync(path7.dirname(tempFilePath), { recursive: true });
      fs6.writeFileSync(tempFilePath, Buffer.from(buffer));
      filePath = tempFilePath;
    }
    if (!fs6.existsSync(filePath)) return { error: 'File not found' };
    const ffprobeBinary = deriveFfprobeBinary();
    let codec = '';
    let sampleRateHz = 0;
    let channels = 0;
    let bitrateKbps = 0;
    let durationSeconds = 0;
    let meanVolumeDb = -60;
    let maxVolumeDb = -60;
    let silenceRatio = 1;
    try {
      const { stdout } = await execPromise(
        `"${ffprobeBinary}" -v quiet -print_format json -show_streams -show_format "${filePath}"`,
        { timeout: 3e4, signal: options.signal }
      );
      const parsed = JSON.parse(String(stdout || '{}'));
      const audioStream =
        (Array.isArray(parsed?.streams) ? parsed.streams : []).find(
          (stream) => stream?.codec_type === 'audio'
        ) ||
        (Array.isArray(parsed?.streams) ? parsed.streams[0] : null) ||
        {};
      codec = clean(audioStream?.codec_name || parsed?.format?.format_name || '');
      sampleRateHz = parseDbNumber(audioStream?.sample_rate, 0);
      channels = parseDbNumber(audioStream?.channels, 0);
      bitrateKbps = Math.round(
        parseDbNumber(audioStream?.bit_rate || parsed?.format?.bit_rate, 0) / 1e3
      );
      durationSeconds = parseDbNumber(audioStream?.duration || parsed?.format?.duration, 0);
    } catch (error) {
      if (!options.signal?.aborted) {
        console.warn('[transcription] ffprobe audio analysis failed:', error?.message || error);
      }
    }
    try {
      const { stderr } = await execPromise(
        `"${FFMPEG_BINARY2}" -i "${filePath}" -af "volumedetect" -f null -`,
        { timeout: 45e3, signal: options.signal }
      );
      meanVolumeDb = parseDbNumber(
        String(stderr || '').match(/mean_volume:\s*([-\d.]+)\s*dB/i)?.[1],
        meanVolumeDb
      );
      maxVolumeDb = parseDbNumber(
        String(stderr || '').match(/max_volume:\s*([-\d.]+)\s*dB/i)?.[1],
        maxVolumeDb
      );
    } catch (error) {
      if (!options.signal?.aborted) {
        console.warn('[transcription] volumedetect analysis failed:', error?.message || error);
      }
    }
    try {
      const { stderr } = await execPromise(
        `"${FFMPEG_BINARY2}" -i "${filePath}" -af "silencedetect=noise=-35dB:d=0.5" -f null -`,
        { timeout: 45e3, signal: options.signal }
      );
      const silenceDurations = String(stderr || '').match(/silence_duration:\s*([0-9.]+)/gi) || [];
      const totalSilence = silenceDurations.reduce(
        (sum, entry) => sum + parseDbNumber(entry, 0),
        0
      );
      silenceRatio =
        durationSeconds > 0 ? clamp(totalSilence / durationSeconds, 0, 1) : silenceRatio;
    } catch (error) {
      if (!options.signal?.aborted) {
        console.warn('[transcription] silencedetect analysis failed:', error?.message || error);
      }
    }
    let qualityScore = 100;
    if (sampleRateHz > 0 && sampleRateHz < 16e3) qualityScore -= 25;
    if (meanVolumeDb < -32) qualityScore -= 25;
    else if (meanVolumeDb < -24) qualityScore -= 15;
    if (silenceRatio > 0.75) qualityScore -= 25;
    else if (silenceRatio > 0.5) qualityScore -= 15;
    qualityScore = clamp(Math.round(qualityScore), 0, 100);
    let qualityLabel = 'good';
    if ((sampleRateHz > 0 && sampleRateHz < 12e3) || meanVolumeDb < -32 || silenceRatio > 0.75) {
      qualityLabel = 'poor';
    } else if (
      (sampleRateHz > 0 && sampleRateHz < 16e3) ||
      meanVolumeDb < -24 ||
      silenceRatio > 0.5
    ) {
      qualityLabel = 'fair';
    }
    const contentType = String(options.contentType || '').toLowerCase();
    const enhancementRecommended =
      qualityLabel !== 'good' || ['audio/mpeg', 'audio/mp4', 'audio/ogg'].includes(contentType);
    return {
      codec,
      sampleRateHz: sampleRateHz || void 0,
      channels: channels || void 0,
      bitrateKbps: bitrateKbps || void 0,
      durationSeconds: durationSeconds || void 0,
      meanVolumeDb,
      maxVolumeDb,
      silenceRatio,
      qualityScore,
      qualityLabel,
      enhancementRecommended,
      enhancementApplied: false,
      enhancementProfile: 'none',
    };
  } finally {
    if (tempFilePath && fs6.existsSync(tempFilePath)) {
      try {
        fs6.unlinkSync(tempFilePath);
      } catch (_) {}
    }
  }
}
async function preprocessAudio(filePath, signal, profile = 'standard', options = {}) {
  if (!AUDIO_PREPROCESS) return null;
  const cachePath = options.cacheKey
    ? getPreprocessCachePath(options.cacheKey, profile)
    : `${filePath}.prep.wav`;
  const tmpPath = options.cacheKey ? `${cachePath}.tmp-${crypto7.randomUUID()}.wav` : cachePath;
  let filter =
    profile === 'enhanced'
      ? 'highpass=f=80,lowpass=f=10000,afftdn=nf=-28:nr=0.95,dynaudnorm=p=1.0:m=30:s=12,acompressor=threshold=-21dB:ratio=3:attack=5:release=80:makeup=4,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=16000,pan=mono|c0=0.5*c0+0.5*c1'
      : 'afftdn=nf=-20:nr=0.85,highpass=f=80,lowpass=f=16000,dynaudnorm=p=0.9:m=100:s=5,aresample=resampler=swr';
  if (options.silenceRemove) {
    filter +=
      ',silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB:stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB';
  }
  try {
    if (options.cacheKey && fs6.existsSync(cachePath)) {
      return cachePath;
    }
    let durationBefore = 0;
    if (DEBUG && options.silenceRemove) {
      try {
        const ffprobeBinary = deriveFfprobeBinary();
        const { stdout } = await execPromise(
          `"${ffprobeBinary}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
          { timeout: 1e4 }
        );
        durationBefore = parseFloat(String(stdout || '0').trim()) || 0;
      } catch (_) {}
    }
    fs6.mkdirSync(path7.dirname(cachePath), { recursive: true });
    await execPromise(
      `"${FFMPEG_BINARY2}" -y -i "${filePath}" -af "${filter}" -threads 4 -ar 16000 -ac 1 "${tmpPath}"`,
      { timeout: 18e4, signal }
    );
    if (DEBUG && options.silenceRemove && durationBefore > 0) {
      try {
        const ffprobeBinary = deriveFfprobeBinary();
        const { stdout } = await execPromise(
          `"${ffprobeBinary}" -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tmpPath}"`,
          { timeout: 1e4 }
        );
        const durationAfter = parseFloat(String(stdout || '0').trim()) || 0;
        const removed = durationBefore - durationAfter;
        console.log(
          `[transcription] Silence removal: ${durationBefore.toFixed(1)}s \u2192 ${durationAfter.toFixed(1)}s (removed ${removed.toFixed(1)}s, ${durationBefore > 0 ? ((removed / durationBefore) * 100).toFixed(0) : 0}%)`
        );
      } catch (_) {}
    }
    if (options.cacheKey) {
      if (!fs6.existsSync(cachePath)) {
        fs6.renameSync(tmpPath, cachePath);
      } else {
        try {
          fs6.unlinkSync(tmpPath);
        } catch (_) {}
      }
      return cachePath;
    }
    return tmpPath;
  } catch (err) {
    if (!signal?.aborted)
      console.warn(
        `[transcription] Audio pre-processing failed for profile ${profile}, using original file.`,
        err.message
      );
    try {
      fs6.unlinkSync(tmpPath);
    } catch (_) {}
    return null;
  }
}
async function requestAudioTranscription({
  filePath,
  buffer,
  filename,
  contentType,
  fields,
  signal,
}) {
  if (!STT_PROVIDER_CHAIN.length) {
    throw new Error('Brakuje skonfigurowanego providera STT.');
  }
  return transcribeWithProviders(STT_PROVIDER_CHAIN, (provider) => ({
    filePath,
    buffer,
    filename,
    contentType,
    signal,
    fields: {
      ...(fields || {}),
      // Groq only supports its own models (e.g. whisper-large-v3), not OpenAI model names
      model:
        provider.id === 'groq' ? provider.defaultModel : fields?.model || provider.defaultModel,
    },
  }));
}
async function runSileroVAD(audioPath, signal) {
  if (!VAD_ENABLED) return null;
  if (!fs6.existsSync(VAD_SCRIPT)) {
    console.warn('[transcription] vad.py not found, skipping Silero VAD.');
    return null;
  }
  return new Promise((resolve) => {
    const child = spawn(PYTHON_BINARY, [VAD_SCRIPT, audioPath], {
      signal,
      timeout: 12e4,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.on('error', (error) => {
      console.warn('[transcription] Silero VAD spawn error:', error.message);
      resolve(null);
    });
    child.on('close', () => {
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed?.error) {
          console.warn('[transcription] Silero VAD returned error:', parsed.error);
          resolve(null);
          return;
        }
        resolve(Array.isArray(parsed) ? parsed : null);
      } catch (e) {
        if (!signal || !signal.aborted) {
          console.warn('[transcription] Silero VAD JSON parse failed:', e.message);
        }
        resolve(null);
      }
    });
  });
}
function extractAudioSegmentMemory(filePath, start, duration, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      FFMPEG_BINARY2,
      [
        '-y',
        '-i',
        filePath,
        '-ss',
        String(start),
        '-t',
        String(duration),
        '-ar',
        '16000',
        '-ac',
        '1',
        '-f',
        'wav',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'], signal }
    );
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.on('close', () => {
      resolve(Buffer.concat(chunks));
    });
    child.on('error', (e) => {
      if (signal?.aborted) return resolve(Buffer.alloc(0));
      reject(e);
    });
  });
}
function mergeChunkedPayloads(payloads, fileSizeBytes = 0) {
  const attempts = Array.isArray(payloads) ? payloads.filter(Boolean) : [];
  const safePayloads = attempts.filter(({ payload }) => payload);
  let highWater = 0;
  const allSegments = safePayloads.flatMap(({ payload, offsetSeconds }) => {
    const segs = Array.isArray(payload?.segments) ? payload.segments : [];
    const adjusted = segs.map((s) => ({
      ...s,
      start: Number(s.start || 0) + offsetSeconds,
      end: Number(s.end || 0) + offsetSeconds,
    }));
    const deduped = adjusted.filter((s) => s.start >= highWater - 0.1);
    if (deduped.length > 0) {
      highWater = Math.max(highWater, deduped[deduped.length - 1].end);
    }
    return deduped;
  });
  let wordHighWater = 0;
  const allWords = safePayloads.flatMap(({ payload, offsetSeconds }) => {
    const words = getRawWords(payload);
    const adjusted = words.map((word) => ({
      ...word,
      start: Number(word?.start ?? word?.start_time ?? word?.offset ?? 0) + offsetSeconds,
      end:
        Number(word?.end ?? word?.end_time ?? word?.offset_end ?? word?.start ?? 0) + offsetSeconds,
    }));
    const deduped = adjusted.filter((w) => w.start >= wordHighWater - 0.1);
    if (deduped.length > 0) {
      wordHighWater = Math.max(wordHighWater, deduped[deduped.length - 1].end);
    }
    return deduped;
  });
  const fullText = safePayloads
    .map(({ payload }) => payload?.text || '')
    .join(' ')
    .trim();
  const sttAttempts = attempts.flatMap(({ sttResult, diagnostics }) => {
    if (Array.isArray(sttResult?.attempts)) return sttResult.attempts;
    if (Array.isArray(diagnostics?.sttAttempts)) return diagnostics.sttAttempts;
    return [];
  });
  return {
    segments: allSegments,
    words: allWords,
    text: fullText,
    sttProviderInfo: attempts.find(({ sttResult }) => sttResult?.providerId)?.sttResult || null,
    transcriptionDiagnostics: {
      usedChunking: true,
      fileSizeBytes,
      chunksAttempted: attempts.length,
      chunksExtracted: attempts.filter(({ diagnostics }) => diagnostics?.extracted).length,
      chunksDiscardedAsTooSmall: attempts.filter(
        ({ diagnostics }) => diagnostics?.discardedAsTooSmall
      ).length,
      chunksSentToStt: attempts.filter(({ diagnostics }) => diagnostics?.sentToStt).length,
      chunksFailedAtStt: attempts.filter(({ diagnostics }) => diagnostics?.sttFailed).length,
      chunksReturnedEmptyPayload: attempts.filter(
        ({ diagnostics }) =>
          diagnostics?.sentToStt &&
          !diagnostics?.sttFailed &&
          !diagnostics?.hasSegments &&
          !diagnostics?.hasWords &&
          !diagnostics?.hasText
      ).length,
      chunksWithSegments: attempts.filter(({ diagnostics }) => diagnostics?.hasSegments).length,
      chunksWithWords: attempts.filter(({ diagnostics }) => diagnostics?.hasWords).length,
      chunksWithText: attempts.filter(({ diagnostics }) => diagnostics?.hasText).length,
      chunksFlaggedSilentByVad: attempts.filter(({ diagnostics }) => diagnostics?.vadFlaggedSilent)
        .length,
      mergedSegmentsCount: allSegments.length,
      mergedWordsCount: allWords.length,
      mergedTextLength: fullText.length,
      lastChunkErrorMessage:
        [...attempts]
          .reverse()
          .map(({ diagnostics }) => clean(diagnostics?.sttErrorMessage || ''))
          .find(Boolean) || '',
      sttAttempts,
    },
  };
}
async function transcribeInChunks(filePath, contentType, fields, options = {}) {
  if (DEBUG) console.log(`[transcription] Starting in-memory concurrent chunking...`);
  const notify = (p, m) => {
    if (typeof options.onProgress === 'function') options.onProgress({ progress: p, message: m });
  };
  const payloads = [];
  const CONCURRENCY_LIMIT = config.STT_CONCURRENCY_LIMIT || 6;
  let offsetSeconds = 0;
  let hasMore = true;
  let currentOverlap = CHUNK_OVERLAP_SECONDS;
  let allSpeechSegments = [];
  while (hasMore && !options.signal?.aborted) {
    const batchPromises = [];
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
      const currentOffset = offsetSeconds;
      offsetSeconds += CHUNK_DURATION_SECONDS - currentOverlap;
      batchPromises.push(
        (async () => {
          const diagnostics = {
            extracted: false,
            discardedAsTooSmall: false,
            vadFlaggedSilent: false,
            sentToStt: false,
            sttFailed: false,
            sttErrorMessage: '',
            hasSegments: false,
            hasWords: false,
            hasText: false,
          };
          const buffer = await extractAudioSegmentMemory(
            filePath,
            currentOffset,
            CHUNK_DURATION_SECONDS,
            options.signal
          );
          diagnostics.extracted = true;
          if (buffer.byteLength < 500) {
            diagnostics.extracted = false;
            diagnostics.discardedAsTooSmall = true;
            return { payload: null, offsetSeconds: currentOffset, diagnostics };
          }
          let chunkSpeech = null;
          if (VAD_ENABLED) {
            const tmpVad = path7.join(os3.tmpdir(), `vadsilero_${crypto7.randomUUID()}.wav`);
            fs6.writeFileSync(tmpVad, buffer);
            chunkSpeech = await runSileroVAD(tmpVad, options.signal);
            try {
              fs6.unlinkSync(tmpVad);
            } catch (_) {}
          }
          if (chunkSpeech && chunkSpeech.length > 0) {
            allSpeechSegments = allSpeechSegments.concat(
              chunkSpeech.map((seg) => ({
                start: currentOffset * 1e3 + seg.start,
                end: currentOffset * 1e3 + seg.end,
              }))
            );
            currentOverlap = calculateAdaptiveOverlap(allSpeechSegments, CHUNK_OVERLAP_SECONDS);
            if (DEBUG) {
              console.log(
                `[transcription] Adaptive overlap: ${currentOverlap.toFixed(1)}s (density-based)`
              );
            }
          }
          diagnostics.vadFlaggedSilent = Boolean(chunkSpeech && chunkSpeech.length === 0);
          try {
            diagnostics.sentToStt = true;
            const sttResult = await requestAudioTranscription({
              buffer,
              filename: `chunk_${currentOffset}.wav`,
              contentType: 'audio/wav',
              fields,
              signal: options.signal,
            });
            const payload = sttResult?.payload || null;
            diagnostics.hasSegments =
              Array.isArray(payload?.segments) && payload.segments.length > 0;
            diagnostics.hasWords = getRawWords(payload).length > 0;
            diagnostics.hasText = Boolean(
              clean(payload?.text || payload?.transcript || payload?.results?.text)
            );
            diagnostics.providerId = sttResult?.providerId || '';
            diagnostics.providerLabel = sttResult?.providerLabel || '';
            diagnostics.providerModel = sttResult?.model || '';
            return { payload, offsetSeconds: currentOffset, diagnostics, sttResult };
          } catch (error) {
            diagnostics.sentToStt = true;
            diagnostics.sttFailed = true;
            diagnostics.sttErrorMessage = clean(error?.message || 'STT request failed');
            diagnostics.sttAttempts = Array.isArray(error?.sttAttempts) ? error.sttAttempts : [];
            return { payload: null, offsetSeconds: currentOffset, diagnostics };
          }
        })()
      );
    }
    const results = await Promise.all(batchPromises);
    payloads.push(...results.filter(Boolean));
    notify(
      Math.min(60, 40 + payloads.length * 5),
      `OpenAI Batch AI \u2014 pobrano ${payloads.length} paczek audio (${Math.round(CHUNK_DURATION_SECONDS / 60)} min ka\u017Cda)...`
    );
    if (results.some((result) => result?.diagnostics?.discardedAsTooSmall)) {
      hasMore = false;
    }
  }
  return payloads;
}
async function transcribeLiveChunk(filePath, contentType, options = {}) {
  if (!STT_PROVIDER_CHAIN.length) return '';
  try {
    const sttResult = await requestAudioTranscription({
      filePath,
      contentType: contentType || 'audio/webm',
      fields: {
        model: VERIFICATION_MODEL,
        language: AUDIO_LANGUAGE,
        response_format: 'json',
        prompt: buildWhisperPrompt({
          meetingTitle: options.meetingTitle,
          participants: options.participants,
          tags: options.tags,
          vocabulary: options.vocabulary,
        }),
        temperature: 0,
      },
      signal: options.signal,
    });
    const payload = sttResult?.payload || null;
    return String(payload?.text || '').trim();
  } catch (err) {
    if (!options.signal?.aborted) {
      if (DEBUG) console.warn('[transcription] Live chunk transcription failed:', err.message);
    }
    return '';
  }
}

// server/diarization.ts
init_config();
var execPromise2 = promisify2(exec2);
var OPENAI_API_KEY2 = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || '';
var OPENAI_BASE_URL2 = config.VOICELOG_OPENAI_BASE_URL;
var HF_TOKEN = config.HF_TOKEN || config.HUGGINGFACE_TOKEN || '';
var FFMPEG_BINARY3 = config.FFMPEG_BINARY;
var VOICELOG_DIARIZER = config.VOICELOG_DIARIZER || 'auto';
var HF_TOKEN_SET = Boolean(HF_TOKEN);
var DEBUG2 = process.env.VOICELOG_DEBUG === 'true';
async function runPyannoteDiarization(audioPath, signal) {
  console.log('[diarization] Local pyannote diarization is disabled.');
  return null;
}
function mergeWithPyannote(pyannoteSegments, whisperSegments) {
  const speakerOrder = /* @__PURE__ */ new Map();
  const speakerNames = {};
  const segments = whisperSegments
    .map((wseg) => {
      const wStart = Number(wseg.start ?? 0);
      const wEnd = Number(wseg.end ?? wStart);
      const text = clean(wseg.text || wseg.transcript || '');
      if (!text) return null;
      let bestSpeaker = null;
      let bestOverlap = 0;
      for (const pseg of pyannoteSegments) {
        const overlap = Math.max(0, Math.min(wEnd, pseg.end) - Math.max(wStart, pseg.start));
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestSpeaker = pseg.speaker;
        }
      }
      const rawSpeakerLabel = bestSpeaker || 'speaker_unknown';
      if (!speakerOrder.has(rawSpeakerLabel)) {
        const nextId = speakerOrder.size;
        speakerOrder.set(rawSpeakerLabel, nextId);
        speakerNames[String(nextId)] = normalizeSpeakerLabel(rawSpeakerLabel, nextId);
      }
      const speakerId = speakerOrder.get(rawSpeakerLabel);
      const estimatedDuration = Math.max(1.5, tokenize(text).length * 0.42);
      const endTimestamp = wEnd > wStart ? wEnd : wStart + estimatedDuration;
      return {
        id: `seg_${crypto8.randomUUID().replace(/-/g, '')}`,
        text,
        timestamp: wStart,
        endTimestamp,
        speakerId,
        rawSpeakerLabel,
      };
    })
    .filter(Boolean);
  return {
    segments,
    speakerNames,
    speakerCount: Object.keys(speakerNames).length,
    text: segments.map((s) => s.text).join(' '),
  };
}
function findPyannoteSpeakerAt(timestamp, pyannoteSegments) {
  for (const pseg of pyannoteSegments) {
    if (timestamp >= pseg.start && timestamp < pseg.end) return pseg.speaker;
  }
  let nearest = null;
  let nearestDist = Infinity;
  for (const pseg of pyannoteSegments) {
    const dist = Math.min(Math.abs(timestamp - pseg.start), Math.abs(timestamp - pseg.end));
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = pseg.speaker;
    }
  }
  return nearest || 'speaker_unknown';
}
function splitSegmentsByWordSpeaker(whisperRawSegments, pyannoteSegments) {
  const hasWords = whisperRawSegments.some(
    (seg) => Array.isArray(seg.words) && seg.words.length > 0
  );
  if (!hasWords) return null;
  const speakerOrder = /* @__PURE__ */ new Map();
  const speakerNames = {};
  const resultSegments = [];
  function getSpeakerId(rawLabel) {
    if (!speakerOrder.has(rawLabel)) {
      const nextId = speakerOrder.size;
      speakerOrder.set(rawLabel, nextId);
      speakerNames[String(nextId)] = normalizeSpeakerLabel(rawLabel, nextId);
    }
    return speakerOrder.get(rawLabel);
  }
  for (const wseg of whisperRawSegments) {
    const segText = clean(wseg.text || '');
    if (!segText) continue;
    const words = Array.isArray(wseg.words) ? wseg.words : [];
    if (!words.length) {
      const midpoint = (Number(wseg.start ?? 0) + Number(wseg.end ?? 0)) / 2;
      const rawLabel = findPyannoteSpeakerAt(midpoint, pyannoteSegments);
      resultSegments.push({
        id: `seg_${crypto8.randomUUID().replace(/-/g, '')}`,
        text: segText,
        timestamp: Number(wseg.start ?? 0),
        endTimestamp: Number(wseg.end ?? wseg.start ?? 0),
        speakerId: getSpeakerId(rawLabel),
        rawSpeakerLabel: rawLabel,
      });
      continue;
    }
    let groupWords = [];
    let groupSpeaker = null;
    const flushGroup = () => {
      if (!groupWords.length || !groupSpeaker) return;
      const gText = groupWords
        .map((w) => w.word || '')
        .join('')
        .trim();
      if (!gText) return;
      const gStart = Number(groupWords[0].start ?? 0);
      const gEnd = Number(groupWords[groupWords.length - 1].end ?? gStart);
      resultSegments.push({
        id: `seg_${crypto8.randomUUID().replace(/-/g, '')}`,
        text: gText,
        timestamp: gStart,
        endTimestamp:
          gEnd > gStart ? gEnd : gStart + Math.max(0.5, gText.split(/\s+/).length * 0.3),
        speakerId: getSpeakerId(groupSpeaker),
        rawSpeakerLabel: groupSpeaker,
        words: groupWords.map((w) => ({
          word: w.word || '',
          start: Number(w.start ?? 0),
          end: Number(w.end ?? 0),
        })),
      });
    };
    for (const word of words) {
      const wordStart = Number(word.start ?? 0);
      const speaker = findPyannoteSpeakerAt(wordStart, pyannoteSegments);
      if (speaker !== groupSpeaker && groupWords.length > 0) {
        flushGroup();
        groupWords = [];
      }
      groupSpeaker = speaker;
      groupWords.push(word);
    }
    flushGroup();
  }
  if (!resultSegments.length) return null;
  return {
    segments: resultSegments,
    speakerNames,
    speakerCount: Object.keys(speakerNames).length,
    text: resultSegments.map((s) => s.text).join(' '),
  };
}
async function diarizeFromTranscript(segments, options = {}) {
  if (!OPENAI_API_KEY2 || !segments.length) return null;
  const CHUNK_SIZE = 180;
  const chunk = segments.slice(0, CHUNK_SIZE);
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };
  const lines = chunk
    .map((seg, i) => {
      const prev = chunk[i - 1];
      const silenceGap =
        prev != null
          ? Math.max(0, Number((seg.start ?? 0) - (prev.end ?? prev.start ?? 0))).toFixed(1)
          : null;
      const gapStr = silenceGap !== null ? ` [cisza ${silenceGap}s]` : '';
      return `[${i}]${gapStr} ${fmt(seg.start ?? 0)}: "${(seg.text || '').replace(/"/g, "'").slice(0, 240)}"`;
    })
    .join('\n');
  const systemPrompt =
    'You are a speaker diarization engine. Your ONLY job is to assign a speaker label (A, B, C\u2026) to each segment of a transcript from a multi-speaker recording. You MUST produce output for every segment \u2014 no skipping. Return ONLY valid JSON, no explanation.';
  const knownParticipants = (options.participants || []).filter(Boolean);
  const participantHint =
    knownParticipants.length >= 2
      ? `
Znani uczestnicy spotkania: ${knownParticipants.slice(0, 8).join(', ')}.
Litery A, B, C\u2026 odpowiadaj\u0105 kolejnym m\xF3wcom w kolejno\u015Bci ich pierwszego wyst\u0105pienia. Spr\xF3buj przypisa\u0107 tyle r\xF3\u017Cnych liter ile jest znanych uczestnik\xF3w.
`
      : '';
  const userPrompt = [
    'Nagranie rozmowy mi\u0119dzy WIELOMA osobami (co najmniej 2). To NIE jest monolog.',
    'Ka\u017Cda zmiana osoby m\xF3wi\u0105cej musi by\u0107 oznaczona inn\u0105 liter\u0105 (A, B, C\u2026).',
    participantHint,
    'SILNE SYGNA\u0141Y ZMIANY M\xD3WCY:',
    '\u2022 [cisza \u2265 0.5s] przed segmentem \u2192 prawie zawsze zmiana m\xF3wcy',
    '\u2022 [cisza \u2265 2s] \u2192 na pewno zmiana m\xF3wcy \u2014 ZAWSZE przypisz inn\u0105 liter\u0119',
    "\u2022 Kr\xF3tka odpowied\u017A ('tak', 'mhm', 'dobra', 'jasne', \u22645 s\u0142\xF3w) po d\u0142u\u017Cszej wypowiedzi \u2192 inna osoba",
    '\u2022 Pytanie \u2192 odpowied\u017A \u2192 inna osoba dla odpowiedzi',
    "\u2022 'Ja\u2026' po d\u0142ugim segmencie innej tre\u015Bci \u2192 zmiana",
    '',
    'NIGDY nie przypisuj wszystkim segmentom tej samej litery je\u015Bli s\u0105 przerwy.',
    'Minimum 2 r\xF3\u017Cnych m\xF3wc\xF3w musi by\u0107 u\u017Cytych, chyba \u017Ce transkrypt jest kr\xF3tszy ni\u017C 3 segmenty.',
    '',
    'Transkrypt ([numer] [cisza przed] czas: "tekst"):',
    lines,
    '',
    `Przypisz m\xF3wc\xF3w dla ${chunk.length} segment\xF3w.`,
    'Format: {"segments": [{"i": 0, "s": "A"}, {"i": 1, "s": "B"}, ...]}',
    'Ka\u017Cdy indeks od 0 do ' + (chunk.length - 1) + ' musi by\u0107 obecny.',
  ].join('\n');
  try {
    const resp = await fetch(`${OPENAI_BASE_URL2}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY2}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: Math.min(4096, chunk.length * 14 + 60),
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });
    if (!resp.ok) throw new Error(`OpenAI chat completions HTTP ${resp.status}`);
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    const assignments = Array.isArray(parsed?.segments) ? parsed.segments : [];
    if (!assignments.length) {
      if (DEBUG2)
        console.warn('[diarization] Transcript diarization: GPT returned empty assignments.');
      return null;
    }
    const indexToSpeaker = new Map(
      assignments.map((a) => [
        Number(a.i),
        String(a.s || 'A')
          .toUpperCase()
          .slice(0, 1),
      ])
    );
    const lastKnown = indexToSpeaker.get(chunk.length - 1) || 'A';
    const speakerOrder = /* @__PURE__ */ new Map();
    const speakerNames = {};
    const resultSegments = segments
      .map((wseg, i) => {
        const text = clean(wseg.text || '');
        if (!text) return null;
        const rawLabel = indexToSpeaker.has(i) ? indexToSpeaker.get(i) : lastKnown;
        if (!speakerOrder.has(rawLabel)) {
          const nextId = speakerOrder.size;
          speakerOrder.set(rawLabel, nextId);
          speakerNames[String(nextId)] = `Speaker ${nextId + 1}`;
        }
        const speakerId = speakerOrder.get(rawLabel);
        const start = Number(wseg.start ?? 0);
        const end = Number(wseg.end ?? start);
        const estimatedDuration = Math.max(1.5, tokenize(text).length * 0.42);
        const endTimestamp = end > start ? end : start + estimatedDuration;
        return {
          id: `seg_${crypto8.randomUUID().replace(/-/g, '')}`,
          text,
          timestamp: start,
          endTimestamp,
          speakerId,
          rawSpeakerLabel: rawLabel,
        };
      })
      .filter(Boolean);
    if (DEBUG2) {
      const dist = resultSegments.reduce((acc, s) => {
        const k = `${s.speakerId}(${s.rawSpeakerLabel})`;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      console.log(
        `[diarization] Transcript-diarize result: ${resultSegments.length} segs, dist: ${JSON.stringify(dist)}`
      );
    }
    return {
      segments: resultSegments,
      speakerNames,
      speakerCount: Object.keys(speakerNames).length,
      text: resultSegments.map((s) => s.text).join(' '),
    };
  } catch (err) {
    if (DEBUG2) console.warn('[diarization] diarizeFromTranscript failed:', err.message);
    return null;
  }
}
async function applyPerSpeakerNorm(inputPath, pyannoteSegs) {
  if (!pyannoteSegs || pyannoteSegs.length === 0) return null;
  const bySpeaker = {};
  for (const seg of pyannoteSegs) {
    if (!bySpeaker[seg.speaker]) bySpeaker[seg.speaker] = [];
    bySpeaker[seg.speaker].push({ start: seg.start, end: seg.end });
  }
  const speakers = Object.keys(bySpeaker);
  if (speakers.length <= 1) return null;
  const speakerGainDb = {};
  for (const speaker of speakers) {
    const segs = bySpeaker[speaker];
    const selectExpr = segs
      .map((s) => `between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})`)
      .join('+');
    try {
      const { stderr } = await execPromise2(
        `"${FFMPEG_BINARY3}" -y -i "${inputPath}" -af "aselect='${selectExpr}',asetpts=N/SR/TB,volumedetect" -f null -`,
        { timeout: 6e4 }
      );
      const match = String(stderr || '').match(/mean_volume:\s*([-\d.]+)\s*dB/i);
      if (match) {
        const meanDb = parseFloat(match[1]);
        const gainDb = -16 - meanDb;
        speakerGainDb[speaker] = Math.max(-12, Math.min(24, gainDb));
        if (DEBUG2)
          console.log(
            `[diarization] PerSpeakerNorm: ${speaker} mean=${meanDb.toFixed(1)}dB \u2192 gain=${speakerGainDb[speaker].toFixed(1)}dB`
          );
      }
    } catch (err) {
      if (DEBUG2)
        console.warn(
          `[diarization] PerSpeakerNorm: volumedetect for ${speaker} failed:`,
          err.message?.slice(0, 100)
        );
    }
  }
  const allSegs = [...pyannoteSegs].sort((a, b) => a.start - b.start);
  let expr = '1.0';
  for (let i = allSegs.length - 1; i >= 0; i--) {
    const seg = allSegs[i];
    const gainDb = speakerGainDb[seg.speaker];
    if (gainDb === void 0 || Math.abs(gainDb) < 0.5) continue;
    const gainLinear = Math.pow(10, gainDb / 20);
    expr = `if(between(t,${seg.start.toFixed(3)},${seg.end.toFixed(3)}),${gainLinear.toFixed(4)},${expr})`;
  }
  if (expr === '1.0') return null;
  const { default: osModule } = await import('node:os');
  const outputPath = path8.join(osModule.tmpdir(), `spknorm_${Date.now()}.wav`);
  try {
    await execPromise2(
      `"${FFMPEG_BINARY3}" -y -i "${inputPath}" -af "volume='${expr}'" -threads 4 -ar 16000 -ac 1 "${outputPath}"`,
      { timeout: 3e5 }
    );
    if (DEBUG2) {
      const origSize = fs7.statSync(inputPath).size;
      const normSize = fs7.statSync(outputPath).size;
      console.log(
        `[diarization] PerSpeakerNorm: ${speakers.join(',')} \u2014 ${(origSize / 1e6).toFixed(1)}MB \u2192 ${(normSize / 1e6).toFixed(1)}MB`
      );
    }
    return outputPath;
  } catch (err) {
    console.warn('[diarization] PerSpeakerNorm: volume apply failed:', err.message?.slice(0, 100));
    try {
      fs7.unlinkSync(outputPath);
    } catch (_) {}
    return null;
  }
}

// server/postProcessing.ts
init_config();
init_logger();
init_speakerEmbedder();

// src/shared/meetingFeedback.ts
var MEETING_FEEDBACK_CATEGORIES = [
  { key: 'facilitation', label: 'Prowadzenie spotkania' },
  { key: 'expertise', label: 'Wiedza merytoryczna' },
  { key: 'clarity', label: 'Jasno\u015B\u0107 wypowiedzi' },
  { key: 'structure', label: 'Struktura i organizacja' },
  { key: 'listening', label: 'S\u0142uchanie i reagowanie' },
  { key: 'closing', label: 'Domykanie ustale\u0144' },
  { key: 'pace', label: 'Tempo i zarz\u0105dzanie czasem' },
  { key: 'collaboration', label: 'Wsp\xF3\u0142praca i atmosfera' },
];
function buildMeetingFeedbackSchemaExample() {
  return {
    overallScore: 8,
    summary: 'Kr\xF3tki, rozwojowy komentarz o ca\u0142ym spotkaniu.',
    strengths: ['Mocna strona 1', 'Mocna strona 2', 'Mocna strona 3'],
    improvementAreas: ['Obszar do poprawy 1', 'Obszar do poprawy 2', 'Obszar do poprawy 3'],
    perceptionNotes: [
      'Jak mo\u017Cesz by\u0107 odbierany 1',
      'Jak mo\u017Cesz by\u0107 odbierany 2',
      'Jak mo\u017Cesz by\u0107 odbierany 3',
    ],
    communicationTips: ['Wskaz\xF3wka 1', 'Wskaz\xF3wka 2', 'Wskaz\xF3wka 3'],
    nextSteps: ['Krok 1', 'Krok 2', 'Krok 3'],
    whatWentWell: ['Co posz\u0142o dobrze 1', 'Co posz\u0142o dobrze 2', 'Co posz\u0142o dobrze 3'],
    whatCouldBeBetter: [
      'Co mo\u017Cna poprawi\u0107 1',
      'Co mo\u017Cna poprawi\u0107 2',
      'Co mo\u017Cna poprawi\u0107 3',
    ],
    categoryScores: MEETING_FEEDBACK_CATEGORIES.map((category) => ({
      key: category.key,
      label: category.label,
      score: 8,
      observation: 'Kr\xF3tka obserwacja dla tej kategorii.',
      improvementTip: 'Jedna praktyczna wskaz\xF3wka na nast\u0119pne spotkanie.',
    })),
  };
}

// server/postProcessing.ts
var __filename4 = fileURLToPath4(import.meta.url);
var __dirname4 = path9.dirname(__filename4);
var execPromise3 = promisify3(exec3);
var OPENAI_API_KEY3 = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || '';
var OPENAI_BASE_URL3 = config.VOICELOG_OPENAI_BASE_URL;
var FFMPEG_BINARY4 = config.FFMPEG_BINARY;
var PYTHON_BINARY2 = config.PYTHON_BINARY;
var ACOUSTIC_FEATURES_SCRIPT = path9.join(__dirname4, 'acoustic_features.py');
var TRANSCRIPT_CORRECTION = config.TRANSCRIPT_CORRECTION;
async function correctTranscriptWithLLM(segments, options = {}) {
  if (!TRANSCRIPT_CORRECTION && !options.transcriptCorrection) return segments;
  if (!OPENAI_API_KEY3) return segments;
  const payload = segments.map((s) => ({ id: s.id, text: s.text }));
  const inputLen = payload.reduce((sum, s) => sum + (s.text?.length || 0), 0);
  try {
    const response = await httpClient(`${OPENAI_BASE_URL3}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY3}`,
        'Content-Type': 'application/json',
      },
      body: {
        model: 'gpt-4o-mini',
        max_tokens: Math.min(4e3, inputLen * 2 + 200),
        messages: [
          {
            role: 'user',
            content: `Popraw interpunkcj\u0119 i pisowni\u0119 w poni\u017Cszych segmentach transkrypcji. Zachowaj dok\u0142adne s\u0142owa i znaczenie. Zwr\xF3\u0107 wy\u0142\u0105cznie tablic\u0119 JSON z polami id i text.

${JSON.stringify(payload)}`,
          },
        ],
      },
      timeout: 6e4,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const corrected = JSON.parse(json.choices[0].message.content);
    const map = new Map(corrected.map((s) => [s.id, s.text]));
    return segments.map((s) => ({ ...s, text: map.has(s.id) ? map.get(s.id) : s.text }));
  } catch (err) {
    if (!options.signal?.aborted)
      console.warn('[postProcessing] LLM correction failed, using original segments.', err.message);
    return segments;
  }
}
async function analyzeMeetingWithOpenAI({ meeting, segments, speakerNames }) {
  if (!OPENAI_API_KEY3 || !segments.length) return null;
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };
  const transcriptText = segments
    .map((seg) => {
      const speaker =
        speakerNames?.[String(seg.speakerId)] || `Speaker ${(seg.speakerId || 0) + 1}`;
      return `[${fmt(seg.timestamp ?? 0)}] ${speaker}: ${seg.text}`;
    })
    .join('\n');
  const schema = JSON.stringify({
    speakerCount: 2,
    speakerLabels: { 0: 'Adam', 1: 'Marcin' },
    summary: '...',
    decisions: ['...'],
    actionItems: ['...'],
    tasks: [
      {
        title: '...',
        owner: '...',
        sourceQuote: '...',
        priority: 'medium',
        tags: [],
      },
    ],
    followUps: ['...'],
    answersToNeeds: [{ need: '...', answer: '...' }],
    suggestedTags: ['tag1'],
    meetingType: 'planning',
    energyLevel: 'medium',
    risks: [{ risk: '...', severity: 'high' }],
    blockers: ['...'],
    participantInsights: [
      {
        speaker: 'Adam',
        mainTopic: '...',
        stance: 'proactive',
        talkRatio: 0.6,
        personality: { D: 70, I: 50, S: 40, C: 80 },
        needs: ['...'],
        concerns: ['...'],
        sentimentScore: 85,
        discStyle: 'DC \u2014 dominuj\u0105cy analityk',
        discDescription:
          'Adam koncentruje si\u0119 na wynikach i analizie, dzia\u0142aj\u0105c szybko i metodycznie.',
        communicationStyle: 'analytical',
        decisionStyle: 'data-driven',
        stressResponse: 'Staje si\u0119 bardziej dyrektywny i zamkni\u0119ty na inne opinie.',
        workingWithTips: [
          'Przedstawiaj fakty i dane',
          'Dawaj czas na analiz\u0119',
          'Unikaj emocjonalnych argument\xF3w',
        ],
        meetingRole: 'ekspert',
        keyMoment: '...',
      },
    ],
    tensions: [{ topic: '...', between: ['A', 'B'], resolved: false }],
    keyQuotes: [{ quote: '...', speaker: 'Adam', why: '...' }],
    suggestedAgenda: ['...'],
    feedback: buildMeetingFeedbackSchemaExample(),
  });
  const prompt = [
    'Jeste\u015B analitykiem spotka\u0144 biznesowych. Analizuj transkrypt i zwr\xF3\u0107 JSON.',
    'Return valid JSON only \u2014 no prose outside the JSON object.',
    "BARDZO WA\u017BNE: Twoim krytycznym zadaniem jest przypisywanie zada\u0144 (Action Items / Tasks) konkretnym m\xF3wcom. W\u0142a\u015Bciwo\u015B\u0107 'owner' w tablicy 'tasks' MUSI zawiera\u0107 dok\u0142adne imi\u0119 (speakerLabels) osoby, kt\xF3ra podj\u0119\u0142a si\u0119 zadania w transkryptach, zamiast og\xF3lnik\xF3w.",
    "ZADANIE A: Zidentyfikuj i uzupe\u0142nij prawdziwe imiona we w\u0142a\u015Bciwo\u015Bci 'speakerLabels' (np. gdy kto\u015B m\xF3wi 'Cze\u015B\u0107 Adam', zamie\u0144 'Speaker 1' na 'Adam') i u\u017Cywaj tylko tych konkretnych imion wok\xF3\u0142 ca\u0142ego pliku (szczeg\xF3lnie klucza 'owner' przy zadaniach).",
    "ZADANIE B: Dla ka\u017Cdej rozpoznanej osoby w sekcji 'participantInsights' wype\u0142nij obiekt 'personality' oszacowuj\u0105c od 0 do 100 psychologi\u0119 DISC.",
    "ZADANIE C: Dla ka\u017Cdej osoby oszacuj jej 'sentimentScore' od 1 (niedost\u0119pny/z\u0142y/wycofany/zimny) do 100 (gor\u0105cy/entuzjastyczny/bardzo zaanga\u017Cowany w relacj\u0119).",
    "ZADANIE D: Dla ka\u017Cdej osoby wype\u0142nij: discStyle (kr\xF3tka etykieta stylu DISC po polsku, np. 'DC \u2014 dominuj\u0105cy analityk'), discDescription (1-2 zdania opisuj\u0105ce dominuj\u0105cy styl), communicationStyle (analytical/expressive/diplomatic/direct), decisionStyle (data-driven/intuitive/consensual/authoritative), stressResponse (jak zachowuje si\u0119 pod presj\u0105, po polsku), workingWithTips (tablica 2-3 praktycznych wskaz\xF3wek po polsku), meetingRole (lider/ekspert/mediator/sceptyk/wykonawca) oraz keyMoment (dos\u0142owny cytat najwa\u017Cniejszej wypowiedzi tej osoby z transkryptu).",
    '',
    `Tytu\u0142 spotkania: ${meeting?.title || 'Nieznany'}`,
    `Kontekst: ${meeting?.context || 'Brak'}`,
    `Potrzeby: ${Array.isArray(meeting?.needs) ? meeting.needs.join(' | ') : meeting?.needs || 'Brak'}`,
    '',
    'Zwr\xF3\u0107 JSON w tym formacie (wszystkie pola w j\u0119zyku polskim):',
    schema,
    '',
    'Transkrypt:',
    transcriptText,
  ].join('\n');
  const startAnalyze = performance.now();
  const reqId = meeting?.requestId || 'internal-analysis';
  try {
    const resp = await fetch(`${OPENAI_BASE_URL3}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY3}`,
        'Content-Type': 'application/json',
        // HTTP/2 + keep-alive for connection reuse (#320)
        Connection: 'keep-alive',
        'Keep-Alive': 'timeout=5, max=100',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4e3,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      // Agent for connection pooling (HTTP/2 support)
      dispatcher: void 0,
      // Node.js fetch uses global agent by default
    });
    if (!resp.ok) throw new Error(`OpenAI analyze HTTP ${resp.status}`);
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || '{}';
    logger.info(`[Metrics] LLM Meeting Analysis Complete`, {
      requestId: reqId,
      durationMs: (performance.now() - startAnalyze).toFixed(2),
      transcriptLength: transcriptText.length,
    });
    return JSON.parse(content);
  } catch (err) {
    console.warn('[postProcessing] analyzeMeetingWithOpenAI failed:', err.message);
    return null;
  }
}
async function embedTextChunks(texts) {
  if (!OPENAI_API_KEY3 || !texts.length) return [];
  try {
    const res = await fetch(`${OPENAI_BASE_URL3}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY3}`,
        'Content-Type': 'application/json',
        // HTTP/2 + keep-alive for connection reuse (#320)
        Connection: 'keep-alive',
        'Keep-Alive': 'timeout=5, max=100',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    });
    if (!res.ok) throw new Error('Embeddings API error');
    const json = await res.json();
    return json.data.map((d) => d.embedding);
  } catch (err) {
    console.error('embedTextChunks failed:', err);
    return [];
  }
}
async function extractSpeakerAudioClip(asset, speakerId, segments, options = {}) {
  const validSegs = segments
    .filter((s) => {
      if (String(s.speakerId) !== String(speakerId)) return false;
      const t = Number(s.timestamp ?? s.start ?? NaN);
      const e = Number(s.endTimestamp ?? s.end ?? NaN);
      return Number.isFinite(t) && Number.isFinite(e) && e > t && t >= 0;
    })
    .slice(0, 15);
  if (!validSegs.length) throw new Error('Brak segment\xF3w z poprawnymi znacznikami czasu.');
  const clipPath = path9.join(
    path9.dirname(asset.file_path),
    `speaker_${asset.id}_${String(speakerId).replace(/[^a-zA-Z0-9_-]/g, '')}_${crypto9.randomUUID().slice(0, 8)}.wav`
  );
  const selectFilter = validSegs
    .map(
      (s) =>
        `between(t,${Number(s.timestamp ?? s.start).toFixed(3)},${Number(s.endTimestamp ?? s.end).toFixed(3)})`
    )
    .join('+');
  await execPromise3(
    `"${FFMPEG_BINARY4}" -y -i "${asset.file_path}" -af "aselect='${selectFilter}',asetpts=N/SR/TB" -t 60 -threads 4 -ar 16000 -ac 1 "${clipPath}"`,
    { timeout: 3e4, signal: options.signal }
  );
  return clipPath;
}
async function generateVoiceCoaching(asset, speakerId, segments, options = {}) {
  if (!OPENAI_API_KEY3) throw new Error('Brak klucza OpenAI API.');
  const clipPath = await extractSpeakerAudioClip(asset, speakerId, segments, options);
  try {
    const audioBase64 = fs8.readFileSync(clipPath).toString('base64');
    const res = await fetch(`${OPENAI_BASE_URL3}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY3}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: { data: audioBase64, format: 'wav' },
              },
              {
                type: 'text',
                text: [
                  'Przeanalizuj mow\u0119 tej osoby dok\u0142adnie \u2014 bazuj\u0105c wy\u0142\u0105cznie na d\u017Awi\u0119ku, nie na tek\u015Bcie.',
                  'Oce\u0144 poni\u017Csze aspekty i daj konkretne, praktyczne wskaz\xF3wki do poprawy:',
                  '1. Ton g\u0142osu i emocje (pewno\u015B\u0107 siebie, energia, monotonia, zaanga\u017Cowanie).',
                  '2. Tempo m\xF3wienia i rytm (za szybko, za wolno, dobre zmiany tempa).',
                  '3. Wymowa polskich g\u0142osek (sz/cz/rz, mi\u0119kkie sp\xF3\u0142g\u0142oski, akcent wyrazowy).',
                  '4. Pauzy \u2014 czy naturalne i buduj\u0105 napi\u0119cie, czy wynikaj\u0105 z niepewno\u015Bci.',
                  '5. Wype\u0142niacze g\u0142osowe (ee, yyy, yyy, znaczy) \u2014 cz\u0119stotliwo\u015B\u0107 i jak je redukowa\u0107.',
                  '6. Dykcja i wyrazisto\u015B\u0107 \u2014 czy s\u0142owa s\u0105 wyra\u017Ane i zrozumia\u0142e.',
                  'Odpowied\u017A po polsku, ok. 200\u2013300 s\u0142\xF3w. Zacznij bezpo\u015Brednio od oceny.',
                ].join(' '),
              },
            ],
          },
        ],
        max_tokens: 700,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenAI API ${res.status}: ${errText.slice(0, 120)}`);
    }
    const json = await res.json();
    const coaching = String(json.choices?.[0]?.message?.content || '').trim();
    if (!coaching) throw new Error('Pusta odpowied\u017A z modelu audio.');
    return coaching;
  } finally {
    try {
      fs8.unlinkSync(clipPath);
    } catch (_) {}
  }
}
async function analyzeAcousticFeatures(filePath, options = {}) {
  if (!fs8.existsSync(filePath)) {
    throw new Error('Plik audio nie istnieje.');
  }
  if (!fs8.existsSync(ACOUSTIC_FEATURES_SCRIPT)) {
    throw new Error('Brak skryptu acoustic_features.py.');
  }
  return new Promise((resolve, reject) => {
    const child = spawn2(PYTHON_BINARY2, [ACOUSTIC_FEATURES_SCRIPT, filePath], {
      signal: options.signal,
      timeout: 12e4,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `acoustic_features.py exited with status ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim() || '{}');
        if (parsed?.error) {
          reject(new Error(String(parsed.error)));
          return;
        }
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Nie udalo sie sparsowac metryk akustycznych: ${error.message}`));
      }
    });
  });
}
async function normalizeRecording(filePath, options = {}) {
  const tmpPath = `${filePath}.norm.tmp`;
  try {
    await execPromise3(
      `"${FFMPEG_BINARY4}" -y -i "${filePath}" -af "highpass=f=80,afftdn,loudnorm=I=-16:TP=-1.5:LRA=11" "${tmpPath}"`,
      { timeout: 12e4, signal: options.signal }
    );
    fs8.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      fs8.unlinkSync(tmpPath);
    } catch (_) {}
    throw err;
  }
}

// server/pipeline.ts
var __filename5 = fileURLToPath5(import.meta.url);
var __dirname5 = path10.dirname(__filename5);
var OPENAI_API_KEY4 = config.VOICELOG_OPENAI_API_KEY || config.OPENAI_API_KEY || '';
var OPENAI_BASE_URL4 = config.VOICELOG_OPENAI_BASE_URL;
var AUDIO_LANGUAGE2 = config.AUDIO_LANGUAGE;
var PER_SPEAKER_NORM = config.VOICELOG_PER_SPEAKER_NORM;
var DEBUG3 = process.env.VOICELOG_DEBUG === 'true';
function isRemoteAudioPath(filePath) {
  return Boolean(filePath && !filePath.includes(path10.sep) && !filePath.includes('/'));
}
function buildAudioQualityForAttempt(audioQuality, profile, enhancementApplied = false) {
  if (!audioQuality || typeof audioQuality !== 'object') return null;
  return {
    ...audioQuality,
    enhancementApplied,
    enhancementProfile: enhancementApplied ? profile : 'none',
  };
}
function shouldRetryWithEnhancedProfile(profile, attemptCount, outcome) {
  if (profile !== 'standard' || attemptCount >= 2) return false;
  if (outcome?.transcriptOutcome === 'empty') return true;
  return Number(outcome?.transcriptionDiagnostics?.chunksFailedAtStt || 0) > 0;
}
async function runTranscriptionAttempt(
  asset,
  options = {},
  baseAudioQuality = null,
  profile = 'standard',
  attemptCount = 1
) {
  const notify = (p, m) => {
    if (typeof options.onProgress === 'function') options.onProgress({ progress: p, message: m });
  };
  let tempFilePath = '';
  let workingFilePath = options.workingFilePath || asset.file_path;
  let prepPath = options.preprocessedFilePath || '';
  const preprocessCacheKey = options.preprocessCacheKey || '';
  const pipelineMetrics = {
    requestId: options.requestId || 'internal-pipeline',
    stages: {},
    total: 0,
  };
  try {
    if (!workingFilePath) throw new Error('Brak \u015Bcie\u017Cki do pliku audio.');
    if (!options.workingFilePath && isRemoteAudioPath(workingFilePath)) {
      notify(10, 'Pobieranie nagrania z bazy danych...');
      const { downloadAudioFromStorage: downloadAudioFromStorage2 } = await Promise.resolve().then(
        () => (init_supabaseStorage(), supabaseStorage_exports)
      );
      const buffer = await downloadAudioFromStorage2(workingFilePath);
      const baseMime = String(asset.content_type || '')
        .toLowerCase()
        .split(';')[0]
        .trim();
      const ext =
        {
          'audio/webm': '.webm',
          'audio/mpeg': '.mp3',
          'audio/mp4': '.m4a',
          'audio/wav': '.wav',
          'audio/ogg': '.ogg',
          'audio/flac': '.flac',
        }[baseMime] || '.webm';
      const uploadDir = getUploadDir();
      tempFilePath = path10.join(uploadDir, `temp_transcribe_${crypto10.randomUUID()}${ext}`);
      fs9.mkdirSync(path10.dirname(tempFilePath), { recursive: true });
      fs9.writeFileSync(tempFilePath, Buffer.from(buffer));
      workingFilePath = tempFilePath;
    }
    if (!fs9.existsSync(workingFilePath)) {
      throw new Error('Lokalny plik audio nie istnieje i nie mogl byc pobrany.');
    }
    notify(10, 'Wyci\u0105ganie audio do pami\u0119ci podr\u0119cznej...');
    if (!prepPath) {
      prepPath = await preprocessAudio(workingFilePath, options.signal, profile, {
        cacheKey: preprocessCacheKey,
        silenceRemove: SILENCE_REMOVE && !HF_TOKEN_SET,
      });
    }
    let transcribeFilePath = prepPath || workingFilePath;
    const transcribeContentType = prepPath
      ? 'audio/wav'
      : options.workingContentType || asset.content_type;
    const attemptAudioQuality = buildAudioQualityForAttempt(
      baseAudioQuality,
      profile,
      Boolean(prepPath)
    );
    notify(30, 'R\xF3wnoleg\u0142e przetwarzanie: VAD + diaryzacja...');
    const usePyannote = VOICELOG_DIARIZER !== 'openai' && HF_TOKEN_SET;
    const [speechSegments, earlyPyannoteSegments] = await Promise.all([
      // 1. Silero VAD - silence detection
      (async () => {
        if (!VAD_ENABLED) return null;
        notify(30, 'Silero VAD - optymalizacja ciszy...');
        return await runSileroVAD(transcribeFilePath, options.signal);
      })(),
      // 2. Pyannote diarization (for per-speaker norm)
      (async () => {
        if (!usePyannote || !PER_SPEAKER_NORM) return null;
        notify(
          25,
          'Wst\u0119pna diaryzacja m\xF3wc\xF3w (normalizacja g\u0142o\u015Bno\u015Bci)...'
        );
        return await runPyannoteDiarization(transcribeFilePath, options.signal);
      })(),
    ]);
    let normFilePath = '';
    if (earlyPyannoteSegments && earlyPyannoteSegments.length > 0) {
      const uniqueSpeakers = new Set(earlyPyannoteSegments.map((s) => s.speaker));
      if (uniqueSpeakers.size > 1) {
        notify(
          28,
          `Normalizacja g\u0142o\u015Bno\u015Bci per m\xF3wca (${uniqueSpeakers.size} m\xF3wc\xF3w)...`
        );
        const normalized = await applyPerSpeakerNorm(transcribeFilePath, earlyPyannoteSegments);
        if (normalized) {
          normFilePath = normalized;
          transcribeFilePath = normalized;
          if (DEBUG3) console.log(`[pipeline] Per-speaker norm applied: ${normalized}`);
        }
      }
    }
    if (DEBUG3 && speechSegments) {
      console.log(`[pipeline] Silero VAD detected ${speechSegments.length} speech segment(s).`);
    }
    let transcriptionDiagnostics = {
      usedChunking: false,
      fileSizeBytes: 0,
      chunksAttempted: 0,
      chunksExtracted: 0,
      chunksDiscardedAsTooSmall: 0,
      chunksSentToStt: 0,
      chunksFailedAtStt: 0,
      chunksReturnedEmptyPayload: 0,
      chunksWithSegments: 0,
      chunksWithWords: 0,
      chunksWithText: 0,
      chunksFlaggedSilentByVad: 0,
      mergedSegmentsCount: 0,
      mergedWordsCount: 0,
      mergedTextLength: 0,
      lastChunkErrorMessage: '',
      transcriptionProfileUsed: profile,
      transcriptionAttemptCount: attemptCount,
    };
    try {
      const fileSize = fs9.statSync(transcribeFilePath).size;
      const isLargeFile = fileSize > MAX_FILE_SIZE_BYTES2;
      transcriptionDiagnostics = {
        ...transcriptionDiagnostics,
        usedChunking: isLargeFile,
        fileSizeBytes: fileSize,
      };
      if (isLargeFile) {
        console.log(
          `[pipeline] File size ${(fileSize / 1024 / 1024).toFixed(1)} MB > limit \u2014 will process in chunks.`
        );
      }
      const contextPrompt = buildWhisperPrompt({
        meetingTitle: options.meetingTitle,
        participants: options.participants,
        tags: options.tags,
        vocabulary: options.vocabulary,
      });
      const whisperTemperature = attemptAudioQuality?.qualityLabel === 'poor' ? 0 : 0.1;
      const selectedModel = getSttModelForProcessingMode(options.processingMode || 'fast');
      const whisperFields = {
        model: selectedModel,
        language: options.language || AUDIO_LANGUAGE2,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment', 'word'],
        prompt: contextPrompt,
        temperature: whisperTemperature,
      };
      notify(40, 'Transkrypcja AI rozk\u0142ada p\u0119tle paczek...');
      let whisperPayload = null;
      let sttProviderInfo = null;
      const modelsToTry = _sttUseGroq
        ? ['whisper-large-v3']
        : selectedModel !== 'whisper-1'
          ? [selectedModel, 'whisper-1']
          : ['whisper-1'];
      const reqId = options.requestId || 'internal-pipeline';
      pipelineMetrics.requestId = reqId;
      const stageStart = (name) => performance.now();
      const stageEnd = (name, start) => {
        const duration = performance.now() - start;
        pipelineMetrics.stages[name] = parseFloat(duration.toFixed(2));
        pipelineMetrics.total += duration;
        MetricsService.observeStageDuration(name, pipelineMetrics.stages[name]);
        logger.info(`[Metrics] Pipeline Stage Complete`, {
          requestId: reqId,
          stage: name,
          durationMs: pipelineMetrics.stages[name],
        });
      };
      const startTranscribe = stageStart('transcription');
      let lastTranscriptionError = null;
      for (const model of modelsToTry) {
        const fields = { ...whisperFields, model };
        try {
          if (isLargeFile) {
            const chunkPayloads = await transcribeInChunks(
              transcribeFilePath,
              transcribeContentType,
              fields,
              options
            );
            whisperPayload = mergeChunkedPayloads(chunkPayloads, fileSize);
            sttProviderInfo = whisperPayload?.sttProviderInfo || null;
            transcriptionDiagnostics = {
              ...transcriptionDiagnostics,
              ...(whisperPayload?.transcriptionDiagnostics || {}),
            };
            const sentToStt = Number(transcriptionDiagnostics.chunksSentToStt || 0);
            const failedAtStt = Number(transcriptionDiagnostics.chunksFailedAtStt || 0);
            if (sentToStt > 0 && failedAtStt === sentToStt) {
              const error = new Error('Transkrypcja STT nie powiodla sie dla zadnego modelu.');
              error.transcriptionDiagnostics = transcriptionDiagnostics;
              error.audioQuality = attemptAudioQuality;
              throw error;
            }
          } else {
            const sttResult = await requestAudioTranscription({
              filePath: transcribeFilePath,
              contentType: transcribeContentType,
              fields,
              signal: options.signal,
            });
            whisperPayload = sttResult?.payload || null;
            sttProviderInfo = sttResult;
            transcriptionDiagnostics = {
              ...transcriptionDiagnostics,
              chunksAttempted: 1,
              chunksExtracted: 1,
              chunksDiscardedAsTooSmall: 0,
              chunksSentToStt: 1,
              chunksFailedAtStt: 0,
              chunksReturnedEmptyPayload:
                Array.isArray(whisperPayload?.segments) && whisperPayload.segments.length > 0
                  ? 0
                  : getRawWords(whisperPayload).length > 0
                    ? 0
                    : clean(
                          whisperPayload?.text ||
                            whisperPayload?.transcript ||
                            whisperPayload?.results?.text
                        )
                      ? 0
                      : 1,
              chunksWithSegments:
                Array.isArray(whisperPayload?.segments) && whisperPayload.segments.length > 0
                  ? 1
                  : 0,
              chunksWithWords: getRawWords(whisperPayload).length > 0 ? 1 : 0,
              chunksWithText: clean(
                whisperPayload?.text || whisperPayload?.transcript || whisperPayload?.results?.text
              )
                ? 1
                : 0,
              mergedSegmentsCount: Array.isArray(whisperPayload?.segments)
                ? whisperPayload.segments.length
                : 0,
              mergedWordsCount: getRawWords(whisperPayload).length,
              mergedTextLength: clean(
                whisperPayload?.text || whisperPayload?.transcript || whisperPayload?.results?.text
              ).length,
              lastChunkErrorMessage: '',
              sttAttempts: Array.isArray(sttResult?.attempts) ? sttResult.attempts : [],
            };
          }
          if (DEBUG3) console.log(`[pipeline] Transcription succeeded with model: ${model}`);
          break;
        } catch (error) {
          whisperPayload = null;
          lastTranscriptionError = error;
          transcriptionDiagnostics = {
            ...transcriptionDiagnostics,
            lastChunkErrorMessage: clean(
              error?.transcriptionDiagnostics?.lastChunkErrorMessage || error?.message || ''
            ),
            ...(error?.transcriptionDiagnostics &&
            typeof error.transcriptionDiagnostics === 'object'
              ? error.transcriptionDiagnostics
              : {}),
          };
          console.error(`[pipeline] Transcription failed with model ${model}:`, error.message);
          if (model === modelsToTry[modelsToTry.length - 1]) {
            console.error('[pipeline] All transcription models exhausted.');
          }
        }
      }
      if (!whisperPayload && _sttUseGroq && OPENAI_API_KEY4) {
        const openaiModels =
          config.VERIFICATION_MODEL !== 'whisper-1'
            ? [config.VERIFICATION_MODEL, 'whisper-1']
            : ['whisper-1'];
        for (const model of openaiModels) {
          const fallbackFields = { ...whisperFields, model };
          try {
            console.log(`[pipeline] Groq STT failed \u2014 retrying with OpenAI model ${model}`);
            if (isLargeFile) {
              const chunkPayloads = await transcribeInChunks(
                transcribeFilePath,
                transcribeContentType,
                fallbackFields,
                {
                  ...options,
                  sttApiKey: OPENAI_API_KEY4,
                  sttBaseUrl: OPENAI_BASE_URL4,
                }
              );
              whisperPayload = mergeChunkedPayloads(chunkPayloads, fileSize);
              transcriptionDiagnostics = {
                ...transcriptionDiagnostics,
                ...(whisperPayload?.transcriptionDiagnostics || {}),
              };
            } else {
              whisperPayload = await requestAudioTranscription({
                filePath: transcribeFilePath,
                contentType: transcribeContentType,
                fields: fallbackFields,
                signal: options.signal,
                apiKey: OPENAI_API_KEY4,
                baseUrl: OPENAI_BASE_URL4,
              });
            }
            if (whisperPayload) {
              lastTranscriptionError = null;
              if (DEBUG3) console.log(`[pipeline] OpenAI fallback succeeded with model: ${model}`);
              break;
            }
          } catch (e) {
            lastTranscriptionError = e;
            console.error(`[pipeline] OpenAI fallback failed for model ${model}:`, e.message);
          }
        }
      }
      if (!whisperPayload) {
        const error =
          lastTranscriptionError instanceof Error
            ? lastTranscriptionError
            : new Error('Transkrypcja STT nie powiodla sie dla zadnego modelu.');
        error.transcriptionDiagnostics = transcriptionDiagnostics;
        error.audioQuality = attemptAudioQuality;
        throw error;
      }
      stageEnd('transcription', startTranscribe);
      const verificationSegments = normalizeVerificationSegments(whisperPayload || {});
      let diarization = null;
      const startDiarize = stageStart('diarization');
      if (usePyannote) {
        notify(80, 'Pyannote - rozpoznawanie i segregacja g\u0142osu po wektorach wieloosiowych!');
        const pyannoteSegments =
          earlyPyannoteSegments ??
          (await runPyannoteDiarization(transcribeFilePath, options.signal));
        if (pyannoteSegments && verificationSegments.length) {
          const rawWhisperSegments = Array.isArray(whisperPayload?.segments)
            ? whisperPayload.segments
            : [];
          const wordDiarization = rawWhisperSegments.length
            ? splitSegmentsByWordSpeaker(rawWhisperSegments, pyannoteSegments)
            : null;
          if (wordDiarization) {
            if (DEBUG3)
              console.log(
                '[pipeline] Using word-level pyannote diarization (finer speaker splits).'
              );
            diarization = wordDiarization;
          } else {
            if (DEBUG3)
              console.log(
                '[pipeline] Using segment-level pyannote diarization merged with Whisper.'
              );
            diarization = mergeWithPyannote(pyannoteSegments, verificationSegments);
          }
        }
      }
      if (!diarization) {
        if (DEBUG3)
          console.log(
            '[pipeline] Pyannote unavailable \u2014 using GPT-4o-mini transcript diarization.'
          );
        notify(80, 'Analiza semantyczna GPT-4o-mini celem wyizolowania rozm\xF3wc\xF3w...');
        try {
          diarization = await diarizeFromTranscript(verificationSegments, {
            participants: options.participants,
          });
          if (DEBUG3 && diarization) {
            console.log(
              `[pipeline] Transcript diarization: ${diarization.segments.length} segs, ${diarization.speakerCount} speaker(s): ${JSON.stringify(diarization.speakerNames)}`
            );
          }
        } catch (err) {
          console.warn('[pipeline] Transcript diarization error:', err.message);
          diarization = null;
        }
      }
      if (!diarization || !diarization.segments.length) {
        if (DEBUG3) console.log('[pipeline] Using whisper segments as single-speaker fallback.');
        diarization = normalizeDiarizedSegments(whisperPayload || {});
      }
      stageEnd('diarization', startDiarize);
      if (!diarization.segments.length) {
        if (
          isLargeFile &&
          Number(transcriptionDiagnostics.chunksExtracted || 0) === 0 &&
          Number(transcriptionDiagnostics.chunksDiscardedAsTooSmall || 0) > 0 &&
          Number(transcriptionDiagnostics.chunksSentToStt || 0) === 0
        ) {
          return buildEmptyTranscriptResult(
            'all_chunks_discarded_as_too_small',
            transcriptionDiagnostics,
            attemptAudioQuality
          );
        }
        return buildEmptyTranscriptResult(
          'no_segments_from_stt',
          transcriptionDiagnostics,
          attemptAudioQuality
        );
      }
      if (speechSegments) {
        const originalCount = diarization.segments.length;
        diarization.segments = diarization.segments.filter((seg) => {
          const hasSpeech = speechSegments.some((v) => {
            const overlap = Math.max(
              0,
              Math.min(seg.endTimestamp, v.end) - Math.max(seg.timestamp, v.start)
            );
            return overlap > 0.1 || overlap / (seg.endTimestamp - seg.timestamp) > 0.2;
          });
          return hasSpeech;
        });
        if (DEBUG3 && diarization.segments.length < originalCount) {
          console.log(
            `[pipeline] VAD filter removed ${originalCount - diarization.segments.length} hallucinated segment(s).`
          );
        }
        if (!diarization.segments.length) {
          return buildEmptyTranscriptResult(
            'segments_removed_by_vad',
            transcriptionDiagnostics,
            attemptAudioQuality
          );
        }
      }
      const verificationResult = buildVerificationResult(
        diarization.segments,
        verificationSegments
      );
      if (DEBUG3) {
        const spkDist = verificationResult.verifiedSegments.reduce((acc, s) => {
          acc[s.speakerId] = (acc[s.speakerId] || 0) + 1;
          return acc;
        }, {});
        console.log(
          `[pipeline] After verification: ${verificationResult.verifiedSegments.length} segs, speakers: ${JSON.stringify(spkDist)}`
        );
      }
      const identifiedNames = { ...diarization.speakerNames };
      const voiceProfiles = options.voiceProfiles || [];
      if (voiceProfiles.length && diarization.speakerCount > 0) {
        const speakerSegmentMap = /* @__PURE__ */ new Map();
        for (const seg of diarization.segments) {
          const sid = String(seg.speakerId);
          if (!speakerSegmentMap.has(sid)) speakerSegmentMap.set(sid, []);
          speakerSegmentMap.get(sid).push(seg);
        }
        for (const [speakerId, segs] of speakerSegmentMap.entries()) {
          const totalSpeakerTime = segs.reduce((sum, s) => sum + (s.endTimestamp - s.timestamp), 0);
          if (totalSpeakerTime < 2) continue;
          const clipPath = path10.join(
            path10.dirname(asset.file_path),
            `spk_${asset.id}_${speakerId}_clip.wav`
          );
          try {
            const safeSegments = segs.slice(0, 8).filter((s) => {
              const t = Number(s.timestamp);
              const e = Number(s.endTimestamp);
              return Number.isFinite(t) && Number.isFinite(e) && e > t && t >= 0;
            });
            if (!safeSegments.length) continue;
            const selectFilter = safeSegments
              .map(
                (s) =>
                  `between(t,${Number(s.timestamp).toFixed(3)},${Number(s.endTimestamp).toFixed(3)})`
              )
              .join('+');
            const { exec: execFn } = await import('node:child_process');
            const { promisify: promisify4 } = await import('node:util');
            const execP = promisify4(execFn);
            const FFMPEG_BINARY5 = config.FFMPEG_BINARY;
            await execP(
              `"${FFMPEG_BINARY5}" -y -i "${asset.file_path}" -af "aselect='${selectFilter}',asetpts=N/SR/TB" -threads 4 -ar 16000 -ac 1 "${clipPath}"`,
              { timeout: 3e4, signal: options.signal }
            );
            const matchResult = await matchSpeakerToProfile(clipPath, voiceProfiles);
            if (matchResult) {
              identifiedNames[speakerId] = matchResult.name;
            }
          } catch (err) {
            console.warn(
              `[pipeline] Speaker clip extraction failed for speaker ${speakerId}:`,
              err.message
            );
          } finally {
            try {
              fs9.unlinkSync(clipPath);
            } catch (_) {}
          }
        }
      }
      const startPostProcess = stageStart('post-processing');
      const processedSegments = await (async () => {
        notify(90, 'Czyszczenie halucynacji AI za spraw\u0105 hybrydowej analizy WavLM...');
        const withoutHallucinations = verificationResult.verifiedSegments.filter(
          (seg) => !isHallucination(seg.text)
        );
        if (DEBUG3 && withoutHallucinations.length < verificationResult.verifiedSegments.length) {
          console.log(
            `[pipeline] Hallucination filter removed ${verificationResult.verifiedSegments.length - withoutHallucinations.length} segment(s).`
          );
        }
        if (!withoutHallucinations.length) {
          return buildEmptyTranscriptResult(
            'segments_removed_as_hallucinations',
            transcriptionDiagnostics,
            attemptAudioQuality
          ).segments;
        }
        const deduplicated = removeConsecutiveDuplicates(withoutHallucinations);
        if (DEBUG3 && deduplicated.length < withoutHallucinations.length) {
          console.log(
            `[pipeline] Cross-segment dedup removed ${withoutHallucinations.length - deduplicated.length} repeated segment(s).`
          );
        }
        if (!deduplicated.length) {
          return buildEmptyTranscriptResult(
            'segments_removed_as_hallucinations',
            transcriptionDiagnostics,
            attemptAudioQuality
          ).segments;
        }
        const merged = mergeShortSegments(deduplicated);
        const corrected = await correctTranscriptWithLLM(merged, options);
        return corrected;
      })();
      stageEnd('post-processing', startPostProcess);
      if (!processedSegments.length) {
        return buildEmptyTranscriptResult(
          'segments_removed_as_hallucinations',
          transcriptionDiagnostics,
          attemptAudioQuality
        );
      }
      const referenceTranscript = verificationSegments
        .map((segment) => clean(segment?.text || ''))
        .filter(Boolean)
        .join(' ');
      const hypothesisTranscript = processedSegments
        .map((segment) => clean(segment?.text || ''))
        .filter(Boolean)
        .join(' ');
      const qualityMetrics = {
        sttProviderId: sttProviderInfo?.providerId || '',
        sttProviderLabel: sttProviderInfo?.providerLabel || '',
        sttModel: sttProviderInfo?.model || '',
        sttAttempts: Array.isArray(sttProviderInfo?.attempts)
          ? sttProviderInfo.attempts
          : Array.isArray(transcriptionDiagnostics?.sttAttempts)
            ? transcriptionDiagnostics.sttAttempts
            : [],
        werProxy: computeWerProxy(referenceTranscript, hypothesisTranscript),
        diarizationConfidence: verificationResult.confidence,
      };
      return {
        providerId: sttProviderInfo?.providerId || 'stt-pipeline',
        providerLabel: sttProviderInfo?.providerLabel || 'STT + diarization',
        pipelineStatus: 'completed',
        transcriptOutcome: 'normal',
        emptyReason: '',
        userMessage: '',
        audioQuality: attemptAudioQuality,
        transcriptionDiagnostics,
        qualityMetrics,
        diarization: {
          speakerNames: identifiedNames,
          speakerCount: diarization.speakerCount,
          confidence: verificationResult.confidence,
          text: diarization.text,
          transcriptOutcome: 'normal',
          emptyReason: '',
          userMessage: '',
          audioQuality: attemptAudioQuality,
          transcriptionDiagnostics,
          qualityMetrics,
        },
        segments: processedSegments,
        speakerNames: identifiedNames,
        speakerCount: diarization.speakerCount,
        confidence: verificationResult.confidence,
        reviewSummary: {
          needsReview: processedSegments.filter(
            (segment) => segment.verificationStatus === 'review'
          ).length,
          approved: processedSegments.filter((segment) => segment.verificationStatus === 'verified')
            .length,
        },
      };
    } catch (error) {
      error.audioQuality = error?.audioQuality || attemptAudioQuality;
      error.transcriptionDiagnostics = {
        ...(transcriptionDiagnostics || {}),
        ...(error?.transcriptionDiagnostics && typeof error.transcriptionDiagnostics === 'object'
          ? error.transcriptionDiagnostics
          : {}),
        transcriptionProfileUsed: profile,
        transcriptionAttemptCount: attemptCount,
      };
      throw error;
    } finally {
      if (pipelineMetrics && pipelineMetrics.total > 0) {
        logger.info(`[Metrics] Pipeline Total Duration`, {
          requestId: pipelineMetrics.requestId,
          recordingId: asset.id,
          totalDurationMs: parseFloat(pipelineMetrics.total.toFixed(2)),
          stages: pipelineMetrics.stages,
          p50:
            Object.values(pipelineMetrics.stages).sort((a, b) => a - b)[
              Math.floor(Object.keys(pipelineMetrics.stages).length / 2)
            ] || 0,
          p95:
            Object.values(pipelineMetrics.stages).sort((a, b) => a - b)[
              Math.floor(Object.keys(pipelineMetrics.stages).length * 0.95)
            ] || 0,
          p99:
            Object.values(pipelineMetrics.stages).sort((a, b) => a - b)[
              Math.floor(Object.keys(pipelineMetrics.stages).length * 0.99)
            ] || 0,
        });
      }
      if (prepPath && !isPreprocessCacheFile(prepPath)) {
        try {
          fs9.unlinkSync(prepPath);
        } catch (_) {}
      }
      if (normFilePath) {
        try {
          fs9.unlinkSync(normFilePath);
        } catch (_) {}
      }
    }
  } finally {
    if (tempFilePath && fs9.existsSync(tempFilePath)) {
      try {
        fs9.unlinkSync(tempFilePath);
      } catch (_) {}
    }
  }
}
async function transcribeRecording(asset, options = {}) {
  let audioQuality = resolveStoredAudioQuality(asset);
  if (!audioQuality) {
    try {
      audioQuality = await Promise.race([
        analyzeAudioQuality(asset.file_path, {
          contentType: asset.content_type,
          signal: options.signal,
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 250)),
      ]);
    } catch (error) {
      if (!options.signal?.aborted) {
        console.warn('[pipeline] Audio quality analysis fallback failed:', error?.message || error);
      }
      audioQuality = null;
    }
  }
  const initialProfile = audioQuality?.enhancementRecommended ? 'enhanced' : 'standard';
  const attemptProfiles = initialProfile === 'standard' ? ['standard', 'enhanced'] : ['enhanced'];
  const preprocessPlan = new Map(
    attemptProfiles.map((profile) => {
      const cacheKey = buildAudioPreprocessCacheKey(asset, profile);
      return [profile, { cacheKey, cachePath: getPreprocessCachePath(cacheKey, profile) }];
    })
  );
  let sourceTempPath = '';
  let sourceFilePath = asset.file_path;
  const remoteSource = isRemoteAudioPath(asset.file_path);
  const needsSourceMaterialization =
    remoteSource &&
    (!config.AUDIO_PREPROCESS ||
      !attemptProfiles.every((profile) =>
        fs9.existsSync(preprocessPlan.get(profile)?.cachePath || '')
      ));
  if (needsSourceMaterialization && remoteSource) {
    try {
      const { downloadAudioFromStorage: downloadAudioFromStorage2 } = await Promise.resolve().then(
        () => (init_supabaseStorage(), supabaseStorage_exports)
      );
      const buffer = await downloadAudioFromStorage2(asset.file_path);
      const baseMime = String(asset.content_type || '')
        .toLowerCase()
        .split(';')[0]
        .trim();
      const ext =
        {
          'audio/webm': '.webm',
          'audio/mpeg': '.mp3',
          'audio/mp4': '.m4a',
          'audio/wav': '.wav',
          'audio/ogg': '.ogg',
          'audio/flac': '.flac',
        }[baseMime] || '.webm';
      const uploadDir = getUploadDir();
      sourceTempPath = path10.join(uploadDir, `temp_transcribe_${crypto10.randomUUID()}${ext}`);
      fs9.mkdirSync(path10.dirname(sourceTempPath), { recursive: true });
      fs9.writeFileSync(sourceTempPath, Buffer.from(buffer));
      sourceFilePath = sourceTempPath;
    } catch (error) {
      if (!options.signal?.aborted) {
        console.warn(
          '[pipeline] Failed to materialize remote audio source:',
          error?.message || error
        );
      }
      throw error;
    }
  }
  let lastError = null;
  let lastResult = null;
  try {
    for (let index = 0; index < attemptProfiles.length; index += 1) {
      const profile = attemptProfiles[index];
      const attemptCount = Math.min(index + 1, 2);
      const plan = preprocessPlan.get(profile);
      const profileWorkingFilePath =
        plan?.cachePath && fs9.existsSync(plan.cachePath) ? plan.cachePath : sourceFilePath;
      const profileOptions = {
        ...options,
        workingFilePath: profileWorkingFilePath,
        workingContentType:
          profileWorkingFilePath === plan?.cachePath ? 'audio/wav' : asset.content_type,
        preprocessedFilePath: profileWorkingFilePath === plan?.cachePath ? plan.cachePath : '',
        preprocessCacheKey: plan?.cacheKey || '',
      };
      try {
        const result = await runTranscriptionAttempt(
          asset,
          profileOptions,
          audioQuality,
          profile,
          attemptCount
        );
        lastResult = result;
        if (
          shouldRetryWithEnhancedProfile(profile, attemptCount, result) &&
          attemptProfiles[index + 1] === 'enhanced'
        ) {
          if (DEBUG3) {
            console.log('[pipeline] Retrying transcription with enhanced preprocessing profile.');
          }
          continue;
        }
        return result;
      } catch (error) {
        lastError = error;
        if (
          shouldRetryWithEnhancedProfile(profile, attemptCount, error) &&
          attemptProfiles[index + 1] === 'enhanced'
        ) {
          if (DEBUG3) {
            console.warn(
              '[pipeline] STT failed on standard profile, retrying with enhanced preprocessing.'
            );
          }
          continue;
        }
        throw error;
      }
    }
    if (lastError) throw lastError;
    return (
      lastResult ||
      buildEmptyTranscriptResult(
        'no_segments_from_stt',
        {
          transcriptionProfileUsed: initialProfile,
          transcriptionAttemptCount: Math.min(attemptProfiles.length, 2),
        },
        buildAudioQualityForAttempt(audioQuality, initialProfile, false)
      )
    );
  } finally {
    if (sourceTempPath && fs9.existsSync(sourceTempPath)) {
      try {
        fs9.unlinkSync(sourceTempPath);
      } catch (_) {}
    }
  }
}

// server/index.ts
init_speakerEmbedder();
var __filename6 = fileURLToPath7(import.meta.url);
var uncaughtCount = 0;
process.on('uncaughtException', (error) => {
  uncaughtCount += 1;
  logger.error(`UNCAUGHT EXCEPTION (${uncaughtCount}):`, error);
  if (uncaughtCount >= 3 && process.uptime() < 30) {
    logger.error('Multiple uncaught exceptions during startup \u2014 exiting.');
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  logger.error(
    'UNHANDLED REJECTION:',
    reason instanceof Error ? reason : new Error(String(reason))
  );
});
var PORT = resolveServerPort(config);
var HOST = config.VOICELOG_API_HOST || '0.0.0.0';
async function bootstrap() {
  validateRequiredApiKeys();
  const hasExternalDatabase = Boolean(config.VOICELOG_DATABASE_URL || config.DATABASE_URL);
  const hasLocalDatabasePath = Boolean(config.VOICELOG_DB_PATH);
  if (!hasExternalDatabase && !hasLocalDatabasePath) {
    logger.warn(
      '[Bootstrap] DATABASE_URL nie jest ustawione. Serwer uruchomi sie na lokalnym SQLite z domyslna sciezka.'
    );
  }
  try {
    const uploadDir = config.VOICELOG_UPLOAD_DIR || './server/data/uploads';
    const fs11 = await import('node:fs');
    const path12 = await import('node:path');
    if (fs11.existsSync(uploadDir)) {
      const files = fs11.readdirSync(uploadDir);
      let deletedCount = 0;
      for (const file of files) {
        if (
          file.startsWith('temp_') ||
          file.startsWith('chunk_') ||
          file.startsWith('preprocess_')
        ) {
          try {
            fs11.unlinkSync(path12.join(uploadDir, file));
            deletedCount++;
          } catch (err) {}
        }
      }
      if (deletedCount > 0) {
        logger.info(
          `[Bootstrap] Cleared ${deletedCount} temporary audio files from ${uploadDir} to free up disk space.`
        );
      }
    }
    if (fs11.statfsSync) {
      const stats = fs11.statfsSync(uploadDir);
      const freeBytes = stats.bavail * stats.bsize;
      const freeGB = (freeBytes / 1024 / 1024 / 1024).toFixed(2);
      if (freeBytes < 100 * 1024 * 1024) {
        logger.error(`[Bootstrap] CRITICAL: Disk space critically low! Only ${freeGB}GB free.`);
        logger.error(
          '[Bootstrap] Please clean up disk space or the server will fail to accept recordings.'
        );
        logger.info('[Bootstrap] Attempting automatic disk cleanup...');
        try {
          const { cleanupDisk: cleanupDisk2 } = await Promise.resolve().then(
            () => (init_cleanup_disk(), cleanup_disk_exports)
          );
          const result = cleanupDisk2();
          logger.info(
            `[Bootstrap] Cleanup result: ${result.deletedCount} files deleted, ${(result.freedBytes / 1024 / 1024).toFixed(2)} MB freed`
          );
        } catch (cleanupError) {
          logger.error('[Bootstrap] Automatic cleanup failed:', cleanupError);
        }
      } else if (freeBytes < 500 * 1024 * 1024) {
        logger.warn(`[Bootstrap] WARNING: Disk space low. ${freeGB}GB free.`);
      } else {
        logger.info(`[Bootstrap] Disk space OK: ${freeGB}GB free.`);
      }
    }
  } catch (error) {
    logger.warn('[Bootstrap] Unable to check disk space:', error);
  }
  const db = getDatabase();
  await db.init();
  const authService = new AuthService(db);
  const workspaceService = new WorkspaceService(db);
  logger.info(
    `[Bootstrap] Initializing TranscriptionService with audioPipeline (${typeof audioPipeline_exports}, keys: ${Object.keys(audioPipeline_exports).join(', ')})`
  );
  const transcriptionService = new TranscriptionService(
    db,
    workspaceService,
    audioPipeline_exports,
    speakerEmbedder_exports
  );
  const app = createApp({
    authService,
    workspaceService,
    transcriptionService,
    config: {
      allowedOrigins: config.VOICELOG_ALLOWED_ORIGINS || 'http://localhost:3000',
      trustProxy: config.VOICELOG_TRUST_PROXY === true,
      uploadDir: db.uploadDir,
    },
  });
  const handler = getRequestListener(app.fetch);
  const server = http.createServer(handler);
  return { server, db, authService, workspaceService, transcriptionService };
}
if (process.argv[1] === __filename6 || process.argv[1]?.endsWith('index.ts')) {
  bootstrap()
    .then(({ server }) => {
      logger.info(`Attempting to listen on ${HOST}:${PORT}...`);
      server.on('error', (error) => {
        logger.error('SERVER ERROR:', error);
      });
      server.listen(PORT, HOST, () => {
        logger.info(`VoiceLog API listening on http://${HOST}:${PORT} (test-ready architecture)`);
      });
    })
    .catch((error) => {
      logger.error('FAILED TO START SERVER:', error);
      process.exit(1);
    });
}
var index_default = bootstrap;
export { bootstrap, index_default as default };
