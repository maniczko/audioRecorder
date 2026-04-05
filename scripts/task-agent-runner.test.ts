import { describe, expect, it, vi } from 'vitest';

import { applyDispatchMetadata, dispatchTask } from './task-agent-runner.mjs';

describe('task-agent-runner', () => {
  it('adds dispatch metadata for active tasks', () => {
    const input = `### MON-12 - Backend task

- Status: \`todo\`
- Wlasciciel: \`Codex\``;

    const result = applyDispatchMetadata(input, 'MON-12', {
      status: 'dispatched',
      dispatchedAt: '2026-04-05T10:00:00.000Z',
      target: 'command:codex',
    });

    expect(result).toContain('- Dispatch status: `dispatched`');
    expect(result).toContain('- Dispatch time: `2026-04-05T10:00:00.000Z`');
    expect(result).toContain('- Dispatch target: `command:codex`');
  });

  it('adds dispatch metadata for snapshot tasks', () => {
    const input = `- **GH-AUTO-2026-04-05-9** — Security issue
  - **Status:** \`todo\`
  - **Owner:** \`Qwen\``;

    const result = applyDispatchMetadata(input, 'GH-AUTO-2026-04-05-9', {
      status: 'dispatched',
      dispatchedAt: '2026-04-05T10:00:00.000Z',
      target: 'webhook:https://example.test/hook',
    });

    expect(result).toContain('  - **Dispatch status:** `dispatched`');
    expect(result).toContain('  - **Dispatch target:** `webhook:https://example.test/hook`');
  });

  it('dispatches through webhook when configured', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const task = {
      taskId: 'MON-13',
      title: 'Webhook task',
      format: 'active',
      lines: ['### MON-13 - Webhook task', '- Status: `todo`', '- Wlasciciel: `Codex`'],
    };

    const result = await dispatchTask(task, {
      env: { TASK_AGENT_CODEX_WEBHOOK_URL: 'https://example.test/codex' },
      fetchImpl,
    });

    expect(result).toEqual({ mode: 'webhook', target: 'https://example.test/codex' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('skips dispatch when no command or webhook is configured', async () => {
    const task = {
      taskId: 'MON-14',
      title: 'No target task',
      format: 'active',
      lines: ['### MON-14 - No target task', '- Status: `todo`', '- Wlasciciel: `Codex`'],
    };

    const result = await dispatchTask(task, { env: {} });

    expect(result).toBeNull();
  });

  it('assigns and dispatches tasks in one cycle', async () => {
    vi.resetModules();
    const queue = `### MON-15 - Backend task

- Status: \`todo\`
- Priorytet: \`P1\`

- **GH-AUTO-2026-04-05-10** — Security issue
  - **Status:** \`todo\``;

    const writes = [];
    const readFileSync = vi.fn().mockImplementation(() => {
      if (writes.length > 0) return writes[writes.length - 1];
      return queue;
    });
    const writeFileSync = vi.fn().mockImplementation((_file, content) => {
      writes.push(content);
    });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const fsMock = {
      readFileSync,
      writeFileSync,
    };

    vi.doMock('node:fs', () => ({ default: fsMock, ...fsMock }));

    const { runTaskAgentCycle: freshCycle } = await import('./task-agent-runner.mjs');

    const result = await freshCycle({
      taskQueuePath: 'TASK_QUEUE.md',
      env: {
        TASK_AGENT_CODEX_WEBHOOK_URL: 'https://example.test/codex',
        TASK_AGENT_QWEN_WEBHOOK_URL: 'https://example.test/qwen',
      },
      fetchImpl,
    });

    expect(result.assigned).toEqual([
      { taskId: 'MON-15', agent: 'Codex' },
      { taskId: 'GH-AUTO-2026-04-05-10', agent: 'Qwen' },
    ]);
    expect(result.dispatches).toHaveLength(2);
    expect(writes[writes.length - 1]).toContain('Dispatch status');
  });
});
