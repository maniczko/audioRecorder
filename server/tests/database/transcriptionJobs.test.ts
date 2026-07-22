import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Database } from '../../database.ts';

let actualFs = fs;
const tempRoots: string[] = [];

async function createDb() {
  actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
  const root = actualFs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-transcription-jobs-'));
  tempRoots.push(root);
  const db = new Database({ dbPath: ':memory:', uploadDir: path.join(root, 'uploads') });
  await db.init();
  return db;
}

async function insertAsset(
  db: Database,
  recordingId: string,
  workspaceId = 'ws_1',
  overrides: Record<string, unknown> = {}
) {
  const now = db.nowIso();
  await db._execute(
    `INSERT INTO media_assets (
      id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
      size_bytes, transcription_status, transcript_json, diarization_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', '[]', '{}', ?, ?)`,
    [
      recordingId,
      workspaceId,
      String(overrides.meeting_id || 'meeting_1'),
      'user_1',
      String(overrides.file_path ?? '/tmp/audio.webm'),
      String(overrides.content_type || 'audio/webm'),
      12,
      now,
      now,
    ]
  );
  if (overrides.transcription_status) {
    await db._execute('UPDATE media_assets SET transcription_status = ? WHERE id = ?', [
      String(overrides.transcription_status),
      recordingId,
    ]);
  }
}

describe('transcription_jobs durable queue', () => {
  afterEach(async () => {
    for (const root of tempRoots.splice(0)) {
      actualFs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('migration creates durable transcription job table and lease indexes', async () => {
    const db = await createDb();
    try {
      await expect(db._get('SELECT * FROM transcription_jobs LIMIT 1')).resolves.toBeNull();
      const indexes = await db._query(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'transcription_jobs'"
      );
      expect(indexes.map((row: { name: string }) => row.name)).toEqual(
        expect.arrayContaining([
          'idx_transcription_jobs_one_active_per_recording',
          'idx_transcription_jobs_lease_queue',
          'idx_transcription_jobs_recording_id',
        ])
      );
    } finally {
      await db.shutdown();
    }
  });

  test('enqueue is idempotent for duplicate active recording requests', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_idempotent');
      const first = await db.enqueueTranscriptionJob({
        recordingId: 'rec_idempotent',
        workspaceId: 'ws_1',
      });
      const second = await db.enqueueTranscriptionJob({
        recordingId: 'rec_idempotent',
        workspaceId: 'ws_1',
      });
      const rows = await db._query('SELECT * FROM transcription_jobs WHERE recording_id = ?', [
        'rec_idempotent',
      ]);

      expect(second.id).toBe(first.id);
      expect(rows).toHaveLength(1);
      await expect(db.getMediaAsset('rec_idempotent')).resolves.toMatchObject({
        transcription_status: 'queued',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('queueTranscription persists recording consent metadata for audit reads', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_consent', 'ws_consent');

      await db.queueTranscription('rec_consent', {
        workspaceId: 'ws_consent',
        meetingId: 'meeting_consent',
        contentType: 'audio/webm',
        recordingConsent: {
          acceptedAt: '2026-06-25T10:00:00.000Z',
          workspaceId: 'ws_consent',
          policyVersion: 'recording-consent-v1',
          actorUserId: 'user_consent',
          disclosureTitle: 'Zgoda na nagrywanie i przetwarzanie AI',
          providerNotice: 'Dane moga byc przekazywane do dostawcow AI/audio.',
          providers: [
            { id: 'stt', label: 'transkrypcja mowy na tekst', enabled: true },
            { id: 'llm-analysis', label: 'analiza AI', enabled: true },
          ],
        },
      });

      const asset = await db.getMediaAsset('rec_consent');
      const diarization = JSON.parse(asset.diarization_json || '{}');

      expect(diarization.recordingConsent).toMatchObject({
        acceptedAt: '2026-06-25T10:00:00.000Z',
        workspaceId: 'ws_consent',
        policyVersion: 'recording-consent-v1',
        actorUserId: 'user_consent',
      });
      expect(diarization.recordingConsent.providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'stt', enabled: true }),
          expect.objectContaining({ id: 'llm-analysis', enabled: true }),
        ])
      );

      await db.queueTranscription('rec_consent', {
        workspaceId: 'ws_consent',
        meetingId: 'meeting_consent',
        contentType: 'audio/webm',
      });

      const requeued = await db.getMediaAsset('rec_consent');
      expect(JSON.parse(requeued.diarization_json || '{}').recordingConsent).toMatchObject({
        actorUserId: 'user_consent',
        policyVersion: 'recording-consent-v1',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('only one worker can acquire a lease for a queued job', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_lease');
      await db.enqueueTranscriptionJob({ recordingId: 'rec_lease', workspaceId: 'ws_1' });

      const firstLease = await db.acquireTranscriptionJobLease({
        workerId: 'worker-a',
        recordingId: 'rec_lease',
      });
      const secondLease = await db.acquireTranscriptionJobLease({
        workerId: 'worker-b',
        recordingId: 'rec_lease',
      });

      expect(firstLease).toMatchObject({ recording_id: 'rec_lease', locked_by: 'worker-a' });
      expect(secondLease).toBeNull();
      await expect(db.getMediaAsset('rec_lease')).resolves.toMatchObject({
        transcription_status: 'processing',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('durable queued job survives service restart and can be recovered', async () => {
    actualFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const root = actualFs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-restart-recovery-'));
    tempRoots.push(root);
    const dbPath = path.join(root, 'voicelog.sqlite');
    const firstDb = new Database({ dbPath, uploadDir: path.join(root, 'uploads') });
    await firstDb.init();
    await insertAsset(firstDb, 'rec_restart');
    const queued = await firstDb.enqueueTranscriptionJob({
      recordingId: 'rec_restart',
      workspaceId: 'ws_1',
    });
    await firstDb.shutdown();

    const secondDb = new Database({ dbPath, uploadDir: path.join(root, 'uploads') });
    await secondDb.init();
    try {
      const recovered = await secondDb.getTranscriptionJobByRecordingId('rec_restart');
      const lease = await secondDb.acquireTranscriptionJobLease({
        workerId: 'worker-after-restart',
        recordingId: 'rec_restart',
      });

      expect(recovered).toMatchObject({ id: queued.id, status: 'queued' });
      expect(lease).toMatchObject({ id: queued.id, status: 'running' });
    } finally {
      await secondDb.shutdown();
    }
  });

  test('completed jobs update media status and allow a new active job for the recording', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_complete');
      const queued = await db.enqueueTranscriptionJob({
        recordingId: 'rec_complete',
        workspaceId: 'ws_1',
      });
      const lease = await db.acquireTranscriptionJobLease({
        workerId: 'worker-complete',
        recordingId: 'rec_complete',
      });

      const completed = await db.completeTranscriptionJob(queued.id, 'worker-complete');
      const next = await db.enqueueTranscriptionJob({
        recordingId: 'rec_complete',
        workspaceId: 'ws_1',
      });
      const rows = await db._query('SELECT * FROM transcription_jobs WHERE recording_id = ?', [
        'rec_complete',
      ]);

      expect(lease).toMatchObject({ id: queued.id, status: 'running' });
      expect(completed).toMatchObject({ id: queued.id, status: 'completed' });
      expect(next.id).not.toBe(queued.id);
      expect(rows).toHaveLength(2);
      await expect(db.getMediaAsset('rec_complete')).resolves.toMatchObject({
        transcription_status: 'queued',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('media status helpers keep durable job state synchronized', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_sync');
      const queued = await db.enqueueTranscriptionJob({
        recordingId: 'rec_sync',
        workspaceId: 'ws_1',
      });

      await db.markTranscriptionProcessing('rec_sync');
      const running = await db.getTranscriptionJobByRecordingId('rec_sync');
      expect(running).toMatchObject({ id: queued.id, status: 'running' });

      await db.saveTranscriptionResult('rec_sync', {
        pipelineStatus: 'completed',
        segments: [{ text: 'done' }],
      });
      const completed = await db._get('SELECT * FROM transcription_jobs WHERE id = ?', [queued.id]);
      expect(completed).toMatchObject({
        status: 'completed',
        locked_by: '',
        locked_until: '',
      });
      expect(completed.completed_at).toEqual(expect.any(String));

      await insertAsset(db, 'rec_failure');
      const failureQueued = await db.enqueueTranscriptionJob({
        recordingId: 'rec_failure',
        workspaceId: 'ws_1',
      });
      await db.acquireTranscriptionJobLease({
        workerId: 'worker-failure',
        recordingId: 'rec_failure',
      });

      await db.markTranscriptionFailure('rec_failure', 'Provider failed', {
        errorCode: 'provider_failed',
      });
      const failed = await db._get('SELECT * FROM transcription_jobs WHERE id = ?', [
        failureQueued.id,
      ]);
      expect(failed).toMatchObject({
        status: 'failed',
        locked_by: '',
        locked_until: '',
        last_error_code: 'provider_failed',
        last_error_message: 'Provider failed',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('failed leased jobs retry only after next_run_at and reject wrong-worker updates', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_retry');
      const queued = await db.enqueueTranscriptionJob({
        recordingId: 'rec_retry',
        workspaceId: 'ws_1',
        maxAttempts: 2,
        nextRunAt: '2026-06-25T10:00:00.000Z',
      });
      const lease = await db.acquireTranscriptionJobLease({
        workerId: 'worker-a',
        recordingId: 'rec_retry',
        now: '2026-06-25T10:00:00.000Z',
      });

      await expect(
        db.failTranscriptionJob(queued.id, 'worker-b', new Error('wrong'))
      ).resolves.toBe(null);
      const retryable = await db.failTranscriptionJob(
        queued.id,
        'worker-a',
        { code: 'STT_TEMPORARY', message: 'temporary provider failure' },
        { now: '2026-06-25T10:00:00.000Z', retryDelayMs: 60_000 }
      );
      const tooEarlyLease = await db.acquireTranscriptionJobLease({
        workerId: 'worker-b',
        recordingId: 'rec_retry',
        now: '2026-06-25T10:00:30.000Z',
      });
      const retryLease = await db.acquireTranscriptionJobLease({
        workerId: 'worker-b',
        recordingId: 'rec_retry',
        now: '2026-06-25T10:01:00.000Z',
      });

      expect(lease).toMatchObject({ id: queued.id, locked_by: 'worker-a' });
      expect(retryable).toMatchObject({
        id: queued.id,
        status: 'retryable_failed',
        last_error_code: 'STT_TEMPORARY',
        next_run_at: '2026-06-25T10:01:00.000Z',
      });
      expect(tooEarlyLease).toBeNull();
      expect(retryLease).toMatchObject({
        id: queued.id,
        status: 'running',
        locked_by: 'worker-b',
        attempt_count: 2,
      });
    } finally {
      await db.shutdown();
    }
  });

  test('heartbeat extends only the current worker lease', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_heartbeat');
      const queued = await db.enqueueTranscriptionJob({
        recordingId: 'rec_heartbeat',
        workspaceId: 'ws_1',
        nextRunAt: '2026-06-25T10:00:00.000Z',
      });
      await db.acquireTranscriptionJobLease({
        workerId: 'worker-heartbeat',
        recordingId: 'rec_heartbeat',
        now: '2026-06-25T10:00:00.000Z',
      });

      await expect(
        db.heartbeatTranscriptionJob(queued.id, 'worker-other', 120_000, '2026-06-25T10:02:00.000Z')
      ).resolves.toBeNull();
      const extended = await db.heartbeatTranscriptionJob(
        queued.id,
        'worker-heartbeat',
        120_000,
        '2026-06-25T10:02:00.000Z'
      );

      expect(extended).toMatchObject({
        id: queued.id,
        locked_by: 'worker-heartbeat',
        locked_until: '2026-06-25T10:04:00.000Z',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('startup recovery requeues stale processing asset with available local audio', async () => {
    const db = await createDb();
    const audioPath = path.join(tempRoots.at(-1) || os.tmpdir(), 'recoverable.webm');
    actualFs.writeFileSync(audioPath, Buffer.from('audio'));
    try {
      await insertAsset(db, 'rec_recoverable', 'ws_1', {
        file_path: audioPath,
        transcription_status: 'processing',
      });

      const summary = await db.recoverStartupTranscriptionJobs({
        now: '2026-06-25T10:00:00.000Z',
      });
      const job = await db.getTranscriptionJobByRecordingId('rec_recoverable');
      const asset = await db.getMediaAsset('rec_recoverable');

      expect(summary).toMatchObject({ recovered: 1, failed: 0, skipped: 0, alreadyActive: 0 });
      expect(job).toMatchObject({
        recording_id: 'rec_recoverable',
        status: 'queued',
        locked_by: null,
        locked_until: null,
      });
      expect(asset).toMatchObject({ transcription_status: 'queued' });
    } finally {
      await db.shutdown();
    }
  });

  test('startup recovery marks assets without an audio source as permanent failures', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_missing_audio', 'ws_1', {
        file_path: '',
        transcription_status: 'processing',
      });

      const summary = await db.recoverStartupTranscriptionJobs({
        now: '2026-06-25T10:00:00.000Z',
      });
      const asset = await db.getMediaAsset('rec_missing_audio');
      const diarization = JSON.parse(asset.diarization_json);

      expect(summary).toMatchObject({ recovered: 0, failed: 1, skipped: 0 });
      expect(asset).toMatchObject({ transcription_status: 'failed' });
      expect(diarization).toMatchObject({
        errorCode: 'audio_source_unavailable',
        retryable: false,
      });
    } finally {
      await db.shutdown();
    }
  });

  test('startup recovery is idempotent and does not duplicate active jobs', async () => {
    const db = await createDb();
    const audioPath = path.join(tempRoots.at(-1) || os.tmpdir(), 'idempotent.webm');
    actualFs.writeFileSync(audioPath, Buffer.from('audio'));
    try {
      await insertAsset(db, 'rec_recovery_idempotent', 'ws_1', {
        file_path: audioPath,
        transcription_status: 'processing',
      });

      const first = await db.recoverStartupTranscriptionJobs({
        now: '2026-06-25T10:00:00.000Z',
      });
      const second = await db.recoverStartupTranscriptionJobs({
        now: '2026-06-25T10:00:00.000Z',
      });
      const rows = await db._query('SELECT * FROM transcription_jobs WHERE recording_id = ?', [
        'rec_recovery_idempotent',
      ]);

      expect(first.recovered).toBe(1);
      expect(second).toMatchObject({ recovered: 0, alreadyActive: 1 });
      expect(rows).toHaveLength(1);
    } finally {
      await db.shutdown();
    }
  });

  test('operator listing filters jobs by workspace, status, recording, and age', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_ops_old', 'ws_ops');
      await insertAsset(db, 'rec_ops_other', 'ws_other');
      const oldJob = await db.enqueueTranscriptionJob({
        recordingId: 'rec_ops_old',
        workspaceId: 'ws_ops',
      });
      await db.enqueueTranscriptionJob({
        recordingId: 'rec_ops_other',
        workspaceId: 'ws_other',
      });
      await db._execute(
        `UPDATE transcription_jobs
         SET status = 'failed', updated_at = ?, last_error_code = 'STT_FAILED'
         WHERE id = ?`,
        ['2026-07-03T09:00:00.000Z', oldJob.id]
      );

      const jobs = await db.listTranscriptionJobsForOperations({
        workspaceId: 'ws_ops',
        status: 'failed',
        recordingId: 'rec_ops_old',
        olderThanMinutes: 30,
        now: '2026-07-03T10:00:00.000Z',
      });

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({
        id: oldJob.id,
        workspace_id: 'ws_ops',
        recording_id: 'rec_ops_old',
        status: 'failed',
        last_error_code: 'STT_FAILED',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('operator actions retry, cancel, and mark failed while syncing media status', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_ops_retry', 'ws_ops');
      await insertAsset(db, 'rec_ops_cancel', 'ws_ops');
      await insertAsset(db, 'rec_ops_fail', 'ws_ops');

      const retryJob = await db.enqueueTranscriptionJob({
        recordingId: 'rec_ops_retry',
        workspaceId: 'ws_ops',
      });
      const cancelJob = await db.enqueueTranscriptionJob({
        recordingId: 'rec_ops_cancel',
        workspaceId: 'ws_ops',
      });
      const failJob = await db.enqueueTranscriptionJob({
        recordingId: 'rec_ops_fail',
        workspaceId: 'ws_ops',
      });
      await db._execute(
        "UPDATE transcription_jobs SET status = 'failed', attempt_count = 3, last_error_message = 'old' WHERE id = ?",
        [retryJob.id]
      );

      const retried = await db.retryTranscriptionJobForOperations(retryJob.id, {
        reason: 'operator retry',
      });
      const cancelled = await db.cancelTranscriptionJobForOperations(cancelJob.id, {
        reason: 'operator cancel',
      });
      const failed = await db.markTranscriptionJobFailedForOperations(failJob.id, {
        reason: 'operator failed',
      });

      expect(retried).toMatchObject({
        id: retryJob.id,
        status: 'queued',
        attempt_count: 0,
        last_error_message: '',
      });
      expect(cancelled).toMatchObject({
        id: cancelJob.id,
        status: 'cancelled',
        last_error_code: 'OPERATOR_CANCELLED',
      });
      expect(failed).toMatchObject({
        id: failJob.id,
        status: 'failed',
        last_error_code: 'OPERATOR_MARK_FAILED',
        last_error_message: 'operator failed',
      });
      await expect(db.getMediaAsset('rec_ops_retry')).resolves.toMatchObject({
        transcription_status: 'queued',
      });
      await expect(db.getMediaAsset('rec_ops_cancel')).resolves.toMatchObject({
        transcription_status: 'failed',
      });
      await expect(db.getMediaAsset('rec_ops_fail')).resolves.toMatchObject({
        transcription_status: 'failed',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('cancelled running jobs are not overwritten by a late worker completion', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_ops_running', 'ws_ops');
      const job = await db.enqueueTranscriptionJob({
        recordingId: 'rec_ops_running',
        workspaceId: 'ws_ops',
      });
      await db.acquireTranscriptionJobLease({
        workerId: 'worker-running',
        recordingId: 'rec_ops_running',
      });

      await db.cancelTranscriptionJobForOperations(job.id, { reason: 'operator cancel' });
      await db.saveTranscriptionResult('rec_ops_running', {
        pipelineStatus: 'completed',
        segments: [{ text: 'late result' }],
      });

      const currentJob = await db.getTranscriptionJobById(job.id);
      const asset = await db.getMediaAsset('rec_ops_running');
      expect(currentJob).toMatchObject({ status: 'cancelled' });
      expect(asset).toMatchObject({ transcription_status: 'failed' });
      expect(asset?.transcript_json).toBe('[]');
    } finally {
      await db.shutdown();
    }
  });

  test('exhausted and non-retryable failures move jobs to dead letter', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_dead_exhausted', 'ws_dead');
      await insertAsset(db, 'rec_dead_non_retryable', 'ws_dead');
      const exhausted = await db.enqueueTranscriptionJob({
        recordingId: 'rec_dead_exhausted',
        workspaceId: 'ws_dead',
        maxAttempts: 1,
      });
      const nonRetryable = await db.enqueueTranscriptionJob({
        recordingId: 'rec_dead_non_retryable',
        workspaceId: 'ws_dead',
        maxAttempts: 3,
      });
      await db.acquireTranscriptionJobLease({
        workerId: 'worker-dead',
        recordingId: 'rec_dead_exhausted',
      });
      await db.acquireTranscriptionJobLease({
        workerId: 'worker-dead',
        recordingId: 'rec_dead_non_retryable',
      });

      const exhaustedJob = await db.failTranscriptionJob(
        exhausted.id,
        'worker-dead',
        { code: 'STT_EXHAUSTED', message: 'provider failed repeatedly' },
        { now: '2026-07-04T10:00:00.000Z' }
      );
      const nonRetryableJob = await db.failTranscriptionJob(
        nonRetryable.id,
        'worker-dead',
        { code: 'AUDIO_INVALID', message: 'invalid audio', retryable: false },
        { now: '2026-07-04T10:00:00.000Z' }
      );

      expect(exhaustedJob).toMatchObject({
        status: 'dead_letter',
        last_error_code: 'STT_EXHAUSTED',
        completed_at: '2026-07-04T10:00:00.000Z',
      });
      expect(nonRetryableJob).toMatchObject({
        status: 'dead_letter',
        last_error_code: 'AUDIO_INVALID',
        completed_at: '2026-07-04T10:00:00.000Z',
      });
      await expect(db.getMediaAsset('rec_dead_exhausted')).resolves.toMatchObject({
        transcription_status: 'failed',
      });
    } finally {
      await db.shutdown();
    }
  });

  test('operator can filter dead-letter jobs by error code and replay without corrupting transcript data', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_dead_replay', 'ws_dead');
      await db.saveTranscriptionResult('rec_dead_replay', {
        pipelineStatus: 'failed',
        segments: [{ text: 'existing transcript remains' }],
      });
      const deadJob = await db.enqueueTranscriptionJob({
        recordingId: 'rec_dead_replay',
        workspaceId: 'ws_dead',
        maxAttempts: 1,
      });
      await db._execute(
        `UPDATE transcription_jobs
         SET status = 'dead_letter',
             attempt_count = 1,
             last_error_code = 'STT_VENDOR_DOWN',
             last_error_message = 'vendor unavailable',
             updated_at = '2026-07-04T09:00:00.000Z',
             completed_at = '2026-07-04T09:00:00.000Z'
         WHERE id = ?`,
        [deadJob.id]
      );

      const filtered = await db.listTranscriptionJobsForOperations({
        workspaceId: 'ws_dead',
        status: 'dead_letter',
        errorCode: 'STT_VENDOR_DOWN',
        olderThanMinutes: 30,
        now: '2026-07-04T10:00:00.000Z',
      });
      const replayed = await db.replayDeadLetterTranscriptionJobForOperations(deadJob.id, {
        reason: 'provider recovered',
      });
      const rows = await db._query('SELECT * FROM transcription_jobs WHERE recording_id = ?', [
        'rec_dead_replay',
      ]);
      const asset = await db.getMediaAsset('rec_dead_replay');

      expect(filtered).toHaveLength(1);
      expect(replayed).toMatchObject({
        recording_id: 'rec_dead_replay',
        workspace_id: 'ws_dead',
        status: 'queued',
        attempt_count: 0,
      });
      expect(replayed.id).not.toBe(deadJob.id);
      expect(rows).toHaveLength(2);
      expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: deadJob.id })]));
      expect(asset?.transcript_json).toContain('existing transcript remains');
    } finally {
      await db.shutdown();
    }
  });

  test('dead-letter metrics report count, age, and error buckets', async () => {
    const db = await createDb();
    try {
      await insertAsset(db, 'rec_dead_metrics_a', 'ws_dead');
      await insertAsset(db, 'rec_dead_metrics_b', 'ws_dead');
      const first = await db.enqueueTranscriptionJob({
        recordingId: 'rec_dead_metrics_a',
        workspaceId: 'ws_dead',
      });
      const second = await db.enqueueTranscriptionJob({
        recordingId: 'rec_dead_metrics_b',
        workspaceId: 'ws_dead',
      });
      await db._execute(
        "UPDATE transcription_jobs SET status = 'dead_letter', last_error_code = 'STT_A', updated_at = '2026-07-04T09:00:00.000Z' WHERE id = ?",
        [first.id]
      );
      await db._execute(
        "UPDATE transcription_jobs SET status = 'dead_letter', last_error_code = 'STT_B', updated_at = '2026-07-04T09:30:00.000Z' WHERE id = ?",
        [second.id]
      );

      const metrics = await db.getTranscriptionDeadLetterMetrics({
        now: '2026-07-04T10:00:00.000Z',
      });

      expect(metrics).toEqual({
        count: 2,
        oldestAgeMinutes: 60,
        byErrorCode: { STT_A: 1, STT_B: 1 },
      });
    } finally {
      await db.shutdown();
    }
  });
});
