import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to server root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function optionalEnumValue(val: unknown) {
  if (val == null) return undefined;
  const normalized = String(val).trim().toLowerCase();
  return normalized ? normalized : undefined;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
  PORT: z.preprocess((val) => Number(val), z.number()).default(4000),
  VOICELOG_API_PORT: z.preprocess((val) => (val ? Number(val) : undefined), z.number().optional()),
  VOICELOG_API_HOST: z.string().default('0.0.0.0'),
  VOICELOG_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  VOICELOG_TRUST_PROXY: z.preprocess((val) => val === 'true', z.boolean()).default(false),

  DATABASE_URL: z.string().optional(),
  VOICELOG_DATABASE_URL: z.string().optional(),
  VOICELOG_DB_PATH: z.string().optional(),
  VOICELOG_UPLOAD_DIR: z.string().optional(),
  VOICELOG_SESSION_TTL_HOURS: z.preprocess(
    (val) => (val ? Number(val) : undefined),
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
    z.enum(['openai', 'groq']).default('groq')
  ),
  VOICELOG_STT_FALLBACK_PROVIDER: z.preprocess(
    optionalEnumValue,
    z.enum(['openai', 'groq', 'none']).default('none')
  ),
  STT_CONCURRENCY_LIMIT: z
    .preprocess((val) => (val ? Number(val) : undefined), z.number().optional())
    .default(2),
  VOICELOG_PROCESSING_MODE_DEFAULT: z.enum(['fast', 'full']).default('fast'),
  VOICELOG_STT_MODEL_FAST: z.string().default('whisper-1'), // Fast mode: whisper-1 for balance
  VOICELOG_STT_MODEL_FULL: z.string().default('gpt-4o-transcribe'), // Full mode: gpt-4o-transcribe for premium accuracy
  VOICELOG_CHUNK_OVERLAP_SECONDS: z
    .preprocess((val) => (val ? Number(val) : undefined), z.number().int().min(0).optional())
    .default(2),
  VOICELOG_ADAPTIVE_OVERLAP: z.preprocess((val) => val === 'true', z.boolean()).default(true), // Enable adaptive overlap based on speech density
  VOICELOG_ENABLE_CHUNK_VAD: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  VOICELOG_ENABLE_POSTPROCESS: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
  VOICELOG_ENABLE_MEETING_ANALYSIS: z.preprocess((val) => val === 'true', z.boolean()).default(false),

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
  VERIFICATION_MODEL: z.string().default('whisper-1'),

  VOICELOG_DIARIZER: z.enum(['pyannote', 'openai', 'auto']).default('auto'),
  AUDIO_LANGUAGE: z.string().default('pl'),
  AUDIO_PREPROCESS: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
  VOICELOG_SILENCE_REMOVE: z.preprocess((val) => val !== 'false', z.boolean()).default(true),
  VOICELOG_PER_SPEAKER_NORM: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  TRANSCRIPT_CORRECTION: z
    .preprocess((val) => val === 'true' || val === true, z.boolean())
    .default(false),
  VAD_ENABLED: z.preprocess((val) => val === 'true', z.boolean()).default(false),
  WHISPER_PROMPT: z.string().optional(),

  DEBUG: z.preprocess((val) => val === 'true', z.boolean()).default(false),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const config = _env.data;
export type Config = z.infer<typeof envSchema>;

// ─────────────────────────────────────────────────────────────
// [104] Runtime validation of required API keys
// ─────────────────────────────────────────────────────────────
export function validateRequiredApiKeys() {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if at least one STT provider is configured
  const hasOpenAI = Boolean(config.OPENAI_API_KEY);
  const hasGroq = Boolean(config.GROQ_API_KEY);
  const hasLocalWhisper = config.USE_LOCAL_WHISPER && Boolean(config.WHISPER_CPP_PATH);

  if (!hasOpenAI && !hasGroq && !hasLocalWhisper) {
    errors.push(
      'Missing STT provider. Configure one of:\n' +
        '  - OPENAI_API_KEY (OpenAI Whisper)\n' +
        '  - GROQ_API_KEY (Groq Whisper)\n' +
        '  - WHISPER_CPP_PATH + USE_LOCAL_WHISPER=true (Local offline processing)'
    );
  }

  // Supabase is recommended for persistent storage on ephemeral platforms like Railway
  const hasSupabase = Boolean(config.SUPABASE_URL) && Boolean(config.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasSupabase) {
    const isRailway = Boolean(
      process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID
    );
    if (isRailway) {
      errors.push(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
          '  On Railway, the local filesystem is ephemeral — your recordings will be LOST after each redeploy.\n' +
          '  Please set these variables to enable persistent remote storage via Supabase.'
      );
    } else {
      warnings.push(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
          '  Audio files will only be stored locally. This is fine for local development,\n' +
          '  but not recommended for production deployments like Railway.'
      );
    }
  }

  // HuggingFace is required for diarization
  if (!config.HF_TOKEN && !config.HUGGINGFACE_TOKEN) {
    warnings.push(
      'Missing HF_TOKEN. Speaker diarization will be disabled.\n' +
        '  Get a token at: https://huggingface.co/settings/tokens'
    );
  }

  // Log errors and warnings
  if (errors.length > 0) {
    console.error('\n❌ Configuration errors:\n');
    errors.forEach((err) => console.error(`  - ${err}\n`));
    console.error('Please fix these errors and restart the server.\n');

    // Don't exit during tests - let the test handle the error
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration warnings:\n');
    warnings.forEach((warn) => console.warn(`  - ${warn}\n`));
  }

  // Log successful configuration
  if (process.env.NODE_ENV === 'development' || config.DEBUG) {
    console.log('\n✅ Configuration loaded successfully:');
    console.log(
      `  - STT Provider: ${config.VOICELOG_STT_PROVIDER} ${hasOpenAI ? '(OpenAI)' : hasGroq ? '(Groq)' : ''}`
    );
    console.log(
      `  - Diarization: ${config.HF_TOKEN || config.HUGGINGFACE_TOKEN ? 'pyannote (HF token set)' : 'disabled'}`
    );
    console.log(`  - Storage: ${hasSupabase ? 'Supabase remote' : 'Local filesystem only'}`);
    console.log(`  - Processing mode: ${config.VOICELOG_PROCESSING_MODE_DEFAULT}`);
    console.log(`  - Debug: ${config.DEBUG}`);
    console.log('');
  }
}
