import fs from 'node:fs';
import path from 'node:path';

const TASK_QUEUE_PATH = path.resolve(process.cwd(), 'TASK_QUEUE.md');

const QWEN_PATTERNS = [
  /\bsecurity\b/i,
  /\bvercel\b/i,
  /\bsentry\b/i,
  /\brailway\b/i,
  /network down/i,
  /install dependencies/i,
  /\bdependency\b/i,
  /\bnpm audit\b/i,
  /\bauto security patches\b/i,
];

const ACTIVE_TASK_HEADING = /^###\s+([A-Z]+(?:-[A-Z0-9]+)*-\d+)\s+-\s+/;
const SNAPSHOT_TASK_HEADING = /^- \*\*([A-Z]+(?:-[A-Z0-9]+)*-\d+)\*\*/;

function getAgentForTask(taskBlock) {
  const normalized = taskBlock.join('\n');
  if (QWEN_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'Qwen';
  }
  return 'Codex';
}

function isTodoStatus(line) {
  return /Status:\s*`todo`/i.test(line) || /\*\*Status:\*\*\s*`todo`/i.test(line);
}

function hasOwnerLine(lines) {
  return lines.some((line) => /Wlasciciel:\s*`[^`]+`/i.test(line) || /\*\*Owner:\*\*\s*`[^`]+`/i.test(line));
}

function assignOwnerToActiveTask(blockLines) {
  if (!blockLines.some(isTodoStatus) || hasOwnerLine(blockLines)) {
    return { changed: false, lines: blockLines };
  }

  const agent = getAgentForTask(blockLines);
  const insertAt = Math.max(
    blockLines.findIndex((line) => /Priorytet:/i.test(line)),
    blockLines.findIndex((line) => /Status:/i.test(line))
  );
  const nextLines = [...blockLines];
  nextLines.splice(insertAt >= 0 ? insertAt + 1 : 1, 0, `- Wlasciciel: \`${agent}\``);
  return { changed: true, lines: nextLines, agent };
}

function assignOwnerToSnapshotTask(blockLines) {
  if (!blockLines.some(isTodoStatus) || hasOwnerLine(blockLines)) {
    return { changed: false, lines: blockLines };
  }

  const agent = getAgentForTask(blockLines);
  const statusIndex = blockLines.findIndex((line) => /\*\*Status:\*\*/i.test(line));
  const nextLines = [...blockLines];
  nextLines.splice(statusIndex >= 0 ? statusIndex + 1 : 1, 0, `  - **Owner:** \`${agent}\``);
  return { changed: true, lines: nextLines, agent };
}

export function assignTaskAgents(markdown) {
  const lines = markdown.split(/\r?\n/);
  const output = [];
  const assignments = [];

  for (let i = 0; i < lines.length; i += 1) {
    const activeMatch = lines[i].match(ACTIVE_TASK_HEADING);
    if (activeMatch) {
      const taskId = activeMatch[1];
      const block = [lines[i]];
      i += 1;
      while (
        i < lines.length &&
        !lines[i].match(ACTIVE_TASK_HEADING) &&
        !lines[i].match(SNAPSHOT_TASK_HEADING) &&
        !lines[i].startsWith('## ')
      ) {
        block.push(lines[i]);
        i += 1;
      }
      i -= 1;

      const assigned = assignOwnerToActiveTask(block);
      output.push(...assigned.lines);
      if (assigned.changed) {
        assignments.push({ taskId, agent: assigned.agent });
      }
      continue;
    }

    const snapshotMatch = lines[i].match(SNAPSHOT_TASK_HEADING);
    if (snapshotMatch) {
      const taskId = snapshotMatch[1];
      const block = [lines[i]];
      i += 1;
      while (
        i < lines.length &&
        !lines[i].match(SNAPSHOT_TASK_HEADING) &&
        !lines[i].startsWith('### ') &&
        !lines[i].startsWith('## ')
      ) {
        block.push(lines[i]);
        i += 1;
      }
      i -= 1;

      const assigned = assignOwnerToSnapshotTask(block);
      output.push(...assigned.lines);
      if (assigned.changed) {
        assignments.push({ taskId, agent: assigned.agent });
      }
      continue;
    }

    output.push(lines[i]);
  }

  return {
    markdown: output.join('\n'),
    assignments,
  };
}

export function assignTaskAgentsFile(taskQueuePath = TASK_QUEUE_PATH) {
  const current = fs.readFileSync(taskQueuePath, 'utf8');
  const result = assignTaskAgents(current);

  if (result.markdown !== current) {
    fs.writeFileSync(taskQueuePath, result.markdown, 'utf8');
  }

  return result;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  const result = assignTaskAgentsFile();
  if (result.assignments.length === 0) {
    console.log('No new unassigned todo tasks found in TASK_QUEUE.md');
  } else {
    result.assignments.forEach((assignment) => {
      console.log(`Assigned ${assignment.taskId} -> ${assignment.agent}`);
    });
  }
}
