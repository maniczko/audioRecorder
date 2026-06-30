import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'node:path';
import * as os from 'node:os';
import { initDatabase, getDatabase } from '../database.ts';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Database (Async Worker SQLite)', () => {
  let db: any;
  let realFs: typeof import('node:fs');
  let testUploadDir: string;

  beforeAll(async () => {
    realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    testUploadDir = realFs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-db-test-'));
    db = initDatabase({ dbPath: ':memory:', uploadDir: testUploadDir });
    await db.init();
  }, 60000);

  afterAll(async () => {
    if (db) {
      await db.shutdown();
    }
    if (realFs.existsSync(testUploadDir)) {
      try {
        realFs.rmSync(testUploadDir, { recursive: true, force: true });
      } catch (err) {
        // Ignore locked file EPERM on Windows test runner
      }
    }
  });

  test('should get the initialized database singleton', () => {
    const singleton = getDatabase();
    expect(singleton).toBeDefined();
    expect(singleton.uploadDir).toBe(testUploadDir);
  });

  test('should successfully query users via worker thread', async () => {
    // Tests the worker based async `_query` and `_get` internally
    const result = await db._get('SELECT * FROM users WHERE email = ?', [
      'nonexistent_user_for_db_layer@example.com',
    ]);
    expect(result).toBeNull();
  });

  test("should persist data across simulated 'deploys' (process restarts)", async () => {
    const dbPath = path.join(testUploadDir, 'data.sqlite');

    // 1. Zapisujemy dane na dysk
    const oldDb = initDatabase({ dbPath, uploadDir: testUploadDir });
    await oldDb.init();
    await oldDb._query('CREATE TABLE IF NOT EXISTS test_deploy (id INTEGER PRIMARY KEY, msg TEXT)');
    await oldDb._query('INSERT INTO test_deploy (msg) VALUES (?)', ['Persisted Data!']);

    // 2. Symulujemy DEPLOY (zamknięcie i ubicie bazy)
    await oldDb.shutdown();

    // 3. Wstajemy po deployu podpinając się pod ten sam dysk
    const newDb = initDatabase({ dbPath, uploadDir: testUploadDir });
    await newDb.init();

    // 4. Sprawdzamy czy dane z poprzedniego życia przetrwały
    const result = await newDb._get('SELECT * FROM test_deploy LIMIT 1');
    expect(result.msg).toBe('Persisted Data!');

    await newDb.shutdown();
  });

  test('should persist pipeline metadata on successful transcription results', async () => {
    const previousSha = process.env.GITHUB_SHA;
    const previousVersion = process.env.APP_VERSION;
    const previousBuildTime = process.env.BUILD_TIME;
    process.env.GITHUB_SHA = 'dbsave123';
    process.env.APP_VERSION = '3.1.4';
    process.env.BUILD_TIME = '2026-03-21T20:40:00.000Z';

    try {
      await db.upsertMediaAsset({
        recordingId: 'rec_meta_success',
        workspaceId: 'ws_meta',
        meetingId: 'm_meta',
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user_meta',
      });

      await db.saveTranscriptionResult('rec_meta_success', {
        pipelineStatus: 'completed',
        transcriptOutcome: 'empty',
        emptyReason: 'no_segments_from_stt',
        userMessage: 'Nie wykryto wypowiedzi w nagraniu.',
        transcriptionDiagnostics: {
          voiceProfileLabeling: {
            applied: false,
            reason: 'no_speakers',
            mode: 'full',
            profileCount: 2,
            attemptedSpeakerCount: 0,
            matchedSpeakerCount: 0,
          },
        },
        qualityMetrics: {
          sttProviderId: 'groq',
          sttProviderLabel: 'Groq Whisper',
          sttModel: 'whisper-large-v3',
          werProxy: 0.18,
          diarizationConfidence: 0.82,
        },
        segments: [],
        diarization: { speakerNames: {}, speakerCount: 0, confidence: 0 },
        reviewSummary: { needsReview: 0, approved: 0 },
      });

      const saved = await db.getMediaAsset('rec_meta_success');
      const diarization = JSON.parse(saved.diarization_json);
      expect(diarization.pipelineGitSha).toBe('dbsave123');
      expect(diarization.pipelineVersion).toBe('3.1.4');
      expect(diarization.pipelineBuildTime).toBe('2026-03-21T20:40:00.000Z');
      expect(diarization.transcriptOutcome).toBe('empty');
      expect(diarization.transcriptionDiagnostics.voiceProfileLabeling).toMatchObject({
        applied: false,
        reason: 'no_speakers',
        mode: 'full',
        profileCount: 2,
      });
      expect(diarization.qualityMetrics).toMatchObject({
        sttProviderId: 'groq',
        werProxy: 0.18,
        diarizationConfidence: 0.82,
      });
    } finally {
      if (previousSha === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = previousSha;
      if (previousVersion === undefined) delete process.env.APP_VERSION;
      else process.env.APP_VERSION = previousVersion;
      if (previousBuildTime === undefined) delete process.env.BUILD_TIME;
      else process.env.BUILD_TIME = previousBuildTime;
    }
  });

  test('Regression: #0 - deleteMediaAsset removes storage, RAG rows and writes a sanitized audit log', async () => {
    const storageModule = await import('../lib/supabaseStorage.ts');
    const deleteAudioFromStorageSpy = vi
      .spyOn(storageModule, 'deleteAudioFromStorage')
      .mockResolvedValue(undefined);
    const previousFsState = { ...(global as any).__TEST_FS_STATE__ };
    (global as any).__TEST_FS_STATE__ = {
      existsSync: false,
      statSyncSize: previousFsState.statSyncSize ?? 1234,
    };

    try {
      const now = new Date().toISOString();
      await db._execute(
        `INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, storage_mode, media_manifest_json, source_size_bytes,
          normalized_size_bytes, transcription_status, transcript_json, diarization_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'rec_delete_full',
          'ws_delete_full',
          'meeting_delete_full',
          'user_delete_full',
          'workspaces/ws_delete_full/recordings/rec_delete_full/audio.webm',
          'audio/webm',
          123,
          'single',
          '{}',
          123,
          123,
          'completed',
          JSON.stringify([{ text: 'secret transcript that must not be audited' }]),
          '{}',
          now,
          now,
        ]
      );
      await db._execute(
        `INSERT INTO rag_chunks (
          id, workspace_id, recording_id, speaker_name, text, embedding_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          'rag_delete_full',
          'ws_delete_full',
          'rec_delete_full',
          'Iwo',
          'secret transcript that must not remain indexed',
          '[0.1,0.2]',
          now,
        ]
      );

      await db.deleteMediaAsset('rec_delete_full', 'ws_delete_full');

      await expect(db.getMediaAsset('rec_delete_full')).resolves.toBeNull();
      await expect(
        db._get('SELECT COUNT(*) AS count FROM rag_chunks WHERE recording_id = ?', [
          'rec_delete_full',
        ])
      ).resolves.toMatchObject({ count: 0 });
      expect(deleteAudioFromStorageSpy).toHaveBeenCalledWith(
        'workspaces/ws_delete_full/recordings/rec_delete_full/audio.webm'
      );

      const auditRow = await db._get(
        'SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ?',
        ['recording', 'rec_delete_full']
      );
      expect(auditRow).toMatchObject({
        workspace_id: 'ws_delete_full',
        action: 'recording.deleted',
        entity_type: 'recording',
        entity_id: 'rec_delete_full',
      });
      expect(String(auditRow.metadata_json || '')).toContain('"ragChunksDeleted":1');
      expect(String(auditRow.metadata_json || '')).not.toContain('secret transcript');
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
      deleteAudioFromStorageSpy.mockRestore();
    }
  });

  test('Regression: #0 - deleteMediaAsset records the actual deleter in the audit log', async () => {
    const storageModule = await import('../lib/supabaseStorage.ts');
    const deleteAudioFromStorageSpy = vi
      .spyOn(storageModule, 'deleteAudioFromStorage')
      .mockResolvedValue(undefined);
    const previousFsState = { ...(global as any).__TEST_FS_STATE__ };
    (global as any).__TEST_FS_STATE__ = {
      existsSync: false,
      statSyncSize: previousFsState.statSyncSize ?? 1234,
    };

    try {
      const now = new Date().toISOString();
      await db._execute(
        `INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, storage_mode, media_manifest_json, source_size_bytes,
          normalized_size_bytes, transcription_status, transcript_json, diarization_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'rec_delete_actor',
          'ws_delete_actor',
          'meeting_delete_actor',
          'recording_creator',
          'workspaces/ws_delete_actor/recordings/rec_delete_actor/audio.webm',
          'audio/webm',
          123,
          'single',
          '{}',
          123,
          123,
          'completed',
          '[]',
          '{}',
          now,
          now,
        ]
      );

      await db.deleteMediaAsset('rec_delete_actor', 'ws_delete_actor', {
        actorUserId: 'actual_deleter',
      });

      const auditRow = await db._get(
        'SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ?',
        ['recording', 'rec_delete_actor']
      );
      expect(auditRow).toMatchObject({
        workspace_id: 'ws_delete_actor',
        actor_user_id: 'actual_deleter',
        action: 'recording.deleted',
      });
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
      deleteAudioFromStorageSpy.mockRestore();
    }
  });

  test('Regression: #0 - cleanupExpiredRecordingsByRetention deletes only expired workspace recordings', async () => {
    const storageModule = await import('../lib/supabaseStorage.ts');
    const deleteAudioFromStorageSpy = vi
      .spyOn(storageModule, 'deleteAudioFromStorage')
      .mockResolvedValue(undefined);
    const previousFsState = { ...(global as any).__TEST_FS_STATE__ };
    (global as any).__TEST_FS_STATE__ = {
      existsSync: false,
      statSyncSize: previousFsState.statSyncSize ?? 1234,
    };

    try {
      await db.ensureWorkspaceState('ws_retention');
      await db.saveWorkspaceState('ws_retention', {
        meetings: [],
        manualTasks: [],
        manualPeople: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
        retentionDays: 1,
      });

      const oldCreatedAt = '2026-06-18T09:00:00.000Z';
      const freshCreatedAt = '2026-06-20T09:00:00.000Z';
      for (const [recordingId, createdAt] of [
        ['rec_retention_old', oldCreatedAt],
        ['rec_retention_fresh', freshCreatedAt],
      ] as const) {
        await db._execute(
          `INSERT INTO media_assets (
            id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
            size_bytes, storage_mode, media_manifest_json, source_size_bytes,
            normalized_size_bytes, transcription_status, transcript_json, diarization_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recordingId,
            'ws_retention',
            '',
            'user_retention',
            `workspaces/ws_retention/recordings/${recordingId}/audio.webm`,
            'audio/webm',
            10,
            'single',
            '{}',
            10,
            10,
            'completed',
            '[]',
            '{}',
            createdAt,
            createdAt,
          ]
        );
      }

      const result = await db.cleanupExpiredRecordingsByRetention({
        nowIso: '2026-06-20T12:00:00.000Z',
      });

      expect(result).toMatchObject({ checked: 2, deleted: 1 });
      await expect(db.getMediaAsset('rec_retention_old')).resolves.toBeNull();
      await expect(db.getMediaAsset('rec_retention_fresh')).resolves.toMatchObject({
        id: 'rec_retention_fresh',
      });
      expect(deleteAudioFromStorageSpy).toHaveBeenCalledWith(
        'workspaces/ws_retention/recordings/rec_retention_old/audio.webm'
      );
      expect(deleteAudioFromStorageSpy).not.toHaveBeenCalledWith(
        'workspaces/ws_retention/recordings/rec_retention_fresh/audio.webm'
      );
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
      deleteAudioFromStorageSpy.mockRestore();
    }
  });

  test('Regression: #1229 - retention cleanup is repeatable and logs source metadata', async () => {
    const storageModule = await import('../lib/supabaseStorage.ts');
    const deleteAudioFromStorageSpy = vi
      .spyOn(storageModule, 'deleteAudioFromStorage')
      .mockResolvedValue(undefined);
    const previousFsState = { ...(global as any).__TEST_FS_STATE__ };
    (global as any).__TEST_FS_STATE__ = {
      existsSync: false,
      statSyncSize: previousFsState.statSyncSize ?? 1234,
    };

    try {
      await db.ensureWorkspaceState('ws_retention_repeat');
      await db.saveWorkspaceState('ws_retention_repeat', {
        meetings: [],
        manualTasks: [],
        manualPeople: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
        retentionDays: 1,
      });
      await db._execute(
        `INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, storage_mode, media_manifest_json, source_size_bytes,
          normalized_size_bytes, transcription_status, transcript_json, diarization_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'rec_retention_repeat_old',
          'ws_retention_repeat',
          'meeting_repeat',
          'user_repeat',
          'workspaces/ws_retention_repeat/recordings/rec_retention_repeat_old/audio.webm',
          'audio/webm',
          10,
          'single',
          '{}',
          10,
          10,
          'completed',
          '[]',
          '{}',
          '2026-06-18T09:00:00.000Z',
          '2026-06-18T09:00:00.000Z',
        ]
      );

      const first = await db.cleanupExpiredRecordingsByRetention({
        workspaceId: 'ws_retention_repeat',
        nowIso: '2026-06-20T12:00:00.000Z',
        actorUserId: 'maintainer_1',
        source: 'test-maintenance',
      });
      const second = await db.cleanupExpiredRecordingsByRetention({
        workspaceId: 'ws_retention_repeat',
        nowIso: '2026-06-20T12:00:00.000Z',
        actorUserId: 'maintainer_1',
        source: 'test-maintenance',
      });

      expect(first).toMatchObject({
        checked: 1,
        deleted: 1,
        deletedRecordingIds: ['rec_retention_repeat_old'],
      });
      expect(second).toMatchObject({ checked: 0, deleted: 0, deletedRecordingIds: [] });
      const auditRows = await db._query(
        'SELECT * FROM audit_logs WHERE workspace_id = ? ORDER BY created_at ASC',
        ['ws_retention_repeat']
      );
      expect(auditRows.map((row: any) => row.action)).toEqual(
        expect.arrayContaining(['recording.deleted', 'retention.cleanup.completed'])
      );
      const deleteAudit = auditRows.find((row: any) => row.action === 'recording.deleted');
      expect(JSON.parse(deleteAudit.metadata_json)).toMatchObject({
        source: 'test-maintenance',
      });
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
      deleteAudioFromStorageSpy.mockRestore();
    }
  });

  test('Regression: #1229 - workspace export includes state, transcripts, AI metadata and audit logs', async () => {
    await db._execute(
      `INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'ws_export',
        'Export Workspace',
        'user_export',
        'EXPORT42',
        '2026-06-20T08:00:00.000Z',
        '2026-06-20T08:00:00.000Z',
      ]
    );
    await db.ensureWorkspaceState('ws_export');
    await db.saveWorkspaceState('ws_export', {
      meetings: [{ id: 'meeting_export', title: 'Exported meeting', recordings: [] }],
      manualTasks: [{ id: 'task_export', title: 'Follow up' }],
      manualPeople: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: ['retencja'],
      retentionDays: 30,
    });
    await db._execute(
      `INSERT INTO media_assets (
        id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
        size_bytes, storage_mode, media_manifest_json, source_size_bytes,
        normalized_size_bytes, transcription_status, transcript_json, diarization_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'rec_export',
        'ws_export',
        'meeting_export',
        'user_export',
        'workspaces/ws_export/recordings/rec_export/audio.webm',
        'audio/webm',
        10,
        'single',
        '{}',
        10,
        10,
        'completed',
        JSON.stringify([{ text: 'Transcript line', speakerId: 's1', timestamp: 0 }]),
        JSON.stringify({
          speakerNames: { s1: 'Anna' },
          analysis: { summary: 'AI summary' },
          recordingConsent: { policyVersion: 'recording-consent-v1' },
        }),
        '2026-06-20T09:00:00.000Z',
        '2026-06-20T09:00:00.000Z',
      ]
    );
    await db.writeAuditLog({
      workspaceId: 'ws_export',
      actorUserId: 'user_export',
      action: 'recording.created',
      entityType: 'recording',
      entityId: 'rec_export',
      metadata: { source: 'test' },
    });

    const payload = await db.exportWorkspaceData('ws_export', {
      actorUserId: 'user_export',
      source: 'test-export',
    });

    expect(payload).toMatchObject({
      schemaVersion: 'workspace-export-v1',
      workspace: {
        id: 'ws_export',
        name: 'Export Workspace',
        retentionDays: 30,
      },
    });
    expect(payload.state.meetings[0]).toMatchObject({ id: 'meeting_export' });
    expect(payload.mediaAssets[0]).toMatchObject({
      id: 'rec_export',
      meetingId: 'meeting_export',
      transcript: [{ text: 'Transcript line', speakerId: 's1', timestamp: 0 }],
      diarization: expect.objectContaining({
        speakerNames: { s1: 'Anna' },
        recordingConsent: { policyVersion: 'recording-consent-v1' },
      }),
    });
    expect(payload.operational.auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'recording.created', entityId: 'rec_export' }),
      ])
    );
    const exportAudit = await db._get(
      'SELECT * FROM audit_logs WHERE workspace_id = ? AND action = ?',
      ['ws_export', 'workspace.export.generated']
    );
    expect(JSON.parse(exportAudit.metadata_json)).toMatchObject({
      source: 'test-export',
      mediaAssetCount: 1,
    });
  });

  test('should persist pipeline metadata on failures and clear old errors when re-queueing', async () => {
    const previousSha = process.env.GITHUB_SHA;
    const previousVersion = process.env.APP_VERSION;
    const previousBuildTime = process.env.BUILD_TIME;
    process.env.GITHUB_SHA = 'dbfail123';
    process.env.APP_VERSION = '3.1.5';
    process.env.BUILD_TIME = '2026-03-21T20:45:00.000Z';

    try {
      await db.upsertMediaAsset({
        recordingId: 'rec_meta_failed',
        workspaceId: 'ws_meta',
        meetingId: 'm_meta',
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user_meta',
      });

      await db.markTranscriptionFailure('rec_meta_failed', 'old failure', {
        usedChunking: true,
        chunksAttempted: 3,
        chunksSentToStt: 3,
        chunksFailedAtStt: 3,
        lastChunkErrorMessage: 'provider timeout',
      });
      let failed = await db.getMediaAsset('rec_meta_failed');
      let diarization = JSON.parse(failed.diarization_json);
      expect(failed.transcription_status).toBe('failed');
      expect(diarization.errorMessage).toBe('old failure');
      expect(diarization.pipelineGitSha).toBe('dbfail123');
      expect(diarization.transcriptionDiagnostics).toMatchObject({
        chunksFailedAtStt: 3,
        lastChunkErrorMessage: 'provider timeout',
      });
      expect(diarization.qualityMetrics).toMatchObject({
        failureCount: 1,
      });

      await db.queueTranscription('rec_meta_failed', {
        workspaceId: 'ws_meta',
        meetingId: 'm_meta',
        contentType: 'audio/webm',
      });

      const queued = await db.getMediaAsset('rec_meta_failed');
      diarization = JSON.parse(queued.diarization_json);
      expect(queued.transcription_status).toBe('queued');
      expect(diarization).toMatchObject({
        qualityMetrics: {
          failureCount: 1,
        },
      });
      expect(JSON.parse(queued.transcript_json)).toEqual([]);
    } finally {
      if (previousSha === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = previousSha;
      if (previousVersion === undefined) delete process.env.APP_VERSION;
      else process.env.APP_VERSION = previousVersion;
      if (previousBuildTime === undefined) delete process.env.BUILD_TIME;
      else process.env.BUILD_TIME = previousBuildTime;
    }
  });
});
