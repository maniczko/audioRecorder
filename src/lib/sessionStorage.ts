import { STORAGE_KEYS, readStorage, writeStorage } from "./storage";

export type WorkspaceSession = {
  userId: string;
  workspaceId: string;
  token: string;
};

const WORKSPACE_STORE_KEY = "voicelog_workspace_store";

function normalizeSession(candidate: any, options: { allowTokenOnly?: boolean } = {}): WorkspaceSession | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const token = String(candidate.token || "").trim();
  const userId = String(candidate.userId || "").trim();
  const workspaceId = String(candidate.workspaceId || "").trim();

  if (!token || (!userId && !options.allowTokenOnly)) {
    return null;
  }

  return {
    userId,
    workspaceId,
    token,
  };
}

export function readLegacySession() {
  return normalizeSession(readStorage(STORAGE_KEYS.session, null), { allowTokenOnly: true });
}

export function writeLegacySession(session: WorkspaceSession | null) {
  writeStorage(STORAGE_KEYS.session, normalizeSession(session));
}

export function clearPersistedSession() {
  writeLegacySession(null);
}

export function readWorkspacePersistedSession() {
  const persisted = readStorage(WORKSPACE_STORE_KEY, null);
  return normalizeSession(persisted?.state?.session || persisted?.session || null);
}

export function syncLegacySessionFromWorkspaceSession(session: WorkspaceSession | null) {
  const normalized = normalizeSession(session);
  writeLegacySession(normalized);
  return normalized;
}

export function resolvePersistedSession() {
  return readLegacySession() || readWorkspacePersistedSession();
}
