import { getDatabase } from "../database.ts";

async function main() {
  const limit = Math.max(1, Number(process.env.RECORDINGS_LIMIT || 10));
  const db = getDatabase();
  await db.init();

  const rows = await db._query(
    `
      SELECT id, meeting_id, workspace_id, transcription_status, updated_at, transcript_json, diarization_json
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
      transcriptionStatus: row.transcription_status,
      updatedAt: row.updated_at,
      pipelineGitSha: (diarization as any).pipelineGitSha || "",
      transcriptOutcome: (diarization as any).transcriptOutcome || "normal",
      emptyReason: (diarization as any).emptyReason || "",
      errorMessage: (diarization as any).errorMessage || "",
      transcriptLength: Array.isArray(transcript) ? transcript.length : 0,
    };
  });

  console.table(normalized);
}

main().catch((error) => {
  console.error("Failed to inspect latest recordings.", error);
  process.exit(1);
});
