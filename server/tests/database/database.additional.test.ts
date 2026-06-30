/**
 * Testy dla database.ts - uzupełnienie coverage
 * Coverage target: 80%+
 */

import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import {
  checkRemoteAudioAvailabilityWithTimeout,
  initDatabase,
  getDatabase,
} from '../../database.ts';
import { fileURLToPath } from 'node:url';
import { logger } from '../../logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Database - Additional Coverage Tests', () => {
  let db: any;
  const testUploadDir = path.resolve(__dirname, 'test_uploads_additional');
  const savedProductionEnv = {
    NODE_ENV: process.env.NODE_ENV,
    RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
    RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
  };

  beforeAll(async () => {
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.RAILWAY_PROJECT_ID;
    process.env.NODE_ENV = 'test';

    const actualFs = await vi.importActual<any>('node:fs');
    const fsMock = (globalThis as any).__mockFs;
    if (fsMock) {
      fsMock.existsSync.mockImplementation((filePath?: string) =>
        typeof filePath === 'string' ? actualFs.existsSync(filePath) : false
      );
      fsMock.mkdirSync.mockImplementation((...args: any[]) =>
        actualFs.mkdirSync(...(args as Parameters<typeof actualFs.mkdirSync>))
      );
      fsMock.writeFileSync.mockImplementation((...args: any[]) =>
        actualFs.writeFileSync(...(args as Parameters<typeof actualFs.writeFileSync>))
      );
      fsMock.readFileSync.mockImplementation((...args: any[]) =>
        actualFs.readFileSync(...(args as Parameters<typeof actualFs.readFileSync>))
      );
      fsMock.readdirSync.mockImplementation((...args: any[]) =>
        actualFs.readdirSync(...(args as Parameters<typeof actualFs.readdirSync>))
      );
      fsMock.unlinkSync.mockImplementation((...args: any[]) =>
        actualFs.unlinkSync(...(args as Parameters<typeof actualFs.unlinkSync>))
      );
      fsMock.rmSync.mockImplementation((...args: any[]) =>
        actualFs.rmSync(...(args as Parameters<typeof actualFs.rmSync>))
      );
    }
    // Clean up test directory
    if (actualFs.existsSync(testUploadDir)) {
      actualFs.rmSync(testUploadDir, { recursive: true, force: true });
    }

    db = initDatabase({ dbPath: ':memory:', uploadDir: testUploadDir });
    await db.init();
  }, 60000);

  afterAll(async () => {
    if (db) {
      await db.shutdown();
    }
    const actualFs = await vi.importActual<any>('node:fs');
    if (actualFs.existsSync(testUploadDir)) {
      try {
        actualFs.rmSync(testUploadDir, { recursive: true, force: true });
      } catch (_) {}
    }
    if (savedProductionEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedProductionEnv.NODE_ENV;
    if (savedProductionEnv.RAILWAY_ENVIRONMENT_NAME === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT_NAME;
    } else {
      process.env.RAILWAY_ENVIRONMENT_NAME = savedProductionEnv.RAILWAY_ENVIRONMENT_NAME;
    }
    if (savedProductionEnv.RAILWAY_PROJECT_ID === undefined) delete process.env.RAILWAY_PROJECT_ID;
    else process.env.RAILWAY_PROJECT_ID = savedProductionEnv.RAILWAY_PROJECT_ID;
  });

  // Helper to check if tables exist
  async function tablesExist(): Promise<boolean> {
    try {
      await db._get('SELECT * FROM media_assets LIMIT 1');
      return true;
    } catch (err: any) {
      if (err.message?.includes('no such table')) {
        return false;
      }
      throw err;
    }
  }

  describe('upsertMediaAsset()', () => {
    test('inserts new media asset with local storage fallback', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      const asset = await db.upsertMediaAsset({
        recordingId: 'rec_new_local',
        workspaceId: 'ws1',
        meetingId: 'm1',
        contentType: 'audio/webm',
        buffer: Buffer.from('test-audio-data'),
        createdByUserId: 'user1',
      });

      expect(asset).toBeDefined();
      expect(asset.id).toBe('rec_new_local');
      expect(asset.workspace_id).toBe('ws1');
      expect(asset.content_type).toBe('audio/webm');
      expect(asset.file_path).toContain('rec_new_local.webm');
    });

    test('Regression: production upload fails instead of falling back to local audio storage', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run
      const savedNodeEnv = process.env.NODE_ENV;
      const savedRailwayProjectId = process.env.RAILWAY_PROJECT_ID;
      const savedForcePersistent = process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE;

      try {
        process.env.NODE_ENV = 'production';
        process.env.RAILWAY_PROJECT_ID = 'railway-project-test';
        process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE = 'true';

        await expect(
          db.upsertMediaAsset({
            recordingId: 'rec_prod_storage_failure',
            workspaceId: 'ws1',
            meetingId: 'm1',
            contentType: 'audio/webm',
            buffer: Buffer.from('test-audio-data'),
            createdByUserId: 'user1',
          })
        ).rejects.toThrow(/Supabase Storage/i);

        const asset = await db.getMediaAsset('rec_prod_storage_failure');
        expect(asset).toBeNull();
      } finally {
        if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = savedNodeEnv;
        if (savedRailwayProjectId === undefined) delete process.env.RAILWAY_PROJECT_ID;
        else process.env.RAILWAY_PROJECT_ID = savedRailwayProjectId;
        if (savedForcePersistent === undefined) {
          delete process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE;
        } else {
          process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE = savedForcePersistent;
        }
      }
    });

    test('updates existing media asset', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      // First insert
      await db.upsertMediaAsset({
        recordingId: 'rec_update',
        workspaceId: 'ws1',
        contentType: 'audio/webm',
        buffer: Buffer.from('initial'),
        createdByUserId: 'user1',
      });

      // Then update
      const updated = await db.upsertMediaAsset({
        recordingId: 'rec_update',
        workspaceId: 'ws1',
        contentType: 'audio/mp4',
        buffer: Buffer.from('updated-audio'),
        createdByUserId: 'user1',
      });

      expect(updated.content_type).toBe('audio/mp4');
      expect(updated.size_bytes).toBe(13); // "updated-audio".length
    });

    test('handles different audio formats correctly', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      const formats = [
        { contentType: 'audio/webm', ext: '.webm' },
        { contentType: 'audio/mpeg', ext: '.mp3' },
        { contentType: 'audio/mp4', ext: '.m4a' },
        { contentType: 'audio/wav', ext: '.wav' },
        { contentType: 'audio/unknown', ext: '.webm' },
      ];

      for (const { contentType, ext } of formats) {
        const asset = await db.upsertMediaAsset({
          recordingId: `rec_format_${ext.replace('.', '')}`,
          workspaceId: 'ws1',
          contentType,
          buffer: Buffer.from('audio'),
          createdByUserId: 'user1',
        });

        expect(asset.file_path).toContain(ext);
      }
    });

    test('sanitizes recording ID to prevent path traversal', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      const safeIds = ['rec-with-dashes', 'rec_with_underscores', 'rec123'];

      for (const safeId of safeIds) {
        const asset = await db.upsertMediaAsset({
          recordingId: safeId,
          workspaceId: 'ws1',
          contentType: 'audio/webm',
          buffer: Buffer.from('audio'),
          createdByUserId: 'user1',
        });

        // Should preserve safe characters
        expect(asset.id).toBe(safeId);
      }
    });

    test('throws error for empty recording ID', async () => {
      await expect(
        db.upsertMediaAsset({
          recordingId: '',
          workspaceId: 'ws1',
          contentType: 'audio/webm',
          buffer: Buffer.from('audio'),
          createdByUserId: 'user1',
        })
      ).rejects.toThrow('Nieprawidłowy identyfikator nagrania.');
    });
  });

  describe('upsertMediaAssetFromPath()', () => {
    test('Regression: production path upload fails instead of preserving local Railway path', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run
      const savedNodeEnv = process.env.NODE_ENV;
      const savedRailwayProjectId = process.env.RAILWAY_PROJECT_ID;
      const savedForcePersistent = process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE;

      try {
        process.env.NODE_ENV = 'production';
        process.env.RAILWAY_PROJECT_ID = 'railway-project-test';
        process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE = 'true';

        const actualFs = await vi.importActual<any>('node:fs');
        const sourcePath = path.join(testUploadDir, 'source-prod-failure.webm');
        actualFs.mkdirSync(testUploadDir, { recursive: true });
        actualFs.writeFileSync(sourcePath, Buffer.from('audio-from-path'));

        await expect(
          db.upsertMediaAssetFromPath({
            recordingId: 'rec_prod_path_storage_failure',
            workspaceId: 'ws1',
            meetingId: 'm1',
            contentType: 'audio/webm',
            filePath: sourcePath,
            createdByUserId: 'user1',
          })
        ).rejects.toThrow(/Supabase Storage/i);

        const asset = await db.getMediaAsset('rec_prod_path_storage_failure');
        expect(asset).toBeNull();
      } finally {
        if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = savedNodeEnv;
        if (savedRailwayProjectId === undefined) delete process.env.RAILWAY_PROJECT_ID;
        else process.env.RAILWAY_PROJECT_ID = savedRailwayProjectId;
        if (savedForcePersistent === undefined) {
          delete process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE;
        } else {
          process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE = savedForcePersistent;
        }
      }
    });
  });

  describe('upsertMediaAssetFromPreparedAudio()', () => {
    test('stores segmented manifests and delete cleans up all local parts', async () => {
      if (!(await tablesExist())) return;

      const actualFs = await vi.importActual<any>('node:fs');
      const recordingId = 'rec_segmented_local';
      const normalizedPath = path.join(testUploadDir, `${recordingId}-normalized.webm`);
      const part0 = path.join(testUploadDir, `${recordingId}-part-0.webm`);
      const part1 = path.join(testUploadDir, `${recordingId}-part-1.webm`);
      actualFs.mkdirSync(testUploadDir, { recursive: true });
      actualFs.writeFileSync(normalizedPath, Buffer.alloc(1024, 1));
      actualFs.writeFileSync(part0, Buffer.from('part-0'));
      actualFs.writeFileSync(part1, Buffer.from('part-1'));

      const asset = await db.upsertMediaAssetFromPreparedAudio({
        recordingId,
        workspaceId: 'ws1',
        meetingId: 'm1',
        normalizedFilePath: normalizedPath,
        sourceSizeBytes: 200 * 1024 * 1024,
        normalizedSizeBytes: 50 * 1024 * 1024,
        durationMs: 20 * 60 * 1000,
        parts: [
          {
            index: 0,
            localPath: part0,
            startMs: 0,
            endMs: 600000,
            sizeBytes: 6,
            contentType: 'audio/webm',
          },
          {
            index: 1,
            localPath: part1,
            startMs: 600000,
            endMs: 1200000,
            sizeBytes: 6,
            contentType: 'audio/webm',
          },
        ],
        createdByUserId: 'user1',
      });

      expect(asset.storage_mode).toBe('segmented');
      const manifest = JSON.parse(asset.media_manifest_json);
      expect(manifest.parts).toHaveLength(2);
      for (const part of manifest.parts) {
        expect(actualFs.existsSync(part.path)).toBe(true);
      }

      await db.deleteMediaAsset(recordingId, 'ws1');

      expect(await db.getMediaAsset(recordingId)).toBeNull();
      for (const part of manifest.parts) {
        expect(actualFs.existsSync(part.path)).toBe(false);
      }
      expect(actualFs.existsSync(asset.file_path)).toBe(false);
    });
  });

  describe('getMediaAsset()', () => {
    test('returns media asset by ID', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      await db.upsertMediaAsset({
        recordingId: 'rec_get',
        workspaceId: 'ws1',
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });

      const asset = await db.getMediaAsset('rec_get');
      expect(asset).toBeDefined();
      expect(asset.id).toBe('rec_get');
    });

    test('returns null for non-existent asset', async () => {
      const asset = await db.getMediaAsset('nonexistent_recording_id');
      expect(asset).toBeNull();
    });
  });

  describe('deleteMediaAsset()', () => {
    test('deletes media asset and cleans up file', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      const recordingId = 'rec_delete';

      await db.upsertMediaAsset({
        recordingId,
        workspaceId: 'ws1',
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });

      // Verify exists
      let asset = await db.getMediaAsset(recordingId);
      expect(asset).toBeDefined();

      // Delete
      await db.deleteMediaAsset(recordingId, 'ws1');

      // Verify deleted
      asset = await db.getMediaAsset(recordingId);
      expect(asset).toBeNull();
    });

    test('does not delete if workspace ID does not match', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      const recordingId = 'rec_delete_wrong_ws';

      await db.upsertMediaAsset({
        recordingId,
        workspaceId: 'ws1',
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });

      // Try to delete with wrong workspace
      await db.deleteMediaAsset(recordingId, 'wrong_workspace');

      // Should still exist
      const asset = await db.getMediaAsset(recordingId);
      expect(asset).toBeDefined();
    });

    test('handles deletion of non-existent asset gracefully', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      // Should not throw
      await expect(db.deleteMediaAsset('nonexistent', 'ws1')).resolves.toBeUndefined();
    });

    test('Regression: #0 — ignores missing legacy audio files without warning noise', async () => {
      if (!(await tablesExist())) return;

      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const recordingId = 'rec_missing_legacy_file';
      const missingPath = path.join(testUploadDir, 'missing-legacy-file.wav');

      await db._execute(
        `INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, transcription_status, transcript_json, diarization_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', '[]', '{}', ?, ?)`,
        [
          recordingId,
          'ws1',
          'm1',
          'user1',
          missingPath,
          'audio/wav',
          123,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      await db.deleteMediaAsset(recordingId, 'ws1');

      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete legacy audio file'),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('saveAudioQualityDiagnostics()', () => {
    test('saves audio quality metrics to diarization_json', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      await db.upsertMediaAsset({
        recordingId: 'rec_quality',
        workspaceId: 'ws1',
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });

      const qualityMetrics = {
        qualityLabel: 'good',
        enhancementRecommended: false,
        snr: 25.5,
        noiseFloor: -60,
      };

      await db.saveAudioQualityDiagnostics('rec_quality', qualityMetrics);

      const asset = await db.getMediaAsset('rec_quality');
      const diarization = JSON.parse(asset.diarization_json);

      expect(diarization.audioQuality).toEqual(qualityMetrics);
    });

    test('handles null audio quality gracefully', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      await db.upsertMediaAsset({
        recordingId: 'rec_quality_null',
        workspaceId: 'ws1',
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });

      await db.saveAudioQualityDiagnostics('rec_quality_null', null);

      const asset = await db.getMediaAsset('rec_quality_null');
      const diarization = JSON.parse(asset.diarization_json);

      // Should not have audioQuality key or be empty
      expect(diarization.audioQuality).toBeUndefined();
    });

    test('does nothing for non-existent asset', async () => {
      if (!(await tablesExist())) return; // Skip if migrations haven't run

      // Should not throw, but may return null
      await expect(
        db.saveAudioQualityDiagnostics('nonexistent', { qualityLabel: 'good' })
      ).resolves.not.toThrow();
    });
  });

  describe('Workspace state reconciliation', () => {
    test('Regression: #0 — getWorkspaceState prunes orphaned recording references', async () => {
      if (!(await tablesExist())) return;

      await db.upsertMediaAsset({
        recordingId: 'rec_state_valid',
        workspaceId: 'ws_state_cleanup',
        meetingId: 'meeting_state_cleanup',
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });

      await db.saveWorkspaceState('ws_state_cleanup', {
        meetings: [
          {
            id: 'meeting_state_cleanup',
            workspaceId: 'ws_state_cleanup',
            title: 'Cleanup test',
            latestRecordingId: 'rec_state_orphan',
            recordings: [
              { id: 'rec_state_orphan', pipelineStatus: 'done' },
              { id: 'rec_state_valid', pipelineStatus: 'done' },
            ],
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState('ws_state_cleanup');
      const meeting = state.meetings.find((item: any) => item.id === 'meeting_state_cleanup');

      expect(meeting?.recordings).toEqual([
        expect.objectContaining({
          id: 'rec_state_valid',
          pipelineStatus: 'done',
          audioAvailable: true,
          audioUnavailable: false,
        }),
      ]);
      expect(meeting?.latestRecordingId).toBe('rec_state_valid');
    });

    test('Regression: #0 - deleting a media asset tombstones it so stale workspace saves cannot resurrect it', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_tombstone';
      const meetingId = 'meeting_state_tombstone';
      const recordingId = 'rec_state_tombstone';
      const staleMeetings = [
        {
          id: meetingId,
          workspaceId,
          title: 'Deleted recording must stay deleted',
          latestRecordingId: recordingId,
          recordings: [{ id: recordingId, pipelineStatus: 'done', transcript: [{ text: 'old' }] }],
        },
      ];

      await db.upsertMediaAsset({
        recordingId,
        workspaceId,
        meetingId,
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });

      await db.saveWorkspaceState(workspaceId, {
        meetings: staleMeetings,
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      await db.deleteMediaAsset(recordingId, workspaceId);

      await db.saveWorkspaceState(workspaceId, {
        meetings: staleMeetings,
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);
      const meeting = state.meetings.find((item: any) => item.id === meetingId);

      expect(meeting?.recordings).toEqual([]);
      expect(meeting?.latestRecordingId).toBeNull();
      expect(state.calendarMeta?.recordingTombstones).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: recordingId })])
      );
    });

    test('Regression: #0 - meeting tombstones prevent stale workspace saves from resurrecting deleted meetings', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_meeting_tombstone';
      const deletedMeeting = {
        id: 'meeting_deleted_tombstone',
        workspaceId,
        title: 'Deleted meeting',
        updatedAt: '2026-05-28T07:00:00.000Z',
      };

      await db.saveWorkspaceState(workspaceId, {
        meetings: [deletedMeeting],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {
          meetingTombstones: [
            {
              id: deletedMeeting.id,
              deletedAt: '2026-05-28T07:01:00.000Z',
              source: 'meeting-delete',
            },
          ],
        },
        vocabulary: [],
      });

      await db.saveWorkspaceState(workspaceId, {
        meetings: [deletedMeeting],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);

      expect(state.meetings.find((meeting: any) => meeting?.id === deletedMeeting.id)).toBeFalsy();
      expect(state.calendarMeta?.meetingTombstones).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: deletedMeeting.id })])
      );
    });

    test('Regression: #0 - workspace state drops null meetings and keeps newest duplicate by id', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_dedupe';

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          null,
          { id: 'meeting_dupe', title: 'Old', updatedAt: '2026-05-28T07:00:00.000Z' },
          { id: 'meeting_dupe', title: 'New', updatedAt: '2026-05-28T07:05:00.000Z' },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);

      expect(state.meetings).toEqual([
        expect.objectContaining({ id: 'meeting_dupe', title: 'New' }),
      ]);
    });

    test('Regression: #0 - workspace state restores fuller transcript from media_assets', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_transcript_restore';
      const meetingId = 'meeting_state_transcript_restore';
      const recordingId = 'rec_state_transcript_restore';
      const serverTranscript = [
        { id: 'seg1', speakerId: '0', timestamp: 0, text: 'Pierwszy fragment rozmowy.' },
        { id: 'seg2', speakerId: '0', timestamp: 4, text: 'Drugi fragment rozmowy.' },
      ];

      await db.upsertMediaAsset({
        recordingId,
        workspaceId,
        meetingId,
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });
      await db.saveTranscriptionResult(recordingId, {
        pipelineStatus: 'completed',
        segments: serverTranscript,
        diarization: {
          speakerNames: { '0': 'iwo' },
          speakerCount: 1,
          confidence: 0.91,
          transcriptOutcome: 'normal',
        },
      });

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          {
            id: meetingId,
            workspaceId,
            title: 'Transcript restore',
            latestRecordingId: recordingId,
            recordings: [
              {
                id: recordingId,
                pipelineStatus: 'done',
                transcriptionStatus: 'done',
                transcript: [{ id: 'seg1', text: 'Pierwszy fragment rozmowy.' }],
              },
            ],
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);
      const meeting = state.meetings.find((item: any) => item.id === meetingId);
      const recording = meeting?.recordings?.[0];

      expect(recording?.transcript).toEqual(serverTranscript);
      expect(recording?.pipelineStatus).toBe('done');
      expect(recording?.transcriptionStatus).toBe('done');
      expect(recording?.speakerNames).toEqual({ '0': 'iwo' });
      expect(recording?.speakerCount).toBe(1);
    });

    test('Regression: #0 - workspace state does not downgrade a completed transcript to a shell recording', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_no_transcript_downgrade';
      const meetingId = 'meeting_state_no_transcript_downgrade';
      const recordingId = 'rec_state_no_transcript_downgrade';
      const fullTranscript = [
        { id: 'seg1', speakerId: '0', timestamp: 0, text: 'Pelny transkrypt zostaje.' },
      ];

      await db.upsertMediaAsset({
        recordingId,
        workspaceId,
        meetingId,
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          {
            id: meetingId,
            workspaceId,
            title: 'Transcript anti downgrade',
            latestRecordingId: recordingId,
            recordings: [
              {
                id: recordingId,
                pipelineStatus: 'done',
                transcriptionStatus: 'done',
                duration: 5400,
                transcript: fullTranscript,
                transcriptOutcome: 'normal',
                speakerNames: { '0': 'Speaker 1' },
                speakerCount: 1,
              },
            ],
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          {
            id: meetingId,
            workspaceId,
            title: 'Transcript anti downgrade',
            latestRecordingId: recordingId,
            recordings: [{ id: recordingId, pipelineStatus: 'done', transcriptionStatus: 'done' }],
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);
      const meeting = state.meetings.find((item: any) => item.id === meetingId);
      const recording = meeting?.recordings?.[0];

      expect(recording).toMatchObject({
        id: recordingId,
        pipelineStatus: 'done',
        transcriptionStatus: 'done',
        duration: 5400,
        transcript: fullTranscript,
        transcriptOutcome: 'normal',
        speakerNames: { '0': 'Speaker 1' },
        speakerCount: 1,
      });
      expect(meeting?.latestRecordingId).toBe(recordingId);
    });

    test('Regression: #0 - missing media asset keeps completed transcript but marks audio unavailable', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_missing_asset_transcript';
      const meetingId = 'meeting_state_missing_asset_transcript';
      const recordingId = 'rec_state_missing_asset_transcript';
      const transcript = [
        { id: 'seg1', speakerId: '0', timestamp: 0, text: 'Transkrypt bez audio zostaje.' },
      ];

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          {
            id: meetingId,
            workspaceId,
            title: 'Missing asset still keeps transcript',
            latestRecordingId: recordingId,
            recordings: [
              {
                id: recordingId,
                pipelineStatus: 'done',
                transcriptionStatus: 'done',
                transcript,
                transcriptOutcome: 'normal',
              },
            ],
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);
      const meeting = state.meetings.find((item: any) => item.id === meetingId);

      expect(meeting?.recordings?.[0]).toMatchObject({
        id: recordingId,
        pipelineStatus: 'done',
        transcriptionStatus: 'done',
        transcript,
        audioAvailable: false,
        audioUnavailable: true,
        audioUnavailableReason: 'audio_source_unavailable',
      });
      expect(meeting?.latestRecordingId).toBe(recordingId);
    });

    test('Regression: #0 - workspace state rebuilds a missing recording from latestRecordingId when the asset exists', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_latest_rebuild';
      const meetingId = 'meeting_state_latest_rebuild';
      const recordingId = 'rec_state_latest_rebuild';
      const serverTranscript = [
        { id: 'seg1', speakerId: '0', timestamp: 0, text: 'Odtworzony fragment z assetu.' },
      ];

      await db.upsertMediaAsset({
        recordingId,
        workspaceId,
        meetingId,
        contentType: 'audio/webm',
        buffer: Buffer.from('audio'),
        createdByUserId: 'user1',
      });
      await db.saveTranscriptionResult(recordingId, {
        pipelineStatus: 'completed',
        segments: serverTranscript,
        diarization: {
          speakerNames: { '0': 'iwo' },
          speakerCount: 1,
          confidence: 0.91,
          transcriptOutcome: 'normal',
        },
      });

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          {
            id: meetingId,
            workspaceId,
            title: 'Latest recording rebuild',
            latestRecordingId: recordingId,
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);
      const meeting = state.meetings.find((item: any) => item.id === meetingId);

      expect(meeting?.latestRecordingId).toBe(recordingId);
      expect(meeting?.recordings).toEqual([
        expect.objectContaining({
          id: recordingId,
          pipelineStatus: 'done',
          transcriptionStatus: 'done',
          transcript: serverTranscript,
          speakerNames: { '0': 'iwo' },
        }),
      ]);
    });

    test('Regression: #0 - workspace state clears a latestRecordingId that points to a missing asset', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_latest_missing';
      const meetingId = 'meeting_state_latest_missing';

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          {
            id: meetingId,
            workspaceId,
            title: 'Latest recording missing',
            latestRecordingId: 'rec_state_latest_missing',
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);
      const meeting = state.meetings.find((item: any) => item.id === meetingId);

      expect(meeting?.latestRecordingId).toBeNull();
      expect(meeting?.recordings).toEqual([]);
    });

    test('Regression: #0 - workspace state marks recordings with missing storage audio as unavailable', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_audio_unavailable';
      const meetingId = 'meeting_state_audio_unavailable';
      const recordingId = 'rec_state_audio_unavailable';
      const availabilitySpy = vi
        .spyOn(db, '_isMediaAssetAudioAvailable')
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false);

      await db._execute(
        `INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          transcription_status, transcript_json, diarization_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordingId,
          workspaceId,
          meetingId,
          'user1',
          'missing-audio.webm',
          'audio/webm',
          'completed',
          JSON.stringify([{ id: 'seg1', speakerId: '0', text: 'Test transcript' }]),
          JSON.stringify({ speakerCount: 1 }),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          {
            id: meetingId,
            workspaceId,
            title: 'Audio unavailable',
            latestRecordingId: recordingId,
            recordings: [{ id: recordingId }],
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);
      const meeting = state.meetings.find((item: any) => item.id === meetingId);

      expect(meeting?.recordings?.[0]).toMatchObject({
        id: recordingId,
        audioAvailable: false,
        audioUnavailable: true,
        audioUnavailableReason: 'audio_source_unavailable',
        transcript: [{ id: 'seg1', speakerId: '0', text: 'Test transcript' }],
      });
      availabilitySpy.mockRestore();
    });

    test('Regression: #0 - workspace state restores playable audio when media asset is available again', async () => {
      if (!(await tablesExist())) return;

      const workspaceId = 'ws_state_audio_available_restore';
      const meetingId = 'meeting_state_audio_available_restore';
      const recordingId = 'rec_state_audio_available_restore';
      const availabilitySpy = vi.spyOn(db, '_isMediaAssetAudioAvailable').mockResolvedValue(true);
      const transcript = [
        { id: 'seg1', speakerId: '0', text: 'Audio wraca bez utraty transkryptu.' },
      ];

      await db._execute(
        `INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          transcription_status, transcript_json, diarization_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordingId,
          workspaceId,
          meetingId,
          'user1',
          'workspace/recording/audio.webm',
          'audio/webm',
          'completed',
          JSON.stringify(transcript),
          JSON.stringify({ speakerCount: 1, transcriptOutcome: 'normal' }),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      await db.saveWorkspaceState(workspaceId, {
        meetings: [
          {
            id: meetingId,
            workspaceId,
            title: 'Audio available restore',
            latestRecordingId: recordingId,
            recordings: [
              {
                id: recordingId,
                pipelineStatus: 'done',
                transcriptionStatus: 'done',
                transcript,
                audioAvailable: false,
                audioUnavailable: true,
                audioUnavailableReason: 'audio_source_unavailable',
              },
            ],
          },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      });

      const state = await db.getWorkspaceState(workspaceId);
      const meeting = state.meetings.find((item: any) => item.id === meetingId);

      expect(meeting?.recordings?.[0]).toMatchObject({
        id: recordingId,
        audioAvailable: true,
        audioUnavailable: false,
        transcript,
      });
      expect(meeting?.recordings?.[0]?.audioUnavailableReason).toBeUndefined();
      availabilitySpy.mockRestore();
    });
  });

  // NOTE: saveTranscriptionResult test removed - function needs integration with existing database.test.ts
  // The functionality is already tested in database.test.ts "should persist pipeline metadata..." tests

  describe('Voice Profiles', () => {
    beforeAll(async () => {
      // Create voice_profiles table
      await db._execute(`
        CREATE TABLE IF NOT EXISTS voice_profiles (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          workspace_id TEXT,
          speaker_name TEXT,
          audio_path TEXT,
          embedding_json TEXT,
          sample_count INTEGER DEFAULT 1,
          threshold REAL DEFAULT 0.82,
          created_at TEXT
        )
      `);
    });

    test('saveVoiceProfile inserts new profile', async () => {
      const profile = {
        id: 'vp_test1',
        userId: 'u1',
        workspaceId: 'ws1',
        speakerName: 'Alice',
        audioPath: '/tmp/alice.wav',
        embedding: [0.1, 0.2, 0.3],
      };

      const result = await db.saveVoiceProfile(profile);
      expect(result.speaker_name).toBe('Alice');
      expect(result.sample_count).toBe(1);
    });

    test('saveVoiceProfile rejects empty embedding without inserting a profile', async () => {
      await expect(
        db.saveVoiceProfile({
          id: 'vp_empty_save',
          userId: 'u1',
          workspaceId: 'ws1',
          speakerName: 'Empty Save',
          audioPath: '/tmp/empty-save.wav',
          embedding: [],
        })
      ).rejects.toMatchObject({
        code: 'embedding_failed',
        stage: 'embedding',
        statusCode: 503,
      });

      await expect(
        db._get('SELECT * FROM voice_profiles WHERE id = ?', ['vp_empty_save'])
      ).resolves.toBeNull();
    });

    test('upsertVoiceProfile creates new profile when not exists', async () => {
      const profile = {
        id: 'vp_test2',
        userId: 'u1',
        workspaceId: 'ws1',
        speakerName: 'Bob',
        audioPath: '/tmp/bob.wav',
        embedding: [0.4, 0.5, 0.6],
      };

      const result = await db.upsertVoiceProfile(profile);
      expect(result.speaker_name).toBe('Bob');
      expect(result.isUpdate).toBeUndefined();
    });

    test('upsertVoiceProfile rejects empty embedding without inserting a profile', async () => {
      await expect(
        db.upsertVoiceProfile({
          id: 'vp_empty_upsert',
          userId: 'u1',
          workspaceId: 'ws1',
          speakerName: 'Empty Upsert',
          audioPath: '/tmp/empty-upsert.wav',
          embedding: [],
        })
      ).rejects.toMatchObject({
        code: 'embedding_failed',
        stage: 'embedding',
        statusCode: 503,
      });

      await expect(
        db._get('SELECT * FROM voice_profiles WHERE id = ?', ['vp_empty_upsert'])
      ).resolves.toBeNull();
    });

    test('upsertVoiceProfile updates existing profile with new sample', async () => {
      const profile1 = {
        id: 'vp_test3',
        userId: 'u1',
        workspaceId: 'ws1',
        speakerName: 'Charlie',
        audioPath: '/tmp/charlie1.wav',
        embedding: [0.1, 0.2, 0.3],
      };

      await db.upsertVoiceProfile(profile1);

      const profile2 = {
        id: 'vp_test3',
        userId: 'u1',
        workspaceId: 'ws1',
        speakerName: 'Charlie',
        audioPath: '/tmp/charlie2.wav',
        embedding: [0.4, 0.5, 0.6],
      };

      const result = await db.upsertVoiceProfile(profile2);
      expect(result.sample_count).toBe(2);
      expect(result.isUpdate).toBe(true);
    });

    test('upsertVoiceProfile rejects empty embedding without mutating an existing profile', async () => {
      await db.upsertVoiceProfile({
        id: 'vp_existing_empty_guard',
        userId: 'u1',
        workspaceId: 'ws1',
        speakerName: 'Guarded Existing',
        audioPath: '/tmp/guarded-original.wav',
        embedding: [0.11, 0.22, 0.33],
      });

      await expect(
        db.upsertVoiceProfile({
          id: 'vp_existing_empty_guard_new',
          userId: 'u1',
          workspaceId: 'ws1',
          speakerName: 'Guarded Existing',
          audioPath: '/tmp/guarded-new.wav',
          embedding: [],
        })
      ).rejects.toMatchObject({
        code: 'embedding_failed',
        stage: 'embedding',
        statusCode: 503,
      });

      const current = await db._get('SELECT * FROM voice_profiles WHERE id = ?', [
        'vp_existing_empty_guard',
      ]);
      expect(current.sample_count).toBe(1);
      expect(current.audio_path).toBe('/tmp/guarded-original.wav');
      expect(JSON.parse(current.embedding_json)).toEqual([0.11, 0.22, 0.33]);
    });

    test('updateVoiceProfileThreshold clamps value between 0.5 and 0.99', async () => {
      await db.upsertVoiceProfile({
        id: 'vp_test4',
        userId: 'u1',
        workspaceId: 'ws1',
        speakerName: 'Eve',
        audioPath: '/tmp/eve.wav',
        embedding: [0.1, 0.2, 0.3],
      });

      await db.updateVoiceProfileThreshold('vp_test4', 'ws1', 0.3);
      let result = await db._get('SELECT threshold FROM voice_profiles WHERE id = ?', ['vp_test4']);
      expect(result.threshold).toBe(0.5);

      await db.updateVoiceProfileThreshold('vp_test4', 'ws1', 1.5);
      result = await db._get('SELECT threshold FROM voice_profiles WHERE id = ?', ['vp_test4']);
      expect(result.threshold).toBe(0.99);
    });

    test('getWorkspaceVoiceProfiles returns profiles', async () => {
      const profiles = await db.getWorkspaceVoiceProfiles('ws1');
      expect(profiles.length).toBeGreaterThan(0);
    });

    test('deleteVoiceProfile removes profile', async () => {
      const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

      await db.upsertVoiceProfile({
        id: 'vp_test5',
        userId: 'u1',
        workspaceId: 'ws1',
        speakerName: 'ToDelete',
        audioPath: '/tmp/to_delete.wav',
        embedding: [0.1],
      });

      await db.deleteVoiceProfile('vp_test5', 'ws1');

      const profiles = await db.getWorkspaceVoiceProfiles('ws1');
      expect(profiles.filter((p: any) => p.id === 'vp_test5')).toHaveLength(0);

      unlinkSpy.mockRestore();
    });

    test('Regression: #0 — ignores missing voice profile files without Sentry noise', async () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const missingPath = path.join(testUploadDir, 'missing-voice-profile.wav');

      await db._execute(
        `INSERT INTO voice_profiles (id, user_id, workspace_id, speaker_name, audio_path, embedding_json, sample_count, threshold, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'vp_missing_audio',
          'u1',
          'ws1',
          'Speaker',
          missingPath,
          '[]',
          1,
          0.82,
          new Date().toISOString(),
        ]
      );

      await db.deleteVoiceProfile('vp_missing_audio', 'ws1');

      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete voice profile audio'),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('checkHealth()', () => {
    test('Regression: #0 — health-check failures stay out of Sentry noise', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      const originalSendToWorker = db._sendToWorker;

      try {
        db._sendToWorker = vi.fn().mockRejectedValue(new Error('database offline'));

        await expect(db.checkHealth()).resolves.toEqual({
          ok: false,
          status: 'database offline',
          type: 'sqlite',
        });

        expect(errorSpy).toHaveBeenCalledWith('[DB] Health check failed:', 'database offline', {
          sentry: false,
        });
      } finally {
        db._sendToWorker = originalSendToWorker;
      }
    });
  });

  describe('RAG (Retrieval-Augmented Generation)', () => {
    beforeAll(async () => {
      await db._execute(`
        CREATE TABLE IF NOT EXISTS rag_chunks (
          id TEXT PRIMARY KEY,
          workspace_id TEXT,
          recording_id TEXT,
          speaker_name TEXT,
          text TEXT,
          embedding_json TEXT,
          created_at TEXT
        )
      `);
    });

    test('saveRagChunk inserts chunk with embedding', async () => {
      const chunk = {
        id: 'rag_test1',
        workspaceId: 'ws1',
        recordingId: 'rec1',
        speakerName: 'Alice',
        text: 'Important content',
        embedding: [0.1, 0.2, 0.3],
        createdAt: new Date().toISOString(),
      };

      await db.saveRagChunk(chunk);

      const result = await db._get('SELECT * FROM rag_chunks WHERE id = ?', ['rag_test1']);
      expect(result.text).toBe('Important content');
      expect(result.speaker_name).toBe('Alice');
    });

    test('saveRagChunks inserts multiple rows in one batch', async () => {
      await db.saveRagChunks([
        {
          id: 'rag_batch_1',
          workspaceId: 'ws1',
          recordingId: 'rec1',
          speakerName: 'Alice',
          text: 'Batch chunk 1',
          embedding: [0.1, 0.2],
          createdAt: new Date().toISOString(),
        },
        {
          id: 'rag_batch_2',
          workspaceId: 'ws1',
          recordingId: 'rec1',
          speakerName: 'Bob',
          text: 'Batch chunk 2',
          embedding: [0.3, 0.4],
          createdAt: new Date().toISOString(),
        },
      ]);

      const rows = await db._query('SELECT id FROM rag_chunks WHERE id IN (?, ?) ORDER BY id ASC', [
        'rag_batch_1',
        'rag_batch_2',
      ]);
      expect(rows.map((row: any) => row.id)).toEqual(['rag_batch_1', 'rag_batch_2']);
    });

    test('getAllRagChunksForWorkspace returns all chunks for workspace', async () => {
      await db.saveRagChunk({
        id: 'rag_test2',
        workspaceId: 'ws1',
        recordingId: 'rec1',
        speakerName: 'Bob',
        text: 'Chunk 2',
        embedding: [0.2],
        createdAt: new Date().toISOString(),
      });

      const chunks = await db.getAllRagChunksForWorkspace('ws1');
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Workspace Member Role Management', () => {
    beforeAll(async () => {
      await db._execute(`
        CREATE TABLE IF NOT EXISTS workspace_members (
          workspace_id TEXT,
          user_id TEXT,
          member_role TEXT,
          joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (workspace_id, user_id)
        )
      `);
    });

    test('updateWorkspaceMemberRole updates role to valid value', async () => {
      await db._execute(
        'INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, ?, ?)',
        ['ws1', 'u1', 'member', new Date().toISOString()]
      );

      await db.updateWorkspaceMemberRole('ws1', 'u1', 'admin');

      const result = await db.getMembership('ws1', 'u1');
      expect(result.member_role).toBe('admin');
    });

    test('updateWorkspaceMemberRole clamps invalid role to member', async () => {
      await db._execute(
        'INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, ?, ?)',
        ['ws1', 'u1', 'admin', new Date().toISOString()]
      );

      await db.updateWorkspaceMemberRole('ws1', 'u1', 'invalid_role');

      const result = await db.getMembership('ws1', 'u1');
      expect(result.member_role).toBe('member');
    });
  });

  describe('Health Check', () => {
    test('getHealth returns ok status', async () => {
      const health = await db.getHealth();
      expect(health).toEqual({ ok: true });
    });
  });

  describe('Meeting Tasks', () => {
    test('updateMeetingTasks is a no-op placeholder', async () => {
      await expect(db.updateMeetingTasks({})).resolves.toBeUndefined();
    });
  });

  describe('Helper functions', () => {
    test('_generateId() creates valid IDs', () => {
      const id = db._generateId('test');
      expect(id).toMatch(/^test_[a-z0-9]+$/);
      expect(id.length).toBeGreaterThan(5);
    });

    test('_generateInviteCode() creates valid codes', () => {
      const code = db._generateInviteCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
      expect(code.length).toBeGreaterThanOrEqual(8);
    });

    test('_safeJsonParse() handles invalid JSON', () => {
      expect(db._safeJsonParse('{"valid": "json"}', {})).toEqual({ valid: 'json' });
      expect(db._safeJsonParse('invalid', { fallback: true })).toEqual({ fallback: true });
      expect(db._safeJsonParse(null, {})).toEqual({});
    });

    test('_pickProfileDraft() extracts profile fields', () => {
      const input = {
        avatarUrl: 'https://example.com/avatar.jpg',
        googleEmail: 'test@example.com',
        name: 'Test User',
        extraField: 'should be excluded',
      };

      const result = db._pickProfileDraft(input, 'test@example.com');

      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.googleEmail).toBe('test@example.com');
      expect(result.extraField).toBeUndefined();
    });

    // ----------------------------------------------------------------
    // Issue #0 - Remote audio availability checks can hang workspace sync
    // Date: 2026-06-29
    // Bug: Supabase Storage availability checks had no timeout and could
    //      block workspace state hydration or PATCH persistence indefinitely.
    // Fix: Slow availability checks resolve as unknown so state sync continues.
    // ----------------------------------------------------------------
    describe('Regression: Issue #0 - remote audio availability timeout', () => {
      test('checkRemoteAudioAvailabilityWithTimeout returns unknown for hung storage checks', async () => {
        const startedAt = Date.now();
        const result = await checkRemoteAudioAvailabilityWithTimeout(
          () => new Promise<boolean>(() => {}),
          'workspace/recording.webm',
          15
        );

        expect(result).toBeNull();
        expect(Date.now() - startedAt).toBeLessThan(250);
      });
    });
  });
});
