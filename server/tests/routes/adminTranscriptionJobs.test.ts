import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.ts';

function buildApp(dbOverrides: Record<string, unknown> = {}) {
  const db = {
    listTranscriptionJobsForOperations: vi.fn().mockResolvedValue([]),
    getTranscriptionJobById: vi.fn(),
    getTranscriptionDeadLetterMetrics: vi.fn().mockResolvedValue({
      count: 0,
      oldestAgeMinutes: 0,
      byErrorCode: {},
    }),
    retryTranscriptionJobForOperations: vi.fn(),
    replayDeadLetterTranscriptionJobForOperations: vi.fn(),
    cancelTranscriptionJobForOperations: vi.fn(),
    markTranscriptionJobFailedForOperations: vi.fn(),
    writeAuditLogBestEffort: vi.fn().mockResolvedValue(undefined),
    checkHealth: vi.fn().mockResolvedValue({ ok: true }),
    ...dbOverrides,
  };
  const app = createApp({
    authService: { getSession: vi.fn() },
    workspaceService: { getMembership: vi.fn() },
    transcriptionService: {},
    db,
    config: {
      allowedOrigins: '*',
      trustProxy: false,
      uploadDir: '/tmp',
      adminToken: 'ops-secret',
    },
  });
  return { app, db };
}

const authHeaders = {
  Authorization: 'Bearer ops-secret',
  'Content-Type': 'application/json',
};

describe('Admin transcription job operations', () => {
  it('blocks job operations without the admin token', async () => {
    const { app, db } = buildApp();

    const res = await app.request('/api/admin/transcription-jobs?workspaceId=ws1');

    expect(res.status).toBe(401);
    expect(db.listTranscriptionJobsForOperations).not.toHaveBeenCalled();
  });

  it('lists filtered jobs without exposing transcript or audio content', async () => {
    const { app, db } = buildApp({
      listTranscriptionJobsForOperations: vi.fn().mockResolvedValue([
        {
          id: 'tj_1',
          recording_id: 'rec_1',
          workspace_id: 'ws1',
          meeting_id: 'meeting_1',
          status: 'failed',
          attempt_count: 2,
          max_attempts: 3,
          locked_by: '',
          locked_until: '',
          next_run_at: '2026-07-03T10:00:00.000Z',
          last_error_code: 'STT_FAILED',
          last_error_message: 'provider failed',
          created_at: '2026-07-03T09:00:00.000Z',
          updated_at: '2026-07-03T09:10:00.000Z',
          completed_at: '',
          transcript_json: '[{"text":"secret"}]',
          file_path: '/tmp/private.webm',
        },
      ]),
    });

    const res = await app.request(
      '/api/admin/transcription-jobs?workspaceId=ws1&status=failed&recordingId=rec_1&olderThanMinutes=30&limit=10',
      { headers: authHeaders }
    );

    expect(res.status).toBe(200);
    expect(db.listTranscriptionJobsForOperations).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      status: 'failed',
      recordingId: 'rec_1',
      errorCode: '',
      olderThanMinutes: 30,
      limit: 10,
    });
    const body = await res.json();
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0]).toMatchObject({
      id: 'tj_1',
      recordingId: 'rec_1',
      workspaceId: 'ws1',
      status: 'failed',
      diagnostics: {
        lastErrorCode: 'STT_FAILED',
        lastErrorMessage: 'provider failed',
      },
    });
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('/tmp/private.webm');
  });

  it('filters dead-letter jobs by error code', async () => {
    const { app, db } = buildApp();

    const res = await app.request(
      '/api/admin/transcription-jobs?workspaceId=ws1&status=dead_letter&errorCode=STT_VENDOR_DOWN',
      { headers: authHeaders }
    );

    expect(res.status).toBe(200);
    expect(db.listTranscriptionJobsForOperations).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      status: 'dead_letter',
      recordingId: '',
      errorCode: 'STT_VENDOR_DOWN',
      olderThanMinutes: undefined,
      limit: 50,
    });
  });

  it('returns job diagnostics by id without raw transcript data', async () => {
    const { app, db } = buildApp({
      getTranscriptionJobById: vi.fn().mockResolvedValue({
        id: 'tj_diag',
        recording_id: 'rec_diag',
        workspace_id: 'ws1',
        meeting_id: 'meeting_diag',
        status: 'running',
        attempt_count: 1,
        max_attempts: 3,
        locked_by: 'worker-1',
        locked_until: '2026-07-03T10:05:00.000Z',
        next_run_at: '2026-07-03T10:00:00.000Z',
        last_error_code: '',
        last_error_message: '',
        created_at: '2026-07-03T09:00:00.000Z',
        updated_at: '2026-07-03T10:00:00.000Z',
        transcript_json: '[{"text":"secret"}]',
      }),
    });

    const res = await app.request('/api/admin/transcription-jobs/tj_diag', {
      headers: authHeaders,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job).toMatchObject({
      id: 'tj_diag',
      recordingId: 'rec_diag',
      status: 'running',
      diagnostics: {
        lockedBy: 'worker-1',
      },
    });
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it.each([
    ['retry', 'retryTranscriptionJobForOperations', 'operator.transcription_job.retry'],
    [
      'replay',
      'replayDeadLetterTranscriptionJobForOperations',
      'operator.transcription_job.replay',
    ],
    ['cancel', 'cancelTranscriptionJobForOperations', 'operator.transcription_job.cancel'],
    [
      'mark-failed',
      'markTranscriptionJobFailedForOperations',
      'operator.transcription_job.mark_failed',
    ],
  ])('runs the %s action and writes an audit event', async (action, methodName, auditAction) => {
    const updatedJob = {
      id: 'tj_action',
      recording_id: 'rec_action',
      workspace_id: 'ws1',
      meeting_id: 'meeting_action',
      status:
        action === 'retry' || action === 'replay'
          ? 'queued'
          : action === 'cancel'
            ? 'cancelled'
            : 'failed',
      attempt_count: 0,
      max_attempts: 3,
      locked_by: '',
      locked_until: '',
      next_run_at: '2026-07-03T10:00:00.000Z',
      last_error_code: '',
      last_error_message: '',
      created_at: '2026-07-03T09:00:00.000Z',
      updated_at: '2026-07-03T10:00:00.000Z',
    };
    const { app, db } = buildApp({
      [methodName]: vi.fn().mockResolvedValue(updatedJob),
    });

    const res = await app.request(`/api/admin/transcription-jobs/tj_action/${action}`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ reason: 'manual operator action' }),
    });

    expect(res.status).toBe(200);
    expect(db[methodName as keyof typeof db]).toHaveBeenCalledWith('tj_action', {
      reason: 'manual operator action',
    });
    expect(db.writeAuditLogBestEffort).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        actorUserId: 'ops-token',
        action: auditAction,
        entityType: 'transcription_job',
        entityId: 'tj_action',
        metadata: expect.objectContaining({
          recordingId: 'rec_action',
          reason: 'manual operator action',
          status: updatedJob.status,
          requestId: expect.any(String),
          source: 'api',
        }),
      })
    );
  });

  it('adds dead-letter metrics to admin JSON metrics', async () => {
    const { app, db } = buildApp({
      getTranscriptionDeadLetterMetrics: vi.fn().mockResolvedValue({
        count: 2,
        oldestAgeMinutes: 45,
        byErrorCode: { STT_VENDOR_DOWN: 2 },
      }),
    });

    const res = await app.request('/api/admin/metrics', { headers: authHeaders });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transcriptionJobs.deadLetter).toEqual({
      count: 2,
      oldestAgeMinutes: 45,
      byErrorCode: { STT_VENDOR_DOWN: 2 },
    });
    expect(db.getTranscriptionDeadLetterMetrics).toHaveBeenCalled();
  });
});
