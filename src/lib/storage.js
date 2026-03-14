const isBrowser = typeof window !== "undefined";

export const STORAGE_KEYS = {
  users: "voicelog.users.v3",
  session: "voicelog.session.v3",
  meetings: "voicelog.meetings.v3",
  taskState: "voicelog.taskState.v1",
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

export function createId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function formatDateTime(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function downloadTextFile(filename, contents, mimeType = "text/plain;charset=utf-8") {
  if (!isBrowser) {
    return;
  }

  const link = window.document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  link.download = filename;
  link.click();
}
