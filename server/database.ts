import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { logger } from './logger.ts';
import { config } from './config.ts';
import { resolveBuildMetadata } from './runtime.ts';
import { isCreatedAtExpiredByRetention } from './lib/retentionPolicy.ts';
import type { SessionPayload, WorkspaceStatePayload } from '../src/shared/contracts.ts';
import {
  STORAGE_CONTENT_TYPE,
  buildManifestStoragePath,
  buildPartStoragePath,
  buildPartTranscriptPath,
  buildSegmentedMediaManifest,
  buildSingleStoragePath,
  parseMediaManifest,
  updateManifestPartTranscription,
} from './lib/mediaStoragePolicy.ts';
import {
  UserProfile,
  UserDraft,
  MeetingUpdates,
  MediaAsset,
  AudioQualityDiagnostics,
  TranscriptionResult,
  WorkspaceState,
} from './lib/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENOSPC_MESSAGE = 'Brak miejsca na dysku serwera. Skontaktuj sie z administratorem.';
const DEFAULT_RETENTION_DAYS = 365;

function _resolveWritableUploadDir(preferredDir: string): string {
  const normalizedPreferred = path.resolve(preferredDir);
  const candidates = [
    normalizedPreferred,
    path.resolve(process.cwd(), 'server', 'data', 'uploads'),
    path.resolve(process.cwd(), '.tmp', 'uploads'),
    path.join(os.tmpdir(), 'voicelog', 'uploads'),
  ];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      const probePath = path.join(candidate, `.write-probe-${process.pid}-${Date.now()}`);
      fs.writeFileSync(probePath, '');
      fs.unlinkSync(probePath);

      if (candidate !== normalizedPreferred) {
        logger.warn(
          `[database] Preferred upload dir ${normalizedPreferred} is NOT writable. ` +
            `Falling back to: ${candidate}. WARNING: If this is an ephemeral path, files will be lost on restart.`,
          {},
          { sentry: false }
        );
      }
      return candidate;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`No writable upload directory available. Candidates: ${candidates.join(', ')}`);
}

function _cleanupOldLocalFiles(uploadDir: string): void {
  try {
    const files = fs
      .readdirSync(uploadDir)
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(uploadDir, f)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime);
    const toDelete = files.slice(0, Math.max(1, Math.floor(files.length * 0.2)));
    for (const file of toDelete) {
      try {
        fs.unlinkSync(path.join(uploadDir, file.name));
      } catch (error: any) {
        logger.warn(`[database] Failed to delete old file ${file.name}:`, error.message);
      }
    }
    logger.warn(`[database] Zwolniono miejsce: usunieto ${toDelete.length} starych plikow audio.`);
  } catch (error: any) {
    logger.warn('[database] Failed to cleanup old local files:', error.message);
  }
}

function _deleteFileIfPresent(
  filePath: string,
  warningPrefix: string,
  warningCode: string = 'FILE_DELETE_FAILED'
): void {
  if (!filePath) return;

  try {
    fs.unlinkSync(filePath);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return;
    }

    logger.warn(
      `${warningPrefix} ${filePath}:`,
      {
        message: error?.message || String(error),
        code: error?.code || warningCode,
      },
      { sentry: false }
    );
  }
}

function _normalizeRetentionDays(value: unknown, fallback = DEFAULT_RETENTION_DAYS): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.floor(numeric);
  }
  return fallback;
}

function _writeLocalAudioFile(uploadDir: string, filename: string, buffer: Buffer): string {
  fs.mkdirSync(uploadDir, { recursive: true });
  const localPath = path.join(uploadDir, filename);
  try {
    fs.writeFileSync(localPath, buffer);
    return localPath;
  } catch (err: any) {
    if (err.code === 'ENOSPC') {
      logger.warn('[database] ENOSPC przy zapisie audio — probuje zwolnic miejsce i ponowic.');
      _cleanupOldLocalFiles(uploadDir);
      try {
        fs.writeFileSync(localPath, buffer);
        return localPath;
      } catch (retryErr: any) {
        if (retryErr.code === 'ENOSPC') {
          const noSpaceErr = new Error(ENOSPC_MESSAGE);
          (noSpaceErr as any).code = 'ENOSPC';
          throw noSpaceErr;
        }
        throw retryErr;
      }
    }
    throw err;
  }
}

function _requiresPersistentAudioStorage(): boolean {
  if (process.env.VOICELOG_FORCE_PERSISTENT_AUDIO_STORAGE === 'true') {
    return true;
  }
  if (process.env.VITEST) {
    return false;
  }
  return (
    process.env.NODE_ENV === 'production' ||
    Boolean(process.env.RAILWAY_ENVIRONMENT_NAME) ||
    Boolean(process.env.RAILWAY_PROJECT_ID)
  );
}

function _buildPersistentAudioStorageError(error?: unknown): Error {
  const details =
    error instanceof Error
      ? error.message
      : error
        ? String((error as any)?.message || error)
        : 'Supabase Storage did not return a remote path.';
  const wrapped = new Error(
    `Supabase Storage is required for production audio uploads; refusing local filesystem fallback. ${details}`
  );
  (wrapped as any).code = 'SUPABASE_STORAGE_REQUIRED';
  return wrapped;
}

const WORKER_QUERY_TIMEOUT_MS = 15000;

export function isAddColumnAlreadyAppliedMigrationError(query: string, error: unknown): boolean {
  if (!/\badd\s+column\b/i.test(query)) return false;
  const message = error instanceof Error ? error.message : String((error as any)?.message || error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('duplicate column name') ||
    (normalized.includes('column') && normalized.includes('already exists'))
  );
}

export class Database {
  type: string;
  uploadDir: string;
  sessionTtlHours: number;
  pool: Pool | any;
  msgId: number;
  callbacks: Map<number, { resolve: (val: any) => void; reject: (err: Error) => void }>;
  worker: Worker | any;
  sqliteInitPromise: Promise<any>;
  private _dbPath: string;
  private _isShuttingDown: boolean;

  constructor(dbConfig: any = {}) {
    const {
      type = 'sqlite',
      dbPath = ':memory:',
      uploadDir = './uploads',
      sessionTtlHours = 24 * 30,
      connectionString,
    } = dbConfig;
    this.type = connectionString ? 'postgres' : type;
    this.uploadDir = _resolveWritableUploadDir(uploadDir);
    this.sessionTtlHours = sessionTtlHours;

    this._dbPath = dbPath;
    this._isShuttingDown = false;

    if (this.type === 'postgres') {
      this.pool = new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
      });
      console.log('[DB] Using PostgreSQL (Supabase)');
    } else {
      if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }

      this.msgId = 0;
      this.callbacks = new Map();
      this._spawnWorker(dbPath);
    }

    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async init() {
    if (this.type !== 'postgres') {
      await this.sqliteInitPromise;
    }
    await this._createSchema();
  }

  private _spawnWorker(dbPath: string) {
    this._isShuttingDown = false;
    const isTypeScriptRuntime = __filename.endsWith('.ts');
    const ext = isTypeScriptRuntime ? '.ts' : '.js';
    const compiledWorkerPath = path.resolve(__dirname, '..', 'dist-server', 'sqliteWorker.js');
    const workerPath =
      isTypeScriptRuntime && fs.existsSync(compiledWorkerPath)
        ? compiledWorkerPath
        : path.join(__dirname, `sqliteWorker${ext}`);
    this.worker =
      isTypeScriptRuntime && workerPath.endsWith('.ts')
        ? new Worker(workerPath, { execArgv: ['--import', 'tsx'] })
        : new Worker(workerPath);

    this.worker.on('message', (msg: any) => {
      const { id, result, error } = msg;
      const cb = this.callbacks.get(id);
      if (cb) {
        this.callbacks.delete(id);
        if (error) cb.reject(new Error(error));
        else cb.resolve(result);
      }
    });

    this.worker.on('error', (err: Error) => {
      console.error('SQLite Worker Error:', err);
      this._rejectAllPending('Worker error: ' + err.message);
    });

    this.worker.on('exit', (code: number) => {
      if (this._isShuttingDown) {
        this.worker = null;
        return;
      }
      if (code !== 0) {
        console.error(`[DB] SQLite Worker exited with code ${code}, restarting...`);
        this._rejectAllPending('Worker exited unexpectedly');
        this._spawnWorker(this._dbPath);
        this.sqliteInitPromise = this._sendToWorker('init', null, null, this._dbPath);
      }
    });

    this.sqliteInitPromise = this._sendToWorker('init', null, null, dbPath);
    console.log('[DB] Using local async SQLite Worker at:', dbPath);
  }

  async shutdown(): Promise<void> {
    if (this.type === 'postgres') {
      if (this.pool?.end) {
        await this.pool.end();
      }
      return;
    }

    if (!this.worker) {
      return;
    }

    this._isShuttingDown = true;
    const worker = this.worker;
    this.worker = null;
    this._rejectAllPending('Worker shut down intentionally');
    await worker.terminate();
  }

  private _rejectAllPending(reason: string) {
    for (const [, cb] of this.callbacks) {
      cb.reject(new Error(reason));
    }
    this.callbacks.clear();
  }

  _sendToWorker(
    type: string,
    sql: string | null,
    params: any[] | null = null,
    dbPath: string | null = null
  ) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      const timer = setTimeout(() => {
        this.callbacks.delete(id);
        reject(
          new Error(
            `[DB] Query timeout after ${WORKER_QUERY_TIMEOUT_MS}ms: ${type} ${String(sql || '').slice(0, 80)}`
          )
        );
      }, WORKER_QUERY_TIMEOUT_MS);
      this.callbacks.set(id, {
        resolve: (val: any) => {
          clearTimeout(timer);
          resolve(val);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
      });
      this.worker.postMessage({ id, type, sql, params, dbPath });
    });
  }

  async _query(sql: string, params: any[] = []) {
    if (this.type === 'postgres') {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      const res = await this.pool.query(pgSql, params);
      return res.rows;
    } else {
      return this._sendToWorker('query', sql, params);
    }
  }

  async _get(sql: string, params: any[] = []) {
    if (this.type === 'postgres') {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      const res = await this.pool.query(pgSql, params);
      return res.rows[0] || null;
    } else {
      const result = await this._sendToWorker('get', sql, params);
      return result || null;
    }
  }

  async _execute(sql: string, params: any[] = []) {
    if (this.type === 'postgres') {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      await this.pool.query(pgSql, params);
    } else {
      await this._sendToWorker('execute', sql, params);
    }
  }

  async checkHealth(): Promise<{ ok: boolean; status: string; type: string }> {
    try {
      if (this.type === 'postgres') {
        await this.pool.query('SELECT 1');
        return { ok: true, status: 'connected', type: 'postgres' };
      } else {
        await this._sendToWorker('query', 'SELECT 1');
        return { ok: true, status: 'ok', type: 'sqlite' };
      }
    } catch (error: any) {
      logger.error('[DB] Health check failed:', error.message, { sentry: false });
      return { ok: false, status: error.message, type: this.type };
    }
  }

  async _createSchema(): Promise<void> {
    await this._execute(`
      CREATE TABLE IF NOT EXISTS server_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const row = await this._get('SELECT version FROM server_migrations WHERE version = ?', [
        file,
      ]);
      if (!row) {
        if (logger && logger.info) logger.info(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const queries = sql
          .split(';')
          .map((q) => q.trim())
          .filter((q) => q && q.replace(/--[^\n]*/g, '').trim());
        for (const q of queries) {
          if (q.length > 0) {
            try {
              await this._execute(q);
            } catch (err: any) {
              if (isAddColumnAlreadyAppliedMigrationError(q, err)) {
                if (logger && logger.warn)
                  logger.warn(`Migration ${file} skipped already-applied ADD COLUMN query: ${q}`);
                continue;
              }
              if (logger && logger.error)
                logger.error(`Migration error in ${file} query: ${q}`, err);
              throw err;
            }
          }
        }
        await this._execute('INSERT INTO server_migrations (version, applied_at) VALUES (?, ?)', [
          file,
          new Date().toISOString(),
        ]);
      }
    }
  }

  nowIso(): string {
    return new Date().toISOString();
  }

  _buildPipelineMetadata(): Record<string, string | undefined> {
    const build = resolveBuildMetadata(process.env, '0.1.0');
    return {
      pipelineVersion: build.appVersion,
      pipelineGitSha: build.gitSha,
      pipelineBuildTime: build.buildTime,
    };
  }

  _normalizeQualityMetrics(existingMetrics: any = {}) {
    const attemptCount = Math.max(0, Number(existingMetrics?.attemptCount) || 0);
    const retryCount = Math.max(0, Number(existingMetrics?.retryCount) || 0);
    const failureCount = Math.max(0, Number(existingMetrics?.failureCount) || 0);
    const failureRate = attemptCount > 0 ? failureCount / attemptCount : 0;

    return {
      ...existingMetrics,
      attemptCount,
      retryCount,
      failureCount,
      failureRate,
    };
  }

  _mergeQualityMetrics(existingMetrics: any = {}, nextMetrics: any = {}) {
    const normalizedExisting = this._normalizeQualityMetrics(existingMetrics);
    const normalizedNext = this._normalizeQualityMetrics(nextMetrics);
    const attemptCount = Math.max(normalizedExisting.attemptCount, normalizedNext.attemptCount);
    const retryCount = Math.max(normalizedExisting.retryCount, normalizedNext.retryCount);
    const failureCount = Math.max(normalizedExisting.failureCount, normalizedNext.failureCount);

    return {
      ...normalizedExisting,
      ...normalizedNext,
      attemptCount,
      retryCount,
      failureCount,
      failureRate: attemptCount > 0 ? failureCount / attemptCount : 0,
    };
  }

  // --- Internal Utilities ---

  _safeJsonParse(raw: any, fallbackValue: any): any {
    if (!raw) return fallbackValue;
    try {
      return JSON.parse(raw);
    } catch (error: any) {
      return fallbackValue;
    }
  }

  _clean(value: any): string {
    return String(value || '').trim();
  }

  _extractRecordingTombstoneIds(calendarMeta: any = {}): Set<string> {
    const ids = new Set<string>();
    const add = (value: any) => {
      const id = String(value?.id || value?.recordingId || value || '').trim();
      if (id) ids.add(id);
    };

    if (Array.isArray(calendarMeta?.recordingTombstones)) {
      calendarMeta.recordingTombstones.forEach(add);
    }
    if (Array.isArray(calendarMeta?.deletedRecordingIds)) {
      calendarMeta.deletedRecordingIds.forEach(add);
    }

    return ids;
  }

  _extractMeetingTombstoneIds(calendarMeta: any = {}): Set<string> {
    const ids = new Set<string>();
    const add = (value: any) => {
      const id = String(value?.id || value?.meetingId || value || '').trim();
      if (id) ids.add(id);
    };

    if (Array.isArray(calendarMeta?.meetingTombstones)) {
      calendarMeta.meetingTombstones.forEach(add);
    }
    if (Array.isArray(calendarMeta?.deletedMeetingIds)) {
      calendarMeta.deletedMeetingIds.forEach(add);
    }

    return ids;
  }

  _normalizeWorkspaceMeetings(
    meetings: any[] = [],
    options: { meetingTombstoneIds?: Set<string> } = {}
  ) {
    const meetingTombstoneIds = options.meetingTombstoneIds || new Set<string>();
    const byId = new Map<string, any>();
    let changed = false;

    const updatedAtMs = (meeting: any) => {
      const raw = String(meeting?.updatedAt || meeting?.createdAt || '').trim();
      const parsed = raw ? new Date(raw).getTime() : Number.NaN;
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    };

    (Array.isArray(meetings) ? meetings : []).forEach((meeting: any) => {
      const id = String(meeting?.id || '').trim();
      if (!id || meetingTombstoneIds.has(id)) {
        changed = true;
        return;
      }

      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, meeting);
        return;
      }

      changed = true;
      const existingUpdatedAt = updatedAtMs(existing);
      const nextUpdatedAt = updatedAtMs(meeting);
      if (!Number.isFinite(existingUpdatedAt) || nextUpdatedAt >= existingUpdatedAt) {
        byId.set(id, meeting);
      }
    });

    return { meetings: [...byId.values()], changed };
  }

  _mergeRecordingTombstones(calendarMeta: any = {}, recordingIds: string[] = []) {
    const base = calendarMeta && typeof calendarMeta === 'object' ? { ...calendarMeta } : {};
    const existing = Array.isArray(base.recordingTombstones) ? base.recordingTombstones : [];
    const byId = new Map<string, any>();

    existing.forEach((item: any) => {
      const id = String(item?.id || item?.recordingId || item || '').trim();
      if (!id) return;
      byId.set(
        id,
        typeof item === 'object' && item
          ? { ...item, id }
          : { id, deletedAt: this.nowIso(), source: 'legacy' }
      );
    });

    recordingIds.forEach((recordingId) => {
      const id = String(recordingId || '').trim();
      if (!id || byId.has(id)) return;
      byId.set(id, { id, deletedAt: this.nowIso(), source: 'media-delete' });
    });

    return {
      ...base,
      recordingTombstones: [...byId.values()].sort((a, b) =>
        String(a.id).localeCompare(String(b.id))
      ),
    };
  }

  _mergeMeetingTombstones(calendarMeta: any = {}, meetingIds: string[] = []) {
    const base = calendarMeta && typeof calendarMeta === 'object' ? { ...calendarMeta } : {};
    const existing = Array.isArray(base.meetingTombstones) ? base.meetingTombstones : [];
    const byId = new Map<string, any>();

    existing.forEach((item: any) => {
      const id = String(item?.id || item?.meetingId || item || '').trim();
      if (!id) return;
      byId.set(
        id,
        typeof item === 'object' && item
          ? { ...item, id }
          : { id, deletedAt: this.nowIso(), source: 'legacy' }
      );
    });

    meetingIds.forEach((meetingId) => {
      const id = String(meetingId || '').trim();
      if (!id || byId.has(id)) return;
      byId.set(id, { id, deletedAt: this.nowIso(), source: 'meeting-delete' });
    });

    return {
      ...base,
      meetingTombstones: [...byId.values()].sort((a, b) =>
        String(a.id).localeCompare(String(b.id))
      ),
    };
  }

  _mergeCalendarMetaTombstones(currentMeta: any = {}, incomingMeta: any = {}) {
    const currentIds = [...this._extractRecordingTombstoneIds(currentMeta)];
    const incomingIds = [...this._extractRecordingTombstoneIds(incomingMeta)];
    const currentMeetingIds = [...this._extractMeetingTombstoneIds(currentMeta)];
    const incomingMeetingIds = [...this._extractMeetingTombstoneIds(incomingMeta)];
    return this._mergeMeetingTombstones(
      this._mergeRecordingTombstones(incomingMeta, [...currentIds, ...incomingIds]),
      [...currentMeetingIds, ...incomingMeetingIds]
    );
  }

  _normalizeMediaPipelineStatus(value: any): string {
    const status = String(value || '').trim();
    if (status === 'completed') return 'done';
    return status || 'queued';
  }

  _transcriptTextLength(segments: any[] = []): number {
    return segments.reduce((sum, segment) => sum + String(segment?.text || '').trim().length, 0);
  }

  _shouldRestoreTranscript(localTranscript: any, serverTranscript: any[]): boolean {
    if (!Array.isArray(serverTranscript) || serverTranscript.length === 0) return false;
    const local = Array.isArray(localTranscript) ? localTranscript : [];
    if (local.length === 0) return true;
    if (serverTranscript.length > local.length) return true;
    return this._transcriptTextLength(serverTranscript) > this._transcriptTextLength(local);
  }

  _hasMeaningfulTranscript(recording: any = {}): boolean {
    return (
      this._transcriptTextLength(Array.isArray(recording?.transcript) ? recording.transcript : []) >
      0
    );
  }

  _isCompletedRecording(recording: any = {}): boolean {
    const status = this._normalizeMediaPipelineStatus(
      recording?.pipelineStatus || recording?.transcriptionStatus || recording?.status
    );
    return status === 'done';
  }

  _mergeRecordingAntiDegradation(currentRecording: any = {}, incomingRecording: any = {}) {
    if (!currentRecording || typeof currentRecording !== 'object') return incomingRecording;
    if (!incomingRecording || typeof incomingRecording !== 'object') return currentRecording;

    const currentHasTranscript = this._hasMeaningfulTranscript(currentRecording);
    const incomingHasTranscript = this._hasMeaningfulTranscript(incomingRecording);
    const shouldPreserveCurrentTranscript =
      currentHasTranscript &&
      (!incomingHasTranscript ||
        this._transcriptTextLength(currentRecording.transcript) >
          this._transcriptTextLength(incomingRecording.transcript));

    if (!shouldPreserveCurrentTranscript) {
      return incomingRecording;
    }

    return {
      ...incomingRecording,
      transcript: currentRecording.transcript,
      transcriptOutcome: currentRecording.transcriptOutcome || incomingRecording.transcriptOutcome,
      analysis: currentRecording.analysis || incomingRecording.analysis,
      aiDebrief: currentRecording.aiDebrief || incomingRecording.aiDebrief,
      reviewSummary: currentRecording.reviewSummary || incomingRecording.reviewSummary,
      speakerNames: currentRecording.speakerNames || incomingRecording.speakerNames,
      speakerCount: currentRecording.speakerCount || incomingRecording.speakerCount,
      diarizationConfidence:
        currentRecording.diarizationConfidence || incomingRecording.diarizationConfidence,
      audioQuality: currentRecording.audioQuality || incomingRecording.audioQuality,
      transcriptionDiagnostics:
        currentRecording.transcriptionDiagnostics || incomingRecording.transcriptionDiagnostics,
      duration: currentRecording.duration || incomingRecording.duration,
      pipelineStatus: currentRecording.pipelineStatus || incomingRecording.pipelineStatus,
      transcriptionStatus:
        currentRecording.transcriptionStatus || incomingRecording.transcriptionStatus,
    };
  }

  _mergeMeetingsAntiRecordingDegradation(
    currentMeetings: any[] = [],
    incomingMeetings: any[] = [],
    tombstoneIds: Set<string> = new Set<string>()
  ) {
    const currentById = new Map(
      (Array.isArray(currentMeetings) ? currentMeetings : [])
        .filter((meeting: any) => meeting?.id)
        .map((meeting: any) => [String(meeting.id), meeting])
    );

    return (Array.isArray(incomingMeetings) ? incomingMeetings : []).map((incomingMeeting: any) => {
      const currentMeeting = currentById.get(String(incomingMeeting?.id || ''));
      if (!currentMeeting) return incomingMeeting;

      const currentRecordings = Array.isArray(currentMeeting.recordings)
        ? currentMeeting.recordings
        : [];
      const incomingRecordings = Array.isArray(incomingMeeting.recordings)
        ? incomingMeeting.recordings
        : [];
      const currentRecordingById = new Map<string, any>(
        currentRecordings
          .filter((recording: any) => recording?.id || recording?.recordingId)
          .map((recording: any) => [String(recording.id || recording.recordingId), recording])
      );

      const nextRecordings = incomingRecordings.map((incomingRecording: any) => {
        const recordingId = String(incomingRecording?.id || incomingRecording?.recordingId || '');
        if (!recordingId || tombstoneIds.has(recordingId)) return incomingRecording;
        return this._mergeRecordingAntiDegradation(
          currentRecordingById.get(recordingId),
          incomingRecording
        );
      });

      const latestRecordingId = String(incomingMeeting.latestRecordingId || '').trim();
      if (
        latestRecordingId &&
        !tombstoneIds.has(latestRecordingId) &&
        !nextRecordings.some(
          (recording: any) =>
            String(recording?.id || recording?.recordingId || '').trim() === latestRecordingId
        )
      ) {
        const currentLatest = currentRecordingById.get(latestRecordingId);
        if (currentLatest && this._hasMeaningfulTranscript(currentLatest)) {
          nextRecordings.unshift({
            ...currentLatest,
            audioAvailable: false,
            audioUnavailable: true,
            audioUnavailableReason:
              currentLatest.audioUnavailableReason || 'audio_source_unavailable',
          });
        }
      }

      return {
        ...incomingMeeting,
        recordings: nextRecordings,
      };
    });
  }

  _deriveAudioExtensions(rawPath: string = '', contentType: string = ''): string[] {
    const candidates = new Set<string>();
    const ext = path.extname(String(rawPath || '').trim());
    if (ext) candidates.add(ext);
    const lowerType = String(contentType || '').toLowerCase();
    if (lowerType.includes('webm')) candidates.add('.webm');
    if (lowerType.includes('mpeg') || lowerType.includes('mp3')) candidates.add('.mp3');
    if (lowerType.includes('wav')) candidates.add('.wav');
    if (lowerType.includes('ogg')) candidates.add('.ogg');
    if (lowerType.includes('mp4') || lowerType.includes('m4a')) candidates.add('.m4a');
    if (!candidates.size) candidates.add('.webm');
    return [...candidates];
  }

  _remoteAudioStorageCandidates(recordingId: string, asset: any = {}): string[] {
    const rawPath = String(asset?.file_path || '').trim();
    if (!rawPath) return [];

    const candidates = new Set<string>();
    const leafName = rawPath.split(/[\\/]/).filter(Boolean).pop() || '';
    const looksLocal =
      fs.existsSync(rawPath) || path.isAbsolute(rawPath) || /^[a-zA-Z]:[\\/]/.test(rawPath);
    if (rawPath && !rawPath.includes('\\') && !looksLocal) {
      candidates.add(rawPath);
    }
    if (leafName) {
      candidates.add(leafName);
    }

    const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    for (const extension of this._deriveAudioExtensions(rawPath, asset?.content_type)) {
      candidates.add(`${safeRecordingId}${extension}`);
    }
    return [...candidates];
  }

  async _isMediaAssetAudioAvailable(recordingId: string, asset: any = {}): Promise<boolean | null> {
    const rawPath = String(asset?.file_path || '').trim();
    if (!rawPath) return false;

    const manifest = parseMediaManifest(asset?.media_manifest_json);
    if (manifest?.parts?.length) {
      if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) return null;
      try {
        const { audioExistsInStorage } = await import('./lib/supabaseStorage.js');
        for (const part of manifest.parts) {
          if (!(await audioExistsInStorage(part.path))) {
            return false;
          }
        }
        return true;
      } catch (error) {
        logger.warn(
          '[database] Unable to verify segmented media asset audio availability.',
          {
            recordingId,
            error: error instanceof Error ? error.message : String(error),
          },
          { sentry: false }
        );
        return null;
      }
    }

    if ((rawPath.includes('/') || rawPath.includes('\\')) && fs.existsSync(rawPath)) {
      return true;
    }

    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
      return null;
    }

    try {
      const { audioExistsInStorage } = await import('./lib/supabaseStorage.js');
      for (const storagePath of this._remoteAudioStorageCandidates(recordingId, asset)) {
        if (await audioExistsInStorage(storagePath)) {
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.warn(
        '[database] Unable to verify media asset audio availability.',
        {
          recordingId,
          error: error instanceof Error ? error.message : String(error),
        },
        { sentry: false }
      );
      return null;
    }
  }

  _enrichRecordingFromMediaAsset(
    recording: any = {},
    asset: any = {},
    options: { audioAvailable?: boolean | null } = {}
  ) {
    const diarization = this._safeJsonParse(asset?.diarization_json, {});
    const transcript = this._safeJsonParse(asset?.transcript_json, []);
    const next: any = {
      ...recording,
      id: String(recording?.id || recording?.recordingId || asset?.id || '').trim(),
    };
    if (recording?.recordingId) {
      next.recordingId = String(recording.recordingId).trim();
    }
    const pipelineStatus = this._normalizeMediaPipelineStatus(asset?.transcription_status);
    const currentStatus = String(recording?.pipelineStatus || recording?.transcriptionStatus || '');
    const authoritativeStatus = ['done', 'failed'].includes(pipelineStatus) || !currentStatus;

    if (pipelineStatus && authoritativeStatus) {
      next.pipelineStatus = pipelineStatus;
      next.transcriptionStatus = pipelineStatus;
    }
    if (this._shouldRestoreTranscript(next.transcript, transcript)) {
      next.transcript = transcript;
    }
    if (diarization && typeof diarization === 'object') {
      if (diarization.speakerNames && typeof diarization.speakerNames === 'object') {
        next.speakerNames = { ...(next.speakerNames || {}), ...diarization.speakerNames };
      }
      if (Number.isFinite(Number(diarization.speakerCount))) {
        next.speakerCount = Number(diarization.speakerCount);
      } else if (Array.isArray(next.transcript)) {
        next.speakerCount = new Set(
          next.transcript.map((segment: any) => String(segment?.speakerId || '')).filter(Boolean)
        ).size;
      }
      if (Number.isFinite(Number(diarization.confidence))) {
        next.diarizationConfidence = Number(diarization.confidence);
      }
      if (diarization.transcriptOutcome) {
        next.transcriptOutcome = String(diarization.transcriptOutcome);
      }
      if (diarization.reviewSummary) {
        next.reviewSummary = diarization.reviewSummary;
      }
      if (diarization.audioQuality) {
        next.audioQuality = diarization.audioQuality;
      }
      if (diarization.qualityMetrics) {
        next.qualityMetrics = diarization.qualityMetrics;
      }
    }

    if (options.audioAvailable === false) {
      next.audioAvailable = false;
      next.audioUnavailable = true;
      next.audioUnavailableReason = 'audio_source_unavailable';
    } else if (options.audioAvailable === true) {
      next.audioAvailable = true;
      next.audioUnavailable = false;
      delete next.audioUnavailableReason;
    }

    return next;
  }

  _normalizeEmail(email: any): string {
    return this._clean(email).toLowerCase();
  }

  _isValidEmail(email: any): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
  }

  _normalizeWorkspaceCode(code: any): string {
    return this._clean(code).replace(/\s+/g, '').toUpperCase();
  }

  _generateId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  _generateInviteCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  _hashPassword(secret: any, salt: string = crypto.randomBytes(16).toString('hex')): string {
    const derived = crypto.scryptSync(String(secret || ''), salt, 64).toString('hex');
    return `${salt}:${derived}`;
  }

  _verifyPassword(secret: any, storedHash: any): boolean {
    const [salt, expected] = String(storedHash || '').split(':');
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(String(secret || ''), salt, 64).toString('hex');

    // Fix: timingSafeEqual throws TypeError if lengths mismatch
    const actualBuf = Buffer.from(actual, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (actualBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  }

  _hashRecoveryCode(code: any): string {
    return crypto
      .createHash('sha256')
      .update(String(code || ''))
      .digest('hex');
  }

  _pickProfileDraft(draft: any = {}, email: string = ''): UserProfile {
    return {
      role: this._clean(draft.role),
      company: this._clean(draft.company),
      timezone: this._clean(draft.timezone) || 'Europe/Warsaw',
      googleEmail: this._clean(draft.googleEmail) || this._normalizeEmail(email),
      phone: this._clean(draft.phone),
      location: this._clean(draft.location),
      team: this._clean(draft.team),
      bio: this._clean(draft.bio),
      avatarUrl: this._clean(draft.avatarUrl),
      preferredInsights: Array.isArray(draft.preferredInsights)
        ? draft.preferredInsights.filter(Boolean)
        : String(draft.preferredInsights || '')
            .split(/\r?\n|,/)
            .map((item: any) => item.trim())
            .filter(Boolean),
      notifyDailyDigest: Boolean(draft.notifyDailyDigest ?? true),
      autoTaskCapture: Boolean(draft.autoTaskCapture ?? true),
      preferredTaskView: draft.preferredTaskView === 'kanban' ? 'kanban' : 'list',
    };
  }

  _buildUserFromRow(row: any): any {
    const profile = this._safeJsonParse(row.profile_json, {});
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      provider: row.provider,
      googleSub: row.google_sub,
      googleEmail: row.google_email || profile.googleEmail || row.email,
      role: profile.role || '',
      company: profile.company || '',
      timezone: profile.timezone || 'Europe/Warsaw',
      phone: profile.phone || '',
      location: profile.location || '',
      team: profile.team || '',
      bio: profile.bio || '',
      avatarUrl: profile.avatarUrl || '',
      preferredInsights: Array.isArray(profile.preferredInsights) ? profile.preferredInsights : [],
      notifyDailyDigest: Boolean(profile.notifyDailyDigest ?? true),
      autoTaskCapture: Boolean(profile.autoTaskCapture ?? true),
      preferredTaskView: profile.preferredTaskView === 'kanban' ? 'kanban' : 'list',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async _buildWorkspaceFromRow(row: any, currentUserId: string = ''): Promise<any> {
    const members = await this._query(
      'SELECT user_id, member_role FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC',
      [row.id]
    );

    const memberIds = members.map((item) => item.user_id);
    const memberRoles = members.reduce((result, item) => {
      result[item.user_id] = item.member_role;
      return result;
    }, {});
    const currentMember = currentUserId
      ? members.find((item) => item.user_id === currentUserId)
      : null;

    return {
      id: row.id,
      name: row.name,
      ownerUserId: row.owner_user_id,
      inviteCode: row.invite_code,
      memberIds,
      memberRoles,
      memberRole: currentMember?.member_role || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // --- Public Methods ---

  async workspaceMembers(workspaceId: string): Promise<any[]> {
    const rows = await this._query(
      `
        SELECT users.*, workspace_members.member_role AS workspace_member_role
        FROM workspace_members
        JOIN users ON users.id = workspace_members.user_id
        WHERE workspace_members.workspace_id = ?
        ORDER BY LOWER(users.name) ASC
      `,
      [workspaceId]
    );
    return rows.map((row) => this._buildUserFromRow(row));
  }

  async workspaceIdsForUser(userId: string): Promise<string[]> {
    const rows = await this._query(
      'SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY joined_at ASC',
      [userId]
    );
    return rows.map((row) => row.workspace_id);
  }

  async accessibleWorkspaces(userId: string): Promise<any[]> {
    const rows = await this._query(
      `
        SELECT workspaces.*
        FROM workspace_members
        JOIN workspaces ON workspaces.id = workspace_members.workspace_id
        WHERE workspace_members.user_id = ?
        ORDER BY workspaces.updated_at DESC
      `,
      [userId]
    );
    return Promise.all(rows.map((row) => this._buildWorkspaceFromRow(row, userId)));
  }

  async ensureWorkspaceState(workspaceId: string): Promise<void> {
    try {
      await this._execute(
        "ALTER TABLE workspace_state ADD COLUMN manual_people_json TEXT NOT NULL DEFAULT '[]'"
      );
    } catch (error) {
      if (
        !isAddColumnAlreadyAppliedMigrationError('ALTER TABLE workspace_state ADD COLUMN', error)
      ) {
        throw error;
      }
    }
    try {
      await this._execute(
        `ALTER TABLE workspace_state ADD COLUMN retention_days INTEGER NOT NULL DEFAULT ${DEFAULT_RETENTION_DAYS}`
      );
    } catch (error) {
      if (
        !isAddColumnAlreadyAppliedMigrationError('ALTER TABLE workspace_state ADD COLUMN', error)
      ) {
        throw error;
      }
    }

    const existing = await this._get(
      'SELECT workspace_id FROM workspace_state WHERE workspace_id = ?',
      [workspaceId]
    );
    if (existing) return;

    const timestamp = this.nowIso();
    await this._execute(
      `
        INSERT INTO workspace_state (
          workspace_id,
          meetings_json,
          manual_tasks_json,
          manual_people_json,
          task_state_json,
          task_boards_json,
          calendar_meta_json,
          vocabulary_json,
          retention_days,
          updated_at
        )
        VALUES (?, '[]', '[]', '[]', '{}', '{}', '{}', '[]', ?, ?)
      `,
      [workspaceId, DEFAULT_RETENTION_DAYS, timestamp]
    );
  }

  async _reconcileWorkspaceMeetingRecordings(
    workspaceId: string,
    meetings: any[] = [],
    options: { tombstoneIds?: Set<string> } = {}
  ) {
    const safeMeetings = Array.isArray(meetings) ? meetings : [];
    const tombstoneIds = options.tombstoneIds || new Set<string>();
    const recordingIdsForMeeting = (meeting: any) => {
      const ids = new Set<string>();
      const latestRecordingId = String(meeting?.latestRecordingId || '').trim();
      if (latestRecordingId) ids.add(latestRecordingId);
      (Array.isArray(meeting?.recordings) ? meeting.recordings : []).forEach((recording: any) => {
        const id = String(recording?.id || recording?.recordingId || '').trim();
        if (id) ids.add(id);
      });
      return [...ids];
    };
    const recordingIds = [
      ...new Set(
        safeMeetings.flatMap((meeting: any) => recordingIdsForMeeting(meeting).filter(Boolean))
      ),
    ];

    if (!recordingIds.length) {
      return { meetings: safeMeetings, changed: false };
    }

    const candidateIds = recordingIds.filter((id) => !tombstoneIds.has(id));
    const candidatePlaceholders = candidateIds.map(() => '?').join(', ');
    const rows = candidateIds.length
      ? await this._query(
          `SELECT * FROM media_assets WHERE workspace_id = ? AND id IN (${candidatePlaceholders})`,
          [workspaceId, ...candidateIds]
        )
      : [];
    const assetsById = new Map(
      rows
        .map((row: any) => [String(row?.id || '').trim(), row])
        .filter(([id]: [string, any]) => Boolean(id))
    );
    const audioAvailabilityById = new Map<string, boolean | null>();
    await Promise.all(
      rows.map(async (row: any) => {
        const id = String(row?.id || '').trim();
        if (!id) return;
        audioAvailabilityById.set(id, await this._isMediaAssetAudioAvailable(id, row));
      })
    );

    let changed = false;
    const nextMeetings = safeMeetings.map((meeting: any) => {
      const currentLatestRecordingId = String(meeting?.latestRecordingId || '').trim();
      const recordings = Array.isArray(meeting?.recordings) ? meeting.recordings : [];
      let candidateRecordings = recordings;

      if (!candidateRecordings.length && currentLatestRecordingId) {
        candidateRecordings =
          !tombstoneIds.has(currentLatestRecordingId) && assetsById.has(currentLatestRecordingId)
            ? [{ id: currentLatestRecordingId }]
            : [];
      }

      const filteredRecordings = candidateRecordings.filter((recording: any) => {
        const recordingId = String(recording?.id || recording?.recordingId || '').trim();
        return (
          Boolean(recordingId) &&
          !tombstoneIds.has(recordingId) &&
          (assetsById.has(recordingId) ||
            (this._isCompletedRecording(recording) && this._hasMeaningfulTranscript(recording)))
        );
      });
      const reconciledRecordings = filteredRecordings.map((recording: any) => {
        const recordingId = String(recording?.id || recording?.recordingId || '').trim();
        const asset = assetsById.get(recordingId);
        if (!asset) {
          const preserved = {
            ...recording,
            audioAvailable: false,
            audioUnavailable: true,
            audioUnavailableReason: recording.audioUnavailableReason || 'audio_source_unavailable',
          };
          if (JSON.stringify(preserved) !== JSON.stringify(recording)) {
            changed = true;
          }
          return preserved;
        }
        const enriched = this._enrichRecordingFromMediaAsset(recording, asset, {
          audioAvailable: audioAvailabilityById.get(recordingId),
        });
        if (JSON.stringify(enriched) !== JSON.stringify(recording)) {
          changed = true;
        }
        return enriched;
      });
      const nextLatestRecordingId =
        currentLatestRecordingId &&
        reconciledRecordings.some(
          (recording: any) =>
            String(recording?.id || recording?.recordingId || '').trim() ===
            currentLatestRecordingId
        )
          ? currentLatestRecordingId
          : String(
              reconciledRecordings[0]?.id || reconciledRecordings[0]?.recordingId || ''
            ).trim();

      if (
        candidateRecordings === recordings &&
        filteredRecordings.length === recordings.length &&
        currentLatestRecordingId === nextLatestRecordingId &&
        reconciledRecordings.every((recording: any, index: number) => {
          return JSON.stringify(recording) === JSON.stringify(recordings[index]);
        })
      ) {
        return meeting;
      }

      changed = true;
      return {
        ...meeting,
        recordings: reconciledRecordings,
        latestRecordingId: nextLatestRecordingId || null,
      };
    });

    return { meetings: nextMeetings, changed };
  }

  async getWorkspaceState(workspaceId: string): Promise<WorkspaceState> {
    let row = await this._get('SELECT * FROM workspace_state WHERE workspace_id = ?', [
      workspaceId,
    ]);
    if (!row) {
      await this.ensureWorkspaceState(workspaceId);
      row = await this._get('SELECT * FROM workspace_state WHERE workspace_id = ?', [workspaceId]);
    }
    const calendarMeta = this._safeJsonParse(row.calendar_meta_json, {});
    const normalizedMeetings = this._normalizeWorkspaceMeetings(
      this._safeJsonParse(row.meetings_json, []),
      {
        meetingTombstoneIds: this._extractMeetingTombstoneIds(calendarMeta),
      }
    );
    const tombstoneIds = this._extractRecordingTombstoneIds(calendarMeta);
    const reconciled = await this._reconcileWorkspaceMeetingRecordings(
      workspaceId,
      normalizedMeetings.meetings,
      {
        tombstoneIds,
      }
    );

    if (normalizedMeetings.changed || reconciled.changed) {
      const timestamp = this.nowIso();
      await this._execute(
        'UPDATE workspace_state SET meetings_json = ?, updated_at = ? WHERE workspace_id = ?',
        [JSON.stringify(reconciled.meetings), timestamp, workspaceId]
      );
      row.updated_at = timestamp;
    }

    return {
      meetings: reconciled.meetings,
      manualTasks: this._safeJsonParse(row.manual_tasks_json, []),
      manualPeople: this._safeJsonParse(row.manual_people_json, []),
      taskState: this._safeJsonParse(row.task_state_json, {}),
      taskBoards: this._safeJsonParse(row.task_boards_json, {}),
      calendarMeta,
      vocabulary: this._safeJsonParse(row.vocabulary_json, []),
      retentionDays: _normalizeRetentionDays(row.retention_days),
      updatedAt: row.updated_at,
    };
  }

  async saveWorkspaceState(
    workspaceId: string,
    payload: WorkspaceStatePayload = {
      meetings: [],
      manualTasks: [],
      manualPeople: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      retentionDays: DEFAULT_RETENTION_DAYS,
    }
  ): Promise<WorkspaceState> {
    await this.ensureWorkspaceState(workspaceId);
    const currentRow = await this._get('SELECT * FROM workspace_state WHERE workspace_id = ?', [
      workspaceId,
    ]);
    const existingMeetings = this._normalizeWorkspaceMeetings(
      this._safeJsonParse(currentRow?.meetings_json, []),
      {
        meetingTombstoneIds: this._extractMeetingTombstoneIds(
          this._safeJsonParse(currentRow?.calendar_meta_json, {})
        ),
      }
    ).meetings;
    const calendarMeta = this._mergeCalendarMetaTombstones(
      this._safeJsonParse(currentRow?.calendar_meta_json, {}),
      payload.calendarMeta && typeof payload.calendarMeta === 'object' ? payload.calendarMeta : {}
    );
    const tombstoneIds = this._extractRecordingTombstoneIds(calendarMeta);
    const antiDegradedMeetings = this._mergeMeetingsAntiRecordingDegradation(
      existingMeetings,
      Array.isArray(payload.meetings) ? payload.meetings : [],
      tombstoneIds
    );
    const normalizedMeetings = this._normalizeWorkspaceMeetings(antiDegradedMeetings, {
      meetingTombstoneIds: this._extractMeetingTombstoneIds(calendarMeta),
    });
    const reconciled = await this._reconcileWorkspaceMeetingRecordings(
      workspaceId,
      normalizedMeetings.meetings,
      { tombstoneIds }
    );
    const timestamp = this.nowIso();
    await this._execute(
      `
        UPDATE workspace_state
        SET meetings_json = ?,
            manual_tasks_json = ?,
            manual_people_json = ?,
            task_state_json = ?,
            task_boards_json = ?,
            calendar_meta_json = ?,
            vocabulary_json = ?,
            retention_days = ?,
            updated_at = ?
        WHERE workspace_id = ?
      `,
      [
        JSON.stringify(reconciled.meetings),
        JSON.stringify(Array.isArray(payload.manualTasks) ? payload.manualTasks : []),
        JSON.stringify(
          Array.isArray((payload as any).manualPeople) ? (payload as any).manualPeople : []
        ),
        JSON.stringify(
          payload.taskState && typeof payload.taskState === 'object' ? payload.taskState : {}
        ),
        JSON.stringify(
          payload.taskBoards && typeof payload.taskBoards === 'object' ? payload.taskBoards : {}
        ),
        JSON.stringify(calendarMeta),
        JSON.stringify(Array.isArray(payload.vocabulary) ? payload.vocabulary : []),
        _normalizeRetentionDays((payload as any).retentionDays, currentRow?.retention_days),
        timestamp,
        workspaceId,
      ]
    );

    await this._execute('UPDATE workspaces SET updated_at = ? WHERE id = ?', [
      timestamp,
      workspaceId,
    ]);
    return this.getWorkspaceState(workspaceId);
  }

  async tombstoneWorkspaceRecording(workspaceId: string, recordingId: string): Promise<void> {
    const safeRecordingId = String(recordingId || '').trim();
    if (!workspaceId || !safeRecordingId) return;

    await this.ensureWorkspaceState(workspaceId);
    const row = await this._get('SELECT * FROM workspace_state WHERE workspace_id = ?', [
      workspaceId,
    ]);
    const calendarMeta = this._mergeRecordingTombstones(
      this._safeJsonParse(row?.calendar_meta_json, {}),
      [safeRecordingId]
    );
    const reconciled = await this._reconcileWorkspaceMeetingRecordings(
      workspaceId,
      this._safeJsonParse(row?.meetings_json, []),
      { tombstoneIds: this._extractRecordingTombstoneIds(calendarMeta) }
    );
    const timestamp = this.nowIso();

    await this._execute(
      'UPDATE workspace_state SET meetings_json = ?, calendar_meta_json = ?, updated_at = ? WHERE workspace_id = ?',
      [JSON.stringify(reconciled.meetings), JSON.stringify(calendarMeta), timestamp, workspaceId]
    );
  }

  async createSession(
    userId: string,
    workspaceId: string
  ): Promise<{ token: string; expiresAt: string }> {
    const timestamp = this.nowIso();
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000).toISOString();
    const token = crypto.randomBytes(48).toString('hex');

    await this._execute('DELETE FROM sessions WHERE expires_at <= ?', [timestamp]);
    await this._execute(
      `
        INSERT INTO sessions (token, user_id, workspace_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      [token, userId, workspaceId, timestamp, expiresAt]
    );

    return { token, expiresAt };
  }

  async getSession(token: string): Promise<any> {
    const row = await this._get('SELECT * FROM sessions WHERE token = ?', [token]);
    if (!row) return null;

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this._execute('DELETE FROM sessions WHERE token = ?', [token]);
      return null;
    }

    return row;
  }

  async getMembership(workspaceId: string, userId: string): Promise<any> {
    return this._get('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [
      workspaceId,
      userId,
    ]);
  }

  async selectWorkspaceForUser(userId: string, preferredWorkspaceId: string = ''): Promise<string> {
    const workspaceIds = await this.workspaceIdsForUser(userId);
    if (!workspaceIds.length) return '';
    if (preferredWorkspaceId && workspaceIds.includes(preferredWorkspaceId)) {
      return preferredWorkspaceId;
    }
    return workspaceIds[0];
  }

  async buildSessionPayload(userId: string, workspaceId: string): Promise<SessionPayload> {
    const [userRow, nextWorkspaceId] = await Promise.all([
      this._get('SELECT * FROM users WHERE id = ?', [userId]),
      this.selectWorkspaceForUser(userId, workspaceId),
    ]);
    if (!userRow || !nextWorkspaceId) {
      throw new Error('Unable to build session payload.');
    }

    const [users, workspaces, state] = await Promise.all([
      this.workspaceMembers(nextWorkspaceId),
      this.accessibleWorkspaces(userId),
      this.getWorkspaceState(nextWorkspaceId),
    ]);

    return {
      user: this._buildUserFromRow(userRow),
      users,
      workspaces,
      workspaceId: nextWorkspaceId,
      state,
    };
  }

  async registerUser(draft: UserDraft): Promise<any> {
    const errorWithStatus = (msg: string, code = 400) => {
      const e = new Error(msg);
      (e as any).statusCode = code;
      return e;
    };
    const email = this._normalizeEmail(draft.email);
    const password = String(draft.password || '');
    const name = this._clean(draft.name);
    const workspaceMode = draft.workspaceMode === 'join' ? 'join' : 'create';
    const inviteCode = this._normalizeWorkspaceCode(draft.workspaceCode);
    const requestedWorkspaceName = this._clean(draft.workspaceName);

    if (!email || !password || !name) throw errorWithStatus('Uzupelnij imie, email i haslo.');
    if (!this._isValidEmail(email)) throw errorWithStatus('Podaj poprawny adres email.');
    if (password.length < 6) throw errorWithStatus('Haslo musi miec przynajmniej 6 znakow.');

    const existingUser = await this._get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) throw errorWithStatus('Konto z takim adresem juz istnieje.', 409);

    const timestamp = this.nowIso();
    const userId = this._generateId('user');
    let workspaceId = '';
    let memberRole = 'member';

    await this._execute('BEGIN');
    try {
      await this._execute(
        `
          INSERT INTO users (
            id, email, password_hash, name, provider, google_sub, google_email,
            recovery_code_hash, recovery_code_expires_at, profile_json, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 'local', '', ?, '', '', ?, ?, ?)
        `,
        [
          userId,
          email,
          this._hashPassword(password),
          name,
          email,
          JSON.stringify(this._pickProfileDraft(draft, email)),
          timestamp,
          timestamp,
        ]
      );

      if (workspaceMode === 'join') {
        if (!inviteCode) throw errorWithStatus('Podaj kod workspace, aby dolaczyc.', 400);
        const workspace = await this._get('SELECT * FROM workspaces WHERE invite_code = ?', [
          inviteCode,
        ]);
        if (!workspace) throw errorWithStatus('Nie znaleziono workspace o takim kodzie.', 404);

        workspaceId = workspace.id;
        await this._execute(
          "INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'member', ?)",
          [workspaceId, userId, timestamp]
        );
      } else {
        workspaceId = this._generateId('workspace');
        memberRole = 'owner';
        await this._execute(
          'INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            workspaceId,
            requestedWorkspaceName || `${name} workspace`,
            userId,
            this._generateInviteCode(),
            timestamp,
            timestamp,
          ]
        );
        await this._execute(
          "INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)",
          [workspaceId, userId, timestamp]
        );
        await this.ensureWorkspaceState(workspaceId);
      }

      if (workspaceMode === 'join') await this.ensureWorkspaceState(workspaceId);
      await this._execute('COMMIT');
    } catch (error) {
      await this._execute('ROLLBACK');
      throw error;
    }

    const session = await this.createSession(userId, workspaceId);
    const payload: any = await this.buildSessionPayload(userId, workspaceId);
    payload.user.workspaceMemberRole =
      memberRole || (await this.getMembership(workspaceId, userId))?.member_role || 'member';
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }

  async loginUser(draft: UserDraft): Promise<any> {
    const errorWithStatus = (msg: string, code = 401) => {
      const e = new Error(msg);
      (e as any).statusCode = code;
      return e;
    };
    const email = this._normalizeEmail(draft.email);
    const password = String(draft.password || '');
    const preferredWorkspaceId = this._clean(draft.workspaceId);
    if (!email || !password) throw errorWithStatus('Uzupelnij email i haslo.', 400);
    const row = await this._get('SELECT * FROM users WHERE email = ?', [email]);

    if (row && !row.password_hash) {
      throw errorWithStatus('To konto korzysta z logowania Google. Uzyj przycisku Google.', 400);
    }

    if (!row || !row.password_hash || !this._verifyPassword(password, row.password_hash)) {
      throw errorWithStatus('Niepoprawny email lub haslo.', 401);
    }

    const workspaceId = await this.selectWorkspaceForUser(row.id, preferredWorkspaceId);
    if (!workspaceId)
      throw errorWithStatus('To konto nie jest jeszcze przypiete do zadnego workspace.', 403);
    if (preferredWorkspaceId && workspaceId !== preferredWorkspaceId) {
      throw errorWithStatus('Nie masz dostepu do wybranego workspace.', 403);
    }

    const [session, payload] = await Promise.all([
      this.createSession(row.id, workspaceId),
      this.buildSessionPayload(row.id, workspaceId),
    ]);
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }

  async requestPasswordReset(draft: { email: string }): Promise<any> {
    const email = this._normalizeEmail(draft.email);
    const genericExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const row = await this._get('SELECT * FROM users WHERE email = ?', [email]);
    if (!row || !row.password_hash) return { expiresAt: genericExpiresAt };

    const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = genericExpiresAt;
    await this._execute(
      'UPDATE users SET recovery_code_hash = ?, recovery_code_expires_at = ?, updated_at = ? WHERE id = ?',
      [this._hashRecoveryCode(recoveryCode), expiresAt, this.nowIso(), row.id]
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset requested for ${email} (expires ${expiresAt})`);
    }
    return { expiresAt };
  }

  async resetPasswordWithCode(draft: {
    email: string;
    code: string;
    newPassword?: string;
    confirmPassword?: string;
  }): Promise<any> {
    const email = this._normalizeEmail(draft.email);
    const code = this._clean(draft.code);
    const newPassword = String(draft.newPassword || '');
    const confirmPassword = String(draft.confirmPassword || '');
    const row = await this._get('SELECT * FROM users WHERE email = ?', [email]);

    if (!row) throw new Error('Nie znaleziono konta z takim adresem.');
    if (!code || !newPassword || !confirmPassword)
      throw new Error('Uzupelnij email, kod i oba pola hasla.');
    if (newPassword.length < 6) throw new Error('Nowe haslo musi miec przynajmniej 6 znakow.');
    if (newPassword !== confirmPassword) throw new Error('Nowe hasla nie sa identyczne.');
    if (!row.recovery_code_hash || !row.recovery_code_expires_at)
      throw new Error('Najpierw popros o kod resetu.');
    if (new Date(row.recovery_code_expires_at).getTime() <= Date.now())
      throw new Error('Kod resetu wygasl. Wygeneruj nowy.');
    if (this._hashRecoveryCode(code) !== row.recovery_code_hash)
      throw new Error('Kod resetu jest niepoprawny.');

    await this._execute(
      "UPDATE users SET password_hash = ?, recovery_code_hash = '', recovery_code_expires_at = '', updated_at = ? WHERE id = ?",
      [this._hashPassword(newPassword), this.nowIso(), row.id]
    );
    return { success: true };
  }

  async upsertGoogleUser(profile: UserDraft): Promise<any> {
    const email = this._normalizeEmail(profile.email);
    if (!email) throw new Error('Brakuje adresu email z Google.');

    const timestamp = this.nowIso();
    let row = await this._get('SELECT * FROM users WHERE email = ? OR google_sub = ?', [
      email,
      this._clean(profile.sub),
    ]);
    let workspaceId = '';

    await this._execute('BEGIN');
    try {
      if (row) {
        const currentProfile = this._safeJsonParse(row.profile_json, {});
        const nextProfile = {
          ...currentProfile,
          avatarUrl: this._clean(profile.picture) || currentProfile.avatarUrl || '',
          googleEmail: email,
        };
        await this._execute(
          "UPDATE users SET email = ?, name = ?, provider = 'google', google_sub = ?, google_email = ?, profile_json = ?, updated_at = ? WHERE id = ?",
          [
            email,
            this._clean(profile.name) || row.name,
            this._clean(profile.sub),
            email,
            JSON.stringify(nextProfile),
            timestamp,
            row.id,
          ]
        );
        workspaceId = await this.selectWorkspaceForUser(row.id);
      } else {
        const userId = this._generateId('user');
        workspaceId = this._generateId('workspace');
        await this._execute(
          `
          INSERT INTO users (
            id, email, password_hash, name, provider, google_sub, google_email,
            recovery_code_hash, recovery_code_expires_at, profile_json, created_at, updated_at
          )
          VALUES (?, ?, NULL, ?, 'google', ?, ?, '', '', ?, ?, ?)`,
          [
            userId,
            email,
            this._clean(profile.name) || this._clean(profile.given_name) || 'Google user',
            this._clean(profile.sub),
            email,
            JSON.stringify(
              this._pickProfileDraft(
                { avatarUrl: this._clean(profile.picture), googleEmail: email },
                email
              )
            ),
            timestamp,
            timestamp,
          ]
        );
        await this._execute(
          'INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            workspaceId,
            `${this._clean(profile.given_name) || this._clean(profile.name) || 'Google'} workspace`,
            userId,
            this._generateInviteCode(),
            timestamp,
            timestamp,
          ]
        );
        await this._execute(
          "INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)",
          [workspaceId, userId, timestamp]
        );
        await this.ensureWorkspaceState(workspaceId);
        row = await this._get('SELECT * FROM users WHERE id = ?', [userId]);
      }
      await this._execute('COMMIT');
    } catch (error) {
      await this._execute('ROLLBACK');
      throw error;
    }

    const actualUserId =
      row?.id || (await this._get('SELECT id FROM users WHERE email = ?', [email]))?.id;
    const actualWorkspaceId = workspaceId || (await this.selectWorkspaceForUser(actualUserId));
    const [session, payload] = await Promise.all([
      this.createSession(actualUserId, actualWorkspaceId),
      this.buildSessionPayload(actualUserId, actualWorkspaceId),
    ]);
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }

  async updateUserProfile(userId: string, updates: Partial<UserDraft> = {}): Promise<any> {
    const row = await this._get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!row) throw new Error('Nie znaleziono konta.');

    const currentProfile = this._safeJsonParse(row.profile_json, {});
    const nextProfile = {
      ...currentProfile,
      ...this._pickProfileDraft({ ...currentProfile, ...updates }, row.email),
    };
    const nextName = this._clean(updates.name) || row.name;

    await this._execute(
      'UPDATE users SET name = ?, google_email = ?, profile_json = ?, updated_at = ? WHERE id = ?',
      [
        nextName,
        nextProfile.googleEmail || row.google_email || row.email,
        JSON.stringify(nextProfile),
        this.nowIso(),
        userId,
      ]
    );

    return this._buildUserFromRow(await this._get('SELECT * FROM users WHERE id = ?', [userId]));
  }

  async changeUserPassword(userId: string, draft: any): Promise<any> {
    const row = await this._get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!row) throw new Error('Nie znaleziono konta.');
    if (!row.password_hash) throw new Error('Haslem tego konta zarzadza Google.');

    const currentPassword = String(draft.currentPassword || '');
    const newPassword = String(draft.newPassword || '');
    const confirmPassword = String(draft.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword)
      throw new Error('Uzupelnij wszystkie pola hasla.');
    if (newPassword.length < 6) throw new Error('Nowe haslo musi miec przynajmniej 6 znakow.');
    if (newPassword !== confirmPassword) throw new Error('Nowe hasla nie sa identyczne.');
    if (!this._verifyPassword(currentPassword, row.password_hash))
      throw new Error('Aktualne haslo jest niepoprawne.');

    await this._execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      this._hashPassword(newPassword),
      this.nowIso(),
      userId,
    ]);
    return { success: true };
  }

  async upsertMediaAsset({
    recordingId,
    workspaceId,
    meetingId = '',
    contentType,
    buffer,
    createdByUserId,
  }: any): Promise<MediaAsset | null> {
    const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeRecordingId) throw new Error('Nieprawidłowy identyfikator nagrania.');
    const baseMime = String(contentType || '')
      .toLowerCase()
      .split(';')[0]
      .trim();
    const extension =
      {
        'audio/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/mp4': '.m4a',
        'audio/wav': '.wav',
        'audio/ogg': '.ogg',
        'audio/flac': '.flac',
        'audio/x-m4a': '.m4a',
        'audio/mp3': '.mp3',
      }[baseMime] || '.webm';

    let storagePath: string;
    const requirePersistentStorage = _requiresPersistentAudioStorage();

    // Try Supabase Storage first, fall back to local fs
    try {
      const { uploadAudioToStorage } = await import('./lib/supabaseStorage.js');
      const result = await uploadAudioToStorage(safeRecordingId, buffer, contentType, extension);
      if (result) {
        storagePath = result;
      } else if (requirePersistentStorage) {
        throw _buildPersistentAudioStorageError();
      } else {
        // Supabase not configured — save locally
        storagePath = _writeLocalAudioFile(
          this.uploadDir,
          `${safeRecordingId}${extension}`,
          buffer
        );
      }
    } catch (err: any) {
      if ((err as any).code === 'ENOSPC' || String(err.message).includes('Brak miejsca na dysku')) {
        throw err;
      }
      logger.warn(
        requirePersistentStorage
          ? '[database] Supabase upload failed in production; local fallback is blocked:'
          : '[database] Supabase upload failed, falling back to local:',
        {
          message: err.message,
        },
        { sentry: false }
      );
      if (requirePersistentStorage) {
        throw _buildPersistentAudioStorageError(err);
      }
      storagePath = _writeLocalAudioFile(this.uploadDir, `${safeRecordingId}${extension}`, buffer);
    }

    const existing = await this._get('SELECT id FROM media_assets WHERE id = ?', [recordingId]);
    const timestamp = this.nowIso();

    if (existing) {
      await this._execute(
        `UPDATE media_assets
         SET workspace_id = ?, meeting_id = ?, file_path = ?, content_type = ?, size_bytes = ?,
             storage_mode = 'single', media_manifest_json = '{}', source_size_bytes = ?,
             normalized_size_bytes = ?, updated_at = ?
         WHERE id = ?`,
        [
          workspaceId,
          meetingId,
          storagePath,
          contentType,
          buffer.byteLength,
          buffer.byteLength,
          buffer.byteLength,
          timestamp,
          recordingId,
        ]
      );
    } else {
      await this._execute(
        `
        INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, storage_mode, media_manifest_json, source_size_bytes, normalized_size_bytes,
          transcription_status, transcript_json, diarization_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'single', '{}', ?, ?, 'queued', '[]', '{}', ?, ?)`,
        [
          recordingId,
          workspaceId,
          meetingId,
          createdByUserId,
          storagePath,
          contentType || 'application/octet-stream',
          buffer.byteLength,
          buffer.byteLength,
          buffer.byteLength,
          timestamp,
          timestamp,
        ]
      );
    }
    return this.getMediaAsset(recordingId);
  }

  async upsertMediaAssetFromPath({
    recordingId,
    workspaceId,
    meetingId = '',
    contentType,
    filePath,
    createdByUserId,
  }: any): Promise<MediaAsset | null> {
    const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeRecordingId) throw new Error('Nieprawidlowy identyfikator nagrania.');
    if (!filePath || !fs.existsSync(filePath)) throw new Error('Plik zrodlowy nie istnieje.');

    const baseMime = String(contentType || '')
      .toLowerCase()
      .split(';')[0]
      .trim();
    const extension =
      {
        'audio/webm': '.webm',
        'audio/mpeg': '.mp3',
        'audio/mp4': '.m4a',
        'audio/wav': '.wav',
        'audio/ogg': '.ogg',
        'audio/flac': '.flac',
        'audio/x-m4a': '.m4a',
        'audio/mp3': '.mp3',
      }[baseMime] || '.webm';
    const fileStats = await fs.promises.stat(filePath);
    let storagePath: string;
    const requirePersistentStorage = _requiresPersistentAudioStorage();

    try {
      const { uploadAudioFileToStorage } = await import('./lib/supabaseStorage.js');
      const result = await uploadAudioFileToStorage(
        safeRecordingId,
        filePath,
        contentType,
        extension
      );
      if (result) {
        storagePath = result;
      } else if (requirePersistentStorage) {
        throw _buildPersistentAudioStorageError();
      } else {
        fs.mkdirSync(this.uploadDir, { recursive: true });
        storagePath = path.join(this.uploadDir, `${safeRecordingId}${extension}`);
        if (path.resolve(storagePath) !== path.resolve(filePath)) {
          await fs.promises.copyFile(filePath, storagePath);
        }
      }
    } catch (err: any) {
      if ((err as any).code === 'ENOSPC' || String(err.message).includes('Brak miejsca na dysku')) {
        throw err;
      }
      logger.warn(
        requirePersistentStorage
          ? '[database] Supabase upload from path failed in production; local fallback is blocked:'
          : '[database] Supabase upload from path failed, falling back to local:',
        {
          message: err.message,
        },
        { sentry: false }
      );
      if (requirePersistentStorage) {
        throw _buildPersistentAudioStorageError(err);
      }
      fs.mkdirSync(this.uploadDir, { recursive: true });
      storagePath = path.join(this.uploadDir, `${safeRecordingId}${extension}`);
      if (path.resolve(storagePath) !== path.resolve(filePath)) {
        await fs.promises.copyFile(filePath, storagePath);
      }
    }

    const existing = await this._get('SELECT id FROM media_assets WHERE id = ?', [recordingId]);
    const timestamp = this.nowIso();

    if (existing) {
      await this._execute(
        `UPDATE media_assets
         SET workspace_id = ?, meeting_id = ?, file_path = ?, content_type = ?, size_bytes = ?,
             storage_mode = 'single', media_manifest_json = '{}', source_size_bytes = ?,
             normalized_size_bytes = ?, updated_at = ?
         WHERE id = ?`,
        [
          workspaceId,
          meetingId,
          storagePath,
          contentType,
          fileStats.size,
          fileStats.size,
          fileStats.size,
          timestamp,
          recordingId,
        ]
      );
    } else {
      await this._execute(
        `
        INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, storage_mode, media_manifest_json, source_size_bytes, normalized_size_bytes,
          transcription_status, transcript_json, diarization_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'single', '{}', ?, ?, 'queued', '[]', '{}', ?, ?)`,
        [
          recordingId,
          workspaceId,
          meetingId,
          createdByUserId,
          storagePath,
          contentType || 'application/octet-stream',
          fileStats.size,
          fileStats.size,
          fileStats.size,
          timestamp,
          timestamp,
        ]
      );
    }

    return this.getMediaAsset(recordingId);
  }

  async upsertMediaAssetFromPreparedAudio({
    recordingId,
    workspaceId,
    meetingId = '',
    normalizedFilePath,
    sourceSizeBytes = 0,
    normalizedSizeBytes = 0,
    durationMs = 0,
    parts = [],
    createdByUserId,
  }: any): Promise<MediaAsset | null> {
    const safeRecordingId = String(recordingId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!safeRecordingId) throw new Error('Nieprawidlowy identyfikator nagrania.');
    if (!normalizedFilePath || !fs.existsSync(normalizedFilePath)) {
      throw new Error('Znormalizowany plik audio nie istnieje.');
    }

    const timestamp = this.nowIso();
    const requirePersistentStorage = _requiresPersistentAudioStorage();
    const normalizedStats = await fs.promises.stat(normalizedFilePath);
    const effectiveNormalizedSize = Number(normalizedSizeBytes || normalizedStats.size);
    const storageMode = Array.isArray(parts) && parts.length > 0 ? 'segmented' : 'single';
    let storagePath = '';
    let manifestJson = '{}';

    try {
      const { uploadAudioFileToStoragePath, uploadBufferToStoragePath } =
        await import('./lib/supabaseStorage.js');

      if (storageMode === 'single') {
        const targetPath = buildSingleStoragePath(workspaceId, recordingId);
        const uploadedPath = await uploadAudioFileToStoragePath(
          targetPath,
          normalizedFilePath,
          STORAGE_CONTENT_TYPE
        );
        if (uploadedPath) {
          storagePath = uploadedPath;
        } else if (requirePersistentStorage) {
          throw _buildPersistentAudioStorageError();
        }
      } else {
        const uploadedParts = [];
        for (const part of parts) {
          const partPath = buildPartStoragePath(workspaceId, recordingId, part.index);
          const uploadedPath = await uploadAudioFileToStoragePath(
            partPath,
            part.localPath,
            STORAGE_CONTENT_TYPE
          );
          if (!uploadedPath) {
            if (requirePersistentStorage) throw _buildPersistentAudioStorageError();
            break;
          }
          uploadedParts.push({ ...part, path: uploadedPath, contentType: STORAGE_CONTENT_TYPE });
        }

        if (uploadedParts.length === parts.length) {
          const manifest = buildSegmentedMediaManifest({
            recordingId,
            workspaceId,
            sourceSizeBytes: Number(sourceSizeBytes || 0),
            normalizedSizeBytes: effectiveNormalizedSize,
            durationMs: Number(durationMs || 0),
            parts: uploadedParts,
          });
          const manifestPath = buildManifestStoragePath(workspaceId, recordingId);
          const uploadedManifestPath = await uploadBufferToStoragePath(
            manifestPath,
            Buffer.from(JSON.stringify(manifest)),
            'application/json'
          );
          storagePath = uploadedManifestPath || manifestPath;
          manifestJson = JSON.stringify(manifest);
        } else if (requirePersistentStorage) {
          throw _buildPersistentAudioStorageError();
        }
      }
    } catch (err: any) {
      if ((err as any).code === 'ENOSPC' || String(err.message).includes('Brak miejsca na dysku')) {
        throw err;
      }
      logger.warn(
        requirePersistentStorage
          ? '[database] Prepared audio upload failed in production; local fallback is blocked:'
          : '[database] Prepared audio upload failed, falling back to local:',
        { message: err.message },
        { sentry: false }
      );
      if (requirePersistentStorage) {
        throw _buildPersistentAudioStorageError(err);
      }
    }

    if (!storagePath) {
      const localDir = path.join(this.uploadDir, safeRecordingId);
      fs.mkdirSync(localDir, { recursive: true });
      if (storageMode === 'single') {
        storagePath = path.join(localDir, 'audio.webm');
        if (path.resolve(storagePath) !== path.resolve(normalizedFilePath)) {
          await fs.promises.copyFile(normalizedFilePath, storagePath);
        }
      } else {
        const localManifestParts = [];
        for (const part of parts) {
          const localPartPath = path.join(
            localDir,
            `part-${String(part.index).padStart(3, '0')}.webm`
          );
          await fs.promises.copyFile(part.localPath, localPartPath);
          localManifestParts.push({
            ...part,
            path: localPartPath,
            contentType: STORAGE_CONTENT_TYPE,
          });
        }
        const manifest = buildSegmentedMediaManifest({
          recordingId,
          workspaceId,
          sourceSizeBytes: Number(sourceSizeBytes || 0),
          normalizedSizeBytes: effectiveNormalizedSize,
          durationMs: Number(durationMs || 0),
          parts: localManifestParts,
        });
        storagePath = path.join(localDir, 'manifest.json');
        manifestJson = JSON.stringify(manifest);
        await fs.promises.writeFile(storagePath, manifestJson);
      }
    }

    const existing = await this._get('SELECT id FROM media_assets WHERE id = ?', [recordingId]);
    const params = [
      workspaceId,
      meetingId,
      storagePath,
      STORAGE_CONTENT_TYPE,
      effectiveNormalizedSize,
      storageMode,
      manifestJson,
      Number(sourceSizeBytes || 0),
      effectiveNormalizedSize,
      timestamp,
      recordingId,
    ];

    if (existing) {
      await this._execute(
        `UPDATE media_assets
         SET workspace_id = ?, meeting_id = ?, file_path = ?, content_type = ?, size_bytes = ?,
             storage_mode = ?, media_manifest_json = ?, source_size_bytes = ?,
             normalized_size_bytes = ?, updated_at = ?
         WHERE id = ?`,
        params
      );
    } else {
      await this._execute(
        `
        INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, storage_mode, media_manifest_json, source_size_bytes,
          normalized_size_bytes, transcription_status, transcript_json, diarization_json,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', '[]', '{}', ?, ?)`,
        [
          recordingId,
          workspaceId,
          meetingId,
          createdByUserId,
          storagePath,
          STORAGE_CONTENT_TYPE,
          effectiveNormalizedSize,
          storageMode,
          manifestJson,
          Number(sourceSizeBytes || 0),
          effectiveNormalizedSize,
          timestamp,
          timestamp,
        ]
      );
    }

    return this.getMediaAsset(recordingId);
  }

  async getMediaAsset(recordingId: string): Promise<MediaAsset | null> {
    return this._get('SELECT * FROM media_assets WHERE id = ?', [
      recordingId,
    ]) as Promise<MediaAsset | null>;
  }

  async writeAuditLog({
    workspaceId,
    actorUserId = '',
    action,
    entityType,
    entityId,
    metadata = {},
  }: {
    workspaceId: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this._execute(
      `INSERT INTO audit_logs (
        id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        workspaceId,
        actorUserId,
        action,
        entityType,
        entityId,
        JSON.stringify(metadata || {}),
        this.nowIso(),
      ]
    );
  }

  async deleteMediaAsset(
    recordingId: string,
    workspaceId: string,
    options: { actorUserId?: string; source?: string } = {}
  ): Promise<void> {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset || asset.workspace_id !== workspaceId) return;

    const manifest = parseMediaManifest(asset.media_manifest_json);
    const transcript = this._safeJsonParse(asset.transcript_json, []);
    const ragCountRow = await this._get(
      'SELECT COUNT(*) AS count FROM rag_chunks WHERE workspace_id = ? AND recording_id = ?',
      [workspaceId, recordingId]
    );
    const ragChunksDeleted = Number(ragCountRow?.count || 0);
    const transcriptPayloadCount = Array.isArray(manifest?.parts)
      ? manifest.parts.filter((part) => String(part?.transcription?.payloadPath || '').trim())
          .length
      : 0;

    if (manifest?.parts?.length) {
      const manifestPaths = manifest.parts
        .flatMap((part) => [part.path, part.transcription?.payloadPath])
        .filter(Boolean);
      const remotePaths = [...manifestPaths, asset.file_path].filter((filePath) => {
        const rawPath = String(filePath || '').trim();
        return rawPath && !fs.existsSync(rawPath) && !path.isAbsolute(rawPath);
      });
      const localPaths = [...manifestPaths, asset.file_path].filter((filePath) => {
        const rawPath = String(filePath || '').trim();
        return rawPath && fs.existsSync(rawPath);
      });

      if (remotePaths.length) {
        const { deleteAudioPathsFromStorage } = await import('./lib/supabaseStorage.js');
        await deleteAudioPathsFromStorage(remotePaths);
      }
      for (const localPath of localPaths) {
        _deleteFileIfPresent(localPath, '[database] Failed to delete segmented audio file');
        if (fs.existsSync(localPath)) {
          fs.rmSync(localPath, { force: true });
        }
      }
      const localManifestPath = String(asset.file_path || '').trim();
      if (localManifestPath && fs.existsSync(localManifestPath)) {
        fs.rmSync(localManifestPath, { force: true });
      }
    } else if (asset.file_path) {
      const rawPath = String(asset.file_path || '').trim();
      const isRemoteStoragePath =
        rawPath &&
        !fs.existsSync(rawPath) &&
        !path.isAbsolute(rawPath) &&
        !/^[a-zA-Z]:[\\/]/.test(rawPath);
      if (isRemoteStoragePath) {
        const { deleteAudioFromStorage } = await import('./lib/supabaseStorage.js');
        await deleteAudioFromStorage(rawPath);
      } else {
        _deleteFileIfPresent(rawPath, '[database] Failed to delete legacy audio file');
      }
    }

    await this._execute('DELETE FROM rag_chunks WHERE workspace_id = ? AND recording_id = ?', [
      workspaceId,
      recordingId,
    ]);
    await this._execute('DELETE FROM media_assets WHERE id = ? AND workspace_id = ?', [
      recordingId,
      workspaceId,
    ]);
    await this.writeAuditLog({
      workspaceId,
      actorUserId: String(options.actorUserId || asset.created_by_user_id || ''),
      action: 'recording.deleted',
      entityType: 'recording',
      entityId: recordingId,
      metadata: {
        meetingId: String(asset.meeting_id || ''),
        storageMode: String(asset.storage_mode || 'single'),
        sizeBytes: Number(asset.size_bytes || 0),
        ragChunksDeleted,
        transcriptPayloadCount,
        hadTranscript: Array.isArray(transcript) ? transcript.length > 0 : Boolean(transcript),
        source: String(options.source || 'manual'),
      },
    });
    await this.tombstoneWorkspaceRecording(workspaceId, recordingId);
  }

  async cleanupExpiredRecordingsByRetention({
    nowIso = this.nowIso(),
    actorUserId = 'system',
    source = 'retention-maintenance',
    workspaceId = '',
  }: {
    nowIso?: string;
    actorUserId?: string;
    source?: string;
    workspaceId?: string;
  } = {}): Promise<{
    checked: number;
    deleted: number;
    deletedRecordingIds: string[];
  }> {
    const workspaceFilter = String(workspaceId || '').trim();
    const rows = await this._query(
      `SELECT
         media_assets.id,
         media_assets.workspace_id,
         media_assets.created_at,
         workspace_state.retention_days
       FROM media_assets
       JOIN workspace_state ON workspace_state.workspace_id = media_assets.workspace_id
       WHERE workspace_state.retention_days > 0
         ${workspaceFilter ? 'AND media_assets.workspace_id = ?' : ''}`,
      workspaceFilter ? [workspaceFilter] : []
    );
    const nowMs = new Date(nowIso).getTime();
    if (!Number.isFinite(nowMs)) {
      return { checked: rows.length, deleted: 0, deletedRecordingIds: [] };
    }

    let deleted = 0;
    const deletedRecordingIds: string[] = [];
    for (const row of rows) {
      const retentionDays = _normalizeRetentionDays(row.retention_days, 0);
      if (retentionDays <= 0) continue;
      if (
        !isCreatedAtExpiredByRetention({
          createdAt: row.created_at,
          nowIso,
          retentionDays,
        })
      ) {
        continue;
      }

      await this.deleteMediaAsset(row.id, row.workspace_id, { actorUserId, source });
      deleted++;
      deletedRecordingIds.push(row.id);
    }

    if (workspaceFilter || deleted > 0) {
      await this.writeAuditLog({
        workspaceId: workspaceFilter || 'all',
        actorUserId,
        action: 'retention.cleanup.completed',
        entityType: 'workspace',
        entityId: workspaceFilter || 'all',
        metadata: {
          source,
          nowIso,
          checked: rows.length,
          deleted,
          deletedRecordingIds,
        },
      });
    }

    return { checked: rows.length, deleted, deletedRecordingIds };
  }

  async exportWorkspaceData(
    workspaceId: string,
    options: { actorUserId?: string; source?: string } = {}
  ): Promise<any> {
    const safeWorkspaceId = String(workspaceId || '').trim();
    if (!safeWorkspaceId) throw new Error('Brakuje workspaceId.');

    const exportedAt = this.nowIso();
    const [workspace, members, state, mediaAssets, ragChunks, auditLogs, transcriptionJobs] =
      await Promise.all([
        this._get('SELECT * FROM workspaces WHERE id = ?', [safeWorkspaceId]),
        this._query(
          `SELECT workspace_members.workspace_id, workspace_members.user_id,
                  workspace_members.member_role, workspace_members.joined_at,
                  users.email, users.name
           FROM workspace_members
           LEFT JOIN users ON users.id = workspace_members.user_id
           WHERE workspace_members.workspace_id = ?
           ORDER BY workspace_members.joined_at ASC`,
          [safeWorkspaceId]
        ),
        this.getWorkspaceState(safeWorkspaceId),
        this._query(`SELECT * FROM media_assets WHERE workspace_id = ? ORDER BY created_at ASC`, [
          safeWorkspaceId,
        ]),
        this._query(
          `SELECT id, workspace_id, recording_id, speaker_name, text, embedding_json, created_at
           FROM rag_chunks WHERE workspace_id = ? ORDER BY created_at ASC`,
          [safeWorkspaceId]
        ),
        this._query(`SELECT * FROM audit_logs WHERE workspace_id = ? ORDER BY created_at ASC`, [
          safeWorkspaceId,
        ]),
        this._query(
          `SELECT * FROM transcription_jobs WHERE workspace_id = ? ORDER BY created_at ASC`,
          [safeWorkspaceId]
        ),
      ]);

    const payload = {
      schemaVersion: 'workspace-export-v1',
      exportedAt,
      workspace: {
        id: safeWorkspaceId,
        name: String(workspace?.name || ''),
        ownerUserId: String(workspace?.owner_user_id || ''),
        createdAt: String(workspace?.created_at || ''),
        updatedAt: String(workspace?.updated_at || ''),
        retentionDays: state.retentionDays,
      },
      members: members.map((member: any) => ({
        userId: String(member.user_id || ''),
        role: String(member.member_role || ''),
        joinedAt: String(member.joined_at || ''),
        email: String(member.email || ''),
        name: String(member.name || ''),
      })),
      state,
      mediaAssets: mediaAssets.map((asset: any) => ({
        id: String(asset.id || ''),
        meetingId: String(asset.meeting_id || ''),
        createdByUserId: String(asset.created_by_user_id || ''),
        filePath: String(asset.file_path || ''),
        contentType: String(asset.content_type || ''),
        sizeBytes: Number(asset.size_bytes || 0),
        storageMode: String(asset.storage_mode || 'single'),
        mediaManifest: this._safeJsonParse(asset.media_manifest_json, {}),
        transcriptionStatus: String(asset.transcription_status || ''),
        transcript: this._safeJsonParse(asset.transcript_json, []),
        diarization: this._safeJsonParse(asset.diarization_json, {}),
        createdAt: String(asset.created_at || ''),
        updatedAt: String(asset.updated_at || ''),
      })),
      ragChunks: ragChunks.map((chunk: any) => ({
        id: String(chunk.id || ''),
        recordingId: String(chunk.recording_id || ''),
        speakerName: String(chunk.speaker_name || ''),
        text: String(chunk.text || ''),
        embedding: this._safeJsonParse(chunk.embedding_json, []),
        createdAt: String(chunk.created_at || ''),
      })),
      operational: {
        auditLogs: auditLogs.map((entry: any) => ({
          id: String(entry.id || ''),
          actorUserId: String(entry.actor_user_id || ''),
          action: String(entry.action || ''),
          entityType: String(entry.entity_type || ''),
          entityId: String(entry.entity_id || ''),
          metadata: this._safeJsonParse(entry.metadata_json, {}),
          createdAt: String(entry.created_at || ''),
        })),
        transcriptionJobs: transcriptionJobs.map((job: any) => ({
          id: String(job.id || ''),
          recordingId: String(job.recording_id || ''),
          meetingId: String(job.meeting_id || ''),
          status: String(job.status || ''),
          attemptCount: Number(job.attempt_count || 0),
          maxAttempts: Number(job.max_attempts || 0),
          nextRunAt: String(job.next_run_at || ''),
          lastErrorCode: String(job.last_error_code || ''),
          lastErrorMessage: String(job.last_error_message || ''),
          createdAt: String(job.created_at || ''),
          updatedAt: String(job.updated_at || ''),
          completedAt: String(job.completed_at || ''),
        })),
      },
    };

    await this.writeAuditLog({
      workspaceId: safeWorkspaceId,
      actorUserId: String(options.actorUserId || ''),
      action: 'workspace.export.generated',
      entityType: 'workspace',
      entityId: safeWorkspaceId,
      metadata: {
        source: String(options.source || 'api'),
        exportedAt,
        mediaAssetCount: payload.mediaAssets.length,
        ragChunkCount: payload.ragChunks.length,
      },
    });

    return payload;
  }

  async saveAudioQualityDiagnostics(
    recordingId: string,
    audioQuality: AudioQualityDiagnostics | null
  ) {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset) return null;
    const diarization = this._safeJsonParse(asset.diarization_json, {});
    const nextPayload =
      audioQuality && typeof audioQuality === 'object'
        ? {
            ...diarization,
            audioQuality,
          }
        : { ...diarization };
    await this._execute(
      'UPDATE media_assets SET diarization_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(nextPayload), this.nowIso(), recordingId]
    );
    return this.getMediaAsset(recordingId);
  }

  async saveMediaManifest(recordingId: string, manifest: any): Promise<MediaAsset | null> {
    await this._execute(
      'UPDATE media_assets SET media_manifest_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(manifest || {}), this.nowIso(), recordingId]
    );
    return this.getMediaAsset(recordingId);
  }

  async markMediaPartTranscription(
    recordingId: string,
    partIndex: number,
    patch: Record<string, any> = {}
  ): Promise<any | null> {
    const asset = await this.getMediaAsset(recordingId);
    const manifest = parseMediaManifest(asset?.media_manifest_json);
    if (!manifest) return null;
    const nextManifest = updateManifestPartTranscription(manifest, partIndex, patch as any);
    await this.saveMediaManifest(recordingId, nextManifest);
    return nextManifest;
  }

  async saveMediaPartTranscript(
    recordingId: string,
    partIndex: number,
    payload: any,
    checkpoint: Record<string, any> = {}
  ): Promise<any | null> {
    const asset = await this.getMediaAsset(recordingId);
    const manifest = parseMediaManifest(asset?.media_manifest_json);
    if (!asset || !manifest) return null;

    const payloadBuffer = Buffer.from(JSON.stringify(payload || {}));
    let payloadPath = buildPartTranscriptPath(
      manifest.workspaceId,
      manifest.recordingId,
      partIndex
    );
    const manifestPath = String(asset.file_path || '').trim();
    const isRemoteManifest =
      manifestPath && !fs.existsSync(manifestPath) && !path.isAbsolute(manifestPath);

    if (isRemoteManifest) {
      const { uploadBufferToStoragePath } = await import('./lib/supabaseStorage.js');
      payloadPath =
        (await uploadBufferToStoragePath(payloadPath, payloadBuffer, 'application/json')) ||
        payloadPath;
    } else {
      const baseDir =
        manifestPath && fs.existsSync(manifestPath)
          ? path.dirname(manifestPath)
          : path.join(this.uploadDir, 'media', recordingId);
      const localDir = path.join(baseDir, 'transcripts');
      await fs.promises.mkdir(localDir, { recursive: true });
      payloadPath = path.join(localDir, `part-${String(partIndex).padStart(3, '0')}.json`);
      await fs.promises.writeFile(payloadPath, payloadBuffer);
    }

    const segments = Array.isArray(payload?.segments) ? payload.segments : [];
    const textLength = segments.reduce(
      (sum: number, segment: any) => sum + String(segment?.text || '').length,
      0
    );
    return this.markMediaPartTranscription(recordingId, partIndex, {
      ...checkpoint,
      status: checkpoint.status || 'completed',
      payloadPath,
      segmentCount:
        typeof checkpoint.segmentCount === 'number' ? checkpoint.segmentCount : segments.length,
      textLength: typeof checkpoint.textLength === 'number' ? checkpoint.textLength : textLength,
      completedAt: checkpoint.completedAt || this.nowIso(),
    });
  }

  async loadMediaPartTranscript(recordingId: string, partIndex: number): Promise<any | null> {
    const asset = await this.getMediaAsset(recordingId);
    const manifest = parseMediaManifest(asset?.media_manifest_json);
    const part = manifest?.parts?.find((item) => item.index === partIndex);
    const payloadPath = String(part?.transcription?.payloadPath || '').trim();
    if (!payloadPath) return null;

    try {
      if (fs.existsSync(payloadPath)) {
        return JSON.parse(await fs.promises.readFile(payloadPath, 'utf8'));
      }
      const { downloadAudioFromStorage } = await import('./lib/supabaseStorage.js');
      const arrayBuffer = await downloadAudioFromStorage(payloadPath);
      return JSON.parse(Buffer.from(arrayBuffer).toString('utf8'));
    } catch {
      return null;
    }
  }

  async updateTranscriptionMetadata(recordingId: string, updates: Record<string, unknown> = {}) {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset) return null;
    const diarization = this._safeJsonParse(asset.diarization_json, {});
    await this._execute(
      'UPDATE media_assets SET diarization_json = ?, updated_at = ? WHERE id = ?',
      [
        JSON.stringify({
          ...diarization,
          ...updates,
        }),
        this.nowIso(),
        recordingId,
      ]
    );
    return this.getMediaAsset(recordingId);
  }

  async markTranscriptionProcessing(recordingId) {
    const existing = await this.getMediaAsset(recordingId);
    const existingDiarization = this._safeJsonParse(existing?.diarization_json, {});
    const existingQualityMetrics = this._normalizeQualityMetrics(
      existingDiarization?.qualityMetrics || {}
    );
    const nextQualityMetrics = this._mergeQualityMetrics(existingQualityMetrics, {
      attemptCount: existingQualityMetrics.attemptCount + 1,
      retryCount:
        existingQualityMetrics.attemptCount > 0
          ? existingQualityMetrics.retryCount + 1
          : existingQualityMetrics.retryCount,
    });
    await this._execute(
      "UPDATE media_assets SET transcription_status = 'processing', diarization_json = ?, updated_at = ? WHERE id = ?",
      [
        JSON.stringify({
          ...existingDiarization,
          qualityMetrics: nextQualityMetrics,
        }),
        this.nowIso(),
        recordingId,
      ]
    );
    const job = await this.getTranscriptionJobByRecordingId(recordingId);
    if (job && ['queued', 'retryable_failed'].includes(String(job.status))) {
      await this._execute(
        "UPDATE transcription_jobs SET status = 'running', updated_at = ? WHERE id = ?",
        [this.nowIso(), job.id]
      );
    }
    return this.getMediaAsset(recordingId);
  }

  async saveTranscriptionResult(
    recordingId: string,
    result: TranscriptionResult = {}
  ): Promise<MediaAsset | null> {
    const existing = await this.getMediaAsset(recordingId);
    const existingDiarization = this._safeJsonParse(existing?.diarization_json, {});
    const defaultPipelineMetadata = this._buildPipelineMetadata();
    const pipelineMetadata = {
      pipelineVersion: result.pipelineVersion || defaultPipelineMetadata.pipelineVersion,
      pipelineGitSha: result.pipelineGitSha || defaultPipelineMetadata.pipelineGitSha,
      pipelineBuildTime: result.pipelineBuildTime || defaultPipelineMetadata.pipelineBuildTime,
    };
    const qualityMetrics = this._mergeQualityMetrics(
      existingDiarization?.qualityMetrics || {},
      result.qualityMetrics || {}
    );
    const diarizationPayload =
      result.diarization && typeof result.diarization === 'object'
        ? {
            ...result.diarization,
            enhancementsPending: Boolean(result.enhancementsPending),
            postprocessStage: result.postprocessStage || '',
            reviewSummary: result.reviewSummary || null,
            transcriptOutcome: result.transcriptOutcome || 'normal',
            emptyReason: result.emptyReason || '',
            userMessage: result.userMessage || '',
            audioQuality: result.audioQuality || existingDiarization.audioQuality || null,
            transcriptionDiagnostics: result.transcriptionDiagnostics || null,
            qualityMetrics,
            ...pipelineMetadata,
          }
        : {
            enhancementsPending: Boolean(result.enhancementsPending),
            postprocessStage: result.postprocessStage || '',
            reviewSummary: result.reviewSummary || null,
            transcriptOutcome: result.transcriptOutcome || 'normal',
            emptyReason: result.emptyReason || '',
            userMessage: result.userMessage || '',
            audioQuality: result.audioQuality || existingDiarization.audioQuality || null,
            transcriptionDiagnostics: result.transcriptionDiagnostics || null,
            qualityMetrics,
            ...pipelineMetadata,
          };
    await this._execute(
      'UPDATE media_assets SET transcription_status = ?, transcript_json = ?, diarization_json = ?, updated_at = ? WHERE id = ?',
      [
        this._clean(result.pipelineStatus) || 'completed',
        JSON.stringify(Array.isArray(result.segments) ? result.segments : []),
        JSON.stringify(diarizationPayload),
        this.nowIso(),
        recordingId,
      ]
    );
    const job = await this.getTranscriptionJobByRecordingId(recordingId);
    if (job && job.status !== 'completed') {
      const timestamp = this.nowIso();
      await this._execute(
        `UPDATE transcription_jobs
         SET status = 'completed',
             locked_by = '',
             locked_until = '',
             completed_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [timestamp, timestamp, job.id]
      );
    }
    return this.getMediaAsset(recordingId);
  }

  async markTranscriptionFailure(
    recordingId,
    errorMessage,
    transcriptionDiagnostics = null,
    audioQuality: AudioQualityDiagnostics | null = null
  ) {
    const existing = await this.getMediaAsset(recordingId);
    const existingDiarization = this._safeJsonParse(existing?.diarization_json, {});
    const existingQualityMetrics = this._normalizeQualityMetrics(
      existingDiarization?.qualityMetrics || {}
    );
    const qualityMetrics = this._mergeQualityMetrics(existingQualityMetrics, {
      failureCount: existingQualityMetrics.failureCount + 1,
    });
    await this._execute(
      "UPDATE media_assets SET transcription_status = 'failed', diarization_json = ?, updated_at = ? WHERE id = ?",
      [
        JSON.stringify({
          errorMessage: this._clean(errorMessage),
          errorCode: this._clean(
            transcriptionDiagnostics?.errorCode || transcriptionDiagnostics?.code || ''
          ),
          retryable:
            typeof transcriptionDiagnostics?.retryable === 'boolean'
              ? transcriptionDiagnostics.retryable
              : false,
          retryAfterMs:
            Number.isFinite(Number(transcriptionDiagnostics?.retryAfterMs)) &&
            Number(transcriptionDiagnostics?.retryAfterMs) > 0
              ? Number(transcriptionDiagnostics.retryAfterMs)
              : null,
          audioValidation:
            transcriptionDiagnostics?.audioValidation &&
            typeof transcriptionDiagnostics.audioValidation === 'object'
              ? transcriptionDiagnostics.audioValidation
              : null,
          audioQuality: audioQuality || existingDiarization.audioQuality || null,
          transcriptionDiagnostics: transcriptionDiagnostics || null,
          qualityMetrics,
          ...this._buildPipelineMetadata(),
        }),
        this.nowIso(),
        recordingId,
      ]
    );
    const job = await this.getTranscriptionJobByRecordingId(recordingId);
    if (job && !['completed', 'cancelled'].includes(String(job.status))) {
      await this._execute(
        `UPDATE transcription_jobs
         SET status = 'failed',
             locked_by = '',
             locked_until = '',
             last_error_code = ?,
             last_error_message = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          this._clean(transcriptionDiagnostics?.errorCode || transcriptionDiagnostics?.code || ''),
          this._clean(errorMessage),
          this.nowIso(),
          job.id,
        ]
      );
    }
    return this.getMediaAsset(recordingId);
  }

  async resetOrphanedJobs(): Promise<number> {
    const ORPHAN_THRESHOLD_MS = 30 * 60 * 1000;
    const cutoff = new Date(Date.now() - ORPHAN_THRESHOLD_MS).toISOString();
    const orphans = await this._query(
      "SELECT id FROM media_assets WHERE transcription_status IN ('processing', 'queued') AND updated_at < ?",
      [cutoff]
    );
    for (const row of orphans) {
      await this._execute(
        "UPDATE media_assets SET transcription_status = 'failed', diarization_json = ?, updated_at = ? WHERE id = ?",
        [
          JSON.stringify({
            errorMessage: 'Pipeline restarted — transcription job was lost. Please retry.',
            ...this._buildPipelineMetadata(),
          }),
          this.nowIso(),
          row.id,
        ]
      );
    }
    return orphans.length;
  }

  async recoverStartupTranscriptionJobs(options: { now?: string } = {}): Promise<{
    recovered: number;
    skipped: number;
    failed: number;
    alreadyActive: number;
  }> {
    const now = options.now || this.nowIso();
    const summary = { recovered: 0, skipped: 0, failed: 0, alreadyActive: 0 };
    const rows = await this._query(
      `SELECT * FROM media_assets
       WHERE transcription_status IN ('queued', 'processing', 'diarization')
       ORDER BY updated_at ASC`
    );

    for (const asset of rows) {
      const recordingId = String(asset?.id || '').trim();
      if (!recordingId) {
        summary.skipped++;
        continue;
      }

      const activeJob = await this._get(
        `SELECT * FROM transcription_jobs
         WHERE recording_id = ? AND status IN ('queued', 'running', 'retryable_failed')
         ORDER BY created_at DESC
         LIMIT 1`,
        [recordingId]
      );

      if (
        activeJob?.status === 'queued' ||
        (activeJob?.status === 'retryable_failed' && String(activeJob.next_run_at || '') > now)
      ) {
        summary.alreadyActive++;
        continue;
      }

      if (
        activeJob?.status === 'running' &&
        activeJob.locked_until &&
        String(activeJob.locked_until) > now
      ) {
        summary.alreadyActive++;
        continue;
      }

      const audioAvailable = await this._isMediaAssetAudioAvailable(recordingId, asset);
      if (audioAvailable === null) {
        summary.skipped++;
        continue;
      }

      if (audioAvailable === false) {
        const diarization = this._safeJsonParse(asset.diarization_json, {});
        await this._execute(
          `UPDATE media_assets
           SET transcription_status = 'failed', diarization_json = ?, updated_at = ?
           WHERE id = ?`,
          [
            JSON.stringify({
              ...diarization,
              errorCode: 'audio_source_unavailable',
              errorMessage:
                'Audio source is unavailable after restart. Upload or retry the recording.',
              retryable: false,
              recoveryStage: 'startup',
              ...this._buildPipelineMetadata(),
            }),
            now,
            recordingId,
          ]
        );
        if (activeJob) {
          await this._execute(
            `UPDATE transcription_jobs
             SET status = 'failed', locked_by = NULL, locked_until = NULL,
                 last_error_code = 'audio_source_unavailable',
                 last_error_message = ?, updated_at = ?, completed_at = ?
             WHERE id = ?`,
            ['Audio source is unavailable after restart.', now, now, activeJob.id]
          );
        }
        summary.failed++;
        continue;
      }

      if (activeJob) {
        await this._execute(
          `UPDATE transcription_jobs
           SET status = 'queued', locked_by = NULL, locked_until = NULL,
               next_run_at = ?, updated_at = ?
           WHERE id = ?`,
          [now, now, activeJob.id]
        );
        await this._syncMediaAssetTranscriptionStatus(recordingId, 'queued');
      } else {
        await this.enqueueTranscriptionJob({
          recordingId,
          workspaceId: asset.workspace_id,
          meetingId: asset.meeting_id || '',
          nextRunAt: now,
        });
      }
      summary.recovered++;
    }

    return summary;
  }

  async queueTranscription(recordingId: string, updates: MeetingUpdates = {}): Promise<any> {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset) throw new Error('Nie znaleziono nagrania.');
    const existingDiarization = this._safeJsonParse(asset.diarization_json, {});
    const recordingConsent =
      updates.recordingConsent && typeof updates.recordingConsent === 'object'
        ? {
            acceptedAt: this._clean(updates.recordingConsent.acceptedAt),
            workspaceId: this._clean(updates.recordingConsent.workspaceId),
            policyVersion: this._clean(updates.recordingConsent.policyVersion),
            disclosureTitle: this._clean(updates.recordingConsent.disclosureTitle),
            providerNotice: this._clean(updates.recordingConsent.providerNotice),
            providers: Array.isArray(updates.recordingConsent.providers)
              ? updates.recordingConsent.providers
                  .filter((provider: any) => provider && typeof provider === 'object')
                  .map((provider: any) => ({
                    id: this._clean(provider.id),
                    label: this._clean(provider.label),
                    enabled: Boolean(provider.enabled),
                  }))
              : [],
          }
        : null;
    const preservedDiarization = {
      ...(existingDiarization?.audioQuality && typeof existingDiarization.audioQuality === 'object'
        ? { audioQuality: existingDiarization.audioQuality }
        : {}),
      ...(existingDiarization?.qualityMetrics &&
      typeof existingDiarization.qualityMetrics === 'object'
        ? { qualityMetrics: this._normalizeQualityMetrics(existingDiarization.qualityMetrics) }
        : {}),
      ...(recordingConsent ? { recordingConsent } : {}),
    };
    await this._execute(
      "UPDATE media_assets SET workspace_id = ?, meeting_id = ?, content_type = ?, transcription_status = 'queued', transcript_json = '[]', diarization_json = ?, updated_at = ? WHERE id = ?",
      [
        this._clean(updates.workspaceId) || asset.workspace_id,
        this._clean(updates.meetingId) || asset.meeting_id,
        this._clean(updates.contentType) || asset.content_type,
        JSON.stringify(preservedDiarization),
        this.nowIso(),
        recordingId,
      ]
    );
    if (typeof this.enqueueTranscriptionJob === 'function') {
      await this.enqueueTranscriptionJob({
        recordingId,
        workspaceId: this._clean(updates.workspaceId) || asset.workspace_id,
        meetingId: this._clean(updates.meetingId) || asset.meeting_id || '',
      });
    }
    return {
      diarization: { segments: [], speakerNames: {}, speakerCount: 0, confidence: 0 },
      segments: [],
      speakerNames: {},
      speakerCount: 0,
      confidence: 0,
      pipelineStatus: 'queued',
    };
  }

  _mapTranscriptionJobStatusToMediaStatus(status: string): string {
    if (status === 'running') return 'processing';
    if (status === 'completed') return 'completed';
    if (status === 'failed' || status === 'cancelled') return 'failed';
    return 'queued';
  }

  _addMillisecondsToIso(isoTimestamp: string, milliseconds: number): string {
    const base = Date.parse(isoTimestamp);
    const safeBase = Number.isFinite(base) ? base : Date.now();
    return new Date(safeBase + milliseconds).toISOString();
  }

  async _syncMediaAssetTranscriptionStatus(recordingId: string, jobStatus: string): Promise<void> {
    await this._execute(
      'UPDATE media_assets SET transcription_status = ?, updated_at = ? WHERE id = ?',
      [this._mapTranscriptionJobStatusToMediaStatus(jobStatus), this.nowIso(), recordingId]
    );
  }

  async getTranscriptionJobByRecordingId(recordingId: string): Promise<any | null> {
    return this._get(
      `SELECT * FROM transcription_jobs
       WHERE recording_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [recordingId]
    );
  }

  async enqueueTranscriptionJob({
    recordingId,
    workspaceId,
    meetingId = '',
    maxAttempts = 3,
    nextRunAt,
  }: {
    recordingId: string;
    workspaceId: string;
    meetingId?: string;
    maxAttempts?: number;
    nextRunAt?: string;
  }): Promise<any> {
    const timestamp = this.nowIso();
    const existingActive = await this._get(
      `SELECT * FROM transcription_jobs
       WHERE recording_id = ? AND status IN ('queued', 'running', 'retryable_failed')
       ORDER BY created_at DESC
       LIMIT 1`,
      [recordingId]
    );
    if (existingActive) {
      await this._syncMediaAssetTranscriptionStatus(recordingId, existingActive.status);
      return existingActive;
    }

    const id = `tj_${crypto.randomUUID()}`;
    const runAt = nextRunAt || timestamp;
    await this._execute(
      `INSERT INTO transcription_jobs (
        id, recording_id, workspace_id, meeting_id, status, attempt_count, max_attempts,
        locked_by, locked_until, next_run_at, last_error_code, last_error_message,
        created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, 'queued', 0, ?, NULL, NULL, ?, NULL, NULL, ?, ?, NULL)`,
      [
        id,
        recordingId,
        workspaceId,
        meetingId,
        Math.max(1, Number(maxAttempts) || 3),
        runAt,
        timestamp,
        timestamp,
      ]
    );
    await this._syncMediaAssetTranscriptionStatus(recordingId, 'queued');
    return this._get('SELECT * FROM transcription_jobs WHERE id = ?', [id]);
  }

  async acquireTranscriptionJobLease({
    workerId,
    leaseMs = 5 * 60 * 1000,
    now = this.nowIso(),
    recordingId = '',
  }: {
    workerId: string;
    leaseMs?: number;
    now?: string;
    recordingId?: string;
  }): Promise<any | null> {
    const recordingFilter = recordingId ? 'AND recording_id = ?' : '';
    const candidate = await this._get(
      `SELECT * FROM transcription_jobs
       WHERE status IN ('queued', 'retryable_failed', 'running')
         AND next_run_at <= ?
         AND (locked_until IS NULL OR locked_until <= ?)
         AND attempt_count < max_attempts
         ${recordingFilter}
       ORDER BY next_run_at ASC, created_at ASC
       LIMIT 1`,
      recordingId ? [now, now, recordingId] : [now, now]
    );
    if (!candidate) return null;

    const lockedUntil = this._addMillisecondsToIso(now, leaseMs);
    await this._execute(
      `UPDATE transcription_jobs
       SET status = 'running', locked_by = ?, locked_until = ?, attempt_count = attempt_count + 1,
           updated_at = ?, last_error_code = NULL, last_error_message = NULL
       WHERE id = ?
         AND next_run_at <= ?
         AND attempt_count < max_attempts
         AND (locked_until IS NULL OR locked_until <= ?)
         AND status IN ('queued', 'retryable_failed', 'running')`,
      [workerId, lockedUntil, now, candidate.id, now, now]
    );
    const leased = await this._get(
      'SELECT * FROM transcription_jobs WHERE id = ? AND locked_by = ? AND locked_until = ?',
      [candidate.id, workerId, lockedUntil]
    );
    if (leased) await this._syncMediaAssetTranscriptionStatus(leased.recording_id, 'running');
    return leased;
  }

  async heartbeatTranscriptionJob(
    jobId: string,
    workerId: string,
    leaseMs = 5 * 60 * 1000,
    now = this.nowIso()
  ): Promise<any | null> {
    const lockedUntil = this._addMillisecondsToIso(now, leaseMs);
    await this._execute(
      `UPDATE transcription_jobs SET locked_until = ?, updated_at = ?
       WHERE id = ? AND locked_by = ? AND status = 'running'`,
      [lockedUntil, now, jobId, workerId]
    );
    return this._get('SELECT * FROM transcription_jobs WHERE id = ? AND locked_by = ?', [
      jobId,
      workerId,
    ]);
  }

  async completeTranscriptionJob(jobId: string, workerId: string): Promise<any | null> {
    const now = this.nowIso();
    await this._execute(
      `UPDATE transcription_jobs
       SET status = 'completed', locked_by = NULL, locked_until = NULL, updated_at = ?, completed_at = ?
       WHERE id = ? AND locked_by = ?`,
      [now, now, jobId, workerId]
    );
    const job = await this._get(
      "SELECT * FROM transcription_jobs WHERE id = ? AND status = 'completed'",
      [jobId]
    );
    if (job) await this._syncMediaAssetTranscriptionStatus(job.recording_id, job.status);
    return job;
  }

  async failTranscriptionJob(
    jobId: string,
    workerId: string,
    error: any = {},
    options: { now?: string; retryDelayMs?: number } = {}
  ): Promise<any | null> {
    const job = await this._get('SELECT * FROM transcription_jobs WHERE id = ? AND locked_by = ?', [
      jobId,
      workerId,
    ]);
    if (!job) return null;
    const now = options.now || this.nowIso();
    const retryable = Number(job.attempt_count) < Number(job.max_attempts);
    const status = retryable ? 'retryable_failed' : 'failed';
    const nextRunAt = retryable
      ? this._addMillisecondsToIso(now, options.retryDelayMs ?? 60_000)
      : now;
    await this._execute(
      `UPDATE transcription_jobs
       SET status = ?, locked_by = NULL, locked_until = NULL, next_run_at = ?,
           last_error_code = ?, last_error_message = ?, updated_at = ?, completed_at = ?
       WHERE id = ? AND locked_by = ?`,
      [
        status,
        nextRunAt,
        this._clean(error?.code || error?.errorCode || 'TRANSCRIPTION_FAILED'),
        this._clean(error?.message || String(error || 'Unknown transcription error')),
        now,
        status === 'failed' ? now : null,
        jobId,
        workerId,
      ]
    );
    const updated = await this._get('SELECT * FROM transcription_jobs WHERE id = ?', [jobId]);
    if (updated)
      await this._syncMediaAssetTranscriptionStatus(updated.recording_id, updated.status);
    return updated;
  }

  async releaseTranscriptionJobLock(jobId: string, workerId: string): Promise<any | null> {
    await this._execute(
      `UPDATE transcription_jobs SET locked_by = NULL, locked_until = NULL, updated_at = ?
       WHERE id = ? AND locked_by = ?`,
      [this.nowIso(), jobId, workerId]
    );
    return this._get('SELECT * FROM transcription_jobs WHERE id = ?', [jobId]);
  }

  async updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole) {
    const nextRole = ['owner', 'admin', 'member', 'viewer'].includes(memberRole)
      ? memberRole
      : 'member';
    await this._execute(
      'UPDATE workspace_members SET member_role = ? WHERE workspace_id = ? AND user_id = ?',
      [nextRole, workspaceId, targetUserId]
    );
    return this.getMembership(workspaceId, targetUserId);
  }

  async removeWorkspaceMember(workspaceId: string, targetUserId: string): Promise<void> {
    await this._execute('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [
      workspaceId,
      targetUserId,
    ]);
  }

  async saveVoiceProfile({ id, userId, workspaceId, speakerName, audioPath, embedding }: any) {
    const timestamp = this.nowIso();
    await this._execute(
      'INSERT INTO voice_profiles (id, user_id, workspace_id, speaker_name, audio_path, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, workspaceId, speakerName, audioPath, JSON.stringify(embedding || []), timestamp]
    );
    return this._get('SELECT * FROM voice_profiles WHERE id = ?', [id]);
  }

  async upsertVoiceProfile({ id, userId, workspaceId, speakerName, audioPath, embedding }: any) {
    const MAX_SAMPLES = 5;
    const existing = await this._get(
      'SELECT * FROM voice_profiles WHERE workspace_id = ? AND LOWER(speaker_name) = LOWER(?)',
      [workspaceId, speakerName.trim()]
    );
    if (existing) {
      const existingCount = existing.sample_count || 1;
      if (existingCount < MAX_SAMPLES) {
        const { addToAverageEmbedding } = await import('./speakerEmbedder.ts');
        let existingEmb: number[] = [];
        try {
          existingEmb = JSON.parse(existing.embedding_json || '[]');
        } catch (error: any) {
          logger.warn(
            `[database] Failed to parse embedding JSON for profile ${existing.id}:`,
            error.message
          );
        }
        const averaged = embedding?.length
          ? addToAverageEmbedding(existingEmb, existingCount, embedding)
          : existingEmb;
        await this._execute(
          'UPDATE voice_profiles SET embedding_json = ?, sample_count = ?, audio_path = ? WHERE id = ?',
          [JSON.stringify(averaged), existingCount + 1, audioPath, existing.id]
        );
      }
      return {
        ...(await this._get('SELECT * FROM voice_profiles WHERE id = ?', [existing.id])),
        isUpdate: true,
      };
    }
    const timestamp = this.nowIso();
    await this._execute(
      'INSERT INTO voice_profiles (id, user_id, workspace_id, speaker_name, audio_path, embedding_json, sample_count, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      [
        id,
        userId,
        workspaceId,
        speakerName.trim(),
        audioPath,
        JSON.stringify(embedding || []),
        timestamp,
      ]
    );
    return this._get('SELECT * FROM voice_profiles WHERE id = ?', [id]);
  }

  async updateVoiceProfileThreshold(id: string, workspaceId: string, threshold: number) {
    const clamped = Math.max(0.5, Math.min(0.99, threshold));
    await this._execute(
      'UPDATE voice_profiles SET threshold = ? WHERE id = ? AND workspace_id = ?',
      [clamped, id, workspaceId]
    );
    return this._get('SELECT * FROM voice_profiles WHERE id = ?', [id]);
  }

  async getWorkspaceVoiceProfiles(workspaceId) {
    return this._query(
      'SELECT * FROM voice_profiles WHERE workspace_id = ? ORDER BY created_at DESC',
      [workspaceId]
    );
  }

  async deleteVoiceProfile(id, workspaceId) {
    const row = await this._get('SELECT * FROM voice_profiles WHERE id = ? AND workspace_id = ?', [
      id,
      workspaceId,
    ]);
    if (row && row.audio_path) {
      _deleteFileIfPresent(row.audio_path, '[database] Failed to delete voice profile audio');
    }
    await this._execute('DELETE FROM voice_profiles WHERE id = ? AND workspace_id = ?', [
      id,
      workspaceId,
    ]);
  }

  async getHealth() {
    return { ok: true };
  }

  async updateMeetingTasks(draft: MeetingUpdates): Promise<void> {}

  // --- RAG (Retrieval-Augmented Generation) ---
  async saveRagChunk(chunk: {
    id: string;
    workspaceId: string;
    recordingId: string;
    speakerName: string;
    text: string;
    embedding: number[];
    createdAt: string;
  }): Promise<void> {
    await this._execute(
      `INSERT INTO rag_chunks (id, workspace_id, recording_id, speaker_name, text, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        chunk.id,
        chunk.workspaceId,
        chunk.recordingId,
        chunk.speakerName,
        chunk.text,
        JSON.stringify(chunk.embedding),
        chunk.createdAt,
      ]
    );
  }

  async saveRagChunks(
    chunks: Array<{
      id: string;
      workspaceId: string;
      recordingId: string;
      speakerName: string;
      text: string;
      embedding: number[];
      createdAt: string;
    }>
  ) {
    if (!Array.isArray(chunks) || !chunks.length) return;
    await this._execute('BEGIN');
    try {
      for (const chunk of chunks) {
        await this.saveRagChunk(chunk);
      }
      await this._execute('COMMIT');
    } catch (error) {
      await this._execute('ROLLBACK');
      throw error;
    }
  }

  async getAllRagChunksForWorkspace(workspaceId: string): Promise<any[]> {
    return this._query(`SELECT * FROM rag_chunks WHERE workspace_id = ?`, [String(workspaceId)]);
  }
}

let defaultInstance: Database | null = null;

export function initDatabase(dbConfig?: any): Database {
  defaultInstance = new Database(dbConfig);
  return defaultInstance;
}

export function getDatabase() {
  if (!defaultInstance) {
    const DATA_DIR = path.resolve(__dirname, 'data');
    const DB_PATH = config.VOICELOG_DB_PATH
      ? path.resolve(config.VOICELOG_DB_PATH)
      : path.join(DATA_DIR, 'voicelog.sqlite');
    const UPLOAD_DIR = config.VOICELOG_UPLOAD_DIR
      ? path.resolve(config.VOICELOG_UPLOAD_DIR)
      : path.join(DATA_DIR, 'uploads');
    const SESSION_TTL_HOURS = Math.max(1, config.VOICELOG_SESSION_TTL_HOURS || 24 * 30);
    const IS_TEST = process.env.NODE_ENV === 'test' || config.NODE_ENV === 'test';
    const CONNECTION_STRING = !IS_TEST ? config.VOICELOG_DATABASE_URL || config.DATABASE_URL : null;

    return initDatabase({
      type: CONNECTION_STRING ? 'postgres' : 'sqlite',
      dbPath: IS_TEST ? ':memory:' : DB_PATH,
      uploadDir: UPLOAD_DIR,
      sessionTtlHours: SESSION_TTL_HOURS,
      connectionString: CONNECTION_STRING,
    });
  }
  return defaultInstance;
}
