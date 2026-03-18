const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

class Database {
  constructor(dbPath, uploadDir, sessionTtlHours) {
    this.dbPath = dbPath;
    this.uploadDir = uploadDir;
    this.sessionTtlHours = sessionTtlHours || 24 * 30;

    if (dbPath !== ":memory:") {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    fs.mkdirSync(uploadDir, { recursive: true });

    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");

    this._createSchema();
  }

  _createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        name TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'local',
        google_sub TEXT NOT NULL DEFAULT '',
        google_email TEXT NOT NULL DEFAULT '',
        recovery_code_hash TEXT NOT NULL DEFAULT '',
        recovery_code_expires_at TEXT NOT NULL DEFAULT '',
        profile_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        invite_code TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        member_role TEXT NOT NULL DEFAULT 'member',
        joined_at TEXT NOT NULL,
        PRIMARY KEY (workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workspace_state (
        workspace_id TEXT PRIMARY KEY,
        meetings_json TEXT NOT NULL DEFAULT '[]',
        manual_tasks_json TEXT NOT NULL DEFAULT '[]',
        task_state_json TEXT NOT NULL DEFAULT '{}',
        task_boards_json TEXT NOT NULL DEFAULT '{}',
        calendar_meta_json TEXT NOT NULL DEFAULT '{}',
        vocabulary_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        transcription_status TEXT NOT NULL DEFAULT 'queued',
        transcript_json TEXT NOT NULL DEFAULT '[]',
        diarization_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS voice_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        speaker_name TEXT NOT NULL,
        audio_path TEXT NOT NULL,
        embedding_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );
    `);
  }

  nowIso() {
    return new Date().toISOString();
  }

  // --- Internal Utilities ---

  _safeJsonParse(raw, fallbackValue) {
    if (!raw) return fallbackValue;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallbackValue;
    }
  }

  _clean(value) {
    return String(value || "").trim();
  }

  _normalizeEmail(email) {
    return this._clean(email).toLowerCase();
  }

  _normalizeWorkspaceCode(code) {
    return this._clean(code).replace(/\s+/g, "").toUpperCase();
  }

  _generateId(prefix) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }

  _generateInviteCode() {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
  }

  _hashPassword(secret, salt = crypto.randomBytes(16).toString("hex")) {
    const derived = crypto.scryptSync(String(secret || ""), salt, 64).toString("hex");
    return `${salt}:${derived}`;
  }

  _verifyPassword(secret, storedHash) {
    const [salt, expected] = String(storedHash || "").split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(String(secret || ""), salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  }

  _hashRecoveryCode(code) {
    return crypto.createHash("sha256").update(String(code || "")).digest("hex");
  }

  _pickProfileDraft(draft = {}, email = "") {
    return {
      role: this._clean(draft.role),
      company: this._clean(draft.company),
      timezone: this._clean(draft.timezone) || "Europe/Warsaw",
      googleEmail: this._clean(draft.googleEmail) || this._normalizeEmail(email),
      phone: this._clean(draft.phone),
      location: this._clean(draft.location),
      team: this._clean(draft.team),
      bio: this._clean(draft.bio),
      avatarUrl: this._clean(draft.avatarUrl),
      preferredInsights: Array.isArray(draft.preferredInsights)
        ? draft.preferredInsights.filter(Boolean)
        : String(draft.preferredInsights || "")
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
      notifyDailyDigest: Boolean(draft.notifyDailyDigest ?? true),
      autoTaskCapture: Boolean(draft.autoTaskCapture ?? true),
      preferredTaskView: draft.preferredTaskView === "kanban" ? "kanban" : "list",
    };
  }

  _buildUserFromRow(row) {
    const profile = this._safeJsonParse(row.profile_json, {});
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      provider: row.provider,
      googleSub: row.google_sub,
      googleEmail: row.google_email || profile.googleEmail || row.email,
      role: profile.role || "",
      company: profile.company || "",
      timezone: profile.timezone || "Europe/Warsaw",
      phone: profile.phone || "",
      location: profile.location || "",
      team: profile.team || "",
      bio: profile.bio || "",
      avatarUrl: profile.avatarUrl || "",
      preferredInsights: Array.isArray(profile.preferredInsights) ? profile.preferredInsights : [],
      notifyDailyDigest: Boolean(profile.notifyDailyDigest ?? true),
      autoTaskCapture: Boolean(profile.autoTaskCapture ?? true),
      preferredTaskView: profile.preferredTaskView === "kanban" ? "kanban" : "list",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  _buildWorkspaceFromRow(row, currentUserId = "") {
    const members = this.db
      .prepare("SELECT user_id, member_role FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC")
      .all(row.id);

    const memberIds = members.map((item) => item.user_id);
    const memberRoles = members.reduce((result, item) => {
      result[item.user_id] = item.member_role;
      return result;
    }, {});
    const currentMember = currentUserId ? members.find((item) => item.user_id === currentUserId) : null;

    return {
      id: row.id,
      name: row.name,
      ownerUserId: row.owner_user_id,
      inviteCode: row.invite_code,
      memberIds,
      memberRoles,
      memberRole: currentMember?.member_role || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // --- Public Methods ---

  workspaceMembers(workspaceId) {
    return this.db
      .prepare(
        `
          SELECT users.*, workspace_members.member_role AS workspace_member_role
          FROM workspace_members
          JOIN users ON users.id = workspace_members.user_id
          WHERE workspace_members.workspace_id = ?
          ORDER BY users.name COLLATE NOCASE ASC
        `
      )
      .all(workspaceId)
      .map((row) => this._buildUserFromRow(row));
  }

  workspaceIdsForUser(userId) {
    return this.db
      .prepare("SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY joined_at ASC")
      .all(userId)
      .map((row) => row.workspace_id);
  }

  accessibleWorkspaces(userId) {
    return this.db
      .prepare(
        `
          SELECT workspaces.*
          FROM workspace_members
          JOIN workspaces ON workspaces.id = workspace_members.workspace_id
          WHERE workspace_members.user_id = ?
          ORDER BY workspaces.updated_at DESC
        `
      )
      .all(userId)
      .map((row) => this._buildWorkspaceFromRow(row, userId));
  }

  ensureWorkspaceState(workspaceId) {
    const existing = this.db.prepare("SELECT workspace_id FROM workspace_state WHERE workspace_id = ?").get(workspaceId);
    if (existing) return;

    const timestamp = this.nowIso();
    this.db
      .prepare(
        `
          INSERT INTO workspace_state (
            workspace_id,
            meetings_json,
            manual_tasks_json,
            task_state_json,
            task_boards_json,
            calendar_meta_json,
            vocabulary_json,
            updated_at
          )
          VALUES (?, '[]', '[]', '{}', '{}', '{}', '[]', ?)
        `
      )
      .run(workspaceId, timestamp);
  }

  getWorkspaceState(workspaceId) {
    this.ensureWorkspaceState(workspaceId);
    const row = this.db.prepare("SELECT * FROM workspace_state WHERE workspace_id = ?").get(workspaceId);
    return {
      meetings: this._safeJsonParse(row.meetings_json, []),
      manualTasks: this._safeJsonParse(row.manual_tasks_json, []),
      taskState: this._safeJsonParse(row.task_state_json, {}),
      taskBoards: this._safeJsonParse(row.task_boards_json, {}),
      calendarMeta: this._safeJsonParse(row.calendar_meta_json, {}),
      vocabulary: this._safeJsonParse(row.vocabulary_json, []),
      updatedAt: row.updated_at,
    };
  }

  saveWorkspaceState(workspaceId, payload = {}) {
    this.ensureWorkspaceState(workspaceId);
    const timestamp = this.nowIso();
    this.db
      .prepare(
        `
          UPDATE workspace_state
          SET meetings_json = ?,
              manual_tasks_json = ?,
              task_state_json = ?,
              task_boards_json = ?,
              calendar_meta_json = ?,
              vocabulary_json = ?,
              updated_at = ?
          WHERE workspace_id = ?
        `
      )
      .run(
        JSON.stringify(Array.isArray(payload.meetings) ? payload.meetings : []),
        JSON.stringify(Array.isArray(payload.manualTasks) ? payload.manualTasks : []),
        JSON.stringify(payload.taskState && typeof payload.taskState === "object" ? payload.taskState : {}),
        JSON.stringify(payload.taskBoards && typeof payload.taskBoards === "object" ? payload.taskBoards : {}),
        JSON.stringify(payload.calendarMeta && typeof payload.calendarMeta === "object" ? payload.calendarMeta : {}),
        JSON.stringify(Array.isArray(payload.vocabulary) ? payload.vocabulary : []),
        timestamp,
        workspaceId
      );

    this.db.prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?").run(timestamp, workspaceId);
    return this.getWorkspaceState(workspaceId);
  }

  createSession(userId, workspaceId) {
    const timestamp = this.nowIso();
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000).toISOString();
    const token = crypto.randomBytes(48).toString("hex");

    this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(timestamp);
    this.db
      .prepare(
        `
          INSERT INTO sessions (token, user_id, workspace_id, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(token, userId, workspaceId, timestamp, expiresAt);

    return { token, expiresAt };
  }

  getSession(token) {
    const row = this.db.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
    if (!row) return null;

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      return null;
    }

    return row;
  }

  getMembership(workspaceId, userId) {
    return this.db
      .prepare("SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
      .get(workspaceId, userId);
  }

  selectWorkspaceForUser(userId, preferredWorkspaceId = "") {
    const workspaceIds = this.workspaceIdsForUser(userId);
    if (!workspaceIds.length) return "";
    if (preferredWorkspaceId && workspaceIds.includes(preferredWorkspaceId)) {
      return preferredWorkspaceId;
    }
    return workspaceIds[0];
  }

  buildSessionPayload(userId, workspaceId) {
    const userRow = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    const nextWorkspaceId = this.selectWorkspaceForUser(userId, workspaceId);
    if (!userRow || !nextWorkspaceId) {
      throw new Error("Unable to build session payload.");
    }

    return {
      user: this._buildUserFromRow(userRow),
      users: this.workspaceMembers(nextWorkspaceId),
      workspaces: this.accessibleWorkspaces(userId),
      workspaceId: nextWorkspaceId,
      state: this.getWorkspaceState(nextWorkspaceId),
    };
  }

  registerUser(draft = {}) {
    const email = this._normalizeEmail(draft.email);
    const password = String(draft.password || "");
    const name = this._clean(draft.name);
    const workspaceMode = draft.workspaceMode === "join" ? "join" : "create";
    const inviteCode = this._normalizeWorkspaceCode(draft.workspaceCode);
    const requestedWorkspaceName = this._clean(draft.workspaceName);

    if (!email || !password || !name) throw new Error("Uzupelnij imie, email i haslo.");
    if (password.length < 6) throw new Error("Haslo musi miec przynajmniej 6 znakow.");

    const existingUser = this.db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existingUser) throw new Error("Konto z takim adresem juz istnieje.");

    const timestamp = this.nowIso();
    const userId = this._generateId("user");
    let workspaceId = "";
    let memberRole = "member";

    this.db.exec("BEGIN");
    try {
      this.db
        .prepare(
          `
            INSERT INTO users (
              id, email, password_hash, name, provider, google_sub, google_email,
              recovery_code_hash, recovery_code_expires_at, profile_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, 'local', '', ?, '', '', ?, ?, ?)
          `
        )
        .run(
          userId, email, this._hashPassword(password), name, email,
          JSON.stringify(this._pickProfileDraft(draft, email)),
          timestamp, timestamp
        );

      if (workspaceMode === "join") {
        const workspace = this.db.prepare("SELECT * FROM workspaces WHERE invite_code = ?").get(inviteCode);
        if (!workspace) throw new Error("Nie znaleziono workspace o takim kodzie.");

        workspaceId = workspace.id;
        this.db
          .prepare("INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'member', ?)")
          .run(workspaceId, userId, timestamp);
      } else {
        workspaceId = this._generateId("workspace");
        memberRole = "owner";
        this.db
          .prepare("INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(workspaceId, requestedWorkspaceName || `${name} workspace`, userId, this._generateInviteCode(), timestamp, timestamp);
        this.db
          .prepare("INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)")
          .run(workspaceId, userId, timestamp);
        this.ensureWorkspaceState(workspaceId);
      }

      if (workspaceMode === "join") this.ensureWorkspaceState(workspaceId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    const session = this.createSession(userId, workspaceId);
    const payload = this.buildSessionPayload(userId, workspaceId);
    payload.user.workspaceMemberRole = memberRole || this.getMembership(workspaceId, userId)?.member_role || "member";
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }

  loginUser(draft = {}) {
    const email = this._normalizeEmail(draft.email);
    const password = String(draft.password || "");
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!row || !row.password_hash || !this._verifyPassword(password, row.password_hash)) {
      throw new Error("Niepoprawny email lub haslo.");
    }

    const workspaceId = this.selectWorkspaceForUser(row.id, this._clean(draft.workspaceId));
    if (!workspaceId) throw new Error("To konto nie jest jeszcze przypiete do zadnego workspace.");

    const session = this.createSession(row.id, workspaceId);
    return { ...this.buildSessionPayload(row.id, workspaceId), token: session.token, expiresAt: session.expiresAt };
  }

  requestPasswordReset(draft = {}) {
    const email = this._normalizeEmail(draft.email);
    const genericExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!row || !row.password_hash) return { expiresAt: genericExpiresAt };

    const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = genericExpiresAt;
    this.db
      .prepare("UPDATE users SET recovery_code_hash = ?, recovery_code_expires_at = ?, updated_at = ? WHERE id = ?")
      .run(this._hashRecoveryCode(recoveryCode), expiresAt, this.nowIso(), row.id);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Password reset code for ${email}: ${recoveryCode} (expires ${expiresAt})`);
    }
    return { expiresAt };
  }

  resetPasswordWithCode(draft = {}) {
    const email = this._normalizeEmail(draft.email);
    const code = this._clean(draft.code);
    const newPassword = String(draft.newPassword || "");
    const confirmPassword = String(draft.confirmPassword || "");
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!row) throw new Error("Nie znaleziono konta z takim adresem.");
    if (!code || !newPassword || !confirmPassword) throw new Error("Uzupelnij email, kod i oba pola hasla.");
    if (newPassword.length < 6) throw new Error("Nowe haslo musi miec przynajmniej 6 znakow.");
    if (newPassword !== confirmPassword) throw new Error("Nowe hasla nie sa identyczne.");
    if (!row.recovery_code_hash || !row.recovery_code_expires_at) throw new Error("Najpierw popros o kod resetu.");
    if (new Date(row.recovery_code_expires_at).getTime() <= Date.now()) throw new Error("Kod resetu wygasl. Wygeneruj nowy.");
    if (this._hashRecoveryCode(code) !== row.recovery_code_hash) throw new Error("Kod resetu jest niepoprawny.");

    this.db
      .prepare("UPDATE users SET password_hash = ?, recovery_code_hash = '', recovery_code_expires_at = '', updated_at = ? WHERE id = ?")
      .run(this._hashPassword(newPassword), this.nowIso(), row.id);
    return { success: true };
  }

  upsertGoogleUser(profile = {}) {
    const email = this._normalizeEmail(profile.email);
    if (!email) throw new Error("Brakuje adresu email z Google.");

    const timestamp = this.nowIso();
    let row = this.db.prepare("SELECT * FROM users WHERE email = ? OR google_sub = ?").get(email, this._clean(profile.sub));
    let workspaceId = "";

    this.db.exec("BEGIN");
    try {
      if (row) {
        const currentProfile = this._safeJsonParse(row.profile_json, {});
        const nextProfile = { ...currentProfile, avatarUrl: this._clean(profile.picture) || currentProfile.avatarUrl || "", googleEmail: email };
        this.db
          .prepare("UPDATE users SET email = ?, name = ?, provider = 'google', google_sub = ?, google_email = ?, profile_json = ?, updated_at = ? WHERE id = ?")
          .run(email, this._clean(profile.name) || row.name, this._clean(profile.sub), email, JSON.stringify(nextProfile), timestamp, row.id);
        workspaceId = this.selectWorkspaceForUser(row.id);
      } else {
        const userId = this._generateId("user");
        workspaceId = this._generateId("workspace");
        this.db
          .prepare(`
            INSERT INTO users (
              id, email, password_hash, name, provider, google_sub, google_email,
              recovery_code_hash, recovery_code_expires_at, profile_json, created_at, updated_at
            )
            VALUES (?, ?, NULL, ?, 'google', ?, ?, '', '', ?, ?, ?)`)
          .run(userId, email, this._clean(profile.name) || this._clean(profile.given_name) || "Google user", this._clean(profile.sub), email,
            JSON.stringify(this._pickProfileDraft({ avatarUrl: this._clean(profile.picture), googleEmail: email }, email)),
            timestamp, timestamp);
        this.db
          .prepare("INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(workspaceId, `${this._clean(profile.given_name) || this._clean(profile.name) || "Google"} workspace`, userId, this._generateInviteCode(), timestamp, timestamp);
        this.db
          .prepare("INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)")
          .run(workspaceId, userId, timestamp);
        this.ensureWorkspaceState(workspaceId);
        row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    const userId = row?.id || this.db.prepare("SELECT id FROM users WHERE email = ?").get(email)?.id;
    const session = this.createSession(userId, workspaceId || this.selectWorkspaceForUser(userId));
    return { ...this.buildSessionPayload(userId, workspaceId), token: session.token, expiresAt: session.expiresAt };
  }

  updateUserProfile(userId, updates = {}) {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!row) throw new Error("Nie znaleziono konta.");

    const currentProfile = this._safeJsonParse(row.profile_json, {});
    const nextProfile = { ...currentProfile, ...this._pickProfileDraft({ ...currentProfile, ...updates }, row.email) };
    const nextName = this._clean(updates.name) || row.name;

    this.db
      .prepare("UPDATE users SET name = ?, google_email = ?, profile_json = ?, updated_at = ? WHERE id = ?")
      .run(nextName, nextProfile.googleEmail || row.google_email || row.email, JSON.stringify(nextProfile), this.nowIso(), userId);

    return this._buildUserFromRow(this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
  }

  changeUserPassword(userId, draft = {}) {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (!row) throw new Error("Nie znaleziono konta.");
    if (!row.password_hash) throw new Error("Haslem tego konta zarzadza Google.");

    const currentPassword = String(draft.currentPassword || "");
    const newPassword = String(draft.newPassword || "");
    const confirmPassword = String(draft.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) throw new Error("Uzupelnij wszystkie pola hasla.");
    if (newPassword.length < 6) throw new Error("Nowe haslo musi miec przynajmniej 6 znakow.");
    if (newPassword !== confirmPassword) throw new Error("Nowe hasla nie sa identyczne.");
    if (!this._verifyPassword(currentPassword, row.password_hash)) throw new Error("Aktualne haslo jest niepoprawne.");

    this.db
      .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .run(this._hashPassword(newPassword), this.nowIso(), userId);
    return { success: true };
  }

  upsertMediaAsset({ recordingId, workspaceId, meetingId = "", contentType, buffer, createdByUserId }) {
    const safeRecordingId = String(recordingId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!safeRecordingId) throw new Error("Nieprawidłowy identyfikator nagrania.");
    const extension = { "audio/webm": ".webm", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav" }[String(contentType || "").toLowerCase()] || ".bin";
    const filePath = path.resolve(this.uploadDir, `${safeRecordingId}${extension}`);
    if (!filePath.startsWith(path.resolve(this.uploadDir) + path.sep)) throw new Error("Nieprawidłowa ścieżka pliku nagrania.");
    fs.writeFileSync(filePath, buffer);

    const existing = this.db.prepare("SELECT id FROM media_assets WHERE id = ?").get(recordingId);
    const timestamp = this.nowIso();

    if (existing) {
      this.db
        .prepare("UPDATE media_assets SET workspace_id = ?, meeting_id = ?, file_path = ?, content_type = ?, size_bytes = ?, updated_at = ? WHERE id = ?")
        .run(workspaceId, meetingId, filePath, contentType, buffer.byteLength, timestamp, recordingId);
    } else {
      this.db
        .prepare(`
          INSERT INTO media_assets (
            id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
            size_bytes, transcription_status, transcript_json, diarization_json, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', '[]', '{}', ?, ?)`)
        .run(recordingId, workspaceId, meetingId, createdByUserId, filePath, contentType || "application/octet-stream", buffer.byteLength, timestamp, timestamp);
    }
    return this.getMediaAsset(recordingId);
  }

  getMediaAsset(recordingId) {
    return this.db.prepare("SELECT * FROM media_assets WHERE id = ?").get(recordingId);
  }

  markTranscriptionProcessing(recordingId) {
    this.db.prepare("UPDATE media_assets SET transcription_status = 'processing', updated_at = ? WHERE id = ?").run(this.nowIso(), recordingId);
    return this.getMediaAsset(recordingId);
  }

  saveTranscriptionResult(recordingId, result = {}) {
    this.db
      .prepare("UPDATE media_assets SET transcription_status = ?, transcript_json = ?, diarization_json = ?, updated_at = ? WHERE id = ?")
      .run(this._clean(result.pipelineStatus) || "completed",
           JSON.stringify(Array.isArray(result.segments) ? result.segments : []),
           JSON.stringify(result.diarization && typeof result.diarization === "object" ? { ...result.diarization, reviewSummary: result.reviewSummary || null } : { reviewSummary: result.reviewSummary || null }),
           this.nowIso(), recordingId);
    return this.getMediaAsset(recordingId);
  }

  markTranscriptionFailure(recordingId, errorMessage) {
    this.db.prepare("UPDATE media_assets SET transcription_status = 'failed', diarization_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify({ errorMessage: this._clean(errorMessage) }), this.nowIso(), recordingId);
    return this.getMediaAsset(recordingId);
  }

  queueTranscription(recordingId, updates = {}) {
    const asset = this.getMediaAsset(recordingId);
    if (!asset) throw new Error("Nie znaleziono nagrania.");
    this.db
      .prepare("UPDATE media_assets SET workspace_id = ?, meeting_id = ?, content_type = ?, transcription_status = 'queued', transcript_json = '[]', diarization_json = '{}', updated_at = ? WHERE id = ?")
      .run(this._clean(updates.workspaceId) || asset.workspace_id, this._clean(updates.meetingId) || asset.meeting_id, this._clean(updates.contentType) || asset.content_type, this.nowIso(), recordingId);
    return { diarization: { segments: [], speakerNames: {}, speakerCount: 0, confidence: 0 }, segments: [], speakerNames: {}, speakerCount: 0, confidence: 0, pipelineStatus: "queued" };
  }

  updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole) {
    const nextRole = ["owner", "admin", "member", "viewer"].includes(memberRole) ? memberRole : "member";
    this.db.prepare("UPDATE workspace_members SET member_role = ? WHERE workspace_id = ? AND user_id = ?").run(nextRole, workspaceId, targetUserId);
    return this.getMembership(workspaceId, targetUserId);
  }

  saveVoiceProfile({ id, userId, workspaceId, speakerName, audioPath, embedding }) {
    const timestamp = this.nowIso();
    this.db
      .prepare("INSERT INTO voice_profiles (id, user_id, workspace_id, speaker_name, audio_path, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, userId, workspaceId, speakerName, audioPath, JSON.stringify(embedding || []), timestamp);
    return this.db.prepare("SELECT * FROM voice_profiles WHERE id = ?").get(id);
  }

  getWorkspaceVoiceProfiles(workspaceId) {
    return this.db.prepare("SELECT * FROM voice_profiles WHERE workspace_id = ? ORDER BY created_at DESC").all(workspaceId);
  }

  deleteVoiceProfile(id, workspaceId) {
    const row = this.db.prepare("SELECT * FROM voice_profiles WHERE id = ? AND workspace_id = ?").get(id, workspaceId);
    if (row && row.audio_path) {
      try { require("node:fs").unlinkSync(row.audio_path); } catch (_) {}
    }
    this.db.prepare("DELETE FROM voice_profiles WHERE id = ? AND workspace_id = ?").run(id, workspaceId);
  }

  getHealth() {
    return { ok: true };
  }
}

let defaultInstance = null;

function initDatabase(dbPath, uploadDir, sessionTtlHours) {
  defaultInstance = new Database(dbPath, uploadDir, sessionTtlHours);
  return defaultInstance;
}

function getDatabase() {
  if (!defaultInstance) {
    const DATA_DIR = path.resolve(__dirname, "data");
    const DB_PATH = process.env.VOICELOG_DB_PATH ? path.resolve(process.env.VOICELOG_DB_PATH) : path.join(DATA_DIR, "voicelog.sqlite");
    const UPLOAD_DIR = process.env.VOICELOG_UPLOAD_DIR ? path.resolve(process.env.VOICELOG_UPLOAD_DIR) : path.join(DATA_DIR, "uploads");
    const SESSION_TTL_HOURS = Math.max(1, Number(process.env.VOICELOG_SESSION_TTL_HOURS) || 24 * 30);
    return initDatabase(DB_PATH, UPLOAD_DIR, SESSION_TTL_HOURS);
  }
  return defaultInstance;
}

module.exports = {
  Database,
  initDatabase,
  getDatabase,
};
