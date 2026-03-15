export const REMINDER_PRESETS = [
  { value: 10, label: "10 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 godz." },
  { value: 180, label: "3 godz." },
  { value: 1440, label: "1 dzien" },
];

function uniqueNumbers(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => Number(value)).filter((value) => value > 0))].sort(
    (left, right) => left - right
  );
}

export function normalizeReminderOffsets(value) {
  return uniqueNumbers(value);
}

export function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date) {
  const next = startOfDay(date);
  const offset = (next.getDay() + 6) % 7;
  return addDays(next, -offset);
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function monthLabel(date) {
  return new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(date);
}

export function weekdayLabels() {
  const base = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat("pl-PL", { weekday: "short" }).format(addDays(base, index))
  );
}

export function buildMonthMatrix(activeDate) {
  const firstDay = startOfDay(new Date(activeDate.getFullYear(), activeDate.getMonth(), 1));
  const offset = (firstDay.getDay() + 6) % 7;
  const cursor = addDays(firstDay, -offset);

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => addDays(cursor, weekIndex * 7 + dayIndex))
  );
}

export function buildWeekDays(activeDate) {
  const weekStart = startOfWeek(activeDate);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function buildTimeSlots(startHour = 6, endHour = 21) {
  return Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
}

function createEntryKey(type, id) {
  return `${type}:${id}`;
}

function calculateEnd(value, durationMinutes = 0) {
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) {
    return value;
  }

  return new Date(start.getTime() + Math.max(0, Number(durationMinutes) || 0) * 60 * 1000).toISOString();
}

function calculateDurationMinutesBetween(startValue, endValue, fallbackMinutes = 30) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return fallbackMinutes;
  }

  return Math.max(15, Math.round((end.getTime() - start.getTime()) / (60 * 1000)) || fallbackMinutes);
}

function entryParticipants(entry) {
  if (entry.type === "meeting") {
    return Array.isArray(entry.source?.attendees) ? entry.source.attendees : [];
  }
  if (entry.type === "task") {
    return [...(entry.source?.assignedTo || []), entry.source?.owner].filter(Boolean);
  }
  return (Array.isArray(entry.source?.attendees) ? entry.source.attendees : [])
    .map((participant) => participant?.displayName || participant?.email || "")
    .filter(Boolean);
}

export function buildCalendarEntries(meetings, googleEvents = [], tasks = [], calendarMeta = {}) {
  const entries = [];

  meetings.forEach((meeting) => {
    if (!meeting?.startsAt) {
      return;
    }

    const key = createEntryKey("meeting", meeting.id);
    const durationMinutes = Number(calendarMeta[key]?.durationMinutes) || meeting.durationMinutes;
    entries.push({
      key,
      id: meeting.id,
      type: "meeting",
      title: meeting.title,
      startsAt: meeting.startsAt,
      endsAt: calculateEnd(meeting.startsAt, durationMinutes),
      durationMinutes,
      editable: true,
      reminders: normalizeReminderOffsets(calendarMeta[key]?.reminders),
      colorTone: "meeting",
      source: meeting,
      participants: meeting.attendees || [],
      googleEventId: calendarMeta[key]?.googleEventId || "",
      timezone: calendarMeta[key]?.timezone || "",
    });
  });

  googleEvents.forEach((event) => {
    const eventStart = event.start?.dateTime || event.start?.date;
    if (!eventStart) {
      return;
    }
    const eventEnd = event.end?.dateTime || event.end?.date || calculateEnd(eventStart, event.start?.date ? 24 * 60 : 30);
    const durationMinutes = calculateDurationMinutesBetween(eventStart, eventEnd, event.start?.date ? 24 * 60 : 30);
    entries.push({
      key: createEntryKey("google", event.id),
      id: event.id,
      type: "google",
      title: event.summary || "Google event",
      startsAt: eventStart,
      endsAt: eventEnd,
      durationMinutes,
      editable: true,
      reminders: [],
      colorTone: "google",
      source: event,
      htmlLink: event.htmlLink || "",
      participants: (event.attendees || []).map((attendee) => attendee.displayName || attendee.email).filter(Boolean),
      timezone: event.start?.timeZone || event.end?.timeZone || "",
    });
  });

  tasks.forEach((task) => {
    if (!task?.dueDate) {
      return;
    }

    const key = createEntryKey("task", task.id);
    const durationMinutes = Number(calendarMeta[key]?.durationMinutes) || 15;
    entries.push({
      key,
      id: task.id,
      type: "task",
      title: task.title,
      startsAt: task.dueDate,
      endsAt: calculateEnd(task.dueDate, durationMinutes),
      durationMinutes,
      editable: true,
      reminders: normalizeReminderOffsets(calendarMeta[key]?.reminders),
      colorTone: "task",
      source: task,
      participants: [...(task.assignedTo || []), task.owner].filter(Boolean),
      googleEventId: calendarMeta[key]?.googleEventId || "",
      timezone: calendarMeta[key]?.timezone || "",
    });
  });

  return entries.sort((left, right) => new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime());
}

export function groupMeetingsByDay(meetings, googleEvents = [], tasks = [], calendarMeta = {}) {
  const bucket = new Map();

  buildCalendarEntries(meetings, googleEvents, tasks, calendarMeta).forEach((entry) => {
    const key = startOfDay(new Date(entry.startsAt)).toISOString();
    const current = bucket.get(key) || [];
    bucket.set(key, [...current, entry]);
  });

  return bucket;
}

export function entriesForDay(entries, date) {
  return entries.filter((entry) => sameDay(new Date(entry.startsAt), startOfDay(date)));
}

export function meetingsForDay(bucket, date) {
  return bucket.get(startOfDay(date).toISOString()) || [];
}

export function isToday(date) {
  return sameDay(startOfDay(date), startOfDay(new Date()));
}

export function isCurrentMonth(date, activeDate) {
  return date.getMonth() === activeDate.getMonth() && date.getFullYear() === activeDate.getFullYear();
}

export function formatCalendarEventTime(value) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatCalendarDayLabel(date, options = {}) {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: options.short ? "short" : "long",
    day: "2-digit",
    month: options.month ? "long" : "short",
  }).format(date);
}

export function toLocalDateTimeValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function mergeDatePreservingTime(targetDate, sourceValue) {
  const base = new Date(targetDate);
  const source = sourceValue ? new Date(sourceValue) : new Date(targetDate);

  base.setHours(source.getHours(), source.getMinutes(), 0, 0);
  return base.toISOString();
}

export function mergeDateWithHour(targetDate, hour, sourceValue) {
  const base = new Date(targetDate);
  const source = sourceValue ? new Date(sourceValue) : new Date(targetDate);
  base.setHours(hour, source.getMinutes(), 0, 0);
  return base.toISOString();
}

export function reminderLabel(minutes) {
  const preset = REMINDER_PRESETS.find((item) => item.value === minutes);
  return preset ? preset.label : `${minutes} min`;
}

export function buildUpcomingReminders(entries, now = new Date()) {
  const nowTime = now.getTime();
  const edge = nowTime + 48 * 60 * 60 * 1000;

  return entries
    .flatMap((entry) =>
      normalizeReminderOffsets(entry.reminders).map((minutes) => {
        const remindAt = new Date(new Date(entry.startsAt).getTime() - minutes * 60 * 1000);
        return {
          id: `${entry.key}:${minutes}`,
          entryKey: entry.key,
          entryType: entry.type,
          entryId: entry.id,
          title: entry.title,
          startsAt: entry.startsAt,
          remindAt: remindAt.toISOString(),
          minutes,
        };
      })
    )
    .filter((reminder) => {
      const remindAt = new Date(reminder.remindAt).getTime();
      return remindAt >= nowTime - 60 * 1000 && remindAt <= edge;
    })
    .sort((left, right) => new Date(left.remindAt).getTime() - new Date(right.remindAt).getTime());
}

export function resizeCalendarEntry(entry, deltaMinutes) {
  const nextDuration = Math.max(15, (Number(entry?.durationMinutes) || 30) + Number(deltaMinutes || 0));
  const startsAt = entry?.startsAt || new Date().toISOString();
  return {
    startsAt,
    endsAt: calculateEnd(startsAt, nextDuration),
    durationMinutes: nextDuration,
  };
}

export function buildConflictMap(entries) {
  const conflictMap = {};
  const sorted = [...(Array.isArray(entries) ? entries : [])].sort(
    (left, right) => new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime()
  );

  sorted.forEach((entry, index) => {
    const start = new Date(entry.startsAt || 0).getTime();
    const end = new Date(entry.endsAt || entry.startsAt || 0).getTime();
    const conflicts = [];

    for (let candidateIndex = index + 1; candidateIndex < sorted.length; candidateIndex += 1) {
      const candidate = sorted[candidateIndex];
      const candidateStart = new Date(candidate.startsAt || 0).getTime();
      const candidateEnd = new Date(candidate.endsAt || candidate.startsAt || 0).getTime();
      if (candidateStart >= end) {
        break;
      }

      if (candidateStart < end && candidateEnd > start) {
        conflicts.push(candidate);
        conflictMap[candidate.key] = [...(conflictMap[candidate.key] || []), entry];
      }
    }

    if (conflicts.length) {
      conflictMap[entry.key] = [...(conflictMap[entry.key] || []), ...conflicts];
    }
  });

  return conflictMap;
}

function resolveParticipantTimezone(participant, workspaceMembers, peopleProfiles, fallbackTimeZone) {
  const normalizedParticipant = String(participant || "").trim().toLowerCase();
  const memberMatch = (Array.isArray(workspaceMembers) ? workspaceMembers : []).find((member) => {
    const values = [member.name, member.email, member.googleEmail].map((value) => String(value || "").trim().toLowerCase());
    return values.includes(normalizedParticipant);
  });
  if (memberMatch?.timezone) {
    return { label: memberMatch.name || memberMatch.email || participant, timezone: memberMatch.timezone };
  }

  const profileMatch = (Array.isArray(peopleProfiles) ? peopleProfiles : []).find(
    (profile) => String(profile.name || "").trim().toLowerCase() === normalizedParticipant
  );
  if (profileMatch?.timezone) {
    return { label: profileMatch.name || participant, timezone: profileMatch.timezone };
  }

  return {
    label: String(participant || "").trim() || "Uczestnik",
    timezone: fallbackTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw",
  };
}

export function buildParticipantTimezoneSummary(
  entry,
  workspaceMembers = [],
  peopleProfiles = [],
  fallbackTimeZone = "Europe/Warsaw"
) {
  const start = entry?.startsAt ? new Date(entry.startsAt) : null;
  const end = entry?.endsAt ? new Date(entry.endsAt) : null;
  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) {
    return [];
  }

  return [...new Map(entryParticipants(entry).map((participant) => [String(participant).trim().toLowerCase(), participant])).values()]
    .map((participant) => resolveParticipantTimezone(participant, workspaceMembers, peopleProfiles, fallbackTimeZone))
    .map((item) => ({
      ...item,
      window: new Intl.DateTimeFormat("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "2-digit",
        timeZone: item.timezone,
      }).format(start),
      range: `${new Intl.DateTimeFormat("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: item.timezone,
      }).format(start)} - ${new Intl.DateTimeFormat("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: item.timezone,
      }).format(end)}`,
    }));
}
