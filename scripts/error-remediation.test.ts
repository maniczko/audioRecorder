import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { classifyError, summarizeRemediationModes } = require('./error-remediation.cjs') as {
  classifyError: (input: {
    source?: string;
    workflow?: string;
    message?: string;
    title?: string;
    text?: string;
    error?: string;
  }) => {
    automation: string;
    dispatchMode: string;
    owner: string;
    priority: string;
    reason: string;
  };
  summarizeRemediationModes: (
    items: Array<{ source?: string; workflow?: string; message?: string; title?: string }>
  ) => Record<string, number>;
};

describe('error-remediation', () => {
  it('classifies lint failures as deterministic auto fixes', () => {
    const result = classifyError({
      source: 'github',
      workflow: 'Lint',
      message: 'ESLint failed because of import order and unused import',
    });

    expect(result).toMatchObject({
      automation: 'auto_fix',
      dispatchMode: 'direct_patch',
      owner: 'Codex',
      priority: 'P2',
    });
  });

  it('classifies GitHub test failures as guarded fixes', () => {
    const result = classifyError({
      source: 'github',
      workflow: 'CI/CD Pipeline',
      message: 'Vitest assertion failed in recorder store tests',
    });

    expect(result).toMatchObject({
      automation: 'guarded_fix',
      dispatchMode: 'branch_pr',
      owner: 'Codex',
      priority: 'P1',
    });
  });

  it('escalates infrastructure and credential failures', () => {
    const result = classifyError({
      source: 'railway',
      workflow: 'Railway runtime',
      message: 'Health check failed with 503 and token unauthorized',
    });

    expect(result).toMatchObject({
      automation: 'escalate',
      dispatchMode: 'manual_only',
      owner: 'Qwen',
      priority: 'P0',
    });
  });

  it('falls back to guarded fixes for unknown GitHub code-facing failures', () => {
    const result = classifyError({
      source: 'github',
      workflow: 'Optimized CI',
      message: 'Unhandled compiler regression in workspace package',
    });

    expect(result).toMatchObject({
      automation: 'guarded_fix',
      dispatchMode: 'branch_pr',
      owner: 'Codex',
      priority: 'P1',
    });
  });

  it('summarizes remediation modes across mixed sources', () => {
    const summary = summarizeRemediationModes([
      { source: 'github', workflow: 'Lint', message: 'prettier formatting issue' },
      { source: 'github', workflow: 'CI', message: 'typecheck failed on contracts.ts' },
      { source: 'vercel', workflow: 'Deployment', message: 'runtime incident with 500 status' },
    ]);

    expect(summary).toEqual({
      auto_fix: 1,
      guarded_fix: 1,
      escalate: 1,
    });
  });
});
