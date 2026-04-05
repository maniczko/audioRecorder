import { describe, expect, it } from 'vitest';

import { assignTaskAgents } from './assign-task-agents.mjs';

describe('assignTaskAgents', () => {
  it('assigns Codex to active todo tasks without an owner by default', () => {
    const input = `### MON-09 - Naprawic backend test

- Status: \`todo\`
- Priorytet: \`P1\`
- Zrodlo: \`GitHub Actions\``;

    const result = assignTaskAgents(input);

    expect(result.assignments).toEqual([{ taskId: 'MON-09', agent: 'Codex' }]);
    expect(result.markdown).toContain('- Wlasciciel: `Codex`');
  });

  it('assigns Qwen to snapshot todo tasks about security and ops', () => {
    const input = `- **GH-AUTO-2026-04-05-5** — Investigate Auto Security Patches network failure
  - **Status:** \`todo\`
  - **Source:** \`GitHub Actions -> Auto Security Patches\`
  - **Error:** \`[VoiceLog] auto-send error: Error: Network down\``;

    const result = assignTaskAgents(input);

    expect(result.assignments).toEqual([{ taskId: 'GH-AUTO-2026-04-05-5', agent: 'Qwen' }]);
    expect(result.markdown).toContain('  - **Owner:** `Qwen`');
  });

  it('does not modify tasks that already have an owner', () => {
    const input = `- **GH-AUTO-2026-04-05-6** — Existing assignment
  - **Status:** \`todo\`
  - **Owner:** \`Qwen\``;

    const result = assignTaskAgents(input);

    expect(result.assignments).toEqual([]);
    expect(result.markdown).toBe(input);
  });

  it('does not modify tasks that are not todo', () => {
    const input = `### MON-10 - Zweryfikowane zadanie

- Status: \`verify\`
- Priorytet: \`P1\``;

    const result = assignTaskAgents(input);

    expect(result.assignments).toEqual([]);
    expect(result.markdown).toBe(input);
  });

  it('handles multiple task formats in one document', () => {
    const input = `## Aktywne zadania

### MON-11 - Backend fix

- Status: \`todo\`
- Priorytet: \`P1\`

## Swiezy snapshot bledow

- **GH-AUTO-2026-04-05-8** — Investigate Railway runtime issue
  - **Status:** \`todo\`
  - **Source:** \`Railway\``;

    const result = assignTaskAgents(input);

    expect(result.assignments).toEqual([
      { taskId: 'MON-11', agent: 'Codex' },
      { taskId: 'GH-AUTO-2026-04-05-8', agent: 'Qwen' },
    ]);
    expect(result.markdown).toContain('- Wlasciciel: `Codex`');
    expect(result.markdown).toContain('  - **Owner:** `Qwen`');
  });

  it('keeps active and snapshot tasks separate without section headers', () => {
    const input = `### MON-15 - Backend task

- Status: \`todo\`
- Priorytet: \`P1\`

- **GH-AUTO-2026-04-05-10** â€” Security issue
  - **Status:** \`todo\``;

    const result = assignTaskAgents(input);

    expect(result.assignments).toEqual([
      { taskId: 'MON-15', agent: 'Codex' },
      { taskId: 'GH-AUTO-2026-04-05-10', agent: 'Qwen' },
    ]);
  });
});
