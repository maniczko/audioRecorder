const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.resolve(process.cwd(), "server", "data");
const DB_PATH = path.resolve(process.cwd(), process.env.VOICELOG_DB_PATH || path.join(DATA_DIR, "voicelog.sqlite"));
const UPLOAD_DIR = path.resolve(
  process.cwd(),
  process.env.VOICELOG_UPLOAD_DIR || path.join(DATA_DIR, "uploads")
);
const SESSION_TTL_HOURS = Math.max(1, Number(process.env.VOICELOG_SESSION_TTL_HOURS) || 24 * 30);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const database = new DatabaseSync(DB_PATH);
database.exec("PRAGMA journal_mode = WAL;");
database.exec("PRAGMA foreign_keys = ON;");

database.exec(`
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
`);

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(raw, fallbackValue) {
  if (!raw) {
    return fallbackValue;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallbackValue;
  }
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(email) {
  return clean(email).toLowerCase();
}

function normalizeWorkspaceCode(code) {
  return clean(code).replace(/\s+/g, "").toUpperCase();
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function generateInviteCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function hashPassword(secret, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(secret || ""), salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(secret, storedHash) {
  const [salt, expected] = String(storedHash || "").split(":");
  if (!salt || !expected) {
    return false;
  }

  const actual = crypto.scryptSync(String(secret || ""), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function hashRecoveryCode(code) {
  return crypto.createHash("sha256").update(String(code || "")).digest("hex");
}

function pickProfileDraft(draft = {}, email = "") {
  return {
    role: clean(draft.role),
    company: clean(draft.company),
    timezone: clean(draft.timezone) || "Europe/Warsaw",
    googleEmail: clean(draft.googleEmail) || normalizeEmail(email),
    phone: clean(draft.phone),
    location: clean(draft.location),
    team: clean(draft.team),
    bio: clean(draft.bio),
    avatarUrl: clean(draft.avatarUrl),
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

function buildUserFromRow(row) {
  const profile = safeJsonParse(row.profile_json, {});
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

function workspaceMembers(workspaceId) {
  return database
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
    .map((row) => buildUserFromRow(row));
}

function workspaceIdsForUser(userId) {
  return database
    .prepare("SELECT workspace_id FROM workspace_members WHERE user_id = ? ORDER BY joined_at ASC")
    .all(userId)
    .map((row) => row.workspace_id);
}

function buildWorkspaceFromRow(row, currentUserId = "") {
  const memberIds = database
    .prepare("SELECT user_id FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC")
    .all(row.id)
    .map((item) => item.user_id);
  const memberRoles = database
    .prepare("SELECT user_id, member_role FROM workspace_members WHERE workspace_id = ? ORDER BY joined_at ASC")
    .all(row.id)
    .reduce((result, item) => {
      result[item.user_id] = item.member_role;
      return result;
    }, {});
  const membership = currentUserId
    ? database
        .prepare("SELECT member_role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
        .get(row.id, currentUserId)
    : null;

  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    inviteCode: row.invite_code,
    memberIds,
    memberRoles,
    memberRole: membership?.member_role || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function accessibleWorkspaces(userId) {
  return database
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
    .map((row) => buildWorkspaceFromRow(row, userId));
}

function ensureWorkspaceState(workspaceId) {
  const existing = database.prepare("SELECT workspace_id FROM workspace_state WHERE workspace_id = ?").get(workspaceId);
  if (existing) {
    return;
  }

  const timestamp = nowIso();
  database
    .prepare(
      `
        INSERT INTO workspace_state (
          workspace_id,
          meetings_json,
          manual_tasks_json,
          task_state_json,
          task_boards_json,
          calendar_meta_json,
          updated_at
        )
        VALUES (?, '[]', '[]', '{}', '{}', '{}', ?)
      `
    )
    .run(workspaceId, timestamp);
}

function getWorkspaceState(workspaceId) {
  ensureWorkspaceState(workspaceId);
  const row = database.prepare("SELECT * FROM workspace_state WHERE workspace_id = ?").get(workspaceId);
  return {
    meetings: safeJsonParse(row.meetings_json, []),
    manualTasks: safeJsonParse(row.manual_tasks_json, []),
    taskState: safeJsonParse(row.task_state_json, {}),
    taskBoards: safeJsonParse(row.task_boards_json, {}),
    calendarMeta: safeJsonParse(row.calendar_meta_json, {}),
    updatedAt: row.updated_at,
  };
}

function saveWorkspaceState(workspaceId, payload = {}) {
  ensureWorkspaceState(workspaceId);
  const timestamp = nowIso();
  database
    .prepare(
      `
        UPDATE workspace_state
        SET meetings_json = ?,
            manual_tasks_json = ?,
            task_state_json = ?,
            task_boards_json = ?,
            calendar_meta_json = ?,
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
      timestamp,
      workspaceId
    );

  database.prepare("UPDATE workspaces SET updated_at = ? WHERE id = ?").run(timestamp, workspaceId);
  return getWorkspaceState(workspaceId);
}

function createSession(userId, workspaceId) {
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const token = crypto.randomBytes(48).toString("hex");

  database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(timestamp);
  database
    .prepare(
      `
        INSERT INTO sessions (token, user_id, workspace_id, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(token, userId, workspaceId, timestamp, expiresAt);

  return {
    token,
    expiresAt,
  };
}

function getSession(token) {
  const row = database.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    database.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  return row;
}

function getMembership(workspaceId, userId) {
  return database
    .prepare("SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .get(workspaceId, userId);
}

function selectWorkspaceForUser(userId, preferredWorkspaceId = "") {
  const workspaceIds = workspaceIdsForUser(userId);
  if (!workspaceIds.length) {
    return "";
  }

  if (preferredWorkspaceId && workspaceIds.includes(preferredWorkspaceId)) {
    return preferredWorkspaceId;
  }

  return workspaceIds[0];
}

function buildSessionPayload(userId, workspaceId) {
  const userRow = database.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  const nextWorkspaceId = selectWorkspaceForUser(userId, workspaceId);
  if (!userRow || !nextWorkspaceId) {
    throw new Error("Unable to build session payload.");
  }

  return {
    user: buildUserFromRow(userRow),
    users: workspaceMembers(nextWorkspaceId),
    workspaces: accessibleWorkspaces(userId),
    workspaceId: nextWorkspaceId,
    state: getWorkspaceState(nextWorkspaceId),
  };
}

function registerUser(draft = {}) {
  const email = normalizeEmail(draft.email);
  const password = String(draft.password || "");
  const name = clean(draft.name);
  const workspaceMode = draft.workspaceMode === "join" ? "join" : "create";
  const inviteCode = normalizeWorkspaceCode(draft.workspaceCode);
  const requestedWorkspaceName = clean(draft.workspaceName);

  if (!email || !password || !name) {
    throw new Error("Uzupelnij imie, email i haslo.");
  }

  if (password.length < 6) {
    throw new Error("Haslo musi miec przynajmniej 6 znakow.");
  }

  const existingUser = database.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existingUser) {
    throw new Error("Konto z takim adresem juz istnieje.");
  }

  const timestamp = nowIso();
  const userId = generateId("user");
  let workspaceId = "";
  let memberRole = "member";

  database.exec("BEGIN");
  try {
    database
      .prepare(
        `
          INSERT INTO users (
            id,
            email,
            password_hash,
            name,
            provider,
            google_sub,
            google_email,
            recovery_code_hash,
            recovery_code_expires_at,
            profile_json,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, 'local', '', ?, '', '', ?, ?, ?)
        `
      )
      .run(
        userId,
        email,
        hashPassword(password),
        name,
        email,
        JSON.stringify(pickProfileDraft(draft, email)),
        timestamp,
        timestamp
      );

    if (workspaceMode === "join") {
      const workspace = database.prepare("SELECT * FROM workspaces WHERE invite_code = ?").get(inviteCode);
      if (!workspace) {
        throw new Error("Nie znaleziono workspace o takim kodzie.");
      }

      workspaceId = workspace.id;
      database
        .prepare(
          `
            INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at)
            VALUES (?, ?, 'member', ?)
          `
        )
        .run(workspaceId, userId, timestamp);
    } else {
      workspaceId = generateId("workspace");
      memberRole = "owner";
      database
        .prepare(
          `
            INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          workspaceId,
          requestedWorkspaceName || `${name} workspace`,
          userId,
          generateInviteCode(),
          timestamp,
          timestamp
        );
      database
        .prepare(
          `
            INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at)
            VALUES (?, ?, 'owner', ?)
          `
        )
        .run(workspaceId, userId, timestamp);
      ensureWorkspaceState(workspaceId);
    }

    if (workspaceMode === "join") {
      ensureWorkspaceState(workspaceId);
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  const session = createSession(userId, workspaceId);
  const payload = buildSessionPayload(userId, workspaceId);
  payload.user.workspaceMemberRole = memberRole || getMembership(workspaceId, userId)?.member_role || "member";
  return {
    ...payload,
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

function loginUser(draft = {}) {
  const email = normalizeEmail(draft.email);
  const password = String(draft.password || "");
  const row = database.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!row || !row.password_hash || !verifyPassword(password, row.password_hash)) {
    throw new Error("Niepoprawny email lub haslo.");
  }

  const workspaceId = selectWorkspaceForUser(row.id, clean(draft.workspaceId));
  if (!workspaceId) {
    throw new Error("To konto nie jest jeszcze przypiete do zadnego workspace.");
  }

  const session = createSession(row.id, workspaceId);
  return {
    ...buildSessionPayload(row.id, workspaceId),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

function requestPasswordReset(draft = {}) {
  const email = normalizeEmail(draft.email);
  const row = database.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row) {
    throw new Error("Nie znaleziono konta z takim adresem.");
  }

  if (!row.password_hash) {
    throw new Error("To konto korzysta z logowania Google. Reset hasla wykonaj w Google.");
  }

  const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  database
    .prepare(
      `
        UPDATE users
        SET recovery_code_hash = ?, recovery_code_expires_at = ?, updated_at = ?
        WHERE id = ?
      `
    )
    .run(hashRecoveryCode(recoveryCode), expiresAt, nowIso(), row.id);

  return {
    recoveryCode,
    expiresAt,
  };
}

function resetPasswordWithCode(draft = {}) {
  const email = normalizeEmail(draft.email);
  const code = clean(draft.code);
  const newPassword = String(draft.newPassword || "");
  const confirmPassword = String(draft.confirmPassword || "");
  const row = database.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!row) {
    throw new Error("Nie znaleziono konta z takim adresem.");
  }

  if (!code || !newPassword || !confirmPassword) {
    throw new Error("Uzupelnij email, kod i oba pola hasla.");
  }

  if (newPassword.length < 6) {
    throw new Error("Nowe haslo musi miec przynajmniej 6 znakow.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Nowe hasla nie sa identyczne.");
  }

  if (!row.recovery_code_hash || !row.recovery_code_expires_at) {
    throw new Error("Najpierw popros o kod resetu.");
  }

  if (new Date(row.recovery_code_expires_at).getTime() <= Date.now()) {
    throw new Error("Kod resetu wygasl. Wygeneruj nowy.");
  }

  if (hashRecoveryCode(code) !== row.recovery_code_hash) {
    throw new Error("Kod resetu jest niepoprawny.");
  }

  database
    .prepare(
      `
        UPDATE users
        SET password_hash = ?, recovery_code_hash = '', recovery_code_expires_at = '', updated_at = ?
        WHERE id = ?
      `
    )
    .run(hashPassword(newPassword), nowIso(), row.id);

  return {
    success: true,
  };
}

function upsertGoogleUser(profile = {}) {
  const email = normalizeEmail(profile.email);
  if (!email) {
    throw new Error("Brakuje adresu email z Google.");
  }

  const timestamp = nowIso();
  let row = database
    .prepare("SELECT * FROM users WHERE email = ? OR google_sub = ?")
    .get(email, clean(profile.sub));
  let workspaceId = "";

  database.exec("BEGIN");
  try {
    if (row) {
      const currentProfile = safeJsonParse(row.profile_json, {});
      const nextProfile = {
        ...currentProfile,
        avatarUrl: clean(profile.picture) || currentProfile.avatarUrl || "",
        googleEmail: email,
      };
      database
        .prepare(
          `
            UPDATE users
            SET email = ?, name = ?, provider = 'google', google_sub = ?, google_email = ?, profile_json = ?, updated_at = ?
            WHERE id = ?
          `
        )
        .run(
          email,
          clean(profile.name) || row.name,
          clean(profile.sub),
          email,
          JSON.stringify(nextProfile),
          timestamp,
          row.id
        );
      workspaceId = selectWorkspaceForUser(row.id);
    } else {
      const userId = generateId("user");
      workspaceId = generateId("workspace");
      database
        .prepare(
          `
            INSERT INTO users (
              id,
              email,
              password_hash,
              name,
              provider,
              google_sub,
              google_email,
              recovery_code_hash,
              recovery_code_expires_at,
              profile_json,
              created_at,
              updated_at
            )
            VALUES (?, ?, NULL, ?, 'google', ?, ?, '', '', ?, ?, ?)
          `
        )
        .run(
          userId,
          email,
          clean(profile.name) || clean(profile.given_name) || "Google user",
          clean(profile.sub),
          email,
          JSON.stringify(
            pickProfileDraft(
              {
                avatarUrl: clean(profile.picture),
                googleEmail: email,
              },
              email
            )
          ),
          timestamp,
          timestamp
        );
      database
        .prepare(
          `
            INSERT INTO workspaces (id, name, owner_user_id, invite_code, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          workspaceId,
          `${clean(profile.given_name) || clean(profile.name) || "Google"} workspace`,
          userId,
          generateInviteCode(),
          timestamp,
          timestamp
        );
      database
        .prepare(
          `
            INSERT INTO workspace_members (workspace_id, user_id, member_role, joined_at)
            VALUES (?, ?, 'owner', ?)
          `
        )
        .run(workspaceId, userId, timestamp);
      ensureWorkspaceState(workspaceId);
      row = database.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }

  const userId = row?.id || database.prepare("SELECT id FROM users WHERE email = ?").get(email)?.id;
  const session = createSession(userId, workspaceId || selectWorkspaceForUser(userId));
  return {
    ...buildSessionPayload(userId, workspaceId),
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

function updateUserProfile(userId, updates = {}) {
  const row = database.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!row) {
    throw new Error("Nie znaleziono konta.");
  }

  const currentProfile = safeJsonParse(row.profile_json, {});
  const nextProfile = {
    ...currentProfile,
    ...pickProfileDraft(
      {
        ...currentProfile,
        ...updates,
      },
      row.email
    ),
  };
  const nextName = clean(updates.name) || row.name;

  database
    .prepare(
      `
        UPDATE users
        SET name = ?, google_email = ?, profile_json = ?, updated_at = ?
        WHERE id = ?
      `
    )
    .run(nextName, nextProfile.googleEmail || row.google_email || row.email, JSON.stringify(nextProfile), nowIso(), userId);

  return buildUserFromRow(database.prepare("SELECT * FROM users WHERE id = ?").get(userId));
}

function changeUserPassword(userId, draft = {}) {
  const row = database.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!row) {
    throw new Error("Nie znaleziono konta.");
  }

  if (!row.password_hash) {
    throw new Error("Haslem tego konta zarzadza Google.");
  }

  const currentPassword = String(draft.currentPassword || "");
  const newPassword = String(draft.newPassword || "");
  const confirmPassword = String(draft.confirmPassword || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error("Uzupelnij wszystkie pola hasla.");
  }

  if (newPassword.length < 6) {
    throw new Error("Nowe haslo musi miec przynajmniej 6 znakow.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Nowe hasla nie sa identyczne.");
  }

  if (!verifyPassword(currentPassword, row.password_hash)) {
    throw new Error("Aktualne haslo jest niepoprawne.");
  }

  database
    .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
    .run(hashPassword(newPassword), nowIso(), userId);

  return {
    success: true,
  };
}

function upsertMediaAsset({ recordingId, workspaceId, meetingId = "", contentType, buffer, createdByUserId }) {
  const extension = {
    "audio/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
  }[String(contentType || "").toLowerCase()] || ".bin";
  const filePath = path.join(UPLOAD_DIR, `${recordingId}${extension}`);
  fs.writeFileSync(filePath, buffer);

  const existing = database.prepare("SELECT id FROM media_assets WHERE id = ?").get(recordingId);
  const timestamp = nowIso();

  if (existing) {
    database
      .prepare(
        `
          UPDATE media_assets
          SET workspace_id = ?, meeting_id = ?, file_path = ?, content_type = ?, size_bytes = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(workspaceId, meetingId, filePath, contentType, buffer.byteLength, timestamp, recordingId);
  } else {
    database
      .prepare(
        `
          INSERT INTO media_assets (
            id,
            workspace_id,
            meeting_id,
            created_by_user_id,
            file_path,
            content_type,
            size_bytes,
            transcription_status,
            transcript_json,
            diarization_json,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', '[]', '{}', ?, ?)
        `
      )
      .run(
        recordingId,
        workspaceId,
        meetingId,
        createdByUserId,
        filePath,
        contentType || "application/octet-stream",
        buffer.byteLength,
        timestamp,
        timestamp
      );
  }

  return database.prepare("SELECT * FROM media_assets WHERE id = ?").get(recordingId);
}

function getMediaAsset(recordingId) {
  return database.prepare("SELECT * FROM media_assets WHERE id = ?").get(recordingId);
}

function markTranscriptionProcessing(recordingId) {
  database
    .prepare(
      `
        UPDATE media_assets
        SET transcription_status = 'processing',
            updated_at = ?
        WHERE id = ?
      `
    )
    .run(nowIso(), recordingId);

  return getMediaAsset(recordingId);
}

function saveTranscriptionResult(recordingId, result = {}) {
  database
    .prepare(
      `
        UPDATE media_assets
        SET transcription_status = ?,
            transcript_json = ?,
            diarization_json = ?,
            updated_at = ?
        WHERE id = ?
      `
    )
    .run(
      clean(result.pipelineStatus) || "completed",
      JSON.stringify(Array.isArray(result.segments) ? result.segments : []),
      JSON.stringify(
        result.diarization && typeof result.diarization === "object"
          ? {
              ...result.diarization,
              reviewSummary: result.reviewSummary || null,
            }
          : { reviewSummary: result.reviewSummary || null }
      ),
      nowIso(),
      recordingId
    );

  return getMediaAsset(recordingId);
}

function markTranscriptionFailure(recordingId, errorMessage) {
  database
    .prepare(
      `
        UPDATE media_assets
        SET transcription_status = 'failed',
            diarization_json = ?,
            updated_at = ?
        WHERE id = ?
      `
    )
    .run(JSON.stringify({ errorMessage: clean(errorMessage) }), nowIso(), recordingId);

  return getMediaAsset(recordingId);
}

function queueTranscription(recordingId, updates = {}) {
  const asset = getMediaAsset(recordingId);
  if (!asset) {
    throw new Error("Nie znaleziono nagrania.");
  }

  database
    .prepare(
      `
        UPDATE media_assets
        SET workspace_id = ?,
            meeting_id = ?,
            content_type = ?,
            transcription_status = 'queued',
            transcript_json = '[]',
            diarization_json = '{}',
            updated_at = ?
        WHERE id = ?
      `
    )
    .run(
      clean(updates.workspaceId) || asset.workspace_id,
      clean(updates.meetingId) || asset.meeting_id,
      clean(updates.contentType) || asset.content_type,
      nowIso(),
      recordingId
    );

  return {
    diarization: {
      segments: [],
      speakerNames: {},
      speakerCount: 0,
      confidence: 0,
    },
    segments: [],
    speakerNames: {},
    speakerCount: 0,
    confidence: 0,
    pipelineStatus: "queued",
  };
}

function updateWorkspaceMemberRole(workspaceId, targetUserId, memberRole) {
  const nextRole = ["owner", "admin", "member", "viewer"].includes(memberRole) ? memberRole : "member";
  database
    .prepare("UPDATE workspace_members SET member_role = ? WHERE workspace_id = ? AND user_id = ?")
    .run(nextRole, workspaceId, targetUserId);
  return getMembership(workspaceId, targetUserId);
}

function getHealth() {
  return {
    ok: true,
    dbPath: DB_PATH,
    uploadDir: UPLOAD_DIR,
  };
}

module.exports = {
  DATA_DIR,
  DB_PATH,
  UPLOAD_DIR,
  database,
  nowIso,
  normalizeEmail,
  normalizeWorkspaceCode,
  getSession,
  getMembership,
  buildSessionPayload,
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPasswordWithCode,
  upsertGoogleUser,
  updateUserProfile,
  changeUserPassword,
  saveWorkspaceState,
  upsertMediaAsset,
  getMediaAsset,
  markTranscriptionProcessing,
  saveTranscriptionResult,
  markTranscriptionFailure,
  queueTranscription,
  updateWorkspaceMemberRole,
  getHealth,
};
