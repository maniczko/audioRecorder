import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeJsonParse } from './verify-supabase-workspace-consistency.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function parseArray(value) {
  const parsed = safeJsonParse(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function parseObject(value) {
  const parsed = safeJsonParse(value, {});
  return isRecord(parsed) ? parsed : {};
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function transcriptTextLength(transcript) {
  return (Array.isArray(transcript) ? transcript : []).reduce(
    (sum, segment) => sum + clean(segment?.text || segment?.transcript).length,
    0
  );
}

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function itemId(value) {
  return clean(isRecord(value) ? value.id || value.recordingId || value.assetId : value);
}

function pipelineStatusFor(asset) {
  const status = clean(asset?.transcription_status);
  if (status === 'completed') return 'done';
  return status || 'done';
}

function durationSecondsFor({ manifest, diarization, transcript }) {
  const manifestDuration = positiveNumber(manifest.durationMs) / 1000;
  const qualityDuration = positiveNumber(diarization.audioQuality?.durationSeconds);
  const transcriptDuration = (Array.isArray(transcript) ? transcript : []).reduce(
    (max, segment) =>
      Math.max(max, positiveNumber(segment?.endTimestamp), positiveNumber(segment?.timestamp)),
    0
  );
  return manifestDuration || qualityDuration || transcriptDuration || 0;
}

function buildRecordingFromAsset(asset, now) {
  const transcript = parseArray(asset?.transcript_json);
  const diarization = parseObject(asset?.diarization_json);
  const manifest = parseObject(asset?.media_manifest_json);
  const recordingId = clean(asset?.id);
  const speakerNames = isRecord(diarization.speakerNames) ? diarization.speakerNames : {};
  const partCount = Array.isArray(manifest.parts) ? manifest.parts.length : 0;

  return {
    id: recordingId,
    createdAt: clean(asset?.created_at || asset?.updated_at || now),
    updatedAt: now,
    duration: durationSecondsFor({ manifest, diarization, transcript }),
    transcript,
    pipelineStatus: pipelineStatusFor(asset),
    transcriptionStatus: clean(asset?.transcription_status),
    transcriptOutcome: clean(diarization.transcriptOutcome || 'normal') || 'normal',
    emptyReason: clean(diarization.emptyReason),
    userMessage: clean(diarization.userMessage),
    speakerNames,
    speakerCount:
      positiveNumber(diarization.speakerCount) ||
      new Set(transcript.map((segment) => clean(segment?.speakerId)).filter(Boolean)).size,
    diarizationConfidence: positiveNumber(diarization.confidence),
    reviewSummary: diarization.reviewSummary || null,
    audioQuality: isRecord(diarization.audioQuality) ? diarization.audioQuality : null,
    transcriptionDiagnostics: isRecord(diarization.transcriptionDiagnostics)
      ? diarization.transcriptionDiagnostics
      : null,
    qualityMetrics: isRecord(diarization.qualityMetrics) ? diarization.qualityMetrics : null,
    storageMode: clean(asset?.storage_mode || 'single'),
    contentType: clean(asset?.content_type),
    sizeBytes: positiveNumber(asset?.size_bytes),
    sourceSizeBytes: positiveNumber(asset?.source_size_bytes),
    normalizedSizeBytes: positiveNumber(asset?.normalized_size_bytes),
    partCount,
  };
}

function upsertRecording(meeting, recording, now) {
  const existing = Array.isArray(meeting.recordings) ? meeting.recordings : [];
  const byId = new Map(
    existing
      .filter((candidate) => isRecord(candidate) && itemId(candidate))
      .map((candidate) => [itemId(candidate), candidate])
  );
  const previous = byId.get(recording.id) || {};
  byId.set(recording.id, {
    ...previous,
    ...recording,
    transcript:
      Array.isArray(recording.transcript) && recording.transcript.length > 0
        ? recording.transcript
        : Array.isArray(previous.transcript)
          ? previous.transcript
          : [],
  });

  return {
    ...meeting,
    latestRecordingId: recording.id,
    recordings: [...byId.values()],
    updatedAt: now,
  };
}

function validateInputs({ workspaceId, targetMeetingId, recordingId, workspaceRow, mediaAsset }) {
  const cleanWorkspaceId = clean(workspaceId);
  const cleanTargetMeetingId = clean(targetMeetingId);
  const cleanRecordingId = clean(recordingId);
  if (!cleanWorkspaceId) throw new Error('workspaceId is required.');
  if (!cleanTargetMeetingId) throw new Error('targetMeetingId is required.');
  if (!cleanRecordingId) throw new Error('recordingId is required.');
  if (!workspaceRow) throw new Error(`workspace_state row not found for ${cleanWorkspaceId}.`);
  if (clean(workspaceRow.workspace_id) !== cleanWorkspaceId) {
    throw new Error('workspace_state row does not match workspaceId.');
  }
  if (!mediaAsset) throw new Error(`media asset ${cleanRecordingId} not found.`);
  if (clean(mediaAsset.id) !== cleanRecordingId) {
    throw new Error('media asset id does not match recordingId.');
  }
  if (clean(mediaAsset.workspace_id) !== cleanWorkspaceId) {
    throw new Error(`media asset ${cleanRecordingId} does not belong to workspace ${cleanWorkspaceId}.`);
  }
  if (clean(mediaAsset.transcription_status) !== 'completed') {
    throw new Error(`media asset ${cleanRecordingId} must be completed before attach repair.`);
  }
  const transcript = parseArray(mediaAsset.transcript_json);
  if (transcript.length === 0 || transcriptTextLength(transcript) === 0) {
    throw new Error(`media asset ${cleanRecordingId} transcript_json must contain at least one segment.`);
  }
}

export function buildAttachMediaAssetRepairPlan({
  workspaceId,
  targetMeetingId,
  recordingId,
  workspaceRow,
  mediaAsset,
  now = new Date().toISOString(),
} = {}) {
  validateInputs({ workspaceId, targetMeetingId, recordingId, workspaceRow, mediaAsset });

  const cleanWorkspaceId = clean(workspaceId);
  const cleanTargetMeetingId = clean(targetMeetingId);
  const cleanRecordingId = clean(recordingId);
  const rawMeetings = parseArray(workspaceRow.meetings_json);
  const targetMeeting = rawMeetings.find((meeting) => clean(meeting?.id) === cleanTargetMeetingId);
  if (!targetMeeting) {
    throw new Error(`target meeting ${cleanTargetMeetingId} not found in workspace_state.`);
  }

  const recording = buildRecordingFromAsset(mediaAsset, now);
  const updatedMeeting = upsertRecording(targetMeeting, recording, now);
  const updatedMeetings = rawMeetings.map((meeting) =>
    clean(meeting?.id) === cleanTargetMeetingId ? updatedMeeting : meeting
  );
  const workspaceStateChanged = stableJson(rawMeetings) !== stableJson(updatedMeetings);
  const mediaAssetMeetingChanged = clean(mediaAsset.meeting_id) !== cleanTargetMeetingId;

  return {
    ok: true,
    workspaceId: cleanWorkspaceId,
    targetMeetingId: cleanTargetMeetingId,
    recordingId: cleanRecordingId,
    previousMediaAssetMeetingId: clean(mediaAsset.meeting_id),
    updatedMediaAssetMeetingId: cleanTargetMeetingId,
    workspaceStateChanged,
    mediaAssetMeetingChanged,
    updatedWorkspaceState: {
      meetings: updatedMeetings,
    },
    updatedMeeting,
    actions: [
      {
        code: 'media_asset_attached_to_existing_meeting',
        recordingId: cleanRecordingId,
        targetMeetingId: cleanTargetMeetingId,
        previousMeetingId: clean(mediaAsset.meeting_id),
      },
    ],
    summary: {
      meetingsBefore: rawMeetings.length,
      meetingsAfter: updatedMeetings.length,
      transcriptSegments: recording.transcript.length,
      transcriptTextLength: transcriptTextLength(recording.transcript),
      durationSeconds: recording.duration,
      partCount: recording.partCount,
    },
  };
}

export function validateAttachMediaAssetRepairPlanForApply(plan) {
  if (!plan?.workspaceStateChanged && !plan?.mediaAssetMeetingChanged) {
    throw new Error('Attach media asset repair has nothing to apply.');
  }
  if (!clean(plan?.workspaceId) || !clean(plan?.targetMeetingId) || !clean(plan?.recordingId)) {
    throw new Error('Attach media asset repair plan is missing required ids.');
  }
}

function redactRecording(recording) {
  const transcript = Array.isArray(recording?.transcript) ? recording.transcript : [];
  return {
    id: clean(recording?.id),
    duration: positiveNumber(recording?.duration),
    pipelineStatus: clean(recording?.pipelineStatus),
    transcriptionStatus: clean(recording?.transcriptionStatus),
    transcriptOutcome: clean(recording?.transcriptOutcome),
    storageMode: clean(recording?.storageMode),
    partCount: positiveNumber(recording?.partCount),
    transcriptSegments: transcript.length,
    transcriptTextLength: transcriptTextLength(transcript),
  };
}

export function toPublicAttachMediaAssetRepairReport(report) {
  const updatedMeeting = report?.updatedMeeting || {};
  const recordings = Array.isArray(updatedMeeting.recordings) ? updatedMeeting.recordings : [];
  return {
    ok: Boolean(report?.ok),
    applied: Boolean(report?.applied),
    workspaceId: clean(report?.workspaceId),
    targetMeetingId: clean(report?.targetMeetingId),
    recordingId: clean(report?.recordingId),
    previousMediaAssetMeetingId: clean(report?.previousMediaAssetMeetingId),
    updatedMediaAssetMeetingId: clean(report?.updatedMediaAssetMeetingId),
    workspaceStateChanged: Boolean(report?.workspaceStateChanged),
    mediaAssetMeetingChanged: Boolean(report?.mediaAssetMeetingChanged),
    reportPath: clean(report?.reportPath),
    backupPath: clean(report?.backupPath),
    summary: report?.summary || {},
    actions: Array.isArray(report?.actions) ? report.actions : [],
    updatedMeeting: {
      id: clean(updatedMeeting.id),
      latestRecordingId: clean(updatedMeeting.latestRecordingId),
      recordingCount: recordings.length,
      recordings: recordings.map(redactRecording),
    },
  };
}

function writeJsonFile(dir, prefix, value) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(
    dir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${prefix}.json`
  );
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function writeReport(report) {
  return writeJsonFile(
    path.join(rootDir, 'reports', 'attach-media-asset-repair'),
    `${report.workspaceId || 'workspace'}-${report.recordingId || 'recording'}`,
    toPublicAttachMediaAssetRepairReport(report)
  );
}

function writeWorkspaceBackup({ workspaceRow, workspaceId, recordingId }) {
  return writeJsonFile(
    path.join(rootDir, 'reports', 'attach-media-asset-repair', 'backups'),
    `${workspaceId || 'workspace'}-${recordingId || 'recording'}-workspace-state-backup`,
    {
      workspace_id: workspaceRow?.workspace_id,
      meetings_json: workspaceRow?.meetings_json,
      calendar_meta_json: workspaceRow?.calendar_meta_json,
      updated_at: workspaceRow?.updated_at,
    }
  );
}

function assertNoSupabaseError(result, label) {
  if (result?.error) {
    throw new Error(`${label}: ${result.error.message || String(result.error)}`);
  }
}

export async function applyAttachMediaAssetRepairPlan({
  supabase,
  plan,
  now = () => new Date().toISOString(),
} = {}) {
  validateAttachMediaAssetRepairPlanForApply(plan);
  const updatedAt = now();

  if (plan.workspaceStateChanged) {
    const result = await supabase
      .from('workspace_state')
      .update({
        meetings_json: JSON.stringify(plan.updatedWorkspaceState.meetings),
        updated_at: updatedAt,
      })
      .eq('workspace_id', plan.workspaceId);
    assertNoSupabaseError(result, 'Failed to update workspace_state');
  }

  if (plan.mediaAssetMeetingChanged) {
    const result = await supabase
      .from('media_assets')
      .update({
        meeting_id: plan.targetMeetingId,
        updated_at: updatedAt,
      })
      .eq('workspace_id', plan.workspaceId)
      .eq('id', plan.recordingId);
    assertNoSupabaseError(result, 'Failed to update media_assets');
  }
}

export async function fetchAttachRepairInputs({ supabase, workspaceId, recordingId }) {
  const workspaceResult = await supabase
    .from('workspace_state')
    .select('workspace_id, meetings_json, calendar_meta_json, updated_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  assertNoSupabaseError(workspaceResult, 'Failed to read workspace_state');

  const assetResult = await supabase
    .from('media_assets')
    .select(
      [
        'id',
        'workspace_id',
        'meeting_id',
        'file_path',
        'content_type',
        'size_bytes',
        'storage_mode',
        'media_manifest_json',
        'source_size_bytes',
        'normalized_size_bytes',
        'transcription_status',
        'transcript_json',
        'diarization_json',
        'created_at',
        'updated_at',
      ].join(', ')
    )
    .eq('workspace_id', workspaceId)
    .eq('id', recordingId)
    .maybeSingle();
  assertNoSupabaseError(assetResult, 'Failed to read media_assets');

  return {
    workspaceRow: workspaceResult.data,
    mediaAsset: assetResult.data,
  };
}

export function validateAttachRepairEnv(env) {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((key) => !clean(env?.[key]));
  if (missing.length) {
    throw new Error(`Missing required Supabase env: ${missing.join(', ')}`);
  }
  try {
    const parsed = new URL(clean(env.SUPABASE_URL));
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      throw new Error('invalid');
    }
  } catch {
    throw new Error('SUPABASE_URL must be a Supabase project API URL.');
  }
}

export async function runAttachMediaAssetToMeetingRepair({
  env = process.env,
  workspaceId = readArg('workspace') || env.WORKSPACE_ID || env.PRODUCTION_SMOKE_WORKSPACE_ID,
  targetMeetingId = readArg('meeting') || readArg('target-meeting'),
  recordingId = readArg('recording'),
  apply = process.argv.includes('--apply'),
  writeReportFile = process.argv.includes('--write-report') || apply,
  now = () => new Date().toISOString(),
} = {}) {
  validateAttachRepairEnv(env);
  const cleanWorkspaceId = clean(workspaceId);
  const cleanTargetMeetingId = clean(targetMeetingId);
  const cleanRecordingId = clean(recordingId);

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_SERVICE_ROLE_KEY), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const inputs = await fetchAttachRepairInputs({
    supabase,
    workspaceId: cleanWorkspaceId,
    recordingId: cleanRecordingId,
  });
  const plan = buildAttachMediaAssetRepairPlan({
    workspaceId: cleanWorkspaceId,
    targetMeetingId: cleanTargetMeetingId,
    recordingId: cleanRecordingId,
    workspaceRow: inputs.workspaceRow,
    mediaAsset: inputs.mediaAsset,
    now: now(),
  });

  let backupPath = '';
  if (apply) {
    validateAttachMediaAssetRepairPlanForApply(plan);
    backupPath = writeWorkspaceBackup({
      workspaceRow: inputs.workspaceRow,
      workspaceId: cleanWorkspaceId,
      recordingId: cleanRecordingId,
    });
    await applyAttachMediaAssetRepairPlan({ supabase, plan, now });
  }

  const report = {
    ...plan,
    applied: apply,
    backupPath,
  };
  const reportPath = writeReportFile ? writeReport(report) : '';
  return {
    ...report,
    reportPath,
  };
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  entrypointPath === path.resolve(rootDir, 'scripts/attach-media-asset-to-meeting.mjs');

if (isMainModule) {
  runAttachMediaAssetToMeetingRepair()
    .then((report) => {
      console.log(JSON.stringify(toPublicAttachMediaAssetRepairReport(report), null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
