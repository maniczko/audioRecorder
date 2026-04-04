import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { validateCiWorkflowSummary } from './validate-ci-workflow-summary.mjs';

const workflowPath = path.resolve(process.cwd(), '.github/workflows/ci-optimized.yml');

function readWorkflow() {
  return fs.readFileSync(workflowPath, 'utf8');
}

// ---------------------------------------------------------------
// Issue #0 - summary job duplicates upstream CI failures
// Date: 2026-04-04
// Bug: the summary job exited with code 1, creating a second GH-AUTO error
// Fix: summary only warns about upstream failures and leaves workflow state
//      to the original critical jobs
// ---------------------------------------------------------------
describe('Regression: Issue #0 - summary job duplicates upstream CI failures', () => {
  it('does not allow exit 1 in the summary job', () => {
    expect(() => validateCiWorkflowSummary(readWorkflow())).not.toThrow();
  });

  it('keeps an explicit warning for upstream critical failures', () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('::warning::Critical checks failed in upstream jobs.');
  });
});
