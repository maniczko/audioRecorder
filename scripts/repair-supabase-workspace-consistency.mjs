import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fetchWorkspaceConsistencyInputs,
  safeJsonParse,
} from './verify-supabase-workspace-consistency.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BUCKET = 'recordings';
const DEFAULT_AUDIT_PREFIXES = [
  'audit_',
  'production_smoke_',
  'recording_smoke_',
  'meeting_smoke_',
];
const LEGACY_AUDIO_REASON = 'legacy_local_audio_unavailable';

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

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function itemId(value) {
  return clean(isRecord(value) ? value.id || value.recordingId || value.meetingId : value);
}

function itemUpdatedAtMs(value) {
  const raw = clean(isRecord(value) ? value.updatedAt || value.createdAt : '');
  const parsed = raw ? new Date(raw).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function transcriptTextLength(value) {
  const segments = Array.isArray(value) ? value : [];
  return segments.reduce(
    (sum, segment) => sum + clean(segment?.text || segment?.transcript).length,
    0
  );
}

function parseTranscript(value) {
  const parsed = safeJsonParse(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function parseObject(value) {
  const parsed = safeJsonParse(value, {});
  return isRecord(parsed) ? parsed : {};
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

function normalizeStoragePath(value) {
  return clean(value).replace(/^recordings\//, '');
}

function isAuditLike(value, prefixes = DEFAULT_AUDIT_PREFIXES) {
  const text = clean(value).toLowerCase();
  return prefixes.some((prefix) => text.startsWith(prefix.toLowerCase()));
}

function tombstoneEntry(id, source, now) {
  return { id, deletedAt: now, source };
}

function tombstoneIds(calendarMeta, key) {
  const values = Array.isArray(calendarMeta?.[key]) ? calendarMeta[key] : [];
  return new Set(values.map(itemId).filter(Boolean));
}

function mergeTombstone(calendarMeta, key, id, source, now) {
  const byId = new Map();
  const existing = Array.isArray(calendarMeta?.[key]) ? calendarMeta[key] : [];
  existing.forEach((entry) => {
    const entryId = itemId(entry);
    if (entryId) byId.set(entryId, entry);
  });
  if (id && !byId.has(id)) {
    byId.set(id, tombstoneEntry(id, source, now));
  }
  return {
    ...calendarMeta,
    [key]: [...byId.values()],
  };
}

function normalizeMeetings(rawMeetings, calendarMeta, actions) {
  const meetings = Array.isArray(rawMeetings) ? rawMeetings : [];
  const deletedMeetingIds = tombstoneIds(calendarMeta, 'meetingTombstones');
  const byId = new Map();

  meetings.forEach((meeting, index) => {
    if (!isRecord(meeting)) {
      actions.push({ code: 'invalid_meeting_removed', index });
      return;
    }

    const id = clean(meeting.id);
    if (!id) {
      actions.push({ code: 'invalid_meeting_removed', index });
      return;
    }

    if (deletedMeetingIds.has(id)) {
      actions.push({ code: 'tombstoned_meeting_removed', meetingId: id });
      return;
    }

    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { meeting, index });
      return;
    }

    const existingTime = itemUpdatedAtMs(existing.meeting);
    const nextTime = itemUpdatedAtMs(meeting);
    const shouldReplace = !Number.isFinite(existingTime) || nextTime >= existingTime;
    actions.push({
      code: 'duplicate_meeting_removed',
      meetingId: id,
      keptIndex: shouldReplace ? index : existing.index,
      removedIndex: shouldReplace ? existing.index : index,
    });
    if (shouldReplace) {
      byId.set(id, { meeting, index });
    }
  });

  return [...byId.values()].map((entry) => entry.meeting);
}

function recordingIdsFromMeeting(meeting) {
  if (!isRecord(meeting)) return [];
  const ids = new Set();
  const latest = clean(meeting.latestRecordingId);
  const direct = clean(meeting.recordingId);
  if (latest) ids.add(latest);
  if (direct) ids.add(direct);
  for (const recording of Array.isArray(meeting.recordings) ? meeting.recordings : []) {
    const id = itemId(recording);
    if (id) ids.add(id);
  }
  return [...ids];
}

function mapMeetingIds(meetings) {
  return new Map(meetings.map((meeting) => [clean(meeting?.id), meeting]).filter(([id]) => id));
}

function mapRecordingRefs(meetings) {
  const refs = new Map();
  meetings.forEach((meeting) => {
    recordingIdsFromMeeting(meeting).forEach((recordingId) => {
      refs.set(recordingId, meeting);
    });
  });
  return refs;
}

function assetTranscript(asset) {
  return parseTranscript(asset?.transcript_json);
}

function pipelineStatusFor(asset) {
  const status = clean(asset?.transcription_status);
  if (status === 'completed') return 'done';
  if (status) return status;
  return 'done';
}

function ensureRecordingObject(meeting, asset, now) {
  const recordingId = clean(asset?.id);
  const transcript = assetTranscript(asset);
  const existing = Array.isArray(meeting.recordings) ? meeting.recordings : [];
  const byId = new Map(
    existing
      .filter((recording) => isRecord(recording) && itemId(recording))
      .map((recording) => [itemId(recording), recording])
  );
  const previous = byId.get(recordingId) || {};
  byId.set(recordingId, {
    ...previous,
    id: recordingId,
    createdAt: clean(previous.createdAt || asset.created_at || asset.updated_at || now),
    updatedAt: now,
    transcript,
    pipelineStatus: pipelineStatusFor(asset),
    transcriptionStatus: clean(asset?.transcription_status || previous.transcriptionStatus),
    audioAvailable: false,
    audioUnavailable: true,
    audioUnavailableReason: LEGACY_AUDIO_REASON,
  });

  return {
    ...meeting,
    latestRecordingId: clean(meeting.latestRecordingId || recordingId),
    recordings: [...byId.values()],
  };
}

function removeRecordingFromMeeting(meeting, recordingId) {
  const recordings = (Array.isArray(meeting.recordings) ? meeting.recordings : []).filter(
    (recording) => itemId(recording) !== recordingId
  );
  const next = {
    ...meeting,
    recordings,
  };
  if (clean(next.latestRecordingId) === recordingId) {
    delete next.latestRecordingId;
  }
  if (clean(next.recordingId) === recordingId) {
    delete next.recordingId;
  }
  return next;
}

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

export function buildWorkspaceRepairPlan({
  workspaceId,
  workspaceRow,
  mediaAssets = [],
  now = new Date().toISOString(),
  auditPrefixes = DEFAULT_AUDIT_PREFIXES,
} = {}) {
  const actions = [];
  const rawCalendarMeta = parseObject(workspaceRow?.calendar_meta_json);
  const rawMeetings = safeJsonParse(workspaceRow?.meetings_json, []);
  let calendarMeta = rawCalendarMeta;
  let meetings = normalizeMeetings(rawMeetings, calendarMeta, actions);
  const assets = Array.isArray(mediaAssets) ? mediaAssets : [];
  const mediaAssetIdsToDelete = new Set();
  const storagePathsToRemove = new Set();

  const meetingById = () => mapMeetingIds(meetings);
  const recordingRefs = () => mapRecordingRefs(meetings);

  for (const asset of assets) {
    const recordingId = clean(asset?.id);
    if (!recordingId) continue;

    const filePath = clean(asset?.file_path);
    const meetingId = clean(asset?.meeting_id);
    const localPath = isLikelyLocalAudioPath(filePath);
    const liveMeeting = meetingId ? meetingById().get(meetingId) : recordingRefs().get(recordingId);
    const transcript = assetTranscript(asset);
    const hasTranscript = transcriptTextLength(transcript) > 0;

    if (localPath) {
      mediaAssetIdsToDelete.add(recordingId);
      actions.push({
        code: 'legacy_local_media_asset_removed',
        recordingId,
        meetingId,
        filePath,
      });

      if (liveMeeting && hasTranscript) {
        const nextMeeting = ensureRecordingObject(liveMeeting, asset, now);
        meetings = meetings.map((meeting) =>
          clean(meeting?.id) === clean(nextMeeting.id) ? nextMeeting : meeting
        );
        actions.push({
          code: 'legacy_transcript_preserved_as_audio_unavailable',
          recordingId,
          meetingId: clean(nextMeeting.id),
        });
      } else if (liveMeeting) {
        const nextMeeting = removeRecordingFromMeeting(liveMeeting, recordingId);
        meetings = meetings.map((meeting) =>
          clean(meeting?.id) === clean(nextMeeting.id) ? nextMeeting : meeting
        );
        calendarMeta = mergeTombstone(
          calendarMeta,
          'recordingTombstones',
          recordingId,
          'legacy-local-audio-repair',
          now
        );
        actions.push({
          code: 'legacy_recording_without_transcript_tombstoned',
          recordingId,
          meetingId: clean(nextMeeting.id),
        });
      } else {
        calendarMeta = mergeTombstone(
          calendarMeta,
          'recordingTombstones',
          recordingId,
          'legacy-local-audio-repair',
          now
        );
      }
      continue;
    }

    const hasMissingMeeting = meetingId && !meetingById().has(meetingId);
    const isSafeAuditOrphan =
      hasMissingMeeting &&
      (isAuditLike(recordingId, auditPrefixes) || isAuditLike(meetingId, auditPrefixes));

    if (isSafeAuditOrphan) {
      mediaAssetIdsToDelete.add(recordingId);
      if (filePath) storagePathsToRemove.add(normalizeStoragePath(filePath));
      calendarMeta = mergeTombstone(
        calendarMeta,
        'recordingTombstones',
        recordingId,
        'audit-orphan-media-repair',
        now
      );
      actions.push({
        code: 'audit_orphan_media_asset_removed',
        recordingId,
        meetingId,
        filePath,
      });
      continue;
    }

    if (hasMissingMeeting) {
      actions.push({
        code: 'orphan_media_asset_requires_manual_review',
        recordingId,
        meetingId,
        filePath,
      });
    }
  }

  const deletedIds = new Set(mediaAssetIdsToDelete);
  const mediaAssetsToKeep = assets.filter((asset) => !deletedIds.has(clean(asset?.id)));
  const updatedWorkspaceState = {
    meetings,
    calendarMeta,
  };
  const workspaceStateChanged =
    stableJson(rawMeetings) !== stableJson(meetings) ||
    stableJson(rawCalendarMeta) !== stableJson(calendarMeta);

  return {
    ok: true,
    workspaceId: clean(workspaceRow?.workspace_id || workspaceId),
    workspaceStateChanged,
    updatedWorkspaceState,
    mediaAssetsToKeep,
    operations: {
      mediaAssetIdsToDelete: [...mediaAssetIdsToDelete],
      storagePathsToRemove: [...storagePathsToRemove],
    },
    actions,
    summary: {
      meetingsBefore: Array.isArray(rawMeetings) ? rawMeetings.length : 0,
      meetingsAfter: meetings.length,
      mediaAssetsBefore: assets.length,
      mediaAssetsAfter: mediaAssetsToKeep.length,
      actions: actions.length,
      mediaAssetsToDelete: mediaAssetIdsToDelete.size,
      storagePathsToRemove: storagePathsToRemove.size,
    },
  };
}

export function validateRepairPlanForApply(plan) {
  const hasWorkspaceChange = Boolean(plan?.workspaceStateChanged);
  const hasMediaDeletes = Array.isArray(plan?.operations?.mediaAssetIdsToDelete)
    ? plan.operations.mediaAssetIdsToDelete.length > 0
    : false;
  const hasStorageDeletes = Array.isArray(plan?.operations?.storagePathsToRemove)
    ? plan.operations.storagePathsToRemove.length > 0
    : false;
  if (!hasWorkspaceChange && !hasMediaDeletes && !hasStorageDeletes) {
    throw new Error('Supabase workspace consistency repair has nothing to apply.');
  }
}

function filePathKind(value) {
  const raw = clean(value);
  if (!raw) return 'missing';
  if (isLikelyLocalAudioPath(raw)) return 'local';
  return 'remote';
}

function redactRecording(recording) {
  const transcript = Array.isArray(recording?.transcript) ? recording.transcript : [];
  return {
    id: itemId(recording),
    audioAvailable: recording?.audioAvailable,
    audioUnavailable: recording?.audioUnavailable,
    audioUnavailableReason: clean(recording?.audioUnavailableReason),
    pipelineStatus: clean(recording?.pipelineStatus),
    transcriptionStatus: clean(recording?.transcriptionStatus),
    transcriptSegments: transcript.length,
    transcriptTextLength: transcriptTextLength(transcript),
  };
}

function redactMeeting(meeting) {
  const recordings = Array.isArray(meeting?.recordings) ? meeting.recordings : [];
  return {
    id: clean(meeting?.id),
    latestRecordingId: clean(meeting?.latestRecordingId),
    recordingCount: recordings.length,
    recordings: recordings.map(redactRecording),
  };
}

function redactAction(action) {
  return {
    code: action.code,
    recordingId: action.recordingId,
    meetingId: action.meetingId,
    filePathKind: filePathKind(action.filePath),
    index: action.index,
    keptIndex: action.keptIndex,
    removedIndex: action.removedIndex,
  };
}

export function toPublicRepairReport(report) {
  return {
    ok: report.ok,
    workspaceId: report.workspaceId,
    applied: Boolean(report.applied),
    bucket: report.bucket,
    workspaceStateChanged: Boolean(report.workspaceStateChanged),
    summary: report.summary,
    operations: report.operations,
    actions: Array.isArray(report.actions) ? report.actions.map(redactAction) : [],
    updatedWorkspaceState: {
      meetings: Array.isArray(report.updatedWorkspaceState?.meetings)
        ? report.updatedWorkspaceState.meetings.map(redactMeeting)
        : [],
      calendarMeta: {
        meetingTombstones: Array.isArray(
          report.updatedWorkspaceState?.calendarMeta?.meetingTombstones
        )
          ? report.updatedWorkspaceState.calendarMeta.meetingTombstones.length
          : 0,
        recordingTombstones: Array.isArray(
          report.updatedWorkspaceState?.calendarMeta?.recordingTombstones
        )
          ? report.updatedWorkspaceState.calendarMeta.recordingTombstones.length
          : 0,
      },
    },
  };
}

function writeReport(report) {
  const dir = path.join(rootDir, 'reports', 'supabase-workspace-repair');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${report.workspaceId || 'workspace'}.json`
  );
  fs.writeFileSync(file, `${JSON.stringify(toPublicRepairReport(report), null, 2)}\n`);
  return file;
}

async function applyRepairPlan({ supabase, bucket, plan }) {
  validateRepairPlanForApply(plan);

  if (plan.workspaceStateChanged) {
    const { error } = await supabase
      .from('workspace_state')
      .update({
        meetings_json: JSON.stringify(plan.updatedWorkspaceState.meetings),
        calendar_meta_json: JSON.stringify(plan.updatedWorkspaceState.calendarMeta),
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', plan.workspaceId);
    if (error) {
      throw new Error(`Failed to update workspace_state: ${error.message}`);
    }
  }

  const ids = plan.operations.mediaAssetIdsToDelete;
  if (ids.length > 0) {
    const { error } = await supabase
      .from('media_assets')
      .delete()
      .eq('workspace_id', plan.workspaceId)
      .in('id', ids);
    if (error) {
      throw new Error(`Failed to delete repaired media_assets: ${error.message}`);
    }
  }

  const storagePaths = plan.operations.storagePathsToRemove;
  if (storagePaths.length > 0) {
    const { error } = await supabase.storage.from(bucket).remove(storagePaths);
    if (error) {
      throw new Error(`Failed to remove repaired storage objects: ${error.message}`);
    }
  }
}

export async function runSupabaseWorkspaceConsistencyRepair({
  env = process.env,
  workspaceId = readArg('workspace') || env.WORKSPACE_ID || env.PRODUCTION_SMOKE_WORKSPACE_ID,
  bucket = readArg('bucket') || env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET,
  apply = process.argv.includes('--apply'),
  writeReportFile = process.argv.includes('--write-report') || env.CI === 'true',
} = {}) {
  const { validateSupabaseVerifierEnv } =
    await import('./verify-supabase-workspace-consistency.mjs');
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
    checkStorage: false,
  });
  const plan = buildWorkspaceRepairPlan({
    workspaceId: clean(workspaceId),
    workspaceRow: inputs.workspaceRow,
    mediaAssets: inputs.mediaAssets,
  });

  if (apply) {
    validateRepairPlanForApply(plan);
    await applyRepairPlan({ supabase, bucket, plan });
  }

  const report = {
    ...plan,
    applied: apply,
    bucket,
  };
  const reportPath = writeReportFile ? writeReport(report) : '';
  return {
    ...report,
    reportPath,
  };
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  entrypointPath === path.resolve(rootDir, 'scripts/repair-supabase-workspace-consistency.mjs');

if (isMainModule) {
  runSupabaseWorkspaceConsistencyRepair()
    .then((report) => {
      console.log(JSON.stringify(toPublicRepairReport(report), null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
