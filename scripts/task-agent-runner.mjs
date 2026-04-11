import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { assignTaskAgents } from './assign-task-agents.mjs';

const TASK_QUEUE_PATH = path.resolve(process.cwd(), 'TASK_QUEUE.md');
const ACTIVE_TASK_HEADING = /^###\s+([A-Z]+(?:-[A-Z0-9]+)*-\d+)\s+-\s+(.*)$/;
const SNAPSHOT_TASK_HEADING = /^- \*\*([A-Z]+(?:-[A-Z0-9]+)*-\d+)\*\*\s+—\s+(.*)$/;

function nowIso() {
  return new Date().toISOString();
}

function getIndentedMetadataLine(format, label, value) {
  return format === 'active' ? `- ${label}: \`${value}\`` : `  - **${label}:** \`${value}\``;
}

function parseTaskBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tasks = [];

  for (let i = 0; i < lines.length; i += 1) {
    const activeMatch = lines[i].match(ACTIVE_TASK_HEADING);
    if (activeMatch) {
      const blockLines = [lines[i]];
      const start = i;
      i += 1;
      while (
        i < lines.length &&
        !lines[i].match(ACTIVE_TASK_HEADING) &&
        !lines[i].match(SNAPSHOT_TASK_HEADING) &&
        !lines[i].startsWith('## ')
      ) {
        blockLines.push(lines[i]);
        i += 1;
      }
      i -= 1;
      tasks.push({
        taskId: activeMatch[1],
        title: activeMatch[2],
        format: 'active',
        start,
        end: i,
        lines: blockLines,
      });
      continue;
    }

    const snapshotMatch = lines[i].match(SNAPSHOT_TASK_HEADING);
    if (snapshotMatch) {
      const blockLines = [lines[i]];
      const start = i;
      i += 1;
      while (
        i < lines.length &&
        !lines[i].match(SNAPSHOT_TASK_HEADING) &&
        !lines[i].startsWith('### ') &&
        !lines[i].startsWith('## ')
      ) {
        blockLines.push(lines[i]);
        i += 1;
      }
      i -= 1;
      tasks.push({
        taskId: snapshotMatch[1],
        title: snapshotMatch[2],
        format: 'snapshot',
        start,
        end: i,
        lines: blockLines,
      });
    }
  }

  return { lines, tasks };
}

function extractField(task, fieldName) {
  const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldRegexes =
    fieldName === 'owner'
      ? [
          /(?:Wlasciciel|Owner):\s*(?:`([^`]+)`|([^\r\n`]+))\s*$/i,
          /\*\*(?:Owner|Wlasciciel):\*\*\s*(?:`([^`]+)`|([^\r\n`]+))\s*$/i,
        ]
      : [
          new RegExp(`(?:${escapedFieldName}:|\\*\\*${escapedFieldName}:\\*\\*)\\s*(?:\`([^\\\`]+)\`|([^\\r\\n\\\`]+))\\s*$`, 'i'),
        ];

  for (const line of task.lines) {
    for (const fieldRegex of fieldRegexes) {
      const match = line.match(fieldRegex);
      if (match) {
        return (match[1] || match[2] || match[3] || match[4] || '').trim();
      }
    }
  }
  return null;
}

function getTaskStatus(task) {
  return extractField(task, 'Status')?.toLowerCase() || null;
}

function hasDispatchMetadata(task) {
  return task.lines.some(
    (line) =>
      /Dispatch status:\s*(?:`[^`]+`|[^\r\n`]+)\s*$/i.test(line) ||
      /\*\*Dispatch status:\*\*\s*(?:`[^`]+`|[^\r\n`]+)\s*$/i.test(line)
  );
}

function isDispatchableTask(task) {
  const automation = extractField(task, 'Automation')?.toLowerCase() || '';
  const dispatchMode = extractField(task, 'Dispatch mode')?.toLowerCase() || '';

  if (automation === 'escalate' || dispatchMode === 'manual_only') {
    return false;
  }

  return getTaskStatus(task) === 'todo' && Boolean(extractField(task, 'owner')) && !hasDispatchMetadata(task);
}

function buildTaskPayload(task) {
  return {
    taskId: task.taskId,
    title: task.title,
    owner: extractField(task, 'owner'),
    status: getTaskStatus(task),
    automation: extractField(task, 'Automation'),
    dispatchMode: extractField(task, 'Dispatch mode'),
    body: task.lines.join('\n'),
    format: task.format,
    sourceFile: TASK_QUEUE_PATH,
  };
}

function resolveAgentTarget(agentName, env = process.env) {
  const normalized = String(agentName || '').trim().toUpperCase();
  return {
    webhookUrl: env[`TASK_AGENT_${normalized}_WEBHOOK_URL`] || '',
    command: env[`TASK_AGENT_${normalized}_COMMAND`] || '',
  };
}

export async function dispatchTask(task, options = {}) {
  const env = options.env || process.env;
  const payload = buildTaskPayload(task);
  const { webhookUrl, command } = resolveAgentTarget(payload.owner, env);

  if (webhookUrl) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('No fetch implementation available for webhook dispatch.');
    }

    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook dispatch failed with HTTP ${response.status}`);
    }

    return { mode: 'webhook', target: webhookUrl };
  }

  if (command) {
    const tempPath = path.join(os.tmpdir(), `task-runner-${payload.taskId}-${Date.now()}.json`);
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    try {
      const timeoutMs = Number(env.TASK_RUNNER_COMMAND_TIMEOUT_MS || 900000);
      const result = spawnSync(command, {
        shell: true,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: timeoutMs,
        env: {
          ...env,
          TASK_RUNNER_TASK_ID: payload.taskId,
          TASK_RUNNER_AGENT: payload.owner,
          TASK_RUNNER_TASK_FILE: tempPath,
          TASK_RUNNER_TASK_TITLE: payload.title,
        },
      });

      if (result.status !== 0) {
        const stderr = String(result.stderr || result.stdout || '').trim();
        throw new Error(stderr || `Command dispatch failed with status ${result.status}`);
      }

      return { mode: 'command', target: command };
    } finally {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
  }

  return null;
}

export function applyDispatchMetadata(markdown, taskId, metadata) {
  const parsed = parseTaskBlocks(markdown);
  const task = parsed.tasks.find((item) => item.taskId === taskId);
  if (!task) return markdown;

  const nextLines = [...task.lines];
  const ownerIndex = nextLines.findIndex((line) => /(?:Wlasciciel|Owner):\s*`[^`]+`/i.test(line));
  const insertIndex = ownerIndex >= 0 ? ownerIndex + 1 : 1;
  nextLines.splice(
    insertIndex,
    0,
    getIndentedMetadataLine(task.format, 'Dispatch status', metadata.status),
    getIndentedMetadataLine(task.format, 'Dispatch time', metadata.dispatchedAt),
    getIndentedMetadataLine(task.format, 'Dispatch target', metadata.target)
  );

  return [
    ...parsed.lines.slice(0, task.start),
    ...nextLines,
    ...parsed.lines.slice(task.end + 1),
  ].join('\n');
}

export async function runTaskAgentCycle(options = {}) {
  const taskQueuePath = options.taskQueuePath || TASK_QUEUE_PATH;
  const original = fs.readFileSync(taskQueuePath, 'utf8');
  const assigned = assignTaskAgents(original);
  let current = assigned.markdown;
  const dispatches = [];

  if (current !== original) {
    fs.writeFileSync(taskQueuePath, current, 'utf8');
  }

  const parsed = parseTaskBlocks(current);
  for (const task of parsed.tasks) {
    if (!isDispatchableTask(task)) continue;
    const dispatchResult = await dispatchTask(task, options);
    if (!dispatchResult) continue;

    const dispatchedAt = nowIso();
    current = applyDispatchMetadata(current, task.taskId, {
      status: 'dispatched',
      dispatchedAt,
      target: `${dispatchResult.mode}:${dispatchResult.target}`,
    });
    dispatches.push({
      taskId: task.taskId,
      agent: extractField(task, 'owner'),
      mode: dispatchResult.mode,
      target: dispatchResult.target,
      dispatchedAt,
    });
  }

  if (current !== fs.readFileSync(taskQueuePath, 'utf8')) {
    fs.writeFileSync(taskQueuePath, current, 'utf8');
  }

  return {
    assigned: assigned.assignments,
    dispatches,
    markdown: current,
  };
}

export async function startTaskAgentRunner(options = {}) {
  const intervalMs = Number(options.intervalMs || process.env.TASK_RUNNER_INTERVAL_MS || 2 * 60 * 60 * 1000);
  const once = options.once ?? process.env.TASK_RUNNER_ONCE === 'true';

  const runCycle = async () => {
    try {
      const result = await runTaskAgentCycle(options);
      if (result.assigned.length === 0 && result.dispatches.length === 0) {
        console.log('Task runner: no new assignable or dispatchable tasks.');
      } else {
        result.assigned.forEach((item) => console.log(`Assigned ${item.taskId} -> ${item.agent}`));
        result.dispatches.forEach((item) =>
          console.log(`Dispatched ${item.taskId} -> ${item.agent} via ${item.mode}`)
        );
      }
    } catch (error) {
      console.error('Task runner cycle failed:', error instanceof Error ? error.message : String(error));
    }
  };

  await runCycle();
  if (once) return;

  console.log(`Task runner polling every ${Math.round(intervalMs / 60000)} minute(s).`);
  setInterval(runCycle, intervalMs);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  startTaskAgentRunner();
}
