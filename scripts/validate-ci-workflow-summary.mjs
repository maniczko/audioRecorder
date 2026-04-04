import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const workflowPath = '.github/workflows/ci-optimized.yml';

function readWorkflow() {
  const absolutePath = path.join(rootDir, workflowPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing file: ${workflowPath}`);
  }

  return fs.readFileSync(absolutePath, 'utf8');
}

export function validateCiWorkflowSummary(content = readWorkflow()) {
  if (!/summary:/m.test(content)) {
    throw new Error(`Workflow validation failed for ${workflowPath}: missing summary job`);
  }

  if (!/name:\s*Check job statuses/m.test(content)) {
    throw new Error(
      `Workflow validation failed for ${workflowPath}: missing "Check job statuses" step`
    );
  }

  if (/exit 1/m.test(content)) {
    throw new Error(
      `Workflow validation failed for ${workflowPath}: summary job must not exit 1 and create duplicate CI failures`
    );
  }

  if (!/::warning::Critical checks failed in upstream jobs\./m.test(content)) {
    throw new Error(
      `Workflow validation failed for ${workflowPath}: missing upstream critical failure warning`
    );
  }

  return true;
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule = entrypointPath === path.resolve(rootDir, 'scripts/validate-ci-workflow-summary.mjs');

if (isMainModule) {
  validateCiWorkflowSummary();
  console.log('CI workflow summary validation passed.');
}
