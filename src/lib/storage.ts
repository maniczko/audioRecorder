import { get, set, del } from 'idb-keyval';

const isBrowser = typeof window !== 'undefined';

export const STORAGE_KEYS = {
  users: 'voicelog.users.v3',
  session: 'voicelog.session.v3',
  workspaces: 'voicelog.workspaces.v1',
  meetings: 'voicelog.meetings.v3',
  taskState: 'voicelog.taskState.v1',
  manualTasks: 'voicelog.manualTasks.v1',
  taskBoards: 'voicelog.taskBoards.v1',
  calendarMeta: 'voicelog.calendarMeta.v1',
  meetingDrafts: 'voicelog.meetingDrafts.v1',
  personNotes: 'voicelog.personNotes.v1',
  notificationState: 'voicelog.notificationState.v1',
  recordingQueue: 'voicelog.recordingQueue.v1',
  vocabulary: 'voicelog.vocabulary.v1',
};

export function readStorage(key, fallbackValue) {
  if (!isBrowser) {
    return fallbackValue;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch (error) {
    console.error(`Unable to read localStorage key "${key}".`, error);
    return fallbackValue;
  }
}

export function writeStorage(key, value) {
  if (!isBrowser) {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to write localStorage key "${key}".`, error);
  }
}

export async function readStorageAsync(key, fallbackValue) {
  if (!isBrowser) return fallbackValue;
  if (!window.indexedDB) return readStorage(key, fallbackValue);
  try {
    let val = await get(key);
    if (val === undefined) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        val = JSON.parse(raw);
        await set(key, val);
      } else {
        val = fallbackValue;
      }
    }
    return val;
  } catch (e) {
    console.error(`Unable to read idb key "${key}".`, e);
    return fallbackValue;
  }
}

export async function writeStorageAsync(key, value) {
  if (!isBrowser) return;
  if (!window.indexedDB) return writeStorage(key, value);
  try {
    await set(key, value);
  } catch (e) {
    console.error(`Unable to write idb key "${key}".`, e);
  }
}

export const idbJSONStorage = {
  getItem: async (name) => {
    const val = await readStorageAsync(name, null);
    // Zustand expects string outputs if using createJSONStorage, but idb-keyval stores parsed objects.
    // If we supply raw storage, we can bypass createJSONStorage if we want, or ensure we stringify since it parses inside IDB.
    // To match raw idb, we should stringify before returning so createJSONStorage can JSON.parse it.
    return val !== null ? JSON.stringify(val) : null;
  },
  setItem: async (name, value) => {
    // createJSONStorage passes already stringified value. We decode it to store as object.
    await writeStorageAsync(name, JSON.parse(value));
  },
  removeItem: async (name) => {
    if (!isBrowser) return;
    if (!window.indexedDB) {
      window.localStorage.removeItem(name);
      return;
    }
    await del(name);
  },
};

export function createId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = String(Math.floor(total / 60)).padStart(2, '0');
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export function formatDateTime(value) {
  if (!value) {
    return 'No date';
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function downloadTextFile(filename, contents, mimeType = 'text/plain;charset=utf-8') {
  if (!isBrowser) {
    return;
  }

  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
