import { getDatabase } from '../database.ts';

function textLength(segments: any[] = []) {
  return segments.reduce((sum, segment) => sum + String(segment?.text || '').trim().length, 0);
}

function parseJson(value: unknown, fallback: any) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    return fallback;
  }
}

function recordingId(recording: any) {
  return String(recording?.id || recording?.recordingId || '').trim();
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const needle = String(args.join(' ') || '').trim();
  if (!needle) {
    console.error(
      'Usage: pnpm exec tsx server/scripts/inspect-recording-forensics.ts "<meeting title or recording id>"'
    );
    process.exitCode = 1;
    return;
  }

  const db = getDatabase() as any;
  const skipStorageCheck = hasFlag('--skip-storage-check');
  const workspaceRows = await db._query(
    `SELECT * FROM workspace_state
      WHERE meetings_json LIKE ?
      ORDER BY updated_at DESC
      LIMIT 25`,
    [`%${needle}%`]
  );
  const assetRows = await db._query(
    `SELECT id, workspace_id, meeting_id, file_path, content_type, size_bytes,
            transcription_status, transcript_json, diarization_json, updated_at
       FROM media_assets
      WHERE id LIKE ? OR meeting_id LIKE ?
      ORDER BY updated_at DESC`,
    [`%${needle}%`, `%${needle}%`]
  );

  const matches: any[] = [];
  for (const row of workspaceRows) {
    const meetings = parseJson(row.meetings_json, []);
    for (const meeting of Array.isArray(meetings) ? meetings : []) {
      const title = String(meeting?.title || '');
      const recordings = Array.isArray(meeting?.recordings) ? meeting.recordings : [];
      const matchedRecordings = recordings.filter((recording: any) => {
        return (
          recordingId(recording).includes(needle) ||
          String(recording?.title || '').includes(needle) ||
          title.includes(needle)
        );
      });
      if (!title.includes(needle) && matchedRecordings.length === 0) continue;

      matches.push({
        workspaceId: row.workspace_id,
        workspaceUpdatedAt: row.updated_at,
        meetingId: meeting?.id || '',
        meetingTitle: title,
        latestRecordingId: meeting?.latestRecordingId || null,
        recordings: (matchedRecordings.length ? matchedRecordings : recordings).map(
          (recording: any) => ({
            id: recordingId(recording),
            pipelineStatus: recording?.pipelineStatus || recording?.transcriptionStatus || '',
            audioAvailable: recording?.audioAvailable ?? null,
            audioUnavailable: Boolean(recording?.audioUnavailable),
            audioUnavailableReason: recording?.audioUnavailableReason || '',
            duration: recording?.duration || null,
            transcriptSegments: Array.isArray(recording?.transcript)
              ? recording.transcript.length
              : 0,
            transcriptTextLength: textLength(recording?.transcript),
            transcriptOutcome: recording?.transcriptOutcome || '',
          })
        ),
      });
    }
  }

  const assetReport = [];
  for (const asset of assetRows) {
    const transcript = parseJson(asset.transcript_json, []);
    const diarization = parseJson(asset.diarization_json, {});
    let audioAvailable: boolean | null | 'skipped' = 'skipped';
    if (!skipStorageCheck) {
      try {
        audioAvailable = await db._isMediaAssetAudioAvailable(asset.id, asset);
      } catch {
        audioAvailable = null;
      }
    }
    assetReport.push({
      id: asset.id,
      workspaceId: asset.workspace_id,
      meetingId: asset.meeting_id,
      filePath: asset.file_path,
      contentType: asset.content_type,
      sizeBytes: asset.size_bytes,
      transcriptionStatus: asset.transcription_status,
      transcriptSegments: Array.isArray(transcript) ? transcript.length : 0,
      transcriptTextLength: textLength(transcript),
      transcriptOutcome: diarization?.transcriptOutcome || '',
      audioAvailable,
      updatedAt: asset.updated_at,
    });
  }

  console.log(
    JSON.stringify(
      {
        query: needle,
        workspaceMatches: matches,
        mediaAssets: assetReport,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('Failed to inspect recording forensics.', error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode || 0);
  });
