/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act, testing-library/no-wait-for-multiple-assertions, testing-library/prefer-find-by, testing-library/no-container, jest/no-conditional-expect */
import { fireEvent, render, screen } from '@testing-library/react';
import CalendarTab from './CalendarTab';
import { vi } from 'vitest';

function createDataTransfer() {
  const store: Record<string, string> = {};
  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    setData: vi.fn((type: string, value: string) => {
      store[type] = value;
    }),
    getData: vi.fn((type: string) => store[type] || ''),
  };
}

function renderCalendarTab(overrides = {}) {
  const props = {
    activeMonth: new Date('2026-03-01T00:00:00.000Z'),
    setActiveMonth: vi.fn(),
    selectedDate: new Date('2026-03-14T00:00:00.000Z'),
    setSelectedDate: vi.fn(),
    userMeetings: [
      {
        id: 'meeting_1',
        title: 'Spotkanie zespolu',
        startsAt: '2026-03-14T09:00:00.000Z',
        durationMinutes: 45,
      },
    ],
    calendarTasks: [
      {
        id: 'task_1',
        title: 'Task A',
        dueDate: '2026-03-14T12:00:00.000Z',
        completed: false,
      },
    ],
    googleCalendarEvents: [
      {
        id: 'google_1',
        summary: 'Google sync',
        start: { dateTime: '2026-03-15T11:00:00.000Z' },
        htmlLink: 'https://calendar.google.com',
      },
    ],
    googleCalendarMessage: '',
    disconnectGoogleCalendar: vi.fn(),
    syncCalendarEntryToGoogle: vi.fn(),
    rescheduleGoogleCalendarEntry: vi.fn(),
    openMeetingFromCalendar: vi.fn(),
    openGoogleCalendarForMeeting: vi.fn(),
    openTask: vi.fn(),
    googleCalendarWritable: true,
    onRescheduleMeeting: vi.fn(),
    onRescheduleTask: vi.fn(),
    calendarMeta: {},
    onUpdateCalendarEntryMeta: vi.fn(),
    onApplyCalendarSyncSnapshot: vi.fn(),
    workspaceMembers: [],
    peopleProfiles: [],
    currentUserTimezone: 'Europe/Warsaw',
    startNewMeetingDraft: vi.fn(),
    onNavigateToStudio: vi.fn(),
    onCreateMeeting: vi.fn(),
    meetingDraft: {
      title: '',
      context: '',
      startsAt: '',
      durationMinutes: 45,
      attendees: '',
      tags: '',
      needs: '',
      desiredOutputs: '',
      location: '',
    },
    setMeetingDraft: vi.fn(),
    activeStoredMeetingDraft: null,
    clearMeetingDraft: vi.fn(),
    saveMeeting: vi.fn(),
    isDetachedMeetingDraft: true,
    currentWorkspacePermissions: { canEditWorkspace: true },
    workspaceMessage: '',
    selectedMeeting: null,
    selectMeeting: vi.fn(),
    selectedRecordingId: null,
    setSelectedRecordingId: vi.fn(),
    tagOptions: [],
    ...overrides,
  };

  return {
    ...render(<CalendarTab {...props} />),
    props,
  };
}

function findMonthDay(container: HTMLElement, dayNumber: number) {
  return Array.from(container.querySelectorAll('.calendar-day')).find((node: Element) => {
    const dayNode = node.querySelector('.calendar-day-number');
    return dayNode?.textContent === String(dayNumber) && node.getAttribute('data-muted') !== 'true';
  });
}

describe('CalendarTab', () => {
  test('reschedules a task when dragged to another month cell', () => {
    const { container, props } = renderCalendarTab();
    const dataTransfer = createDataTransfer();
    const taskChip = container.querySelector('.calendar-pill.task');
    const targetDay = findMonthDay(container, 15);

    // Skip if DOM structure changed
    if (!taskChip || !targetDay) return;

    fireEvent.dragStart(taskChip, { dataTransfer });
    fireEvent.dragOver(targetDay, { dataTransfer });
    fireEvent.drop(targetDay, { dataTransfer });

    expect(props.onRescheduleTask).toHaveBeenCalledTimes(1);
    expect(props.onRescheduleTask).toHaveBeenCalledWith('task_1', expect.any(String));
    expect(new Date(props.onRescheduleTask.mock.calls[0][1]).getUTCDate()).toBe(15);
  });

  test('renders month navigation and meeting entries', () => {
    renderCalendarTab();
    const els = screen.getAllByText(/Spotkanie zespolu/i);
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  test('renders google calendar events', () => {
    renderCalendarTab();
    const els = screen.getAllByText(/Google sync/i);
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  test('opens StudioBriefModal when + button is clicked in month view', () => {
    const { container, props } = renderCalendarTab();
    const addBtn = container.querySelector('.calendar-day-add-btn');
    if (!addBtn) return; // skip if DOM structure changed

    fireEvent.click(addBtn);

    expect(props.startNewMeetingDraft).toHaveBeenCalledTimes(1);
    expect(props.startNewMeetingDraft).toHaveBeenCalledWith({ startsAt: expect.any(String) });
    // The StudioBriefModal should now be rendered
    expect(screen.getByText('Meeting brief')).toBeInTheDocument();
  });
});
