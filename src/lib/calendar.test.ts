import { describe, test, expect } from 'vitest';
import { buildCalendarDescription, buildGoogleCalendarUrl, downloadMeetingIcs } from './calendar';
import * as storage from './storage';

vi.mock('./storage', () => ({
  downloadTextFile: vi.fn(),
}));

describe('calendar library', () => {
  const mockMeeting = {
    id: 'm1',
    title: 'Test Meeting',
    context: 'Context info',
    attendees: ['Jan', 'Anna'],
    needs: ['Need 1'],
    desiredOutputs: ['Output 1'],
    startsAt: '2026-03-20T10:00:00Z',
    durationMinutes: 60,
    location: 'Office',
    analysis: {
      summary: 'Short summary',
      actionItems: ['Item 1']
    }
  };

  test('buildCalendarDescription should format all sections', () => {
    const desc = buildCalendarDescription(mockMeeting);
    expect(desc).toContain('Context: Context info');
    expect(desc).toContain('Attendees: Jan, Anna');
    expect(desc).toContain('Latest summary: Short summary');
    expect(desc).toContain('Action items: Item 1');
  });

  test('buildGoogleCalendarUrl should generate correct URL with encoded params', () => {
    const url = buildGoogleCalendarUrl(mockMeeting);
    expect(url).toContain('https://calendar.google.com/calendar/render');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('text=Test+Meeting');
    // URLSearchParams encodes / as %2F
    expect(url).toContain('dates=20260320T100000Z%2F20260320T110000Z');
  });

  test('downloadMeetingIcs should call downloadTextFile with ICS content', () => {
    downloadMeetingIcs(mockMeeting);
    
    expect(storage.downloadTextFile).toHaveBeenCalledWith(
      'test-meeting.ics',
      expect.stringContaining('BEGIN:VCALENDAR'),
      'text/calendar;charset=utf-8'
    );
    
    const callArgs = (storage.downloadTextFile as any).mock.calls[0];
    const icsContent = callArgs[1];
    expect(icsContent).toContain('SUMMARY:Test Meeting');
    expect(icsContent).toContain('LOCATION:Office');
  });

  test('downloadMeetingIcs should handle special characters in title for filename', () => {
    downloadMeetingIcs({ ...mockMeeting, title: 'Meeting @ 2:00!' });
    expect(storage.downloadTextFile).toHaveBeenCalledWith(
      'meeting-2-00.ics',
      expect.any(String),
      expect.any(String)
    );
  });
});
