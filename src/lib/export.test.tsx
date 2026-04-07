/**
 * @vitest-environment jsdom
 * export lib tests
 *
 * Tests for export utility functions:
 * - slugifyExportTitle
 * - buildMeetingNotesText
 * - printMeetingPdf
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { slugifyExportTitle, buildMeetingNotesText, printMeetingPdf } from './export';

describe('slugifyExportTitle', () => {
  it('converts simple title to slug', () => {
    expect(slugifyExportTitle('Team Standup Meeting')).toBe('team-standup-meeting');
  });

  it('handles special characters', () => {
    expect(slugifyExportTitle('Q1 Review & Planning (2024)')).toBe('q1-review-planning-2024');
  });

  it('handles multiple spaces', () => {
    expect(slugifyExportTitle('  Multiple   Spaces  Here  ')).toBe('multiple-spaces-here');
  });

  it('handles accented characters', () => {
    expect(slugifyExportTitle('Spotkanie Zespołu')).toBe('spotkanie-zespo-u');
  });

  it('handles empty string', () => {
    expect(slugifyExportTitle('')).toBe('meeting');
  });

  it('handles null/undefined', () => {
    expect(slugifyExportTitle(null as any)).toBe('meeting');
    expect(slugifyExportTitle(undefined as any)).toBe('meeting');
  });

  it('handles numeric titles', () => {
    expect(slugifyExportTitle('Meeting 123')).toBe('meeting-123');
  });

  it('handles already slugified strings', () => {
    expect(slugifyExportTitle('already-slugified')).toBe('already-slugified');
  });

  it('handles mixed case', () => {
    expect(slugifyExportTitle('MiXeD CaSe TiTlE')).toBe('mixed-case-title');
  });

  it('uses custom fallback', () => {
    expect(slugifyExportTitle('', 'custom-fallback')).toBe('custom-fallback');
  });

  it('handles only special characters', () => {
    expect(slugifyExportTitle('!!!@@@###')).toBe('meeting');
  });
});

describe('buildMeetingNotesText', () => {
  const mockFormatDateTime = (date: string) => new Date(date).toLocaleString('pl-PL');
  const mockMeeting = {
    id: 'meeting-1',
    title: 'Team Standup',
    startsAt: '2024-01-15T10:00:00Z',
    tags: ['weekly', 'sync'],
    needs: ['Status update', 'Blockers'],
    desiredOutputs: ['Action items', 'Next steps'],
  };

  const mockAnalysis = {
    summary: 'Great discussion about Q1 goals',
    decisions: ['Approve budget', 'Hire 2 developers'],
    actionItems: ['Review PR #123', 'Update docs'],
  };

  it('builds complete meeting notes', () => {
    const notes = buildMeetingNotesText(mockMeeting, mockAnalysis, mockFormatDateTime);

    expect(notes).toContain('Spotkanie: Team Standup');
    expect(notes).toContain('Start:');
    expect(notes).toContain('Tagi: weekly, sync');
    expect(notes).toContain('Potrzeby: Status update, Blockers');
    expect(notes).toContain('Outputy: Action items, Next steps');
    expect(notes).toContain('Podsumowanie:');
    expect(notes).toContain('Great discussion about Q1 goals');
    expect(notes).toContain('Decyzje:');
    expect(notes).toContain('- Approve budget');
    expect(notes).toContain('- Hire 2 developers');
    expect(notes).toContain('Zadania:');
    expect(notes).toContain('- Review PR #123');
    expect(notes).toContain('- Update docs');
  });

  it('handles missing meeting', () => {
    const notes = buildMeetingNotesText(null as any, mockAnalysis, mockFormatDateTime);
    expect(notes).toBe('');
  });

  it('handles missing analysis', () => {
    const notes = buildMeetingNotesText(mockMeeting, null, mockFormatDateTime);

    expect(notes).toContain('Spotkanie: Team Standup');
    expect(notes).toContain('Podsumowanie:');
    expect(notes).toContain('Brak');
  });

  it('handles empty arrays', () => {
    const meetingWithEmptyArrays = {
      ...mockMeeting,
      tags: [],
      needs: [],
      desiredOutputs: [],
    };

    const notes = buildMeetingNotesText(meetingWithEmptyArrays, mockAnalysis, mockFormatDateTime);

    expect(notes).toContain('Tagi: Brak');
    expect(notes).toContain('Potrzeby: Brak');
    expect(notes).toContain('Outputy: Brak');
  });

  it('includes AI debrief when present on meeting', () => {
    const meetingWithDebrief = {
      ...mockMeeting,
      aiDebrief: {
        summary: 'AI summary of the meeting',
        decisions: ['AI decision 1'],
        risks: ['AI risk 1'],
        followUps: ['AI follow-up 1'],
      },
    };

    const notes = buildMeetingNotesText(meetingWithDebrief, mockAnalysis, mockFormatDateTime);

    expect(notes).toContain('Debrief AI:');
    expect(notes).toContain('AI summary of the meeting');
    expect(notes).toContain('Decyzje debriefu:');
    expect(notes).toContain('- AI decision 1');
    expect(notes).toContain('Ryzyka debriefu:');
    expect(notes).toContain('- AI risk 1');
    expect(notes).toContain('Nastepne kroki debriefu:');
    expect(notes).toContain('- AI follow-up 1');
  });

  it('handles partial AI debrief', () => {
    const meetingWithPartialDebrief = {
      ...mockMeeting,
      aiDebrief: {
        summary: 'Partial debrief',
      },
    };

    const notes = buildMeetingNotesText(
      meetingWithPartialDebrief,
      mockAnalysis,
      mockFormatDateTime
    );

    expect(notes).toContain('Debrief AI:');
    expect(notes).toContain('Partial debrief');
    expect(notes).not.toContain('Decyzje debriefu:');
  });

  it('handles empty analysis fields', () => {
    const emptyAnalysis = {
      summary: '',
      decisions: [],
      actionItems: [],
    };

    const notes = buildMeetingNotesText(mockMeeting, emptyAnalysis, mockFormatDateTime);

    expect(notes).toContain('Podsumowanie:');
    expect(notes).toContain('Brak');
    expect(notes).toContain('Decyzje:');
    expect(notes).toContain('Zadania:');
  });
});

describe('printMeetingPdf', () => {
  let mockWindow: any;
  let mockDocument: any;
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockDocument = {
      write: vi.fn(),
      close: vi.fn(),
    };

    mockWindow = {
      document: mockDocument,
      focus: vi.fn(),
      print: vi.fn(),
    };

    openSpy = vi.spyOn(window, 'open').mockReturnValue(mockWindow as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens new window with correct parameters', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Team Standup',
      tags: ['weekly'],
      needs: ['Status'],
      desiredOutputs: ['Actions'],
      startsAt: '2024-01-15T10:00:00Z',
      analysis: { summary: 'Test summary' },
    };

    const mockRecording = {
      transcript: [],
      analysis: {},
    };

    printMeetingPdf(mockMeeting, mockRecording, {}, vi.fn(), vi.fn());

    expect(window.open).toHaveBeenCalledWith(
      '',
      '_blank',
      'noopener,noreferrer,width=980,height=900'
    );
    expect(mockDocument.close).toHaveBeenCalledTimes(1);
    expect(mockWindow.focus).toHaveBeenCalledTimes(1);
    expect(mockWindow.print).toHaveBeenCalledTimes(1);
  });

  it('does nothing if window.open returns null', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    printMeetingPdf(mockMeeting, null, {}, vi.fn(), vi.fn());

    expect(mockDocument.write).not.toHaveBeenCalled();
  });

  it('does nothing if meeting is null', () => {
    printMeetingPdf(null as any, null, {}, vi.fn(), vi.fn());

    expect(window.open).not.toHaveBeenCalled();
  });

  it('does nothing in server environment (no window)', () => {
    const originalWindow = global.window;
    // @ts-ignore - simulate server environment
    delete global.window;

    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    printMeetingPdf(mockMeeting, null, {}, vi.fn(), vi.fn());

    expect(openSpy).not.toHaveBeenCalled();

    // Restore window
    global.window = originalWindow;
  });

  it('writes HTML document with correct structure', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Team Standup',
      tags: ['weekly', 'sync'],
      needs: ['Status'],
      desiredOutputs: ['Actions'],
      startsAt: '2024-01-15T10:00:00Z',
      analysis: { summary: 'Test summary' },
    };

    const mockFormatDateTime = () => '2024-01-15 10:00';
    const mockFormatDuration = (seconds: number) =>
      `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

    printMeetingPdf(mockMeeting, null, {}, mockFormatDateTime, mockFormatDuration);

    expect(mockDocument.write).toHaveBeenCalledTimes(1);

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).toContain('<!doctype html>');
    expect(htmlContent).toContain('<html lang="pl">');
    expect(htmlContent).toContain('<meta charset="utf-8" />');
    expect(htmlContent).toContain('Team Standup - PDF export');
    expect(htmlContent).toContain('VoiceLog export');
    expect(htmlContent).toContain('Team Standup');
  });

  it('includes meeting metadata in export', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Team Standup',
      tags: ['weekly', 'sync'],
      needs: ['Status update'],
      desiredOutputs: ['Action items'],
      startsAt: '2024-01-15T10:00:00Z',
      analysis: { summary: 'Test summary' },
    };

    printMeetingPdf(mockMeeting, null, {}, vi.fn(), vi.fn());

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).toContain('weekly');
    expect(htmlContent).toContain('sync');
    expect(htmlContent).toContain('Status update');
    expect(htmlContent).toContain('Action items');
  });

  it('includes transcript segments when recording provided', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    const mockRecording = {
      transcript: [
        { speakerId: 0, text: 'Hello everyone', timestamp: 0, verificationStatus: 'review' },
        { speakerId: 1, text: 'Hi there', timestamp: 60, verificationStatus: 'verified' },
      ],
    };

    const mockSpeakerNames = { '0': 'Alice', '1': 'Bob' };
    const mockFormatDuration = (seconds: number) => `${seconds}s`;

    printMeetingPdf(mockMeeting, mockRecording, mockSpeakerNames, vi.fn(), mockFormatDuration);

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).toContain('Alice');
    expect(htmlContent).toContain('Bob');
    expect(htmlContent).toContain('Hello everyone');
    expect(htmlContent).toContain('Hi there');
    expect(htmlContent).toContain('Do weryfikacji');
    expect(htmlContent).toContain('Zweryfikowane');
  });

  it('handles missing speaker names', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    const mockRecording = {
      transcript: [
        { speakerId: 0, text: 'Hello', timestamp: 0 },
        { speakerId: 5, text: 'World', timestamp: 30 },
      ],
    };

    printMeetingPdf(mockMeeting, mockRecording, {}, vi.fn(), vi.fn());

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).toContain('Speaker 1');
    expect(htmlContent).toContain('Speaker 6');
  });

  it('includes analysis summary', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
      analysis: {
        summary: 'Meeting analysis summary',
        decisions: ['Decision 1', 'Decision 2'],
        actionItems: ['Action 1'],
      },
    };

    printMeetingPdf(mockMeeting, null, {}, vi.fn(), vi.fn());

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).toContain('Meeting analysis summary');
    expect(htmlContent).toContain('Decision 1');
    expect(htmlContent).toContain('Decision 2');
    expect(htmlContent).toContain('Action 1');
  });

  it('uses recording analysis if meeting analysis missing', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    const mockRecording = {
      transcript: [],
      analysis: {
        summary: 'Recording analysis',
      },
    };

    printMeetingPdf(mockMeeting, mockRecording, {}, vi.fn(), vi.fn());

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).toContain('Recording analysis');
  });

  it('escapes HTML in meeting title', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: '<script>alert("XSS")</script>',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    printMeetingPdf(mockMeeting, null, {}, vi.fn(), vi.fn());

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).not.toContain('<script>');
    expect(htmlContent).toContain('&lt;script&gt;');
  });

  it('escapes HTML in transcript text', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    const mockRecording = {
      transcript: [{ speakerId: 0, text: '<b>Bold</b> & <i>Italic</i>', timestamp: 0 }],
    };

    printMeetingPdf(mockMeeting, mockRecording, {}, vi.fn(), vi.fn());

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).not.toContain('<b>Bold</b>');
    expect(htmlContent).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    expect(htmlContent).toContain('&amp;');
  });

  it('includes print-friendly CSS', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    printMeetingPdf(mockMeeting, null, {}, vi.fn(), vi.fn());

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).toContain('@media print');
    expect(htmlContent).toContain('break-inside: avoid');
  });

  it('includes verification badges for transcript segments', () => {
    const mockMeeting = {
      id: 'meeting-1',
      title: 'Test',
      tags: [],
      needs: [],
      desiredOutputs: [],
      startsAt: '2024-01-15T10:00:00Z',
    };

    const mockRecording = {
      transcript: [
        { speakerId: 0, text: 'Review this', timestamp: 0, verificationStatus: 'review' },
        { speakerId: 1, text: 'Verified this', timestamp: 60, verificationStatus: 'verified' },
      ],
    };

    printMeetingPdf(mockMeeting, mockRecording, {}, vi.fn(), vi.fn());

    const htmlContent = mockDocument.write.mock.calls[0][0];
    expect(htmlContent).toContain('doc-badge warning');
    expect(htmlContent).toContain('doc-badge success');
    expect(htmlContent).toContain('Do weryfikacji');
    expect(htmlContent).toContain('Zweryfikowane');
  });
});
