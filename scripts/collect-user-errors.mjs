#!/usr/bin/env node

/**
 * collect-user-errors.js
 *
 * Reads an exported VoiceLog error log JSON file and appends
 * corresponding tasks to TASK_QUEUE.md.
 *
 * Usage:
 *   node scripts/collect-user-errors.js <path-to-errors.json>
 *   node scripts/collect-user-errors.js              # reads from stdin
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const TASK_QUEUE_PATH = resolve(import.meta.dirname, '..', 'TASK_QUEUE.md');

function readInput() {
  const arg = process.argv[2];
  if (arg && existsSync(arg)) {
    return readFileSync(arg, 'utf-8');
  }
  // Try stdin
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    console.error('Usage: node scripts/collect-user-errors.js <errors.json>');
    process.exit(1);
  }
}

function groupErrors(errors) {
  const groups = new Map();
  for (const err of errors) {
    const key = `${err.type}::${err.message}`;
    if (!groups.has(key)) {
      groups.set(key, { ...err, count: 1 });
    } else {
      groups.get(key).count++;
    }
  }
  return [...groups.values()];
}

function errorToTask(err, index) {
  const typeLabel =
    {
      runtime: 'Runtime Error',
      'unhandled-rejection': 'Promise Rejection',
      'react-boundary': 'React Boundary Error',
      network: 'Network Error',
      manual: 'User-Reported Issue',
    }[err.type] || 'Unknown Error';

  const date = err.timestamp ? err.timestamp.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const countNote = err.count > 1 ? ` (x${err.count})` : '';
  const taskId = `USER-ERR-${Date.now().toString(36).toUpperCase()}-${index}`;

  let md = `\n- **${taskId}** - ${typeLabel}: ${err.message}${countNote}\n`;
  md += `  - **Status:** todo\n`;
  md += `  - **Source:** User error log (${date})\n`;
  md += `  - **Type:** ${err.type}\n`;
  if (err.source) md += `  - **File:** ${err.source}\n`;
  if (err.context) md += `  - **Context:** ${err.context}\n`;
  if (err.stack) {
    const shortStack = err.stack.split('\n').slice(0, 3).join('\n    ');
    md += `  - **Stack:**\n    \`\`\`\n    ${shortStack}\n    \`\`\`\n`;
  }

  return md;
}

function main() {
  const raw = readInput();
  let errors;
  try {
    errors = JSON.parse(raw);
  } catch {
    console.error('Invalid JSON input');
    process.exit(1);
  }

  if (!Array.isArray(errors) || errors.length === 0) {
    console.log('No errors to import.');
    return;
  }

  const grouped = groupErrors(errors);
  console.log(`Found ${errors.length} errors (${grouped.length} unique).`);

  const taskBlocks = grouped.map((err, i) => errorToTask(err, i));
  const section = `\n### User-Reported Errors (imported ${new Date().toISOString().slice(0, 10)})\n${taskBlocks.join('')}`;

  if (!existsSync(TASK_QUEUE_PATH)) {
    console.error(`TASK_QUEUE.md not found at: ${TASK_QUEUE_PATH}`);
    process.exit(1);
  }

  const current = readFileSync(TASK_QUEUE_PATH, 'utf-8');
  writeFileSync(TASK_QUEUE_PATH, current.trimEnd() + '\n' + section + '\n', 'utf-8');
  console.log(`Added ${grouped.length} task(s) to TASK_QUEUE.md`);
}

main();
