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

  test('Regression: Issue #1403 - ignores orphan workspace memberships during bootstrap', async () => {
    const timestamp = new Date().toISOString();
    const userId = `user_orphan_${Date.now()}`;
    const validWorkspaceId = `workspace_valid_${Date.now()}`;
    const orphanWorkspaceId = `workspace_orphan_${Date.now()}`;

    await db._execute(
      `INSERT INTO users (
        id, email, password_hash, name, provider, google_sub, google_email,
        recovery_code_hash, recovery_code_expires_at, profile_json, created_at, updated_at
      ) VALUES (?, ?, '', 'Orphan Test', 'local', '', ?, '', '', '{}', ?, ?)`,
      [`${userId}`, `${userId}@example.test`, `${userId}@example.test`, timestamp, timestamp]
    );
    await db._execute(
      `INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at)
       VALUES (?, 'Valid Workspace', ?, ?, ?, ?)`,
      [validWorkspaceId, userId, `INV${String(Date.now()).slice(-8)}`, timestamp, timestamp]
    );
    await db._execute(
      `INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at)
       VALUES (?, ?, 'owner', ?)`,
      [orphanWorkspaceId, userId, timestamp]
    );
    await db._execute(
      `INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at)
       VALUES (?, ?, 'owner', ?)`,
      [validWorkspaceId, userId, timestamp]
    );

    await expect(db.getMembership(orphanWorkspaceId, userId)).resolves.toBeNull();

    const payload = await db.buildSessionPayload(userId, orphanWorkspaceId);
    expect(payload.workspaceId).toBe(validWorkspaceId);
    await expect(
      db._get('SELECT * FROM workspace_state WHERE workspace_id = ?', [orphanWorkspaceId])
    ).resolves.toBeNull();
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
        requestId: 'req_delete_actor',
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
      expect(JSON.parse(auditRow.metadata_json)).toMatchObject({
        requestId: 'req_delete_actor',
      });
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
      deleteAudioFromStorageSpy.mockRestore();
    }
  });

  test('Issue #1230 - listAuditLogs filters recording events with safe metadata', async () => {
    await db._execute(
      `INSERT INTO audit_logs (
        id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
      ) VALUES
        (?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'audit_list_recent',
        'ws_audit_list',
        'user_recent',
        'recording.audio.downloaded',
        'recording',
        'rec_audit_list',
        JSON.stringify({ requestId: 'req_recent', source: 'api' }),
        '2026-06-28T12:00:00.000Z',
        'audit_list_older',
        'ws_audit_list',
        'user_older',
        'recording.ai.analyzed',
        'recording',
        'rec_audit_list',
        JSON.stringify({ requestId: 'req_older', mode: 'openai' }),
        '2026-06-28T11:00:00.000Z',
        'audit_list_other_recording',
        'ws_audit_list',
        'user_other',
        'recording.deleted',
        'recording',
        'rec_other',
        JSON.stringify({ requestId: 'req_other' }),
        '2026-06-28T13:00:00.000Z',
      ]
    );

    const firstPage = await db.listAuditLogs('ws_audit_list', {
      recordingId: 'rec_audit_list',
      limit: 1,
    });

    expect(firstPage.events).toEqual([
      expect.objectContaining({
        id: 'audit_list_recent',
        workspaceId: 'ws_audit_list',
        actorUserId: 'user_recent',
        action: 'recording.audio.downloaded',
        eventType: 'recording.audio.downloaded',
        entityType: 'recording',
        entityId: 'rec_audit_list',
        recordingId: 'rec_audit_list',
        metadata: { requestId: 'req_recent', source: 'api' },
        createdAt: '2026-06-28T12:00:00.000Z',
      }),
    ]);
    expect(firstPage.nextCursor).toBe('2026-06-28T12:00:00.000Z');

    const secondPage = await db.listAuditLogs('ws_audit_list', {
      recordingId: 'rec_audit_list',
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.events[0]).toMatchObject({
      id: 'audit_list_older',
      recordingId: 'rec_audit_list',
    });
    expect(JSON.stringify(firstPage)).not.toContain('rec_other');
  });

  test('Issue #1258 - exportAuditLogs filters events and strips raw content metadata', async () => {
    await db._execute(
      `INSERT INTO audit_logs (
        id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
      ) VALUES
        (?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?),
        (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'audit_export_match',
        'ws_audit_export',
        'user_export',
        'recording.audio.downloaded',
        'recording',
        'rec_export',
        JSON.stringify({
          requestId: 'req_export',
          source: 'api',
          transcriptText: 'RAW TRANSCRIPT SECRET',
          audioPath: '/tmp/raw-audio.webm',
          prompt: 'RAW PROMPT SECRET',
        }),
        '2026-07-03T10:00:00.000Z',
        'audit_export_wrong_actor',
        'ws_audit_export',
        'user_other',
        'recording.audio.downloaded',
        'recording',
        'rec_export',
        JSON.stringify({ requestId: 'req_other_actor' }),
        '2026-07-03T11:00:00.000Z',
        'audit_export_wrong_recording',
        'ws_audit_export',
        'user_export',
        'recording.deleted',
        'recording',
        'rec_other_export',
        JSON.stringify({ requestId: 'req_other_recording' }),
        '2026-07-03T12:00:00.000Z',
      ]
    );

    const report = await db.exportAuditLogs('ws_audit_export', {
      generatedBy: 'operator_1',
      from: '2026-07-03T00:00:00.000Z',
      to: '2026-07-04T00:00:00.000Z',
      eventType: 'recording.audio.downloaded',
      actorUserId: 'user_export',
      recordingId: 'rec_export',
      nowIso: '2026-07-05T12:00:00.000Z',
    });

    expect(report).toMatchObject({
      schemaVersion: 'audit-export-v1',
      generatedAt: '2026-07-05T12:00:00.000Z',
      generatedBy: 'operator_1',
      filters: {
        workspaceId: 'ws_audit_export',
        from: '2026-07-03T00:00:00.000Z',
        to: '2026-07-04T00:00:00.000Z',
        eventType: 'recording.audio.downloaded',
        actorUserId: 'user_export',
        recordingId: 'rec_export',
      },
      eventCount: 1,
    });
    expect(report.events).toEqual([
      expect.objectContaining({
        id: 'audit_export_match',
        workspaceId: 'ws_audit_export',
        actorUserId: 'user_export',
        eventType: 'recording.audio.downloaded',
        recordingId: 'rec_export',
        metadata: { requestId: 'req_export', source: 'api' },
        createdAt: '2026-07-03T10:00:00.000Z',
      }),
    ]);
    expect(JSON.stringify(report)).not.toContain('RAW TRANSCRIPT SECRET');
    expect(JSON.stringify(report)).not.toContain('/tmp/raw-audio.webm');
    expect(JSON.stringify(report)).not.toContain('RAW PROMPT SECRET');
    expect(JSON.stringify(report)).not.toContain('audit_export_wrong_actor');
    expect(JSON.stringify(report)).not.toContain('audit_export_wrong_recording');
  });

  test('Issue #1230 - deleteMediaAsset succeeds when audit storage is unavailable', async () => {
    const storageModule = await import('../lib/supabaseStorage.ts');
    const deleteAudioFromStorageSpy = vi
      .spyOn(storageModule, 'deleteAudioFromStorage')
      .mockResolvedValue(undefined);
    const writeAuditSpy = vi
      .spyOn(db, 'writeAuditLog')
      .mockRejectedValueOnce(new Error('audit database unavailable'));
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
          'rec_delete_audit_down',
          'ws_delete_audit_down',
          'meeting_delete_audit_down',
          'user_delete_audit_down',
          'workspaces/ws_delete_audit_down/recordings/rec_delete_audit_down/audio.webm',
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

      await expect(
        db.deleteMediaAsset('rec_delete_audit_down', 'ws_delete_audit_down')
      ).resolves.toBeUndefined();
      await expect(db.getMediaAsset('rec_delete_audit_down')).resolves.toBeNull();
      expect(writeAuditSpy).toHaveBeenCalled();
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
      deleteAudioFromStorageSpy.mockRestore();
      writeAuditSpy.mockRestore();
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
        requestId: 'req_retention_repeat',
      });
      const second = await db.cleanupExpiredRecordingsByRetention({
        workspaceId: 'ws_retention_repeat',
        nowIso: '2026-06-20T12:00:00.000Z',
        actorUserId: 'maintainer_1',
        source: 'test-maintenance',
        requestId: 'req_retention_repeat_2',
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
        requestId: 'req_retention_repeat',
      });
      const cleanupAudit = auditRows.find((row: any) => {
        if (row.action !== 'retention.cleanup.completed') {
          return false;
        }
        return JSON.parse(row.metadata_json).requestId === 'req_retention_repeat';
      });
      expect(JSON.parse(cleanupAudit.metadata_json)).toMatchObject({
        requestId: 'req_retention_repeat',
      });
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
      deleteAudioFromStorageSpy.mockRestore();
    }
  });

  test('Issue #1261 - retention cleanup skips recordings under active legal hold', async () => {
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
      await db.ensureWorkspaceState('ws_retention_hold');
      await db.saveWorkspaceState('ws_retention_hold', {
        meetings: [],
        manualTasks: [],
        manualPeople: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
        retentionDays: 1,
      });

      for (const recordingId of ['rec_hold_old', 'rec_hold_delete']) {
        await db._execute(
          `INSERT INTO media_assets (
            id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
            size_bytes, storage_mode, media_manifest_json, source_size_bytes,
            normalized_size_bytes, transcription_status, transcript_json, diarization_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recordingId,
            'ws_retention_hold',
            'meeting_hold',
            'user_hold',
            `workspaces/ws_retention_hold/recordings/${recordingId}/audio.webm`,
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
      }

      await db.setRecordingRetentionHold({
        workspaceId: 'ws_retention_hold',
        recordingId: 'rec_hold_old',
        actorUserId: 'admin_hold',
        reason: 'legal discovery',
        requestId: 'req_hold_create',
      });

      const result = await db.cleanupExpiredRecordingsByRetention({
        workspaceId: 'ws_retention_hold',
        nowIso: '2026-06-20T12:00:00.000Z',
        actorUserId: 'system',
        source: 'test-retention',
        requestId: 'req_hold_cleanup',
      });

      expect(result).toMatchObject({
        checked: 2,
        deleted: 1,
        deletedRecordingIds: ['rec_hold_delete'],
        heldRecordingIds: ['rec_hold_old'],
      });
      await expect(db.getMediaAsset('rec_hold_old')).resolves.toMatchObject({ id: 'rec_hold_old' });
      await expect(db.getMediaAsset('rec_hold_delete')).resolves.toBeNull();
      expect(deleteAudioFromStorageSpy).not.toHaveBeenCalledWith(
        'workspaces/ws_retention_hold/recordings/rec_hold_old/audio.webm'
      );

      const auditRows = await db._query(
        'SELECT * FROM audit_logs WHERE workspace_id = ? ORDER BY created_at ASC',
        ['ws_retention_hold']
      );
      expect(auditRows.map((row: any) => row.action)).toEqual(
        expect.arrayContaining([
          'recording.retention_hold.created',
          'recording.deleted',
          'retention.cleanup.completed',
        ])
      );
      const cleanupAudit = auditRows.find(
        (row: any) => row.action === 'retention.cleanup.completed'
      );
      expect(JSON.parse(cleanupAudit.metadata_json)).toMatchObject({
        heldRecordingIds: ['rec_hold_old'],
        requestId: 'req_hold_cleanup',
      });
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
      deleteAudioFromStorageSpy.mockRestore();
    }
  });

  test('Issue #1261 - retention hold can be released and is audited', async () => {
    await db.ensureWorkspaceState('ws_retention_hold_release');
    await db.setRecordingRetentionHold({
      workspaceId: 'ws_retention_hold_release',
      recordingId: 'rec_hold_release',
      actorUserId: 'admin_hold',
      reason: 'customer dispute',
      requestId: 'req_hold_release_create',
    });

    await expect(db.listRecordingRetentionHolds('ws_retention_hold_release')).resolves.toEqual([
      expect.objectContaining({
        recordingId: 'rec_hold_release',
        reason: 'customer dispute',
        active: true,
      }),
    ]);

    const released = await db.clearRecordingRetentionHold({
      workspaceId: 'ws_retention_hold_release',
      recordingId: 'rec_hold_release',
      actorUserId: 'admin_hold',
      reason: 'case closed',
      requestId: 'req_hold_release_clear',
    });

    expect(released).toMatchObject({ recordingId: 'rec_hold_release', active: false });
    await expect(db.listRecordingRetentionHolds('ws_retention_hold_release')).resolves.toEqual([]);
    const releaseAudit = await db._get(
      'SELECT * FROM audit_logs WHERE workspace_id = ? AND action = ?',
      ['ws_retention_hold_release', 'recording.retention_hold.released']
    );
    expect(JSON.parse(releaseAudit.metadata_json)).toMatchObject({
      reason: 'case closed',
      requestId: 'req_hold_release_clear',
    });
  });

  test('Issue #1261 - workspace-level retention hold skips all expired workspace recordings', async () => {
    await db.ensureWorkspaceState('ws_retention_workspace_hold');
    await db.saveWorkspaceState('ws_retention_workspace_hold', {
      meetings: [],
      manualTasks: [],
      manualPeople: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      retentionDays: 1,
    });
    for (const recordingId of ['rec_workspace_hold_a', 'rec_workspace_hold_b']) {
      await db._execute(
        `INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, storage_mode, media_manifest_json, source_size_bytes,
          normalized_size_bytes, transcription_status, transcript_json, diarization_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordingId,
          'ws_retention_workspace_hold',
          '',
          'user_hold',
          `workspaces/ws_retention_workspace_hold/recordings/${recordingId}/audio.webm`,
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
    }

    await db.setWorkspaceRetentionHold({
      workspaceId: 'ws_retention_workspace_hold',
      actorUserId: 'admin_hold',
      reason: 'regulator request',
      requestId: 'req_workspace_hold',
    });

    const result = await db.cleanupExpiredRecordingsByRetention({
      workspaceId: 'ws_retention_workspace_hold',
      nowIso: '2026-06-20T12:00:00.000Z',
      actorUserId: 'system',
      source: 'test-retention',
      requestId: 'req_workspace_hold_cleanup',
    });

    expect(result).toMatchObject({
      checked: 2,
      deleted: 0,
      heldRecordingIds: ['rec_workspace_hold_a', 'rec_workspace_hold_b'],
    });
    await expect(db.getMediaAsset('rec_workspace_hold_a')).resolves.toMatchObject({
      id: 'rec_workspace_hold_a',
    });
    const holds = await db.listRecordingRetentionHolds('ws_retention_workspace_hold');
    expect(holds).toEqual([
      expect.objectContaining({
        scope: 'workspace',
        recordingId: '',
        active: true,
      }),
    ]);
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
    await db._execute(
      `INSERT INTO voice_profiles (
        id, user_id, workspace_id, speaker_name, audio_path, embedding_json, sample_count,
        threshold, created_at, updated_at, profile_source, embedding_model, embedding_version,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'vp_export_missing_sample',
        'user_export',
        'ws_export',
        'Anna',
        path.join(testUploadDir, 'missing-voice-profile-sample.wav'),
        JSON.stringify([0.1, 0.2, 0.3]),
        2,
        0.87,
        '2026-06-20T09:10:00.000Z',
        '2026-06-20T09:20:00.000Z',
        'manual_upload',
        'voice-profile-embedding',
        '1',
        'user_export',
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

    const previousFsState = { ...(global as any).__TEST_FS_STATE__ };
    (global as any).__TEST_FS_STATE__ = {
      ...previousFsState,
      existsSync: false,
    };
    let payload;
    try {
      payload = await db.exportWorkspaceData('ws_export', {
        actorUserId: 'user_export',
        source: 'test-export',
        requestId: 'req_export_workspace',
      });
    } finally {
      (global as any).__TEST_FS_STATE__ = previousFsState;
    }

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
    expect(payload.voiceProfileSamples).toEqual([
      expect.objectContaining({
        id: 'vp_export_missing_sample',
        speakerName: 'Anna',
        userId: 'user_export',
        audioPath: expect.stringContaining('missing-voice-profile-sample.wav'),
        sampleStoragePolicy: 'durable_until_profile_delete_or_replaced',
        retentionPolicy: 'retained_until_profile_delete',
        sampleFileExists: false,
        sampleCount: 2,
        threshold: 0.87,
        source: 'manual_upload',
        model: 'voice-profile-embedding',
        version: '1',
        createdBy: 'user_export',
        createdAt: '2026-06-20T09:10:00.000Z',
        updatedAt: '2026-06-20T09:20:00.000Z',
      }),
    ]);
    expect(payload.voiceProfileSamples[0]).not.toHaveProperty('embedding');
    expect(payload.voiceProfileSamples[0]).not.toHaveProperty('embeddingJson');
    expect(payload.voiceProfileSamples[0]).not.toHaveProperty('embedding_json');
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
      requestId: 'req_export_workspace',
      mediaAssetCount: 1,
      voiceProfileSampleCount: 1,
      missingVoiceProfileSampleCount: 1,
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
