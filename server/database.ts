import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { logger } from "./logger.ts";
import { config } from "./config.ts";
import { 
  UserProfile, 
  UserDraft, 
  MeetingUpdates, 
  MediaAsset, 
  TranscriptionResult, 
  WorkspaceState 
} from "./lib/types.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Database {
  type: string;
  uploadDir: string;
  sessionTtlHours: number;
  pool: Pool | any;
  msgId: number;
  callbacks: Map<number, { resolve: (val: any) => void; reject: (err: Error) => void }>;
  worker: Worker | any;
  sqliteInitPromise: Promise<any>;

  constructor(dbConfig: any = {}) {
    const { type = "sqlite", dbPath = ":memory:", uploadDir = "./uploads", sessionTtlHours = 24 * 30, connectionString } = dbConfig;
    this.type = connectionString ? "postgres" : type;
    this.uploadDir = uploadDir;
    this.sessionTtlHours = sessionTtlHours;

    if (this.type === "postgres") {
      this.pool = new Pool({ connectionString });
      console.log("[DB] Using PostgreSQL (Supabase)");
    } else {
      if (dbPath !== ":memory:") {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      }
      
      this.msgId = 0;
      this.callbacks = new Map();
      this.worker = new Worker(path.join(__dirname, "sqliteWorker.ts"));
      
      this.worker.on("message", (msg) => {
        const { id, result, error } = msg;
        const cb = this.callbacks.get(id);
        if (cb) {
          this.callbacks.delete(id);
          if (error) cb.reject(new Error(error));
          else cb.resolve(result);
        }
      });
      
      this.worker.on("error", (err) => console.error("SQLite Worker Error:", err));
      
      this.sqliteInitPromise = this._sendToWorker("init", null, null, dbPath);
      console.log("[DB] Using local async SQLite Worker at:", dbPath);
    }

    fs.mkdirSync(uploadDir, { recursive: true });
  }

  async init() {
    if (this.type !== "postgres") {
      await this.sqliteInitPromise;
    }
    await this._createSchema();
  }

  _sendToWorker(type, sql, params = null, dbPath = null) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, sql, params, dbPath });
    });
  }

  async _query(sql, params = []) {
    if (this.type === "postgres") {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      const res = await this.pool.query(pgSql, params);
      return res.rows;
    } else {
      return this._sendToWorker("query", sql, params);
    }
  }

  async _get(sql, params = []) {
    if (this.type === "postgres") {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      const res = await this.pool.query(pgSql, params);
      return res.rows[0] || null;
    } else {
      const result = await this._sendToWorker("get", sql, params);
      return result || null;
    }
  }

  async _execute(sql, params = []) {
    if (this.type === "postgres") {
      let i = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++i}`);
      await this.pool.query(pgSql, params);
    } else {
      await this._sendToWorker("execute", sql, params);
    }
  }

  async _createSchema() {
    await this._execute(`
      CREATE TABLE IF NOT EXISTS server_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

    for (const file of files) {
      const row = await this._get("SELECT version FROM server_migrations WHERE version = ?", [file]);
      if (!row) {
        if (logger && logger.info) logger.info(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        const queries = sql.split(';').map(q => q.trim()).filter(q => q);
        for (const q of queries) {
          if (q.length > 0) {
            try {
              await this._execute(q);
            } catch (err) {
              if (logger && logger.error) logger.error(`Migration error in ${file} query: ${q}`, err);
              throw err;
            }
          }
        }
        await this._execute("INSERT INTO server_migrations (version, applied_at) VALUES (?, ?)", [file, new Date().toISOString()]);
      }
    }
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

  _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
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
    
    // Fix: timingSafeEqual throws TypeError if lengths mismatch
    const actualBuf = Buffer.from(actual, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (actualBuf.length !== expectedBuf.length) return false;
    
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  }

  _hashRecoveryCode(code) {
    return crypto.createHash("sha256").update(String(code || "")).digest("hex");
  }

  _pickProfileDraft(draft: any = {}, email = ""): UserProfile {
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
            .map((item: any) => item.trim())
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

  async _buildWorkspaceFromRow(row, currentUserId = "") {
    const members = await this._query("SELECT user_id, member_role FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC", [row.id]);

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

  async workspaceMembers(workspaceId) {
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

  async workspaceIdsForUser(userId) {
    const rows = await this._query("SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY joined_at ASC", [userId]);
    return rows.map((row) => row.workspace_id);
  }

  async accessibleWorkspaces(userId) {
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

  async ensureWorkspaceState(workspaceId) {
    const existing = await this._get("SELECT workspace_id FROM workspace_state WHERE workspace_id = ?", [workspaceId]);
    if (existing) return;

    const timestamp = this.nowIso();
    await this._execute(
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
      `,
      [workspaceId, timestamp]
    );
  }

  async getWorkspaceState(workspaceId: string): Promise<WorkspaceState> {
    let row = await this._get("SELECT * FROM workspace_state WHERE workspace_id = ?", [workspaceId]);
    if (!row) {
      await this.ensureWorkspaceState(workspaceId);
      row = await this._get("SELECT * FROM workspace_state WHERE workspace_id = ?", [workspaceId]);
    }
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

  async saveWorkspaceState(workspaceId: string, payload: Partial<WorkspaceState> = {}): Promise<WorkspaceState> {
    await this.ensureWorkspaceState(workspaceId);
    const timestamp = this.nowIso();
    await this._execute(
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
      `,
      [
        JSON.stringify(Array.isArray(payload.meetings) ? payload.meetings : []),
        JSON.stringify(Array.isArray(payload.manualTasks) ? payload.manualTasks : []),
        JSON.stringify(payload.taskState && typeof payload.taskState === "object" ? payload.taskState : {}),
        JSON.stringify(payload.taskBoards && typeof payload.taskBoards === "object" ? payload.taskBoards : {}),
        JSON.stringify(payload.calendarMeta && typeof payload.calendarMeta === "object" ? payload.calendarMeta : {}),
        JSON.stringify(Array.isArray(payload.vocabulary) ? payload.vocabulary : []),
        timestamp,
        workspaceId
      ]
    );

    await this._execute("UPDATE workspaces SET updated_at = ? WHERE id = ?", [timestamp, workspaceId]);
    return this.getWorkspaceState(workspaceId);
  }

  async createSession(userId, workspaceId) {
    const timestamp = this.nowIso();
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000).toISOString();
    const token = crypto.randomBytes(48).toString("hex");

    await this._execute("DELETE FROM sessions WHERE expires_at <= ?", [timestamp]);
    await this._execute(
      `
        INSERT INTO sessions (token, user_id, workspace_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `,
      [token, userId, workspaceId, timestamp, expiresAt]
    );

    return { token, expiresAt };
  }

  async getSession(token) {
    const row = await this._get("SELECT * FROM sessions WHERE token = ?", [token]);
    if (!row) return null;

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this._execute("DELETE FROM sessions WHERE token = ?", [token]);
      return null;
    }

    return row;
  }

  async getMembership(workspaceId, userId) {
    return this._get("SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?", [workspaceId, userId]);
  }

  async selectWorkspaceForUser(userId, preferredWorkspaceId = "") {
    const workspaceIds = await this.workspaceIdsForUser(userId);
    if (!workspaceIds.length) return "";
    if (preferredWorkspaceId && workspaceIds.includes(preferredWorkspaceId)) {
      return preferredWorkspaceId;
    }
    return workspaceIds[0];
  }

  async buildSessionPayload(userId, workspaceId) {
    const [userRow, nextWorkspaceId] = await Promise.all([
      this._get("SELECT * FROM users WHERE id = ?", [userId]),
      this.selectWorkspaceForUser(userId, workspaceId)
    ]);
    if (!userRow || !nextWorkspaceId) {
      throw new Error("Unable to build session payload.");
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
    const email = this._normalizeEmail(draft.email);
    const password = String(draft.password || "");
    const name = this._clean(draft.name);
    const workspaceMode = draft.workspaceMode === "join" ? "join" : "create";
    const inviteCode = this._normalizeWorkspaceCode(draft.workspaceCode);
    const requestedWorkspaceName = this._clean(draft.workspaceName);

    if (!email || !password || !name) throw new Error("Uzupelnij imie, email i haslo.");
    if (!this._isValidEmail(email)) throw new Error("Podaj poprawny adres email.");
    if (password.length < 6) throw new Error("Haslo musi miec przynajmniej 6 znakow.");

    const existingUser = await this._get("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) throw new Error("Konto z takim adresem juz istnieje.");

    const timestamp = this.nowIso();
    const userId = this._generateId("user");
    let workspaceId = "";
    let memberRole = "member";

    await this._execute("BEGIN");
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
          userId, email, this._hashPassword(password), name, email,
          JSON.stringify(this._pickProfileDraft(draft, email)),
          timestamp, timestamp
        ]
      );

      if (workspaceMode === "join") {
        if (!inviteCode) throw new Error("Podaj kod workspace, aby dolaczyc.");
        const workspace = await this._get("SELECT * FROM workspaces WHERE invite_code = ?", [inviteCode]);
        if (!workspace) throw new Error("Nie znaleziono workspace o takim kodzie.");

        workspaceId = workspace.id;
        await this._execute("INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'member', ?)", [workspaceId, userId, timestamp]);
      } else {
        workspaceId = this._generateId("workspace");
        memberRole = "owner";
        await this._execute("INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [workspaceId, requestedWorkspaceName || `${name} workspace`, userId, this._generateInviteCode(), timestamp, timestamp]);
        await this._execute("INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)", [workspaceId, userId, timestamp]);
        await this.ensureWorkspaceState(workspaceId);
      }

      if (workspaceMode === "join") await this.ensureWorkspaceState(workspaceId);
      await this._execute("COMMIT");
    } catch (error) {
      await this._execute("ROLLBACK");
      throw error;
    }

    const session = await this.createSession(userId, workspaceId);
    const payload: any = await this.buildSessionPayload(userId, workspaceId);
    payload.user.workspaceMemberRole = memberRole || (await this.getMembership(workspaceId, userId))?.member_role || "member";
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }

  async loginUser(draft: UserDraft): Promise<any> {
    const email = this._normalizeEmail(draft.email);
    const password = String(draft.password || "");
    const preferredWorkspaceId = this._clean(draft.workspaceId);
    if (!email || !password) throw new Error("Uzupelnij email i haslo.");
    const row = await this._get("SELECT * FROM users WHERE email = ?", [email]);

    if (row && !row.password_hash) {
      throw new Error("To konto korzysta z logowania Google. Uzyj przycisku Google.");
    }

    if (!row || !row.password_hash || !this._verifyPassword(password, row.password_hash)) {
      throw new Error("Niepoprawny email lub haslo.");
    }

    const workspaceId = await this.selectWorkspaceForUser(row.id, preferredWorkspaceId);
    if (!workspaceId) throw new Error("To konto nie jest jeszcze przypiete do zadnego workspace.");
    if (preferredWorkspaceId && workspaceId !== preferredWorkspaceId) {
      throw new Error("Nie masz dostepu do wybranego workspace.");
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
    const row = await this._get("SELECT * FROM users WHERE email = ?", [email]);
    if (!row || !row.password_hash) return { expiresAt: genericExpiresAt };

    const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = genericExpiresAt;
    await this._execute("UPDATE users SET recovery_code_hash = ?, recovery_code_expires_at = ?, updated_at = ? WHERE id = ?", [this._hashRecoveryCode(recoveryCode), expiresAt, this.nowIso(), row.id]);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Password reset code for ${email}: ${recoveryCode} (expires ${expiresAt})`);
    }
    return { expiresAt };
  }

  async resetPasswordWithCode(draft: { email: string; code: string; newPassword?: string; confirmPassword?: string }): Promise<any> {
    const email = this._normalizeEmail(draft.email);
    const code = this._clean(draft.code);
    const newPassword = String(draft.newPassword || "");
    const confirmPassword = String(draft.confirmPassword || "");
    const row = await this._get("SELECT * FROM users WHERE email = ?", [email]);

    if (!row) throw new Error("Nie znaleziono konta z takim adresem.");
    if (!code || !newPassword || !confirmPassword) throw new Error("Uzupelnij email, kod i oba pola hasla.");
    if (newPassword.length < 6) throw new Error("Nowe haslo musi miec przynajmniej 6 znakow.");
    if (newPassword !== confirmPassword) throw new Error("Nowe hasla nie sa identyczne.");
    if (!row.recovery_code_hash || !row.recovery_code_expires_at) throw new Error("Najpierw popros o kod resetu.");
    if (new Date(row.recovery_code_expires_at).getTime() <= Date.now()) throw new Error("Kod resetu wygasl. Wygeneruj nowy.");
    if (this._hashRecoveryCode(code) !== row.recovery_code_hash) throw new Error("Kod resetu jest niepoprawny.");

    await this._execute("UPDATE users SET password_hash = ?, recovery_code_hash = '', recovery_code_expires_at = '', updated_at = ? WHERE id = ?", [this._hashPassword(newPassword), this.nowIso(), row.id]);
    return { success: true };
  }

  async upsertGoogleUser(profile: UserDraft): Promise<any> {
    const email = this._normalizeEmail(profile.email);
    if (!email) throw new Error("Brakuje adresu email z Google.");

    const timestamp = this.nowIso();
    let row = await this._get("SELECT * FROM users WHERE email = ? OR google_sub = ?", [email, this._clean(profile.sub)]);
    let workspaceId = "";

    await this._execute("BEGIN");
    try {
      if (row) {
        const currentProfile = this._safeJsonParse(row.profile_json, {});
        const nextProfile = { ...currentProfile, avatarUrl: this._clean(profile.picture) || currentProfile.avatarUrl || "", googleEmail: email };
        await this._execute("UPDATE users SET email = ?, name = ?, provider = 'google', google_sub = ?, google_email = ?, profile_json = ?, updated_at = ? WHERE id = ?", [email, this._clean(profile.name) || row.name, this._clean(profile.sub), email, JSON.stringify(nextProfile), timestamp, row.id]);
        workspaceId = await this.selectWorkspaceForUser(row.id);
      } else {
        const userId = this._generateId("user");
        workspaceId = this._generateId("workspace");
        await this._execute(`
          INSERT INTO users (
            id, email, password_hash, name, provider, google_sub, google_email,
            recovery_code_hash, recovery_code_expires_at, profile_json, created_at, updated_at
          )
          VALUES (?, ?, NULL, ?, 'google', ?, ?, '', '', ?, ?, ?)`, [userId, email, this._clean(profile.name) || this._clean(profile.given_name) || "Google user", this._clean(profile.sub), email,
          JSON.stringify(this._pickProfileDraft({ avatarUrl: this._clean(profile.picture), googleEmail: email }, email)),
          timestamp, timestamp]);
        await this._execute("INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [workspaceId, `${this._clean(profile.given_name) || this._clean(profile.name) || "Google"} workspace`, userId, this._generateInviteCode(), timestamp, timestamp]);
        await this._execute("INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at) VALUES (?, ?, 'owner', ?)", [workspaceId, userId, timestamp]);
        await this.ensureWorkspaceState(workspaceId);
        row = await this._get("SELECT * FROM users WHERE id = ?", [userId]);
      }
      await this._execute("COMMIT");
    } catch (error) {
      await this._execute("ROLLBACK");
      throw error;
    }

    const actualUserId = row?.id || (await this._get("SELECT id FROM users WHERE email = ?", [email]))?.id;
    const actualWorkspaceId = workspaceId || (await this.selectWorkspaceForUser(actualUserId));
    const [session, payload] = await Promise.all([
      this.createSession(actualUserId, actualWorkspaceId),
      this.buildSessionPayload(actualUserId, actualWorkspaceId),
    ]);
    return { ...payload, token: session.token, expiresAt: session.expiresAt };
  }

  async updateUserProfile(userId: string, updates: Partial<UserDraft> = {}): Promise<any> {
    const row = await this._get("SELECT * FROM users WHERE id = ?", [userId]);
    if (!row) throw new Error("Nie znaleziono konta.");

    const currentProfile = this._safeJsonParse(row.profile_json, {});
    const nextProfile = { ...currentProfile, ...this._pickProfileDraft({ ...currentProfile, ...updates }, row.email) };
    const nextName = this._clean(updates.name) || row.name;

    await this._execute("UPDATE users SET name = ?, google_email = ?, profile_json = ?, updated_at = ? WHERE id = ?", [nextName, nextProfile.googleEmail || row.google_email || row.email, JSON.stringify(nextProfile), this.nowIso(), userId]);

    return this._buildUserFromRow(await this._get("SELECT * FROM users WHERE id = ?", [userId]));
  }

  async changeUserPassword(userId: string, draft: any): Promise<any> {
    const row = await this._get("SELECT * FROM users WHERE id = ?", [userId]);
    if (!row) throw new Error("Nie znaleziono konta.");
    if (!row.password_hash) throw new Error("Haslem tego konta zarzadza Google.");

    const currentPassword = String(draft.currentPassword || "");
    const newPassword = String(draft.newPassword || "");
    const confirmPassword = String(draft.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) throw new Error("Uzupelnij wszystkie pola hasla.");
    if (newPassword.length < 6) throw new Error("Nowe haslo musi miec przynajmniej 6 znakow.");
    if (newPassword !== confirmPassword) throw new Error("Nowe hasla nie sa identyczne.");
    if (!this._verifyPassword(currentPassword, row.password_hash)) throw new Error("Aktualne haslo jest niepoprawne.");

    await this._execute("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [this._hashPassword(newPassword), this.nowIso(), userId]);
    return { success: true };
  }

  async upsertMediaAsset({ recordingId, workspaceId, meetingId = "", contentType, buffer, createdByUserId }: any): Promise<MediaAsset | null> {
    const safeRecordingId = String(recordingId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!safeRecordingId) throw new Error("Nieprawidłowy identyfikator nagrania.");
    const extension = { "audio/webm": ".webm", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav" }[String(contentType || "").toLowerCase()] || ".bin";
    const filePath = path.resolve(this.uploadDir, `${safeRecordingId}${extension}`);
    if (!filePath.startsWith(path.resolve(this.uploadDir) + path.sep)) throw new Error("Nieprawidłowa ścieżka pliku nagrania.");
    fs.writeFileSync(filePath, buffer);

    const existing = await this._get("SELECT id FROM media_assets WHERE id = ?", [recordingId]);
    const timestamp = this.nowIso();

    if (existing) {
      await this._execute("UPDATE media_assets SET workspace_id = ?, meeting_id = ?, file_path = ?, content_type = ?, size_bytes = ?, updated_at = ? WHERE id = ?", [workspaceId, meetingId, filePath, contentType, buffer.byteLength, timestamp, recordingId]);
    } else {
      await this._execute(`
        INSERT INTO media_assets (
          id, workspace_id, meeting_id, created_by_user_id, file_path, content_type,
          size_bytes, transcription_status, transcript_json, diarization_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', '[]', '{}', ?, ?)`, [recordingId, workspaceId, meetingId, createdByUserId, filePath, contentType || "application/octet-stream", buffer.byteLength, timestamp, timestamp]);
    }
    return this.getMediaAsset(recordingId);
  }

  async getMediaAsset(recordingId: string): Promise<MediaAsset | null> {
    return this._get("SELECT * FROM media_assets WHERE id = ?", [recordingId]) as Promise<MediaAsset | null>;
  }

  async markTranscriptionProcessing(recordingId) {
    await this._execute("UPDATE media_assets SET transcription_status = 'processing', updated_at = ? WHERE id = ?", [this.nowIso(), recordingId]);
    return this.getMediaAsset(recordingId);
  }

  async saveTranscriptionResult(recordingId: string, result: TranscriptionResult = {}): Promise<MediaAsset | null> {
    await this._execute("UPDATE media_assets SET transcription_status = ?, transcript_json = ?, diarization_json = ?, updated_at = ? WHERE id = ?", [this._clean(result.pipelineStatus) || "completed",
         JSON.stringify(Array.isArray(result.segments) ? result.segments : []),
         JSON.stringify(result.diarization && typeof result.diarization === "object" ? { ...result.diarization, reviewSummary: result.reviewSummary || null } : { reviewSummary: result.reviewSummary || null }),
         this.nowIso(), recordingId]);
    return this.getMediaAsset(recordingId);
  }

  async markTranscriptionFailure(recordingId, errorMessage) {
    await this._execute("UPDATE media_assets SET transcription_status = 'failed', diarization_json = ?, updated_at = ? WHERE id = ?", [JSON.stringify({ errorMessage: this._clean(errorMessage) }), this.nowIso(), recordingId]);
    return this.getMediaAsset(recordingId);
  }

  async queueTranscription(recordingId: string, updates: MeetingUpdates = {}): Promise<any> {
    const asset = await this.getMediaAsset(recordingId);
    if (!asset) throw new Error("Nie znaleziono nagrania.");
    await this._execute("UPDATE media_assets SET workspace_id = ?, meeting_id = ?, content_type = ?, transcription_status = 'queued', transcript_json = '[]', diarization_json = '{}', updated_at = ? WHERE id = ?", [this._clean(updates.workspaceId) || asset.workspace_id, this._clean(updates.meetingId) || asset.meeting_id, this._clean(updates.contentType) || asset.content_type, this.nowIso(), recordingId]);
    return { diarization: { segments: [], speakerNames: {}, speakerCount: 0, confidence: 0 }, segments: [], speakerNames: {}, speakerCount: 0, confidence: 0, pipelineStatus: "queued" };
  }

  async updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole) {
    const nextRole = ["owner", "admin", "member", "viewer"].includes(memberRole) ? memberRole : "member";
    await this._execute("UPDATE workspace_members SET member_role = ? WHERE workspace_id = ? AND user_id = ?", [nextRole, workspaceId, targetUserId]);
    return this.getMembership(workspaceId, targetUserId);
  }

  async saveVoiceProfile({ id, userId, workspaceId, speakerName, audioPath, embedding }: any) {
    const timestamp = this.nowIso();
    await this._execute("INSERT INTO voice_profiles (id, user_id, workspace_id, speaker_name, audio_path, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [id, userId, workspaceId, speakerName, audioPath, JSON.stringify(embedding || []), timestamp]);
    return this._get("SELECT * FROM voice_profiles WHERE id = ?", [id]);
  }

  async getWorkspaceVoiceProfiles(workspaceId) {
    return this._query("SELECT * FROM voice_profiles WHERE workspace_id = ? ORDER BY created_at DESC", [workspaceId]);
  }

  async deleteVoiceProfile(id, workspaceId) {
    const row = await this._get("SELECT * FROM voice_profiles WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
    if (row && row.audio_path) {
      try { fs.unlinkSync(row.audio_path); } catch (_) {}
    }
    await this._execute("DELETE FROM voice_profiles WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
  }

  async getHealth() {
    return { ok: true };
  }

  async updateMeetingTasks(draft: MeetingUpdates): Promise<void> {}

  // --- RAG (Retrieval-Augmented Generation) ---
  async saveRagChunk(chunk: { id: string; workspaceId: string; recordingId: string; speakerName: string; text: string; embedding: number[]; createdAt: string }) {
    await this._execute(
      `INSERT INTO rag_chunks (id, workspace_id, recording_id, speaker_name, text, embedding_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [chunk.id, chunk.workspaceId, chunk.recordingId, chunk.speakerName, chunk.text, JSON.stringify(chunk.embedding), chunk.createdAt]
    );
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
    const DATA_DIR = path.resolve(__dirname, "data");
    const DB_PATH = config.VOICELOG_DB_PATH ? path.resolve(config.VOICELOG_DB_PATH) : path.join(DATA_DIR, "voicelog.sqlite");
    const UPLOAD_DIR = config.VOICELOG_UPLOAD_DIR ? path.resolve(config.VOICELOG_UPLOAD_DIR) : path.join(DATA_DIR, "uploads");
    const SESSION_TTL_HOURS = Math.max(1, config.VOICELOG_SESSION_TTL_HOURS || 24 * 30);
    const IS_TEST = process.env.NODE_ENV === "test" || config.NODE_ENV === "test";
    const CONNECTION_STRING = !IS_TEST ? (config.VOICELOG_DATABASE_URL || config.DATABASE_URL) : null;

    return initDatabase({
      type: CONNECTION_STRING ? "postgres" : "sqlite",
      dbPath: IS_TEST ? ":memory:" : DB_PATH,
      uploadDir: UPLOAD_DIR,
      sessionTtlHours: SESSION_TTL_HOURS,
      connectionString: CONNECTION_STRING
    });

  }
  return defaultInstance;
}
