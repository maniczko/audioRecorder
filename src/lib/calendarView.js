function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
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

export function groupMeetingsByDay(meetings, googleEvents = []) {
  const bucket = new Map();

  function append(dateValue, entry) {
    const date = startOfDay(dateValue);
    const key = date.toISOString();
    const current = bucket.get(key) || [];
    bucket.set(key, [...current, entry]);
  }

  meetings.forEach((meeting) => {
    append(new Date(meeting.startsAt), {
      id: meeting.id,
      title: meeting.title,
      startsAt: meeting.startsAt,
      durationMinutes: meeting.durationMinutes,
      type: "meeting",
    });
  });

  googleEvents.forEach((event) => {
    const eventStart = event.start?.dateTime || event.start?.date;
    if (!eventStart) {
      return;
    }

    append(new Date(eventStart), {
      id: event.id,
      title: event.summary || "Google event",
      startsAt: eventStart,
      durationMinutes: 30,
      type: "google",
    });
  });

  return bucket;
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
