import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { initDatabase, getDatabase } from '../database.ts';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Database (Async Worker SQLite)', () => {
  let db: any;
  const testUploadDir = path.resolve(__dirname, 'test_uploads_db_layer');

  beforeAll(async () => {
    db = initDatabase({ dbPath: ':memory:', uploadDir: testUploadDir });
    await db.init();
  }, 60000);

  afterAll(async () => {
    if (db) {
      await db.shutdown();
    }
    if (fs.existsSync(testUploadDir)) {
      try {
        fs.rmSync(testUploadDir, { recursive: true, force: true });
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
