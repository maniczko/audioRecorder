import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildMeetingAIDebrief,
  parseList,
  createMeeting,
  updateMeeting,
  upsertMeeting,
  attachRecording,
  createEmptyMeetingDraft,
  meetingToDraft,
} from './meeting';

vi.mock('./storage', () => {
  let counter = 0;
  return {
    createId: (prefix: string) => `${prefix}_${++counter}`,
  };
});

describe('parseList', () => {
  it('splits by newline', () => {
    expect(parseList('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('splits by comma', () => {
    expect(parseList('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace and filters empties', () => {
    expect(parseList(' a , , b \n\n c ')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array for empty/null input', () => {
    expect(parseList('')).toEqual([]);
    expect(parseList(null)).toEqual([]);
    expect(parseList(undefined)).toEqual([]);
  });
});

describe('createMeeting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-28T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates meeting with generated id and defaults', () => {
    const meeting = createMeeting('user1', { title: 'Standup' });
    expect(meeting.id).toMatch(/^meeting_/);
    expect(meeting.userId).toBe('user1');
    expect(meeting.title).toBe('Standup');
    expect(meeting.durationMinutes).toBe(45);
    expect(meeting.recordings).toEqual([]);
    expect(meeting.activity).toHaveLength(1);
    expect(meeting.activity[0].type).toBe('created');
  });

  it('uses default title when draft title is empty', () => {
    const meeting = createMeeting('user1', {});
    expect(meeting.title).toBe('Nowe spotkanie');
  });

  it('parses list fields from draft', () => {
    const meeting = createMeeting('user1', {
      title: 'Test',
      attendees: 'Jan,Anna',
      tags: 'dev\nops',
    });
    expect(meeting.attendees).toEqual(['Jan', 'Anna']);
    expect(meeting.tags).toEqual(['dev', 'ops']);
  });

  it('uses options for workspaceId and creator info', () => {
    const meeting = createMeeting(
      'user1',
      { title: 'Test' },
      {
        workspaceId: 'ws1',
        createdByUserId: 'admin1',
        createdByUserName: 'Admin',
      }
    );
    expect(meeting.workspaceId).toBe('ws1');
    expect(meeting.createdByUserId).toBe('admin1');
    expect(meeting.activity[0].actorName).toBe('Admin');
  });
});

describe('updateMeeting', () => {
  it('merges draft fields into existing meeting', () => {
    const original = { id: 'm1', title: 'Old', durationMinutes: 30, tags: ['x'] };
    const updated = updateMeeting(original, { title: 'New', durationMinutes: 60, tags: 'a,b' });
    expect(updated.id).toBe('m1');
    expect(updated.title).toBe('New');
    expect(updated.durationMinutes).toBe(60);
    expect(updated.tags).toEqual(['a', 'b']);
  });

  it('preserves existing title if draft title is empty', () => {
    const original = { title: 'Keep Me' };
    const updated = updateMeeting(original, { title: '' });
    expect(updated.title).toBe('Keep Me');
  });

  it('preserves existing durationMinutes if draft value is 0 or negative', () => {
    const original = { durationMinutes: 30 };
    const updated = updateMeeting(original, { durationMinutes: 0 });
    expect(updated.durationMinutes).toBe(30);
  });
});

describe('upsertMeeting', () => {
  it('prepends new meeting when it does not exist', () => {
    const meetings = [{ id: 'm1' }, { id: 'm2' }];
    const result = upsertMeeting(meetings, { id: 'm3', title: 'New' });
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('m3');
  });

  it('replaces existing meeting by id', () => {
    const meetings = [{ id: 'm1', title: 'Old' }, { id: 'm2' }];
    const result = upsertMeeting(meetings, { id: 'm1', title: 'Updated' });
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Updated');
  });
});

describe('attachRecording', () => {
  it('attaches recording to meeting and updates related fields', () => {
    const meeting = { id: 'm1', title: 'Test', recordings: [] };
    const recording = {
      id: 'rec1',
      analysis: { summary: 'Good meeting' },
      speakerNames: { 0: 'Jan' },
      speakerCount: 1,
    };

    const result = attachRecording(meeting, recording);
    expect(result.recordings).toHaveLength(1);
    expect(result.recordings[0].id).toBe('rec1');
    expect(result.latestRecordingId).toBe('rec1');
    expect(result.analysis).toEqual({ summary: 'Good meeting' });
    expect(result.speakerCount).toBe(1);
    expect(result.aiDebrief).toBeDefined();
  });

  it('uses recording.aiDebrief if provided', () => {
    const meeting = { id: 'm1', recordings: [] };
    const recording = {
      id: 'rec1',
      analysis: null,
      aiDebrief: { summary: 'Custom debrief' },
      speakerNames: {},
      speakerCount: 0,
    };

    const result = attachRecording(meeting, recording);
    expect(result.aiDebrief).toEqual({ summary: 'Custom debrief' });
  });
});

describe('buildMeetingAIDebrief', () => {
  it('returns debrief with default summary when analysis is null', () => {
    const result = buildMeetingAIDebrief({ title: 'Test' }, null);
    expect(result.meetingTitle).toBe('Test');
    expect(result.summary).toContain('Spotkanie zostało przetworzone');
    expect(result.decisions).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.generatedAt).toBeDefined();
  });

  it('extracts decisions and risks from analysis', () => {
    const analysis = {
      summary: 'Podsumowanie',
      decisions: ['Wdrożyć feature A', 'Zamknąć sprint'],
      risks: [{ risk: 'Opóźnienie' }],
      actionItems: ['Review PR'],
    };
    const result = buildMeetingAIDebrief({ title: 'Sprint' }, analysis);
    expect(result.decisions).toEqual(['Wdrożyć feature A', 'Zamknąć sprint']);
    expect(result.risks).toEqual(['Opóźnienie']);
    expect(result.summary).toContain('Podsumowanie');
    expect(result.summary).toContain('Kluczowe decyzje');
  });

  it('deduplicates items case-insensitively', () => {
    const analysis = {
      decisions: ['Deploy', 'deploy', 'DEPLOY'],
    };
    const result = buildMeetingAIDebrief({}, analysis);
    expect(result.decisions).toEqual(['Deploy']);
  });
});

describe('createEmptyMeetingDraft', () => {
  it('returns a draft with default values', () => {
    const draft = createEmptyMeetingDraft();
    expect(draft.title).toBe('');
    expect(draft.durationMinutes).toBe(45);
    expect(draft.startsAt).toBeTruthy();
    expect(draft.attendees).toBe('');
    expect(draft.tags).toBe('');
  });
});

describe('meetingToDraft', () => {
  it('converts meeting arrays back to newline-joined strings', () => {
    const meeting = {
      title: 'Sprint',
      context: 'Context',
      startsAt: '2026-03-28T10:00:00.000Z',
      durationMinutes: 60,
      attendees: ['Jan', 'Anna'],
      tags: ['dev', 'ops'],
      needs: [],
      concerns: ['Risk A'],
      desiredOutputs: ['Report'],
      location: 'Room 1',
    };
    const draft = meetingToDraft(meeting);
    expect(draft.title).toBe('Sprint');
    expect(draft.attendees).toBe('Jan\nAnna');
    expect(draft.tags).toBe('dev\nops');
    expect(draft.concerns).toBe('Risk A');
    expect(draft.location).toBe('Room 1');
  });

  it('handles missing startsAt gracefully', () => {
    const draft = meetingToDraft({ title: 'X', attendees: [] });
    expect(draft.startsAt).toBe('');
  });
});
