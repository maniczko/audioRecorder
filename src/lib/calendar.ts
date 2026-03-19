import { downloadTextFile } from "./storage";

function pad(value) {
  return String(value).padStart(2, "0");
}

function googleDate(date) {
  const safe = new Date(date);
  return [
    safe.getUTCFullYear(),
    pad(safe.getUTCMonth() + 1),
    pad(safe.getUTCDate()),
    "T",
    pad(safe.getUTCHours()),
    pad(safe.getUTCMinutes()),
    pad(safe.getUTCSeconds()),
    "Z",
  ].join("");
}

function escapeIcsText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildCalendarDescription(meeting) {
  const sections = [
    `Context: ${meeting.context || "No extra context."}`,
    `Attendees: ${meeting.attendees?.join(", ") || "Not specified"}`,
    `Needs: ${meeting.needs?.join(" | ") || "Not specified"}`,
    `Desired outputs: ${meeting.desiredOutputs?.join(" | ") || "Not specified"}`,
  ];

  if (meeting.analysis?.summary) {
    sections.push(`Latest summary: ${meeting.analysis.summary}`);
  }

  if (meeting.analysis?.actionItems?.length) {
    sections.push(`Action items: ${meeting.analysis.actionItems.join(" | ")}`);
  }

  return sections.join("\n");
}

export function buildGoogleCalendarUrl(meeting) {
  const startsAt = new Date(meeting.startsAt);
  const endsAt = new Date(startsAt.getTime() + meeting.durationMinutes * 60 * 1000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.title,
    dates: `${googleDate(startsAt)}/${googleDate(endsAt)}`,
    details: buildCalendarDescription(meeting),
    location: meeting.location || "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadMeetingIcs(meeting) {
  const startsAt = new Date(meeting.startsAt);
  const endsAt = new Date(startsAt.getTime() + meeting.durationMinutes * 60 * 1000);
  const contents = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VoiceLog//Meeting Intelligence//EN",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@voicelog.local`,
    `DTSTAMP:${googleDate(new Date())}`,
    `DTSTART:${googleDate(startsAt)}`,
    `DTEND:${googleDate(endsAt)}`,
    `SUMMARY:${escapeIcsText(meeting.title)}`,
    `DESCRIPTION:${escapeIcsText(buildCalendarDescription(meeting))}`,
    `LOCATION:${escapeIcsText(meeting.location || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const safeName = meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  downloadTextFile(`${safeName || "meeting"}.ics`, contents, "text/calendar;charset=utf-8");
}
