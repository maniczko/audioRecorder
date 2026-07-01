import { getDatabase } from '../database.ts';

async function main() {
  const db = getDatabase();
  await db.init();
  try {
    const workspaceId = String(process.env.VOICELOG_RETENTION_WORKSPACE_ID || '').trim();
    const result = await db.cleanupExpiredRecordingsByRetention({
      workspaceId,
      actorUserId: 'system',
      source: 'scheduled-maintenance',
      nowIso: new Date().toISOString(),
    });
    console.log(JSON.stringify({ ok: true, workspaceId: workspaceId || 'all', ...result }));
  } finally {
    await db.shutdown();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
});
