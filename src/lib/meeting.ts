import { createId } from './storage';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueList(values, fallback = [], limit = 5) {
  const seen = new Set();
  const result = [];
  [...safeArray(values), ...safeArray(fallback)].forEach((item) => {
    const text = String(item || '').trim();
    if (!text) {
      return;
    }
    const key = text.toLowerCase();
    if (seen.has(key) || result.length >= limit) {
      return;
    }
    seen.add(key);
    result.push(text);
  });
  return result;
}

function joinSentence(items, fallback) {
  const list = uniqueList(items, [], 3);
  return list.length ? list.join(' · ') : fallback;
}

export function buildMeetingAIDebrief(meeting, analysis) {
  const safeAnalysis = analysis || {};
  const decisions = uniqueList(safeAnalysis.decisions, [], 5);
  const risks = uniqueList(
    safeArray(safeAnalysis.risks).map((item) => item?.risk || item),
    [],
    3
  );
  const followUps = uniqueList(safeAnalysis.followUps, safeAnalysis.actionItems, 5);
  const actionItems = uniqueList(safeAnalysis.actionItems, [], 5);

  const summaryParts = [
    safeAnalysis.summary || 'Spotkanie zostało przetworzone i przygotowano wstępny debrief.',
    decisions.length
      ? `Kluczowe decyzje: ${joinSentence(decisions, 'Brak jednoznacznych decyzji')}.`
      : 'Nie wykryto jednoznacznych decyzji.',
    risks.length
      ? `Ryzyka: ${joinSentence(risks, 'Brak istotnych ryzyk')}.`
      : 'Nie wykryto istotnych ryzyk.',
    followUps.length
      ? `Następne kroki: ${joinSentence(followUps, 'Brak dodatkowych follow-upów')}.`
      : 'Brak dodatkowych follow-upów.',
  ];

  return {
    meetingTitle: meeting?.title || '',
    summary: summaryParts.join(' '),
    decisions,
    risks,
    followUps,
    actionItems,
    generatedAt: new Date().toISOString(),
  };
}

export function parseList(text) {
  return String(text || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createMeeting(userId: string, draft: any, options: { workspaceId?: string; createdByUserId?: string; createdByUserName?: string } = {}) {
  const now = new Date().toISOString();

  return {
    id: createId('meeting'),
    userId,
    workspaceId: options.workspaceId || draft.workspaceId || '',
    createdByUserId: options.createdByUserId || userId,
    title: String(draft.title || '').trim() || 'Nowe spotkanie',
    context: String(draft.context || '').trim(),
    startsAt: draft.startsAt || new Date().toISOString(),
    durationMinutes: Number(draft.durationMinutes) > 0 ? Number(draft.durationMinutes) : 45,
    attendees: parseList(draft.attendees),
    tags: parseList(draft.tags),
    needs: parseList(draft.needs),
    concerns: parseList(draft.concerns),
    desiredOutputs: parseList(draft.desiredOutputs),
    location: String(draft.location || '').trim(),
    recordings: [],
    latestRecordingId: null,
    analysis: null,
    aiDebrief: null,
    speakerNames: {},
    speakerCount: 0,
    activity: [
      {
        id: createId('meeting_activity'),
        type: 'created',
        actorId: options.createdByUserId || userId,
        actorName: options.createdByUserName || '',
        message: 'Utworzono spotkanie.',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateMeeting(meeting: any, draft: any) {
  return {
    ...meeting,
    workspaceId: draft.workspaceId || meeting.workspaceId || '',
    createdByUserId: meeting.createdByUserId || meeting.userId || '',
    title: String(draft.title || '').trim() || meeting.title,
    context: String(draft.context || '').trim(),
    startsAt: draft.startsAt || meeting.startsAt,
    durationMinutes:
      Number(draft.durationMinutes) > 0 ? Number(draft.durationMinutes) : meeting.durationMinutes,
    attendees: parseList(draft.attendees),
    tags: parseList(draft.tags),
    needs: parseList(draft.needs),
    concerns: parseList(draft.concerns),
    desiredOutputs: parseList(draft.desiredOutputs),
    location: String(draft.location || '').trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function upsertMeeting(meetings, nextMeeting) {
  const exists = meetings.some((meeting) => meeting.id === nextMeeting.id);

  if (!exists) {
    return [nextMeeting, ...meetings];
  }

  return meetings.map((meeting) => (meeting.id === nextMeeting.id ? nextMeeting : meeting));
}

export function attachRecording(meeting, recording) {
  const aiDebrief = recording.aiDebrief || buildMeetingAIDebrief(meeting, recording.analysis);
  return {
    ...meeting,
    recordings: [recording, ...meeting.recordings],
    latestRecordingId: recording.id,
    analysis: recording.analysis,
    aiDebrief,
    speakerNames: recording.speakerNames,
    speakerCount: recording.speakerCount,
    updatedAt: new Date().toISOString(),
  };
}

export function createEmptyMeetingDraft() {
  const startsAt = new Date(Date.now() + 30 * 60 * 1000);
  const localIso = new Date(startsAt.getTime() - startsAt.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return {
    title: '',
    context: '',
    startsAt: localIso,
    durationMinutes: 45,
    attendees: '',
    tags: '',
    needs: '',
    desiredOutputs: '',
    location: '',
  };
}

export function meetingToDraft(meeting) {
  const startsAt = meeting.startsAt
    ? new Date(
        new Date(meeting.startsAt).getTime() -
          new Date(meeting.startsAt).getTimezoneOffset() * 60 * 1000
      )
        .toISOString()
        .slice(0, 16)
    : '';

  return {
    title: meeting.title,
    context: meeting.context,
    startsAt,
    durationMinutes: meeting.durationMinutes,
    attendees: (meeting.attendees || []).join('\n'),
    tags: (meeting.tags || []).join('\n'),
    needs: (meeting.needs || []).join('\n'),
    concerns: (meeting.concerns || []).join('\n'),
    desiredOutputs: (meeting.desiredOutputs || []).join('\n'),
    location: meeting.location || '',
  };
}
