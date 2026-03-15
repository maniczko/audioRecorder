import { createId } from "./storage";

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toIsoOrEmpty(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function toTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function computeDurationMinutes(startsAt, endsAt, fallbackMinutes = 30) {
  const start = new Date(startsAt || 0);
  const end = new Date(endsAt || 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return fallbackMinutes;
  }

  return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000) || fallbackMinutes);
}

export function buildGoogleTaskSnapshot(taskLike) {
  return {
    title: cleanText(taskLike?.title),
    dueDate: toIsoOrEmpty(taskLike?.dueDate || taskLike?.due),
    notes: cleanText(taskLike?.notes || taskLike?.description),
    completed: Boolean(taskLike?.completed || taskLike?.status === "completed"),
  };
}

export function areGoogleTaskSnapshotsEqual(left, right) {
  return (
    cleanText(left?.title) === cleanText(right?.title) &&
    toIsoOrEmpty(left?.dueDate) === toIsoOrEmpty(right?.dueDate) &&
    cleanText(left?.notes) === cleanText(right?.notes) &&
    Boolean(left?.completed) === Boolean(right?.completed)
  );
}

export function detectGoogleTaskConflict(existingTask, importedTask) {
  const localSnapshot = buildGoogleTaskSnapshot(existingTask);
  const remoteSnapshot = buildGoogleTaskSnapshot(importedTask);
  const lastSyncedAt =
    existingTask?.googleSyncedAt || existingTask?.googlePulledAt || existingTask?.createdAt || importedTask?.createdAt || "";
  const localUpdatedAt = existingTask?.googleLocalUpdatedAt || existingTask?.updatedAt || existingTask?.createdAt || "";
  const remoteUpdatedAt = importedTask?.googleUpdatedAt || importedTask?.updatedAt || importedTask?.createdAt || "";
  const localChanged =
    existingTask?.googleSyncStatus === "local_changes" || toTimestamp(localUpdatedAt) > toTimestamp(lastSyncedAt);
  const remoteChanged = toTimestamp(remoteUpdatedAt) > toTimestamp(lastSyncedAt);

  return {
    hasConflict: localChanged && remoteChanged && !areGoogleTaskSnapshotsEqual(localSnapshot, remoteSnapshot),
    localSnapshot,
    remoteSnapshot,
    localUpdatedAt,
    remoteUpdatedAt,
    lastSyncedAt,
  };
}

export function createGoogleTaskConflictState(existingTask, importedTask) {
  const conflict = detectGoogleTaskConflict(existingTask, importedTask);
  if (!conflict.hasConflict) {
    return null;
  }

  return {
    id: createId("google_task_conflict"),
    entityType: "task",
    detectedAt: new Date().toISOString(),
    localSnapshot: conflict.localSnapshot,
    remoteSnapshot: conflict.remoteSnapshot,
    finalSnapshot: conflict.localSnapshot,
    localUpdatedAt: conflict.localUpdatedAt,
    remoteUpdatedAt: conflict.remoteUpdatedAt,
    lastSyncedAt: conflict.lastSyncedAt,
    sourceLabel: importedTask?.sourceMeetingTitle || existingTask?.sourceMeetingTitle || "Google Tasks",
  };
}

export function buildCalendarSyncSnapshot(source, options = {}) {
  const type = options.type || source?.type || "meeting";
  if (type === "task") {
    return {
      title: cleanText(source?.title),
      startsAt: toIsoOrEmpty(source?.startsAt || source?.dueDate),
      endsAt: toIsoOrEmpty(source?.endsAt || source?.dueDate),
      durationMinutes: Number(source?.durationMinutes) || 15,
      location: "",
    };
  }

  return {
    title: cleanText(source?.title || source?.summary),
    startsAt: toIsoOrEmpty(source?.startsAt || source?.start?.dateTime || source?.start?.date),
    endsAt: toIsoOrEmpty(
      source?.endsAt ||
        source?.end?.dateTime ||
        source?.end?.date ||
        source?.startsAt ||
        source?.start?.dateTime ||
        source?.start?.date
    ),
    durationMinutes:
      Number(source?.durationMinutes) ||
      computeDurationMinutes(
        source?.startsAt || source?.start?.dateTime || source?.start?.date,
        source?.endsAt || source?.end?.dateTime || source?.end?.date,
        type === "task" ? 15 : 30
      ),
    location: cleanText(source?.location),
  };
}

export function areCalendarSyncSnapshotsEqual(left, right) {
  return (
    cleanText(left?.title) === cleanText(right?.title) &&
    toIsoOrEmpty(left?.startsAt) === toIsoOrEmpty(right?.startsAt) &&
    toIsoOrEmpty(left?.endsAt) === toIsoOrEmpty(right?.endsAt) &&
    Number(left?.durationMinutes || 0) === Number(right?.durationMinutes || 0) &&
    cleanText(left?.location) === cleanText(right?.location)
  );
}

export function detectGoogleCalendarConflict({ localSnapshot, remoteSnapshot, localUpdatedAt, remoteUpdatedAt, lastSyncedAt }) {
  const localChanged = toTimestamp(localUpdatedAt) > toTimestamp(lastSyncedAt);
  const remoteChanged = toTimestamp(remoteUpdatedAt) > toTimestamp(lastSyncedAt);

  return {
    hasConflict: localChanged && remoteChanged && !areCalendarSyncSnapshotsEqual(localSnapshot, remoteSnapshot),
    localChanged,
    remoteChanged,
  };
}

export function createGoogleCalendarConflictState({
  entryType,
  localSnapshot,
  remoteSnapshot,
  localUpdatedAt,
  remoteUpdatedAt,
  lastSyncedAt,
}) {
  const detection = detectGoogleCalendarConflict({
    localSnapshot,
    remoteSnapshot,
    localUpdatedAt,
    remoteUpdatedAt,
    lastSyncedAt,
  });

  if (!detection.hasConflict) {
    return null;
  }

  return {
    id: createId("google_calendar_conflict"),
    entityType: entryType,
    detectedAt: new Date().toISOString(),
    localSnapshot,
    remoteSnapshot,
    finalSnapshot: localSnapshot,
    localUpdatedAt,
    remoteUpdatedAt,
    lastSyncedAt,
  };
}
