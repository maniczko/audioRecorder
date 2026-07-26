import { describe, expect, it, vi } from 'vitest';

import {
  buildBackupRestoreVerificationReport,
  runBackupRestoreVerification,
  validateBackupRestoreVerifierEnv,
} from './verify-backup-restore.mjs';

const validEnv = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  RESTORE_VERIFY_WORKSPACE_ID: 'workspace_restore',
  RESTORE_VERIFY_ENVIRONMENT: 'staging',
};

const workspaceWithReferenceEnv = {
  ...validEnv,
  SUPABASE_URL: 'https://staging-project.supabase.co',
  RESTORE_VERIFY_REFERENCE_URL: 'https://reference-project.supabase.co',
};

describe('backup restore verifier', () => {
  it('reports a healthy staging restore with transcript metadata and audio availability', () => {
    const report = buildBackupRestoreVerificationReport({
      workspaceId: 'workspace_restore',
      restoreEnvironment: 'staging',
      storageChecked: true,
      expectedRecordingIds: ['recording_restore_1'],
      backupMetadata: { backupId: 'backup-2026-07-04' },
      workspaceSupabaseUrl: 'https://staging-project.supabase.co',
      storageStatusByPath: {
        'recording_restore_1.webm': { exists: true },
      },
      workspaceRow: {
        workspace_id: 'workspace_restore',
        calendar_meta_json: '{}',
        meetings_json: JSON.stringify([
          {
            id: 'meeting_restore_1',
            latestRecordingId: 'recording_restore_1',
            recordings: [
              {
                id: 'recording_restore_1',
                transcript: [{ text: 'Restored transcript visible in workspace state' }],
              },
            ],
          },
        ]),
      },
      mediaAssets: [
        {
          id: 'recording_restore_1',
          workspace_id: 'workspace_restore',
          meeting_id: 'meeting_restore_1',
          file_path: 'recording_restore_1.webm',
          transcription_status: 'completed',
          transcript_json: JSON.stringify([{ text: 'Restored transcript visible in media asset' }]),
        },
      ],
    });

    expect(report.ok).toBe(true);
    expect(report.summary).toMatchObject({
      mediaAssetCount: 1,
      expectedRecordingCount: 1,
      completedTranscriptCount: 1,
      storageChecked: true,
    });
    expect(report.issues).toEqual([]);
  });

  it('detects restoration configured against the same reference project and blocks', () => {
    const report = buildBackupRestoreVerificationReport({
      workspaceId: 'workspace_restore',
      restoreEnvironment: 'staging',
      storageChecked: true,
      expectedRecordingIds: ['recording_restore_1'],
      workspaceSupabaseUrl: 'https://staging-project.supabase.co',
      backupMetadata: { backupId: 'backup-2026-07-04' },
      restoreReferenceUrl: 'https://staging-project.supabase.co',
      storageStatusByPath: {
        'recording_restore_1.webm': { exists: true },
      },
      workspaceRow: {
        workspace_id: 'workspace_restore',
        calendar_meta_json: '{}',
        meetings_json: JSON.stringify([
          {
            id: 'meeting_restore_1',
            latestRecordingId: 'recording_restore_1',
            recordings: [
              {
                id: 'recording_restore_1',
                transcript: [{ text: 'Restored transcript visible in workspace state' }],
              },
            ],
          },
        ]),
      },
      mediaAssets: [
        {
          id: 'recording_restore_1',
          workspace_id: 'workspace_restore',
          meeting_id: 'meeting_restore_1',
          file_path: 'recording_restore_1.webm',
          transcription_status: 'completed',
          transcript_json: JSON.stringify([{ text: 'Restored transcript visible in media asset' }]),
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'restore_reference_project_matches_workspace_project',
          severity: 'P0',
        }),
      ])
    );
  });

  it('detects missing expected recordings, transcript metadata, and audio objects', () => {
    const report = buildBackupRestoreVerificationReport({
      workspaceId: 'workspace_restore',
      restoreEnvironment: 'staging',
      storageChecked: true,
      expectedRecordingIds: ['recording_restore_1', 'recording_restore_missing'],
      backupMetadata: { restoreId: 'restore-drill-1' },
      storageStatusByPath: {
        'recording_restore_1.webm': { exists: false, error: 'Object not found' },
      },
      workspaceRow: {
        workspace_id: 'workspace_restore',
        calendar_meta_json: '{}',
        meetings_json: JSON.stringify([
          {
            id: 'meeting_restore_1',
            latestRecordingId: 'recording_restore_1',
            recordings: [{ id: 'recording_restore_1', transcript: [] }],
          },
        ]),
      },
      mediaAssets: [
        {
          id: 'recording_restore_1',
          workspace_id: 'workspace_restore',
          meeting_id: 'meeting_restore_1',
          file_path: 'recording_restore_1.webm',
          transcription_status: 'completed',
          transcript_json: '[]',
        },
      ],
    });

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'restore_expected_recording_missing', severity: 'P0' }),
        expect.objectContaining({
          code: 'restore_expected_recording_missing_transcript',
          severity: 'P1',
        }),
        expect.objectContaining({ code: 'restore_audio_object_missing', severity: 'P0' }),
      ])
    );
  });

  it('rejects missing configuration and production targets unless break-glass is explicit', () => {
    expect(() => validateBackupRestoreVerifierEnv({})).toThrow(
      'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
    expect(() =>
      validateBackupRestoreVerifierEnv({
        ...validEnv,
        RESTORE_VERIFY_ENVIRONMENT: 'production',
      })
    ).toThrow('refuses production targets');
    expect(() =>
      validateBackupRestoreVerifierEnv({
        ...validEnv,
        RESTORE_VERIFY_ENVIRONMENT: 'production',
        RESTORE_VERIFY_ALLOW_PRODUCTION: 'true',
      })
    ).not.toThrow();
    expect(() =>
      validateBackupRestoreVerifierEnv({
        ...validEnv,
        RESTORE_VERIFY_REFERENCE_URL: 'not-a-valid-url',
      })
    ).toThrow('RESTORE_VERIFY_REFERENCE_URL');
  });

  it('runs against mocked restored DB and storage inputs without touching production', async () => {
    const fetchInputs = vi.fn().mockResolvedValue({
      storageChecked: true,
      storageStatusByPath: {
        'recording_restore_1.webm': { exists: true },
      },
      workspaceRow: {
        workspace_id: 'workspace_restore',
        calendar_meta_json: '{}',
        meetings_json: JSON.stringify([
          {
            id: 'meeting_restore_1',
            latestRecordingId: 'recording_restore_1',
            recordings: [{ id: 'recording_restore_1', transcript: [{ text: 'ok' }] }],
          },
        ]),
      },
      mediaAssets: [
        {
          id: 'recording_restore_1',
          workspace_id: 'workspace_restore',
          meeting_id: 'meeting_restore_1',
          file_path: 'recording_restore_1.webm',
          transcription_status: 'completed',
          transcript_json: JSON.stringify([{ text: 'ok' }]),
        },
      ],
    });

    const report = await runBackupRestoreVerification({
      env: validEnv,
      workspaceId: 'workspace_restore',
      expectedRecordingIds: ['recording_restore_1'],
      backupMetadata: { backupId: 'backup-2026-07-04' },
      fetchInputs,
      writeReportFile: false,
    });

    expect(report.ok).toBe(true);
    expect(fetchInputs).toHaveBeenCalledWith({
      workspaceId: 'workspace_restore',
      bucket: 'recordings',
      checkStorage: true,
    });
  });

  it('runs with explicit reference URL override in env', async () => {
    const fetchInputs = vi.fn().mockResolvedValue({
      storageChecked: true,
      storageStatusByPath: {
        'recording_restore_1.webm': { exists: true },
      },
      workspaceRow: {
        workspace_id: 'workspace_restore',
        calendar_meta_json: '{}',
        meetings_json: JSON.stringify([
          {
            id: 'meeting_restore_1',
            latestRecordingId: 'recording_restore_1',
            recordings: [{ id: 'recording_restore_1', transcript: [{ text: 'ok' }] }],
          },
        ]),
      },
      mediaAssets: [
        {
          id: 'recording_restore_1',
          workspace_id: 'workspace_restore',
          meeting_id: 'meeting_restore_1',
          file_path: 'recording_restore_1.webm',
          transcription_status: 'completed',
          transcript_json: JSON.stringify([{ text: 'ok' }]),
        },
      ],
    });

    const report = await runBackupRestoreVerification({
      env: workspaceWithReferenceEnv,
      workspaceId: 'workspace_restore',
      expectedRecordingIds: ['recording_restore_1'],
      backupMetadata: { backupId: 'backup-2026-07-04' },
      fetchInputs,
      writeReportFile: false,
      restoreReferenceUrl: 'https://reference-project.supabase.co',
    });

    expect(report.ok).toBe(true);
    expect(report.referenceInputProject).toBe('reference-project');
    expect(report.referenceProject).toBe('staging-project');
  });
});
