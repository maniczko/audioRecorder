import { createId } from "./storage";

export function parseList(text) {
  return String(text || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createMeeting(userId, draft) {
  const now = new Date().toISOString();

  return {
    id: createId("meeting"),
    userId,
    title: String(draft.title || "").trim() || "Nowe spotkanie",
    context: String(draft.context || "").trim(),
    startsAt: draft.startsAt || new Date().toISOString(),
    durationMinutes: Number(draft.durationMinutes) > 0 ? Number(draft.durationMinutes) : 45,
    attendees: parseList(draft.attendees),
    tags: parseList(draft.tags),
    needs: parseList(draft.needs),
    desiredOutputs: parseList(draft.desiredOutputs),
    location: String(draft.location || "").trim(),
    recordings: [],
    latestRecordingId: null,
    analysis: null,
    speakerNames: {},
    speakerCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateMeeting(meeting, draft) {
  return {
    ...meeting,
    title: String(draft.title || "").trim() || meeting.title,
    context: String(draft.context || "").trim(),
    startsAt: draft.startsAt || meeting.startsAt,
    durationMinutes: Number(draft.durationMinutes) > 0 ? Number(draft.durationMinutes) : meeting.durationMinutes,
    attendees: parseList(draft.attendees),
    tags: parseList(draft.tags),
    needs: parseList(draft.needs),
    desiredOutputs: parseList(draft.desiredOutputs),
    location: String(draft.location || "").trim(),
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
  return {
    ...meeting,
    recordings: [recording, ...meeting.recordings],
    latestRecordingId: recording.id,
    analysis: recording.analysis,
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
    title: "",
    context: "",
    startsAt: localIso,
    durationMinutes: 45,
    attendees: "",
    tags: "",
    needs: "",
    desiredOutputs: "",
    location: "",
  };
}

export function meetingToDraft(meeting) {
  const startsAt = meeting.startsAt
    ? new Date(new Date(meeting.startsAt).getTime() - new Date(meeting.startsAt).getTimezoneOffset() * 60 * 1000)
        .toISOString()
        .slice(0, 16)
    : "";

  return {
    title: meeting.title,
    context: meeting.context,
    startsAt,
    durationMinutes: meeting.durationMinutes,
    attendees: meeting.attendees.join("\n"),
    tags: (meeting.tags || []).join("\n"),
    needs: meeting.needs.join("\n"),
    desiredOutputs: meeting.desiredOutputs.join("\n"),
    location: meeting.location || "",
  };
}
