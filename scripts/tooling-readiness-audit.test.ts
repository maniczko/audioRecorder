import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  evaluateToolingReadiness,
  formatToolingReadinessMarkdown,
  requiredToolingIds,
} from './tooling-readiness-audit.mjs';

describe('tooling-readiness-audit', () => {
  it('keeps the repository tooling orchestration at the 9/10 target', () => {
    const report = evaluateToolingReadiness();

    expect(requiredToolingIds).toEqual([
      'github-actions-secrets',
      'supabase-mcp',
      'sentry',
      'vercel',
      'railway',
      'playwright-browser',
      'codex-skills',
      'prompt-engineer',
      'coderabbit',
      'figma-canva',
      'twilio',
      'openai-developers',
      'local-env',
    ]);
    expect(report.averageScore).toBeGreaterThanOrEqual(9);
    expect(report.tools.map((tool) => tool.id)).toEqual(requiredToolingIds);
    expect(report.tools.every((tool) => tool.score >= 9)).toBe(true);
    expect(report.blockers).toEqual([]);
  });

  it('fails below target when repository evidence is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-tooling-audit-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));

    const report = evaluateToolingReadiness({ rootDir: root });

    expect(report.averageScore).toBeLessThan(9);
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          toolId: 'github-actions-secrets',
          evidenceId: 'node22-ci',
        }),
      ])
    );
  });

  it('does not read or print local secret values from .env', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-tooling-audit-'));
    fs.mkdirSync(path.join(root, 'docs/tooling'), { recursive: true });
    fs.writeFileSync(path.join(root, '.env'), 'OPENAI_API_KEY=SECRET_MARKER_SHOULD_NOT_APPEAR');
    fs.writeFileSync(path.join(root, '.env.example'), 'OPENAI_API_KEY=\nSENTRY_DSN=\n');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: {} }));

    const report = evaluateToolingReadiness({ rootDir: root });
    const markdown = formatToolingReadinessMarkdown(report);

    expect(markdown).not.toContain('SECRET_MARKER_SHOULD_NOT_APPEAR');
    expect(JSON.stringify(report)).not.toContain('SECRET_MARKER_SHOULD_NOT_APPEAR');
  });
});
