import { describe, expect, test, vi } from 'vitest';
import {
  addDays,
  buildCalendarEntries,
  buildConflictMap,
  buildMonthMatrix,
  buildParticipantTimezoneSummary,
  buildTimeSlots,
  buildUpcomingReminders,
  buildWeekDays,
  entriesForDay,
  formatCalendarDayLabel,
  formatCalendarEventTime,
  groupMeetingsByDay,
  isCurrentMonth,
  isToday,
  meetingsForDay,
  mergeDatePreservingTime,
  mergeDateWithHour,
  monthLabel,
  normalizeReminderOffsets,
  reminderLabel,
  resizeCalendarEntry,
  startOfDay,
  startOfWeek,
  toLocalDateTimeValue,
  weekdayLabels,
} from './calendarView';

describe('calendarView helpers', () => {
  test('basic date helpers and labels', () => {
    const base = new Date('2026-03-10T12:00:00.000Z');
    expect(startOfDay(base).getHours()).toBe(0);
    expect(addDays(base, 2).getDate()).toBe(new Date('2026-03-12T12:00:00.000Z').getDate());
    expect(startOfWeek(base).getDay()).toBe(1);
    expect(monthLabel(base)).toMatch(/2026/);
    expect(weekdayLabels()).toHaveLength(7);
  });

  test('buildMonthMatrix and buildWeekDays', () => {
    const active = new Date(2026, 2, 10);
    const matrix = buildMonthMatrix(active);
    expect(matrix).toHaveLength(6);
    expect(matrix[0]).toHaveLength(7);
    const weekDays = buildWeekDays(active);
    expect(weekDays).toHaveLength(7);
    expect(weekDays[0].getDay()).toBe(1);
  });

  test('buildTimeSlots and reminder offsets', () => {
    expect(buildTimeSlots(8, 10)).toEqual([8, 9, 10]);
    expect(normalizeReminderOffsets([30, 10, 10, -5, '60'])).toEqual([10, 30, 60]);
    expect(reminderLabel(30)).toBe('30 min');
    expect(reminderLabel(45)).toBe('45 min');
  });

  test('calendar entries and grouping', () => {
    const meetings = [
      {
        id: 'm1',
        title: 'Daily',
        startsAt: '2026-03-10T10:00:00.000Z',
        durationMinutes: 60,
        attendees: ['Anna'],
      },
    ];
    const googleEvents = [
      {
        id: 'g1',
        summary: 'Event',
        start: { dateTime: '2026-03-10T12:00:00.000Z', timeZone: 'Europe/Warsaw' },
        end: { dateTime: '2026-03-10T12:30:00.000Z' },
        attendees: [{ displayName: 'Bob' }],
      },
      {
        id: 'g2',
        summary: 'All day',
        start: { date: '2026-03-11' },
        end: { date: '2026-03-12' },
      },
    ];
    const tasks = [
      { id: 't1', title: 'Task', dueDate: '2026-03-10T09:30:00.000Z', assignedTo: [], owner: '' },
    ];
    const meta = { 'meeting:m1': { durationMinutes: 45, reminders: [10] } };

    const entries = buildCalendarEntries(meetings, googleEvents, tasks, meta);
    expect(entries[0].startsAt).toBe('2026-03-10T09:30:00.000Z');
    expect(entries.find((entry) => entry.key === 'meeting:m1')?.durationMinutes).toBe(45);
    expect(entries.find((entry) => entry.key === 'google:g2')?.durationMinutes).toBe(1440);

    const bucket = groupMeetingsByDay(meetings, googleEvents, tasks, meta);
    const dayKey = startOfDay(new Date('2026-03-10T10:00:00.000Z')).toISOString();
    expect(bucket.get(dayKey)).toBeTruthy();
    expect(entriesForDay(entries, new Date('2026-03-10T00:00:00.000Z'))).toHaveLength(3);
    expect(meetingsForDay(bucket, new Date('2026-03-10T00:00:00.000Z'))).toHaveLength(3);
  });

  test('today and month helpers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));

    expect(isToday(new Date('2026-03-10T08:00:00.000Z'))).toBe(true);
    expect(
      isCurrentMonth(new Date('2026-03-01T00:00:00.000Z'), new Date('2026-03-10T00:00:00.000Z'))
    ).toBe(true);
    expect(
      isCurrentMonth(new Date('2026-04-01T00:00:00.000Z'), new Date('2026-03-10T00:00:00.000Z'))
    ).toBe(false);

    vi.useRealTimers();
  });

  test('format helpers and local datetime value', () => {
    const label = formatCalendarDayLabel(new Date('2026-03-10T00:00:00.000Z'), {
      short: true,
      month: true,
    });
    expect(label).toBeTruthy();
    const time = formatCalendarEventTime('2026-03-10T09:30:00.000Z');
    expect(time).toMatch(/\d{2}:\d{2}/);
    expect(toLocalDateTimeValue('invalid')).toBe('');
    expect(toLocalDateTimeValue('2026-03-10T09:30:00.000Z')).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    );
  });

  test('merge date helpers preserve time and hour', () => {
    const merged = mergeDatePreservingTime('2026-03-10T00:00:00.000Z', '2026-03-10T15:45:00.000Z');
    const mergedDate = new Date(merged);
    const source = new Date('2026-03-10T15:45:00.000Z');
    expect(mergedDate.getHours()).toBe(source.getHours());
    expect(mergedDate.getMinutes()).toBe(source.getMinutes());

    const mergedHour = mergeDateWithHour('2026-03-10T00:00:00.000Z', 9, '2026-03-10T15:30:00.000Z');
    const mergedHourDate = new Date(mergedHour);
    expect(mergedHourDate.getHours()).toBe(9);
  });

  test('upcoming reminders and resizing', () => {
    const entries = [
      {
        key: 'meeting:m1',
        id: 'm1',
        type: 'meeting',
        title: 'Daily',
        startsAt: '2026-03-10T10:00:00.000Z',
        reminders: [30, 60],
      },
    ];
    const now = new Date('2026-03-10T09:20:00.000Z');
    const reminders = buildUpcomingReminders(entries, now);
    expect(reminders[0].minutes).toBe(30);

    const resized = resizeCalendarEntry(
      { startsAt: '2026-03-10T10:00:00.000Z', durationMinutes: 10 },
      -5
    );
    expect(resized.durationMinutes).toBe(15);
  });

  test('conflict map detects overlaps', () => {
    const entries = [
      {
        key: 'a',
        startsAt: '2026-03-10T10:00:00.000Z',
        endsAt: '2026-03-10T11:00:00.000Z',
      },
      {
        key: 'b',
        startsAt: '2026-03-10T10:30:00.000Z',
        endsAt: '2026-03-10T11:30:00.000Z',
      },
      {
        key: 'c',
        startsAt: '2026-03-10T12:00:00.000Z',
        endsAt: '2026-03-10T12:30:00.000Z',
      },
    ];

    const conflicts = buildConflictMap(entries);
    expect(conflicts.a).toHaveLength(1);
    expect(conflicts.b).toHaveLength(1);
    expect(conflicts.c).toBeUndefined();
  });

  test('participant timezone summary uses workspace and profile data', () => {
    const entry = {
      type: 'google',
      startsAt: '2026-03-10T10:00:00.000Z',
      endsAt: '2026-03-10T11:00:00.000Z',
      source: {
        attendees: [
          { displayName: 'Anna', email: 'anna@example.com' },
          { displayName: 'Bob', email: 'bob@example.com' },
        ],
      },
    };

    const summary = buildParticipantTimezoneSummary(
      entry,
      [{ name: 'Anna', timezone: 'Europe/Paris' }],
      [{ name: 'Bob', timezone: 'America/New_York' }],
      'Europe/Warsaw'
    );

    expect(summary).toHaveLength(2);
    expect(summary.find((item) => item.label === 'Anna')?.timezone).toBe('Europe/Paris');
    expect(summary.find((item) => item.label === 'Bob')?.timezone).toBe('America/New_York');
  });
});
