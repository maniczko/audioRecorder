import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to server root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
  PORT: z.preprocess((val) => Number(val), z.number()).default(4000),
  VOICELOG_API_PORT: z.preprocess((val) => val ? Number(val) : undefined, z.number().optional()),
  VOICELOG_API_HOST: z.string().default("0.0.0.0"),
  VOICELOG_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  VOICELOG_TRUST_PROXY: z.preprocess((val) => val === "true", z.boolean()).default(false),
  
  DATABASE_URL: z.string().optional(),
  VOICELOG_DATABASE_URL: z.string().optional(),
  VOICELOG_DB_PATH: z.string().optional(),
  VOICELOG_UPLOAD_DIR: z.string().optional(),
  VOICELOG_SESSION_TTL_HOURS: z.preprocess((val) => val ? Number(val) : undefined, z.number().optional()),
  
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  SENTRY_DSN: z.string().optional(),
  
  OPENAI_API_KEY: z.string().optional(),
  VOICELOG_OPENAI_API_KEY: z.string().optional(),
  VOICELOG_OPENAI_BASE_URL: z.string().default("https://api.openai.com/v1"),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-haiku-latest"),
  
  HF_TOKEN: z.string().optional(),
  HUGGINGFACE_TOKEN: z.string().optional(),
  FFMPEG_BINARY: z.string().default("ffmpeg"),
  PYTHON_BINARY: z.string().default("python"),
  
  DIARIZATION_MODEL: z.string().default("pyannote/speaker-diarization-3.1"),
  SPEAKER_IDENTIFICATION_MODEL: z.string().default("microsoft/wavlm-base-plus-sv"),
  VERIFICATION_MODEL: z.string().default("gpt-4o-transcribe"),
  
  AUDIO_LANGUAGE: z.string().default("pl"),
  AUDIO_PREPROCESS: z.preprocess((val) => val !== "false", z.boolean()).default(true),
  TRANSCRIPT_CORRECTION: z.preprocess((val) => val === "true", z.boolean()).default(false),
  VAD_ENABLED: z.preprocess((val) => val !== "false", z.boolean()).default(true),
  WHISPER_PROMPT: z.string().optional(),
  
  DEBUG: z.preprocess((val) => val === "true", z.boolean()).default(false),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  process.exit(1);
}

export const config = _env.data;
export type Config = z.infer<typeof envSchema>;
