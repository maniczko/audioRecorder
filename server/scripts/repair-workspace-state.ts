import { getDatabase } from '../database.ts';

function readArg(name: string) {
  const prefix = `--${name}=`;
  const directIndex = process.argv.indexOf(`--${name}`);
  if (directIndex >= 0 && process.argv[directIndex + 1]) {
    return process.argv[directIndex + 1];
  }
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
}

function safeJsonParse(value: unknown, fallback: any) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return fallback;
  }
}

function countValidMeetingIds(meetings: unknown[]) {
  const counts = new Map<string, number>();
  let nullish = 0;
  let invalid = 0;

  meetings.forEach((meeting: any) => {
    if (!meeting) {
      nullish += 1;
      return;
    }
    const id = String(meeting?.id || '').trim();
    if (!id) {
      invalid += 1;
      return;
    }
    counts.set(id, (counts.get(id) || 0) + 1);
  });

  return {
    nullish,
    invalid,
    duplicates: [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0),
  };
}

async function main() {
  const workspaceId = readArg('workspace') || process.env.WORKSPACE_ID || '';
  const apply = process.argv.includes('--apply');

  if (!workspaceId.trim()) {
    console.error('Missing workspace id. Use WORKSPACE_ID=... or --workspace=...');
    process.exit(1);
  }

  const db = getDatabase();
  await db.init();

  const row = await db._get('SELECT * FROM workspace_state WHERE workspace_id = ?', [workspaceId]);
  if (!row) {
    console.error(`workspace_state row not found for ${workspaceId}`);
    process.exit(1);
  }

  const calendarMeta = safeJsonParse(row.calendar_meta_json, {});
  const meetings = safeJsonParse(row.meetings_json, []);
  const before = Array.isArray(meetings) ? meetings : [];
  const beforeCounts = countValidMeetingIds(before);
  const normalized = db._normalizeWorkspaceMeetings(before, {
    meetingTombstoneIds: db._extractMeetingTombstoneIds(calendarMeta),
  });

  const summary = {
    workspaceId,
    mode: apply ? 'apply' : 'dry-run',
    before: {
      meetings: before.length,
      nullish: beforeCounts.nullish,
      invalid: beforeCounts.invalid,
      duplicateEntries: beforeCounts.duplicates,
    },
    after: {
      meetings: normalized.meetings.length,
    },
    changed: normalized.changed,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply || !normalized.changed) {
    return;
  }

  await db.saveWorkspaceState(workspaceId, {
    meetings: normalized.meetings,
    manualTasks: safeJsonParse(row.manual_tasks_json, []),
    taskState: safeJsonParse(row.task_state_json, {}),
    taskBoards: safeJsonParse(row.task_boards_json, {}),
    calendarMeta,
    vocabulary: safeJsonParse(row.vocabulary_json, []),
  });

  console.log(`workspace_state repaired for ${workspaceId}`);
}

main().catch((error) => {
  console.error('Failed to repair workspace_state.', error);
  process.exit(1);
});
