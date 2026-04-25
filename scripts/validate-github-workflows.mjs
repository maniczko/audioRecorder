import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

const workflowDir = path.resolve('.github/workflows');
const suspiciousMojibakePattern =
  /[\u0102\u00c4]\S*|\u00e2[\u20ac\u2022\u2020\u201d\u2122]?|\u0111\u017a|\ufffd/u;

function validateWorkflowFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

  if (suspiciousMojibakePattern.test(content)) {
    throw new Error(`Workflow validation failed for ${relativePath}: suspicious mojibake detected`);
  }

  const parsed = parse(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Workflow validation failed for ${relativePath}: file does not parse`);
  }

  if (typeof parsed.name !== 'string' || parsed.name.trim().length === 0) {
    throw new Error(`Workflow validation failed for ${relativePath}: missing workflow name`);
  }

  if (!('on' in parsed) || !('jobs' in parsed)) {
    throw new Error(
      `Workflow validation failed for ${relativePath}: missing required on/jobs keys`
    );
  }
}

for (const entry of fs.readdirSync(workflowDir)) {
  if (!entry.endsWith('.yml')) {
    continue;
  }

  validateWorkflowFile(path.join(workflowDir, entry));
}

console.log('GitHub workflow validation passed.');
