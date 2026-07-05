import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findForbiddenSecretLiterals, validateSecretHygiene } from './validate-secret-hygiene.mjs';

const repoRoot = process.cwd();
const runbookPath = join(repoRoot, 'docs', 'SECURITY_KEY_MANAGEMENT_RUNBOOK.md');

describe('secret hygiene validation', () => {
  it('blocks obvious production-looking secret literals', () => {
    const violations = findForbiddenSecretLiterals([
      {
        path: 'server/config.ts',
        content: 'const leaked = "sk-proj-live_1234567890abcdefghijklmnopqrstuvwxyz";',
      },
      {
        path: 'docs/example.md',
        content: 'SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real.payload',
      },
      {
        path: 'scripts/example.mjs',
        content: 'const token = "github_pat_1234567890abcdefghijklmnopqrstuvwxyz";',
      },
    ]);

    expect(violations.map((violation) => violation.kind)).toEqual([
      'openai-api-key',
      'supabase-service-role-jwt',
      'github-pat',
    ]);
  });

  it('allows placeholders, dummy CI values, and test fixtures', () => {
    const violations = findForbiddenSecretLiterals([
      { path: '.env.example', content: '# OPENAI_API_KEY=sk-...' },
      {
        path: '.github/workflows/ci.yml',
        content: 'OPENAI_API_KEY: sk-proj-dummy-ci-key-for-validating-env-123456789',
      },
      {
        path: 'server/tests/setup.ts',
        content: "process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';",
      },
    ]);

    expect(violations).toEqual([]);
  });

  it('keeps the current tracked repository free of obvious secret literals', () => {
    expect(() => validateSecretHygiene()).not.toThrow();
  });

  it('documents secret inventory, rotation, encryption assumptions, and emergency response', () => {
    const markdown = readFileSync(runbookPath, 'utf8');

    for (const requiredText of [
      'Secret inventory',
      'Rotation procedure',
      'Emergency rotation checklist',
      'Encryption assumptions',
      'Railway',
      'Vercel',
      'Supabase',
      'OpenAI',
      'Groq',
      'Anthropic',
      'Hugging Face',
      'Google OAuth',
      'Sentry',
      'Datadog',
      'New Relic',
    ]) {
      expect(markdown).toContain(requiredText);
    }
  });
});
