import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { initDatabase } from '../../database.ts';

describe('durable transcription jobs', () => {
  let db: any;
  let uploadDir: string;

  beforeEach(async () => {
    const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    uploadDir = realFs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-transcription-jobs-'));
    db = initDatabase({ dbPath: ':memory:', uploadDir });
    await db.init();
  }, 60000);

  afterEach(async () => {
    if (db) {
      await db.shutdown();
      db = null;
    }
    if (uploadDir && fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
  });

  async function createMediaAsset(recordingId = 'rec_job') {
    return db.upsertMediaAsset({
      recordingId,
      workspaceId: 'ws_jobs',
      meetingId: 'meet_jobs',
      contentType: 'audio/webm',
      buffer: Buffer.from('audio'),
      createdByUserId: 'user_jobs',
    });
  }

  test('migration creates transcription_jobs table with lease fields', async () => {
    const columns = await db._query('PRAGMA table_info(transcription_jobs)');
    const names = columns.map((column: any) => column.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'recording_id',
        'workspace_id',
        'meeting_id',
        'status',
        'attempt_count',
        'max_attempts',
        'locked_by',
        'locked_until',
        'next_run_at',
        'last_error_code',
        'last_error_message',
        'completed_at',
      ])
    );
  });

  test('enqueue is idempotent for the same active recording', async () => {
    await createMediaAsset('rec_idempotent');

    const first = await db.enqueueTranscriptionJob('rec_idempotent', { workspaceId: 'ws_jobs' });
    const second = await db.enqueueTranscriptionJob('rec_idempotent', { workspaceId: 'ws_jobs' });
    const rows = await db._query('SELECT * FROM transcription_jobs WHERE recording_id = ?', [
      'rec_idempotent',
    ]);
    const asset = await db.getMediaAsset('rec_idempotent');

    expect(second.id).toBe(first.id);
    expect(rows).toHaveLength(1);
    expect(asset.transcription_status).toBe('queued');
  });

  test('parallel enqueue requests resolve to one active job', async () => {
    await createMediaAsset('rec_parallel');

    const jobs = await Promise.all([
      db.enqueueTranscriptionJob('rec_parallel', { workspaceId: 'ws_jobs' }),
      db.enqueueTranscriptionJob('rec_parallel', { workspaceId: 'ws_jobs' }),
    ]);
    const rows = await db._query('SELECT * FROM transcription_jobs WHERE recording_id = ?', [
      'rec_parallel',
    ]);

    expect(new Set(jobs.map((job: any) => job.id)).size).toBe(1);
    expect(rows).toHaveLength(1);
  });

  test('only one worker can acquire a transcription job lease', async () => {
    await createMediaAsset('rec_lease');
    await db.enqueueTranscriptionJob('rec_lease', { workspaceId: 'ws_jobs' });

    const firstLease = await db.acquireTranscriptionJobLease('worker-a', {
      recordingId: 'rec_lease',
      leaseMs: 60_000,
    });
    const secondLease = await db.acquireTranscriptionJobLease('worker-b', {
      recordingId: 'rec_lease',
      leaseMs: 60_000,
    });
    const asset = await db.getMediaAsset('rec_lease');

    expect(firstLease).toMatchObject({
      recording_id: 'rec_lease',
      status: 'running',
      locked_by: 'worker-a',
      attempt_count: 1,
    });
    expect(secondLease).toBeNull();
    expect(asset.transcription_status).toBe('processing');
  });

  test('queued transcription jobs survive database restart and can be recovered', async () => {
    const dbPath = path.join(uploadDir, 'durable.sqlite');
    await db.shutdown();

    const firstDb = initDatabase({ dbPath, uploadDir });
    await firstDb.init();
    db = firstDb;
    await createMediaAsset('rec_restart');
    const queued = await db.enqueueTranscriptionJob('rec_restart', { workspaceId: 'ws_jobs' });
    await db.shutdown();

    const restartedDb = initDatabase({ dbPath, uploadDir });
    await restartedDb.init();
    db = restartedDb;
    const recovered = await db.getTranscriptionJob('rec_restart');
    const lease = await db.acquireTranscriptionJobLease('worker-restarted', {
      recordingId: 'rec_restart',
    });

    expect(recovered.id).toBe(queued.id);
    expect(recovered.status).toBe('queued');
    expect(lease).toMatchObject({
      id: queued.id,
      status: 'running',
      locked_by: 'worker-restarted',
    });
  }, 60000);

  test('expired running leases return to retryable queued state', async () => {
    await createMediaAsset('rec_expired');
    await db.enqueueTranscriptionJob('rec_expired', { workspaceId: 'ws_jobs' });
    const lease = await db.acquireTranscriptionJobLease('worker-expired', {
      recordingId: 'rec_expired',
      leaseMs: 1_000,
    });

    const future = new Date(Date.now() + 5_000).toISOString();
    const recoveredCount = await db.recoverExpiredTranscriptionJobLeases(future);
    const recovered = await db.getTranscriptionJob('rec_expired');
    const asset = await db.getMediaAsset('rec_expired');

    expect(lease.status).toBe('running');
    expect(recoveredCount).toBe(1);
    expect(recovered).toMatchObject({
      status: 'retryable_failed',
      locked_by: '',
      last_error_code: 'lease_expired',
    });
    expect(asset.transcription_status).toBe('queued');
  });

  test('acquire recovers and leases an expired running job', async () => {
    await createMediaAsset('rec_reacquire');
    await db.enqueueTranscriptionJob('rec_reacquire', { workspaceId: 'ws_jobs' });
    const firstLease = await db.acquireTranscriptionJobLease('worker-old', {
      recordingId: 'rec_reacquire',
      leaseMs: 1_000,
    });

    await db._execute(
      'UPDATE transcription_jobs SET locked_until = ?, updated_at = ? WHERE id = ?',
      [
        new Date(Date.now() - 5_000).toISOString(),
        new Date(Date.now() - 5_000).toISOString(),
        firstLease.id,
      ]
    );
    const nextLease = await db.acquireTranscriptionJobLease('worker-new', {
      recordingId: 'rec_reacquire',
      leaseMs: 60_000,
    });

    expect(nextLease).toMatchObject({
      id: firstLease.id,
      status: 'running',
      locked_by: 'worker-new',
      attempt_count: 2,
      last_error_code: 'lease_expired',
    });
  });
});
