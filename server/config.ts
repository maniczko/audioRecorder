```typescript
import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env relative to server root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function optionalEnumValue(val: unknown) {
  if (val == null) return undefined;
  const normalized = String(val).trim().toLowerCase();
  return normalized ? normalized : undefined;
}

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
  OPENAI_BASE_URL: z.string().optional(),
  LANGSMITH_TRACING: z.string().optional(),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  VOICELOG_STT_PROVIDER: z.preprocess(
    optionalEnumValue,
    z.enum(["openai", "groq"]).default("openai")
  ),
  VOICELOG_STT_FALLBACK_PROVIDER: z.preprocess(
    optionalEnumValue,
    z.enum(["openai", "groq", "none"]).default("none")
  ),
  STT_CONCURRENCY_LIMIT: z.preprocess((val) => val ? Number(val) : undefined, z.number().optional()),
  VOICELOG_PROCESSING_MODE_DEFAULT: z.enum(["fast", "full"]).default("fast"),
  VOICELOG_STT_MODEL_FAST: z.string().default("openai/whisper-1"),
  VOICELOG_STT_MODEL_FULL: z.string().default("openai/whisper-1"),
  VOICELOG_CHUNK_OVERLAP_SECONDS: z.preprocess((val) => val ? Number(val) : undefined, z.number().int().min(0).optional()).default(5),
  VOICELOG_ENABLE_CHUNK_VAD: z.preprocess((val) => val === "true", z.boolean()).default(false),
  VOICELOG_ENABLE_POSTPROCESS: z.preprocess((val) => val !== "false", z.boolean()).default(true),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-haiku-latest"),
  
  HF_TOKEN: z.string().optional(),
  HUGGINGFACE_API_KEY: z.string().optional(), // Added missing environment variable
});

export const config = envSchema.parse(process.env);
export function validateRequiredApiKeys() {
  const requiredKeys = [
    "OPENAI_API_KEY",
    "VOICELOG_OPENAI_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  for (const key of requiredKeys) {
    if (!config[key]) {
      console.error(`Missing required API key: ${key}`);
      process.exit(1);
    }
  }
}
```
