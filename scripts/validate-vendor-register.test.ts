import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const docPath = join(repoRoot, 'docs', 'VENDOR_DATA_RESIDENCY_MATRIX.md');

const requiredProviders = [
  'Supabase',
  'OpenAI',
  'Groq',
  'Anthropic',
  'Hugging Face',
  'Google Gemini',
  'Google Workspace',
  'Sentry',
  'Datadog',
  'New Relic',
  'OpenTelemetry',
];

const requiredEnvFlags = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'OPENAI_API_KEY',
  'VOICELOG_OPENAI_API_KEY',
  'VOICELOG_OPENAI_BASE_URL',
  'GROQ_API_KEY',
  'ANTHROPIC_API_KEY',
  'VOICELOG_ENABLE_MEETING_ANALYSIS',
  'HF_TOKEN',
  'HUGGINGFACE_TOKEN',
  'GEMINI_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
  'SENTRY_DSN',
  'DD_API_KEY',
  'NEW_RELIC_LICENSE_KEY',
  'VOICELOG_OTEL_ENABLED',
];

const requiredCapabilities = [
  'stt',
  'diarization',
  'meetingAnalysis',
  'supabaseStorage',
  'embeddings',
  'imageGeneration',
];

describe('vendor data residency matrix', () => {
  it('documents production providers, env flags, fallbacks, and capabilities mapping', () => {
    const markdown = readFileSync(docPath, 'utf8');

    for (const provider of requiredProviders) {
      expect(markdown).toContain(provider);
    }

    for (const envFlag of requiredEnvFlags) {
      expect(markdown).toContain(envFlag);
    }

    for (const capabilityId of requiredCapabilities) {
      expect(markdown).toContain(capabilityId);
    }

    expect(markdown).toContain('/api/capabilities');
    expect(markdown).toContain('/health');
    expect(markdown).toContain('Disable or fallback path');
    expect(markdown).toContain('User-facing disclosure source');
  });
});
