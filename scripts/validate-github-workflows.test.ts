import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowDir = path.resolve('.github/workflows');
const suspiciousMojibakePattern =
  /[\u0102\u00c4]\S*|\u00e2[\u20ac\u2022\u2020\u201d\u2122]?|\u0111\u017a|\ufffd/u;

describe('GitHub workflows validation', () => {
  it('parses every workflow file and keeps required top-level keys', async () => {
    const { readdirSync } = await import('node:fs');
    const workflowFiles = readdirSync(workflowDir).filter((entry) => entry.endsWith('.yml'));

    for (const fileName of workflowFiles) {
      const filePath = path.join(workflowDir, fileName);
      const parsed = parse(readFileSync(filePath, 'utf8')) as {
        name?: unknown;
        on?: unknown;
        jobs?: unknown;
      } | null;

      expect(parsed, fileName).toBeTruthy();
      expect(typeof parsed?.name, fileName).toBe('string');
      expect(parsed && 'on' in parsed, fileName).toBe(true);
      expect(parsed && 'jobs' in parsed, fileName).toBe(true);
    }
  });

  it('rejects the mojibake pattern that broke workflow loading before', () => {
    const brokenSample =
      "name: Broken\non:\n  push:\n    branches: [main]\njobs:\n  bad:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo 'Ä‚â€žĂ˘â‚¬ÂĂ„Ä…ÄąĹş broken'\n";

    expect(suspiciousMojibakePattern.test(brokenSample)).toBe(true);
  });

  it('does not flag the restored CI workflow as mojibake', () => {
    const workflowPath = path.join(workflowDir, 'ci.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(suspiciousMojibakePattern.test(content)).toBe(false);
  });

  it('keeps the CI security audit report while blocking only high and critical findings', () => {
    const workflowPath = path.join(workflowDir, 'ci.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('pnpm audit --audit-level=high --json > audit-report.json || true');
    expect(content).toContain('report.metadata?.vulnerabilities');
    expect(content).toContain('high > 0 || critical > 0');
  });

  it('gives optimized ci test job extra heap for the large Vitest suite', () => {
    const workflowPath = path.join(workflowDir, 'ci-optimized.yml');
    const parsed = parse(readFileSync(workflowPath, 'utf8')) as {
      jobs?: {
        test?: {
          env?: Record<string, string>;
        };
      };
    } | null;

    expect(parsed?.jobs?.test?.env?.NODE_OPTIONS).toBe('--max-old-space-size=12288');
  });

  it('passes exact SHA enforcement into backend smoke checks', () => {
    const workflowPath = path.join(workflowDir, 'backend-production-smoke.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('REQUIRE_EXACT_GIT_SHA');
    expect(content).toContain('require_exact_git_sha');
  });

  it('uses the backend smoke scope helper instead of treating every package.json edit as a backend deploy', () => {
    const workflowPath = path.join(workflowDir, 'backend-production-smoke.yml');
    const content = readFileSync(workflowPath, 'utf8');

    expect(content).toContain('scripts/detect-backend-smoke-scope.mjs');
    expect(content).not.toContain("grep -Eq '^(server/|Dockerfile|package\\.json");
  });
});
