import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function clean(value) {
  return String(value || '').trim();
}

function normalizeId(value) {
  return clean(value);
}

function transcriptTextLength(value) {
  const segments = Array.isArray(value) ? value : [];
  return segments.reduce(
    (sum, segment) => sum + clean(segment?.text || segment?.transcript).length,
    0
  );
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

function isCanonicalRemoteAudioPath(value) {
  const raw = clean(value);
  return Boolean(raw && !isLikelyLocalAudioPath(raw) && !raw.includes('/'));
}

function extractTombstoneIds(calendarMeta, key, legacyKey) {
  const ids = new Set();
  const add = (value) => {
    const id = normalizeId(value?.id || value?.recordingId || value?.meetingId || value);
    if (id) ids.add(id);
  };
  if (Array.isArray(calendarMeta?.[key])) {
    calendarMeta[key].forEach(add);
  }
  if (legacyKey && Array.isArray(calendarMeta?.[legacyKey])) {
    calendarMeta[legacyKey].forEach(add);
  }
  return ids;
}

export function extractRecordingRefs(meeting) {
  const refs = new Map();
  const meetingId = normalizeId(meeting?.id);
  const meetingTitle = clean(meeting?.title || meeting?.name || meeting?.summary);

  const add = (recording, source) => {
    const recordingId = normalizeId(
      recording?.id || recording?.recordingId || recording?.assetId || recording
    );
    if (!recordingId) return;
    const existing = refs.get(recordingId) || {};
    refs.set(recordingId, {
      ...existing,
      meetingId,
      meetingTitle,
      recordingId,
      source: existing.source ? `${existing.source},${source}` : source,
      transcript:
        Array.isArray(existing.transcript) && existing.transcript.length > 0
          ? existing.transcript
          : Array.isArray(recording?.transcript)
            ? recording.transcript
            : [],
      rawRecording: typeof recording === 'object' ? recording : existing.rawRecording,
    });
  };

  add(meeting?.latestRecordingId, 'latestRecordingId');
  add(meeting?.recordingId, 'recordingId');
  for (const recording of Array.isArray(meeting?.recordings) ? meeting.recordings : []) {
    add(recording, 'recordings');
  }

  return [...refs.values()];
}

function issue(severity, code, message, details = {}) {
  return { severity, code, message, details };
}

export function buildWorkspaceConsistencyReport({
  workspaceId,
  workspaceRow,
  mediaAssets = [],
  storageStatusByPath = {},
  storageChecked = false,
  bucket = DEFAULT_BUCKET,
} = {}) {
  const issues = [];
  const stateWorkspaceId = normalizeId(workspaceRow?.workspace_id || workspaceId);
  const calendarMeta = safeJsonParse(workspaceRow?.calendar_meta_json, {});
  const meetingsRaw = safeJsonParse(workspaceRow?.meetings_json, []);
  const meetings = Array.isArray(meetingsRaw) ? meetingsRaw : [];
  const meetingTombstoneIds = extractTombstoneIds(
    calendarMeta,
    'meetingTombstones',
    'deletedMeetingIds'
  );
  const recordingTombstoneIds = extractTombstoneIds(
    calendarMeta,
    'recordingTombstones',
    'deletedRecordingIds'
  );
  const assets = Array.isArray(mediaAssets) ? mediaAssets : [];
  const assetsById = new Map(
    assets.map((asset) => [normalizeId(asset?.id), asset]).filter(([id]) => Boolean(id))
  );
  const storageStatus =
    storageStatusByPath instanceof Map
      ? storageStatusByPath
      : new Map(Object.entries(storageStatusByPath || {}));

  if (!workspaceRow) {
    issues.push(
      issue('P0', 'workspace_state_missing', `workspace_state row not found for ${workspaceId}`, {
        workspaceId,
      })
    );
  }

  if (!Array.isArray(meetingsRaw)) {
    issues.push(
      issue('P0', 'workspace_meetings_not_array', 'workspace_state.meetings_json is not an array', {
        workspaceId: stateWorkspaceId,
      })
    );
  }

  const meetingIds = new Map();
  const recordingRefs = [];
  meetings.forEach((meeting, index) => {
    if (!meeting || typeof meeting !== 'object') {
      issues.push(
        issue(
          'P1',
          'workspace_meeting_invalid',
          'workspace_state contains an invalid meeting entry',
          {
            workspaceId: stateWorkspaceId,
            index,
          }
        )
      );
      return;
    }

    const meetingId = normalizeId(meeting.id);
    if (!meetingId) {
      issues.push(
        issue('P1', 'workspace_meeting_missing_id', 'workspace_state meeting is missing id', {
          workspaceId: stateWorkspaceId,
          index,
        })
      );
      return;
    }

    meetingIds.set(meetingId, (meetingIds.get(meetingId) || 0) + 1);
    if (meetingTombstoneIds.has(meetingId)) {
      issues.push(
        issue(
          'P0',
          'meeting_resurrected_after_tombstone',
          'workspace_state still contains a meeting listed in calendarMeta.meetingTombstones',
          { workspaceId: stateWorkspaceId, meetingId }
        )
      );
    }

    recordingRefs.push(...extractRecordingRefs(meeting));
  });

  for (const [meetingId, count] of meetingIds.entries()) {
    if (count > 1) {
      issues.push(
        issue(
          'P1',
          'workspace_meeting_duplicate',
          'workspace_state contains duplicate meeting ids',
          {
            workspaceId: stateWorkspaceId,
            meetingId,
            count,
          }
        )
      );
    }
  }

  const refsByRecordingId = new Map();
  for (const ref of recordingRefs) {
    refsByRecordingId.set(ref.recordingId, ref);
    if (recordingTombstoneIds.has(ref.recordingId)) {
      issues.push(
        issue(
          'P0',
          'recording_resurrected_after_tombstone',
          'workspace_state still references a recording listed in calendarMeta.recordingTombstones',
          {
            workspaceId: stateWorkspaceId,
            meetingId: ref.meetingId,
            recordingId: ref.recordingId,
          }
        )
      );
      continue;
    }

    const asset = assetsById.get(ref.recordingId);
    if (!asset) {
      issues.push(
        issue(
          'P1',
          'meeting_references_missing_media_asset',
          'workspace_state meeting references a recording that does not exist in media_assets',
          {
            workspaceId: stateWorkspaceId,
            meetingId: ref.meetingId,
            recordingId: ref.recordingId,
            source: ref.source,
          }
        )
      );
      continue;
    }

    const assetTranscript = safeJsonParse(asset.transcript_json, []);
    const assetTextLength = transcriptTextLength(assetTranscript);
    const uiTextLength = transcriptTextLength(ref.transcript);
    if (assetTextLength > 0 && assetTextLength > uiTextLength) {
      issues.push(
        issue(
          'P1',
          'media_asset_transcript_not_restored_to_workspace',
          'media_assets has a richer transcript than workspace_state/UI for the referenced recording',
          {
            workspaceId: stateWorkspaceId,
            meetingId: ref.meetingId,
            recordingId: ref.recordingId,
            assetTextLength,
            workspaceTextLength: uiTextLength,
          }
        )
      );
    }

    const hasRecordingObject = String(ref.source || '').includes('recordings');
    if (!hasRecordingObject && assetTextLength > 0) {
      issues.push(
        issue(
          'P1',
          'latest_recording_missing_recording_object',
          'meeting has latestRecordingId for an asset with transcript but no recordings[] entry for UI hydration',
          {
            workspaceId: stateWorkspaceId,
            meetingId: ref.meetingId,
            recordingId: ref.recordingId,
          }
        )
      );
    }
  }

  for (const asset of assets) {
    const recordingId = normalizeId(asset?.id);
    if (!recordingId || recordingTombstoneIds.has(recordingId)) continue;

    const filePath = clean(asset?.file_path);
    if (!filePath) {
      issues.push(
        issue('P0', 'media_asset_missing_file_path', 'media_assets row has no file_path', {
          workspaceId: stateWorkspaceId,
          recordingId,
        })
      );
    } else if (isLikelyLocalAudioPath(filePath)) {
      issues.push(
        issue(
          'P0',
          'media_asset_uses_local_audio_path',
          'production media_assets.file_path points to local/ephemeral storage instead of Supabase Storage',
          {
            workspaceId: stateWorkspaceId,
            recordingId,
            filePath,
          }
        )
      );
    } else if (!isCanonicalRemoteAudioPath(filePath)) {
      issues.push(
        issue(
          'P2',
          'media_asset_non_canonical_storage_path',
          'media_assets.file_path should be a canonical Supabase Storage object name',
          {
            workspaceId: stateWorkspaceId,
            recordingId,
            filePath,
          }
        )
      );
    }

    if (filePath && !isLikelyLocalAudioPath(filePath) && storageChecked) {
      const storagePath = normalizeStoragePath(filePath);
      const status = storageStatus.get(storagePath);
      if (!status?.exists) {
        issues.push(
          issue(
            'P0',
            'supabase_storage_object_missing',
            'media_assets.file_path points to a missing Supabase Storage object',
            {
              workspaceId: stateWorkspaceId,
              recordingId,
              bucket,
              filePath: storagePath,
              error: status?.error,
            }
          )
        );
      }
    }

    const meetingId = normalizeId(asset?.meeting_id);
    if (meetingId && !meetingIds.has(meetingId) && !meetingTombstoneIds.has(meetingId)) {
      issues.push(
        issue(
          'P1',
          'media_asset_points_to_missing_meeting',
          'media_assets.meeting_id points to a meeting that is not present in workspace_state',
          {
            workspaceId: stateWorkspaceId,
            meetingId,
            recordingId,
          }
        )
      );
    }

    if (!meetingId && !refsByRecordingId.has(recordingId)) {
      issues.push(
        issue(
          'P2',
          'media_asset_without_meeting_reference',
          'media asset is not attached to a workspace_state meeting',
          {
            workspaceId: stateWorkspaceId,
            recordingId,
          }
        )
      );
    }
  }

  const severityCounts = issues.reduce(
    (counts, item) => {
      counts[item.severity] = (counts[item.severity] || 0) + 1;
      return counts;
    },
    { P0: 0, P1: 0, P2: 0 }
  );

  return {
    ok: severityCounts.P0 === 0 && severityCounts.P1 === 0,
    workspaceId: stateWorkspaceId || workspaceId,
    storageChecked,
    bucket,
    summary: {
      meetings: meetings.length,
      mediaAssets: assets.length,
      meetingTombstones: meetingTombstoneIds.size,
      recordingTombstones: recordingTombstoneIds.size,
      recordingReferences: recordingRefs.length,
      issues: issues.length,
      severityCounts,
    },
    issues,
  };
}

export function validateSupabaseVerifierEnv(env = process.env) {
  const missing = [];
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!clean(env[key])) missing.push(key);
  }
  const workspaceId = clean(env.WORKSPACE_ID || env.PRODUCTION_SMOKE_WORKSPACE_ID);
  if (!workspaceId) missing.push('WORKSPACE_ID or PRODUCTION_SMOKE_WORKSPACE_ID');
  if (missing.length > 0) {
    throw new Error(
      `Supabase workspace consistency verification missing env: ${missing.join(', ')}`
    );
  }
  try {
    const parsed = new URL(clean(env.SUPABASE_URL));
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      throw new Error('invalid Supabase project URL');
    }
  } catch {
    throw new Error(
      'Supabase workspace consistency verification requires SUPABASE_URL to be the Supabase project API URL.'
    );
  }
}

async function storageObjectExists(supabase, bucket, filePath) {
  const storagePath = normalizeStoragePath(filePath);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60);
  return {
    path: storagePath,
    exists: Boolean(!error && data?.signedUrl),
    error: error?.message,
  };
}

export async function fetchWorkspaceConsistencyInputs({
  supabase,
  workspaceId,
  bucket = DEFAULT_BUCKET,
  checkStorage = true,
}) {
  const stateResult = await supabase
    .from('workspace_state')
    .select('workspace_id, meetings_json, calendar_meta_json, updated_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (stateResult.error) {
    throw new Error(`Failed to read workspace_state: ${stateResult.error.message}`);
  }

  const assetsResult = await supabase
    .from('media_assets')
    .select(
      'id, workspace_id, meeting_id, file_path, content_type, size_bytes, transcription_status, transcript_json, diarization_json, updated_at'
    )
    .eq('workspace_id', workspaceId);
  if (assetsResult.error) {
    throw new Error(`Failed to read media_assets: ${assetsResult.error.message}`);
  }

  const mediaAssets = Array.isArray(assetsResult.data) ? assetsResult.data : [];
  const storageStatusByPath = new Map();
  if (checkStorage) {
    const paths = [
      ...new Set(
        mediaAssets
          .map((asset) => clean(asset?.file_path))
          .filter((filePath) => filePath && !isLikelyLocalAudioPath(filePath))
          .map(normalizeStoragePath)
      ),
    ];
    const statuses = await Promise.all(
      paths.map((filePath) => storageObjectExists(supabase, bucket, filePath))
    );
    statuses.forEach((status) => storageStatusByPath.set(status.path, status));
  }

  return {
    workspaceRow: stateResult.data,
    mediaAssets,
    storageStatusByPath,
    storageChecked: checkStorage,
  };
}

function writeReport(report) {
  const dir = path.join(rootDir, 'reports', 'supabase-workspace-consistency');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${report.workspaceId || 'workspace'}.json`
  );
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

export async function runSupabaseWorkspaceConsistencyVerification({
  env = process.env,
  workspaceId = readArg('workspace') || env.WORKSPACE_ID || env.PRODUCTION_SMOKE_WORKSPACE_ID,
  bucket = readArg('bucket') || env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET,
  strict = process.argv.includes('--strict') ||
    env.PRODUCTION_REQUIRE_SUPABASE_WORKSPACE_VERIFY === 'true',
  checkStorage = !process.argv.includes('--skip-storage'),
  writeReportFile = process.argv.includes('--write-report') || env.CI === 'true',
} = {}) {
  validateSupabaseVerifierEnv({
    ...env,
    WORKSPACE_ID: workspaceId,
  });

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_SERVICE_ROLE_KEY), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const inputs = await fetchWorkspaceConsistencyInputs({
    supabase,
    workspaceId: clean(workspaceId),
    bucket,
    checkStorage,
  });
  const report = buildWorkspaceConsistencyReport({
    workspaceId: clean(workspaceId),
    bucket,
    ...inputs,
  });
  const reportPath = writeReportFile ? writeReport(report) : '';

  return {
    ...report,
    reportPath,
    strict,
  };
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  entrypointPath === path.resolve(rootDir, 'scripts/verify-supabase-workspace-consistency.mjs');

if (isMainModule) {
  runSupabaseWorkspaceConsistencyVerification()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.strict && !report.ok) {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
