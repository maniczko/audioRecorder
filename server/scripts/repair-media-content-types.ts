import { pathToFileURL } from 'node:url';
import { getDatabase } from '../database.ts';

export interface MediaContentTypeMismatch {
  id: string;
  workspace_id: string;
  file_path: string;
  content_type: string;
  storage_mode?: string;
}

export function isRepairableWebmContentTypeMismatch(row: Partial<MediaContentTypeMismatch>) {
  const filePath = String(row.file_path || '').toLowerCase();
  const contentType = String(row.content_type || '').toLowerCase();
  return filePath.endsWith('.webm') && contentType === 'audio/mpeg';
}

export function buildRepairPlan(rows: Partial<MediaContentTypeMismatch>[]) {
  return rows.filter(isRepairableWebmContentTypeMismatch).map((row) => ({
    id: String(row.id || ''),
    workspaceId: String(row.workspace_id || ''),
    filePath: String(row.file_path || ''),
    from: String(row.content_type || ''),
    to: 'audio/webm',
  }));
}

async function main() {
  const apply = process.argv.includes('--apply');
  const workspaceArg = process.argv.find((arg) => arg.startsWith('--workspaceId='));
  const workspaceId = workspaceArg ? workspaceArg.split('=').slice(1).join('=').trim() : '';
  const db = getDatabase();
  await db.init();

  const rows = await db._query(
    `
      SELECT id, workspace_id, file_path, content_type, storage_mode
      FROM media_assets
      WHERE lower(file_path) LIKE '%.webm'
        AND lower(content_type) = 'audio/mpeg'
        ${workspaceId ? 'AND workspace_id = ?' : ''}
      ORDER BY updated_at DESC
    `,
    workspaceId ? [workspaceId] : []
  );
  const plan = buildRepairPlan(rows);

  console.table(plan);
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        candidates: rows.length,
        repairable: plan.length,
      },
      null,
      2
    )
  );

  if (!apply || plan.length === 0) return;

  for (const item of plan) {
    await db._execute('UPDATE media_assets SET content_type = ?, updated_at = ? WHERE id = ?', [
      item.to,
      new Date().toISOString(),
      item.id,
    ]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('Failed to repair media content types.', error);
    process.exit(1);
  });
}
