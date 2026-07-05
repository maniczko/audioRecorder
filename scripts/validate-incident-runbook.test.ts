import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const runbookPath = join(repoRoot, 'docs', 'INCIDENT_RESPONSE_DR_RUNBOOK.md');

describe('incident response and disaster recovery runbook', () => {
  it('documents severity, roles, rollback, scenarios, tabletop, and post-incident review', () => {
    const markdown = readFileSync(runbookPath, 'utf8');

    for (const requiredText of [
      'Severity levels',
      'Roles and escalation',
      'Communication',
      'Rollback',
      'Verification commands',
      'Backend unhealthy after deploy',
      'STT provider outage',
      'Supabase Storage unavailable',
      'Database degraded',
      'Stuck transcription jobs',
      'High failure rate',
      'Tabletop exercise checklist',
      'Post-incident review template',
      'pnpm run release:prod-smoke',
      'pnpm run release:audio-prod-smoke',
      'pnpm run errors:railway',
      'pnpm run sentry:release-health',
      'pnpm run verify:supabase:workspace',
    ]) {
      expect(markdown).toContain(requiredText);
    }
  });
});
