import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkflowStep {
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
}

interface WorkflowDefinition {
  jobs?: Record<string, { steps?: WorkflowStep[] }>;
}

const workflowDir = path.resolve('.github/workflows');
const setupAction = './.github/actions/setup-node-pnpm';
const compressedSizeActionPrefix = 'preactjs/compressed-size-action@';

function readWorkflow(name: string): WorkflowDefinition {
  return parse(readFileSync(path.join(workflowDir, name), 'utf8')) as WorkflowDefinition;
}

function expectPostSafeBundleSequence(workflowName: string, steps: WorkflowStep[]) {
  const preserveIndex = steps.findIndex(
    (step) => step.name === 'Preserve repository-owned setup action'
  );
  const setupIndex = steps.findIndex((step) => step.uses === setupAction);
  const compressedSizeIndex = steps.findIndex((step) =>
    step.uses?.startsWith(compressedSizeActionPrefix)
  );
  const restoreCheckoutIndex = steps.findIndex(
    (step) => step.name === 'Restore pull request checkout for action cleanup'
  );
  const restoreActionIndex = steps.findIndex(
    (step) => step.name === 'Restore repository-owned setup action for post steps'
  );

  expect(preserveIndex, `${workflowName} preserve action step`).toBeGreaterThanOrEqual(0);
  expect(setupIndex, `${workflowName} canonical setup step`).toBeGreaterThan(preserveIndex);
  expect(compressedSizeIndex, `${workflowName} compressed-size step`).toBeGreaterThan(setupIndex);
  expect(restoreCheckoutIndex, `${workflowName} checkout restore step`).toBeGreaterThan(
    compressedSizeIndex
  );
  expect(restoreActionIndex, `${workflowName} action restore step`).toBeGreaterThan(
    restoreCheckoutIndex
  );

  expect(steps[preserveIndex]?.run, `${workflowName} preserve command`).toContain(
    '$RUNNER_TEMP/setup-node-pnpm-action'
  );
  expect(steps[preserveIndex]?.run, `${workflowName} preserve source`).toContain(
    'cp -R .github/actions/setup-node-pnpm/.'
  );
  expect(steps[restoreActionIndex]?.if, `${workflowName} action restore condition`).toBe('always()');
  expect(steps[restoreActionIndex]?.run, `${workflowName} action restore guard`).toContain(
    'test -f "$RUNNER_TEMP/setup-node-pnpm-action/action.yml"'
  );
  expect(steps[restoreActionIndex]?.run, `${workflowName} action restore target`).toContain(
    'mkdir -p .github/actions/setup-node-pnpm'
  );
}

describe('bundle workflow checkout regression', () => {
  // -----------------------------------------------------------------
  // Issue #1514 — stale pull-request heads and compressed-size checkout
  // Date: 2026-07-22
  // Bug: a PR created before the local setup action existed could not start
  //      Bundle Size Monitor. After compressed-size-action changed checkout,
  //      nested post steps could also lose the repository-owned action path.
  // Fix: use the synthetic merge checkout and preserve the action in RUNNER_TEMP
  //      before restoring it for post-step execution.
  // -----------------------------------------------------------------
  it('uses the merge checkout before running the local action on pull requests', () => {
    const workflow = readWorkflow('bundle-size.yml');
    const steps = workflow.jobs?.['bundle-size']?.steps ?? [];
    const checkout = steps.find((step) => step.name === 'Checkout code');

    expect(checkout?.uses).toBe('actions/checkout@v7');
    expect(checkout?.if).toBe("github.event_name == 'pull_request'");
    expect(checkout?.with?.ref).toBeUndefined();
  });

  it('keeps the setup action available through standalone bundle comparison checkout changes', () => {
    const workflow = readWorkflow('bundle-size.yml');
    const steps = workflow.jobs?.['bundle-size']?.steps ?? [];

    expectPostSafeBundleSequence('bundle-size.yml', steps);
  });

  it('keeps the setup action available through code-review bundle checkout changes', () => {
    const workflow = readWorkflow('code-review.yml');
    const steps = workflow.jobs?.['bundle-size']?.steps ?? [];

    expectPostSafeBundleSequence('code-review.yml', steps);
  });
});
