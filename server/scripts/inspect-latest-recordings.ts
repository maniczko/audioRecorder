import { getDatabase } from "../database.ts";

async function main() {
  const limit = Math.max(1, Number(process.env.RECORDINGS_LIMIT || 10));
  const db = getDatabase();
  await db.init();

  const rows = await db._query(
    `
      SELECT id, meeting_id, workspace_id, content_type, size_bytes, transcription_status, updated_at, transcript_json, diarization_json
      FROM media_assets
      ORDER BY updated_at DESC
      LIMIT ?
    `,
    [limit]
  );

  const normalized = rows.map((row: any) => {
    let diarization = {};
    let transcript = [];
    try {
      diarization = JSON.parse(row.diarization_json || "{}");
    } catch (_) {}
    try {
      transcript = JSON.parse(row.transcript_json || "[]");
    } catch (_) {}

    return {
      recordingId: row.id,
      meetingId: row.meeting_id || "",
      workspaceId: row.workspace_id || "",
      contentType: row.content_type || "",
      fileSizeBytes: Number(row.size_bytes || 0),
      transcriptionStatus: row.transcription_status,
      updatedAt: row.updated_at,
      pipelineGitSha: (diarization as any).pipelineGitSha || "",
      pipelineVersion: (diarization as any).pipelineVersion || "",
      pipelineBuildTime: (diarization as any).pipelineBuildTime || "",
      transcriptOutcome: (diarization as any).transcriptOutcome || "normal",
      emptyReason: (diarization as any).emptyReason || "",
      errorMessage: (diarization as any).errorMessage || "",
      transcriptionDiagnostics: (diarization as any).transcriptionDiagnostics || null,
      chunksAttempted: Number((diarization as any).transcriptionDiagnostics?.chunksAttempted || 0),
      chunksExtracted: Number((diarization as any).transcriptionDiagnostics?.chunksExtracted || 0),
      chunksDiscardedAsTooSmall: Number((diarization as any).transcriptionDiagnostics?.chunksDiscardedAsTooSmall || 0),
      chunksSentToStt: Number((diarization as any).transcriptionDiagnostics?.chunksSentToStt || 0),
      chunksFailedAtStt: Number((diarization as any).transcriptionDiagnostics?.chunksFailedAtStt || 0),
      chunksReturnedEmptyPayload: Number((diarization as any).transcriptionDiagnostics?.chunksReturnedEmptyPayload || 0),
      chunksWithText: Number((diarization as any).transcriptionDiagnostics?.chunksWithText || 0),
      mergedTextLength: Number((diarization as any).transcriptionDiagnostics?.mergedTextLength || 0),
      lastChunkErrorMessage: (diarization as any).transcriptionDiagnostics?.lastChunkErrorMessage || "",
      transcriptLength: Array.isArray(transcript) ? transcript.length : 0,
    };
  });

  console.table(normalized);
}

main().catch((error) => {
  console.error("Failed to inspect latest recordings.", error);
  process.exit(1);
});
