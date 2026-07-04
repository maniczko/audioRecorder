import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWorkspaceConsistencyReport,
  fetchWorkspaceConsistencyInputs,
} from './verify-supabase-workspace-consistency.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BUCKET = 'recordings';

function readArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const directIndex = process.argv.indexOf(`--${name}`);
  if (directIndex >= 0 && process.argv[directIndex + 1]) {
    return process.argv[directIndex + 1];
  }
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function clean(value) {
  return String(value || '').trim();
}

function normalizeStoragePath(value) {
  return clean(value).replace(/^recordings\//, '');
}

function isLikelyLocalAudioPath(value) {
  const raw = clean(value);
  if (!raw) return false;
  return (
    /^[a-z]:\\/i.test(raw) ||
    raw.includes('\\') ||
    raw.startsWith('/') ||
    raw.startsWith('./') ||
    raw.startsWith('../')
  );
}

function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function parseList(value) {
  return clean(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function transcriptTextLength(value) {
  const segments = Array.isArray(value) ? value : [];
  return segments.reduce(
    (sum, segment) => sum + clean(segment?.text || segment?.transcript).length,
    0
  );
}

function assetTranscriptLength(asset) {
  return transcriptTextLength(safeJsonParse(asset?.transcript_json, []));
}

function issue(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

function toStorageStatusMap(storageStatusByPath = {}) {
  return storageStatusByPath instanceof Map
    ? storageStatusByPath
    : new Map(Object.entries(storageStatusByPath || {}));
}

function severityCounts(issues) {
  return issues.reduce(
    (counts, item) => {
      counts[item.severity] = (counts[item.severity] || 0) + 1;
      return counts;
    },
    { P0: 0, P1: 0, P2: 0 }
  );
}

function hasBlockingIssues(issues) {
  return issues.some((item) => item.severity === 'P0' || item.severity === 'P1');
}

export function validateBackupRestoreVerifierEnv(env = process.env) {
  const missing = [];
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!clean(env[key])) missing.push(key);
  }
  const workspaceId = clean(env.WORKSPACE_ID || env.RESTORE_VERIFY_WORKSPACE_ID);
  if (!workspaceId) missing.push('WORKSPACE_ID or RESTORE_VERIFY_WORKSPACE_ID');

  if (missing.length > 0) {
    throw new Error(`Backup restore verification missing env: ${missing.join(', ')}`);
  }

  const environment = clean(env.RESTORE_VERIFY_ENVIRONMENT || 'staging').toLowerCase();
  if (environment === 'production' && env.RESTORE_VERIFY_ALLOW_PRODUCTION !== 'true') {
    throw new Error(
      'Backup restore verification refuses production targets by default. Use staging/sandbox data or set RESTORE_VERIFY_ALLOW_PRODUCTION=true for an explicit break-glass run.'
    );
  }

  try {
    const parsed = new URL(clean(env.SUPABASE_URL));
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      throw new Error('invalid Supabase project URL');
    }
  } catch {
    throw new Error(
      'Backup restore verification requires SUPABASE_URL to be the Supabase project API URL.'
    );
  }
}

export function buildBackupRestoreVerificationReport({
  workspaceId,
  workspaceRow,
  mediaAssets = [],
  storageStatusByPath = {},
  storageChecked = false,
  bucket = DEFAULT_BUCKET,
  expectedRecordingIds = [],
  minCompletedRecordings = 1,
  restoreEnvironment = 'staging',
  backupMetadata = {},
} = {}) {
  const assets = Array.isArray(mediaAssets) ? mediaAssets : [];
  const expectedIds = Array.isArray(expectedRecordingIds)
    ? expectedRecordingIds.map(clean).filter(Boolean)
    : parseList(expectedRecordingIds);
  const storageStatus = toStorageStatusMap(storageStatusByPath);
  const issues = [];
  const consistencyReport = buildWorkspaceConsistencyReport({
    workspaceId,
    workspaceRow,
    mediaAssets: assets,
    storageStatusByPath: storageStatus,
    storageChecked,
    bucket,
  });

  issues.push(
    ...consistencyReport.issues.map((item) => ({
      ...item,
      details: { ...(item.details || {}), source: 'workspace-consistency' },
    }))
  );

  if (clean(restoreEnvironment).toLowerCase() === 'production') {
    issues.push(
      issue(
        'P0',
        'restore_verification_targets_production',
        'Restore verification must run against staging or sandbox data by default.',
        { workspaceId }
      )
    );
  }

  if (!workspaceRow) {
    issues.push(
      issue('P0', 'restore_workspace_missing', 'Restored workspace row is missing.', {
        workspaceId,
      })
    );
  }

  if (assets.length === 0) {
    issues.push(
      issue('P1', 'restore_media_assets_missing', 'Restored workspace has no media assets.', {
        workspaceId,
      })
    );
  }

  const completedWithTranscript = assets.filter(
    (asset) =>
      clean(asset?.transcription_status) === 'completed' && assetTranscriptLength(asset) > 0
  );
  const minimum = Number.isFinite(Number(minCompletedRecordings))
    ? Math.max(0, Number(minCompletedRecordings))
    : 1;
  if (completedWithTranscript.length < minimum) {
    issues.push(
      issue(
        'P1',
        'restore_completed_transcripts_below_threshold',
        'Restored workspace has fewer completed transcript-bearing recordings than expected.',
        {
          workspaceId,
          expectedAtLeast: minimum,
          actual: completedWithTranscript.length,
        }
      )
    );
  }

  const assetsById = new Map(assets.map((asset) => [clean(asset?.id), asset]));
  for (const recordingId of expectedIds) {
    const asset = assetsById.get(recordingId);
    if (!asset) {
      issues.push(
        issue(
          'P0',
          'restore_expected_recording_missing',
          'Expected restored recording is missing.',
          {
            workspaceId,
            recordingId,
          }
        )
      );
      continue;
    }

    if (assetTranscriptLength(asset) === 0) {
      issues.push(
        issue(
          'P1',
          'restore_expected_recording_missing_transcript',
          'Expected restored recording has no transcript metadata.',
          { workspaceId, recordingId }
        )
      );
    }
  }

  if (!storageChecked) {
    issues.push(
      issue(
        'P1',
        'restore_audio_storage_not_checked',
        'Restore verification did not check Supabase Storage audio availability.',
        { workspaceId, bucket }
      )
    );
  } else {
    const assetsToCheck =
      expectedIds.length > 0 ? expectedIds.map((id) => assetsById.get(id)).filter(Boolean) : assets;
    for (const asset of assetsToCheck) {
      const filePath = clean(asset?.file_path);
      if (!filePath || isLikelyLocalAudioPath(filePath)) continue;
      const storagePath = normalizeStoragePath(filePath);
      const status = storageStatus.get(storagePath);
      if (!status) {
        issues.push(
          issue(
            'P1',
            'restore_audio_storage_status_missing',
            'Restore verification did not receive storage status for an audio object.',
            { workspaceId, recordingId: clean(asset?.id), storagePath }
          )
        );
      } else if (!status.exists) {
        issues.push(
          issue(
            'P0',
            'restore_audio_object_missing',
            'Restored media asset points to an unavailable Supabase Storage object.',
            {
              workspaceId,
              recordingId: clean(asset?.id),
              storagePath,
              error: status.error || '',
            }
          )
        );
      }
    }
  }

  if (!clean(backupMetadata.backupId || backupMetadata.restoreId)) {
    issues.push(
      issue(
        'P2',
        'restore_backup_metadata_missing',
        'Backup or restore identifier was not supplied; keep the manual runbook evidence with this report.',
        { workspaceId }
      )
    );
  }

  const counts = severityCounts(issues);
  return {
    ok: !hasBlockingIssues(issues),
    workspaceId: clean(workspaceId),
    restoreEnvironment: clean(restoreEnvironment) || 'staging',
    bucket,
    checkedAt: new Date().toISOString(),
    backupMetadata,
    summary: {
      mediaAssetCount: assets.length,
      expectedRecordingCount: expectedIds.length,
      completedTranscriptCount: completedWithTranscript.length,
      storageChecked,
      severityCounts: counts,
    },
    issues,
  };
}

function writeReport(report) {
  const dir = path.join(rootDir, 'reports', 'backup-restore-verification');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${report.workspaceId || 'workspace'}.json`
  );
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

export async function runBackupRestoreVerification({
  env = process.env,
  workspaceId = readArg('workspace') || env.WORKSPACE_ID || env.RESTORE_VERIFY_WORKSPACE_ID,
  bucket = readArg('bucket') || env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET,
  restoreEnvironment = readArg('environment') || env.RESTORE_VERIFY_ENVIRONMENT || 'staging',
  expectedRecordingIds = parseList(
    readArg('expected-recordings') || env.RESTORE_VERIFY_EXPECTED_RECORDING_IDS
  ),
  minCompletedRecordings = readArg('min-completed-recordings') ||
    env.RESTORE_VERIFY_MIN_COMPLETED_RECORDINGS ||
    1,
  backupMetadata = {
    backupId: readArg('backup-id') || env.RESTORE_VERIFY_BACKUP_ID || '',
    restoreId: readArg('restore-id') || env.RESTORE_VERIFY_RESTORE_ID || '',
  },
  checkStorage = !process.argv.includes('--skip-storage'),
  writeReportFile = process.argv.includes('--write-report') || env.CI === 'true',
  fetchInputs,
  createClientFactory,
} = {}) {
  validateBackupRestoreVerifierEnv({
    ...env,
    WORKSPACE_ID: workspaceId,
    RESTORE_VERIFY_ENVIRONMENT: restoreEnvironment,
  });

  let inputs;
  if (typeof fetchInputs === 'function') {
    inputs = await fetchInputs({
      workspaceId: clean(workspaceId),
      bucket,
      checkStorage,
    });
  } else {
    const createClient =
      createClientFactory || (await import('@supabase/supabase-js')).createClient;
    const supabase = createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_SERVICE_ROLE_KEY), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    inputs = await fetchWorkspaceConsistencyInputs({
      supabase,
      workspaceId: clean(workspaceId),
      bucket,
      checkStorage,
    });
  }

  const report = buildBackupRestoreVerificationReport({
    workspaceId: clean(workspaceId),
    bucket,
    restoreEnvironment,
    expectedRecordingIds,
    minCompletedRecordings,
    backupMetadata,
    ...inputs,
  });
  const reportPath = writeReportFile ? writeReport(report) : '';

  return {
    ...report,
    reportPath,
  };
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule = entrypointPath === path.resolve(rootDir, 'scripts/verify-backup-restore.mjs');

if (isMainModule) {
  runBackupRestoreVerification()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
