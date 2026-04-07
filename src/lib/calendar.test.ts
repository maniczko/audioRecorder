/**
 * @vitest-environment jsdom
 * calendar lib tests
 *
 * Tests for calendar utility functions:
 * - buildCalendarDescription
 * - buildGoogleCalendarUrl
 * - downloadMeetingIcs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  downloadTextFile: vi.fn(),
}));

vi.mock('./storage', () => ({
  downloadTextFile: mocks.downloadTextFile,
}));

// Now import the module
import { buildCalendarDescription, buildGoogleCalendarUrl, downloadMeetingIcs } from './calendar';

describe('buildCalendarDescription', () => {
  const mockMeeting = {
    id: 'meeting-1',
    title: 'Team Standup',
    context: 'Daily sync meeting',
    attendees: ['Alice', 'Bob', 'Charlie'],
    needs: ['Status update', 'Blockers'],
    desiredOutputs: ['Action items', 'Next steps'],
    location: 'Zoom Room A',
    startsAt: '2024-01-15T10:00:00Z',
    durationMinutes: 30,
  };

  it('builds description with all meeting fields', () => {
    const description = buildCalendarDescription(mockMeeting);

    expect(description).toContain('Context: Daily sync meeting');
    expect(description).toContain('Attendees: Alice, Bob, Charlie');
    expect(description).toContain('Needs: Status update | Blockers');
    expect(description).toContain('Desired outputs: Action items | Next steps');
  });

  it('includes analysis summary when present', () => {
    const meetingWithAnalysis = {
      ...mockMeeting,
      analysis: {
        summary: 'Great discussion about Q1 goals',
      },
    };

    const description = buildCalendarDescription(meetingWithAnalysis);
    expect(description).toContain('Latest summary: Great discussion about Q1 goals');
  });

  it('includes action items when present', () => {
    const meetingWithActions = {
      ...mockMeeting,
      analysis: {
        actionItems: ['Review PR #123', 'Update documentation'],
      },
    };

    const description = buildCalendarDescription(meetingWithActions);
    expect(description).toContain('Action items: Review PR #123 | Update documentation');
  });

  it('handles missing optional fields gracefully', () => {
    const minimalMeeting = {
      id: 'meeting-2',
      title: 'Quick Sync',
      startsAt: '2024-01-15T11:00:00Z',
      durationMinutes: 15,
    };

    const description = buildCalendarDescription(minimalMeeting);
    expect(description).toContain('Context: No extra context.');
    expect(description).toContain('Attendees: Not specified');
    expect(description).toContain('Needs: Not specified');
    expect(description).toContain('Desired outputs: Not specified');
  });

  it('handles empty arrays', () => {
    const meetingWithEmptyArrays = {
      ...mockMeeting,
      attendees: [],
      needs: [],
      desiredOutputs: [],
    };

    const description = buildCalendarDescription(meetingWithEmptyArrays);
    expect(description).toContain('Attendees: Not specified');
    expect(description).toContain('Needs: Not specified');
    expect(description).toContain('Desired outputs: Not specified');
  });
});

describe('buildGoogleCalendarUrl', () => {
  const mockMeeting = {
    id: 'meeting-1',
    title: 'Team Standup',
    startsAt: '2024-01-15T10:00:00Z',
    durationMinutes: 30,
    location: 'Zoom Room A',
    context: 'Daily sync',
    attendees: ['Alice', 'Bob'],
    needs: ['Status update'],
    desiredOutputs: ['Action items'],
  };

  it('builds valid Google Calendar URL', () => {
    const url = buildGoogleCalendarUrl(mockMeeting);

    expect(url).toContain('https://calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Team+Standup');
    expect(url).toContain('location=Zoom+Room+A');
  });

  it('includes correct start and end dates', () => {
    const url = buildGoogleCalendarUrl(mockMeeting);

    // Should contain dates parameter with start/end
    expect(url).toContain('dates=');
    // Meeting starts at 2024-01-15T10:00:00Z and lasts 30 minutes
    expect(url).toContain('20240115T100000Z');
    expect(url).toContain('20240115T103000Z');
  });

  it('includes meeting description', () => {
    const url = buildGoogleCalendarUrl(mockMeeting);

    expect(url).toContain('details=');
    expect(url).toContain('Context%3A+Daily+sync');
  });

  it('handles missing location', () => {
    const meetingNoLocation = {
      ...mockMeeting,
      location: '',
    };

    const url = buildGoogleCalendarUrl(meetingNoLocation);
    expect(url).toContain('location=');
  });

  it('encodes special characters in title', () => {
    const meetingWithSpecialChars = {
      ...mockMeeting,
      title: 'Team Standup & Review (Q1)',
    };

    const url = buildGoogleCalendarUrl(meetingWithSpecialChars);
    expect(url).toContain('text=Team+Standup+%26+Review+%28Q1%29');
  });

  it('handles long duration meetings', () => {
    const longMeeting = {
      ...mockMeeting,
      durationMinutes: 120, // 2 hours
    };

    const url = buildGoogleCalendarUrl(longMeeting);
    expect(url).toContain('20240115T100000Z');
    expect(url).toContain('20240115T120000Z'); // 2 hours later
  });
});

describe('downloadMeetingIcs', () => {
  const mockMeeting = {
    id: 'meeting-1',
    title: 'Team Standup',
    startsAt: '2024-01-15T10:00:00Z',
    durationMinutes: 30,
    location: 'Zoom Room A',
    context: 'Daily sync',
    attendees: ['Alice', 'Bob'],
    needs: ['Status update'],
    desiredOutputs: ['Action items'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls downloadTextFile with correct ICS content', () => {
    downloadMeetingIcs(mockMeeting);

    expect(mocks.downloadTextFile).toHaveBeenCalledTimes(1);

    const [filename, content, mimeType] = mocks.downloadTextFile.mock.calls[0];
    expect(filename).toBe('team-standup.ics');
    expect(mimeType).toBe('text/calendar;charset=utf-8');
    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('VERSION:2.0');
    expect(content).toContain('PRODID:-//VoiceLog//Meeting Intelligence//EN');
    expect(content).toContain('BEGIN:VEVENT');
    expect(content).toContain('END:VEVENT');
    expect(content).toContain('END:VCALENDAR');
  });

  it('includes meeting UID in ICS', () => {
    downloadMeetingIcs(mockMeeting);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('UID:meeting-1@voicelog.local');
  });

  it('includes correct DTSTART and DTEND', () => {
    downloadMeetingIcs(mockMeeting);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('DTSTART:20240115T100000Z');
    expect(content).toContain('DTEND:20240115T103000Z');
  });

  it('includes SUMMARY with escaped text', () => {
    const meetingWithSpecialChars = {
      ...mockMeeting,
      title: 'Team Standup & Review',
    };

    downloadMeetingIcs(meetingWithSpecialChars);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('SUMMARY:Team Standup & Review');
  });

  it('includes DESCRIPTION with meeting details', () => {
    downloadMeetingIcs(mockMeeting);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('DESCRIPTION:');
    expect(content).toContain('Context: Daily sync');
    expect(content).toContain('Attendees: Alice\\, Bob');
  });

  it('includes LOCATION', () => {
    downloadMeetingIcs(mockMeeting);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('LOCATION:Zoom Room A');
  });

  it('handles missing location gracefully', () => {
    const meetingNoLocation = {
      ...mockMeeting,
      location: '',
    };

    downloadMeetingIcs(meetingNoLocation);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('LOCATION:');
  });

  it('escapes newlines in description', () => {
    const meetingWithNewlines = {
      ...mockMeeting,
      context: 'Line 1\nLine 2',
    };

    downloadMeetingIcs(meetingWithNewlines);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    // ICS format should escape newlines
    expect(content).not.toContain('\nLine 2');
  });

  it('escapes commas in description', () => {
    const meetingWithCommas = {
      ...mockMeeting,
      attendees: ['Alice, Bob', 'Charlie'],
    };

    downloadMeetingIcs(meetingWithCommas);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('Alice\\, Bob');
  });

  it('escapes semicolons in description', () => {
    const meetingWithSemis = {
      ...mockMeeting,
      context: 'Context; with; semicolons',
    };

    downloadMeetingIcs(meetingWithSemis);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('Context\\; with\\; semicolons');
  });

  it('escapes backslashes in description', () => {
    const meetingWithBackslash = {
      ...mockMeeting,
      location: 'Room \\A\\',
    };

    downloadMeetingIcs(meetingWithBackslash);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toContain('Room \\\\A\\\\');
  });

  it('includes DTSTAMP', () => {
    downloadMeetingIcs(mockMeeting);

    const [, content] = mocks.downloadTextFile.mock.calls[0];
    expect(content).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
  });
});
