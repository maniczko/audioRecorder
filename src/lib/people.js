function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(items) {
  return [...new Set(safeArray(items).map((item) => String(item || "").trim()).filter(Boolean))];
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function includesName(collection, name) {
  const normalized = normalizeWhitespace(name).toLowerCase();
  return safeArray(collection).some((item) => normalizeWhitespace(item).toLowerCase() === normalized);
}

function personOwnsTask(task, name) {
  const owner = normalizeWhitespace(task.owner).toLowerCase();
  const target = normalizeWhitespace(name).toLowerCase();
  return Boolean(owner && target && (owner === target || owner.includes(target) || target.includes(owner)));
}

function inferTraits(meetings, tasks, needs, outputs) {
  const signals = `${needs.join(" ")} ${outputs.join(" ")} ${meetings.map((meeting) => meeting.context || "").join(" ")}`.toLowerCase();
  const traits = [];

  if (tasks.length >= 4) {
    traits.push("czesto przejmuje ownership i follow-upy");
  }
  if (meetings.length >= 4) {
    traits.push("regularnie uczestniczy w kluczowych spotkaniach");
  }
  if (/ryzyk|plan|harmonogram|deadline|termin/.test(signals)) {
    traits.push("pilnuje planu i terminow");
  }
  if (/budzet|koszt|rentown|zakres/.test(signals)) {
    traits.push("patrzy na decyzje przez pryzmat kosztu i zakresu");
  }
  if (/klient|uzytkownik|feedback|potrzeb/.test(signals)) {
    traits.push("wnosi perspektywe potrzeb i oczekiwan");
  }

  return traits.slice(0, 3);
}

function personSummary(name, meetings, tasks, needs, outputs) {
  const traits = inferTraits(meetings, tasks, needs, outputs);
  const firstTrait = traits[0] || "bierze udzial w spotkaniach roboczych";
  const firstNeed = needs[0] || "jasne ustalenia";
  const firstOutput = outputs[0] || "konkretne kolejne kroki";

  return `${name} ${firstTrait}. Najczesciej oczekuje: ${firstNeed}. Po spotkaniach najbardziej licza sie dla tej osoby: ${firstOutput}.`;
}

export function buildPeopleProfiles(meetings, tasks, currentUser, workspaceMembers = []) {
  const names = uniqueStrings([
    currentUser?.name,
    ...safeArray(workspaceMembers).flatMap((member) => [member.name, member.email, member.googleEmail]),
    ...safeArray(meetings).flatMap((meeting) => [
      ...safeArray(meeting.attendees),
      ...Object.values(meeting.speakerNames || {}),
      ...Object.values(meeting.analysis?.speakerLabels || {}),
    ]),
    ...safeArray(tasks).map((task) => task.owner),
  ]);

  return names
    .map((name) => {
      const personMeetings = safeArray(meetings)
        .filter(
          (meeting) =>
            includesName(meeting.attendees, name) ||
            includesName(Object.values(meeting.speakerNames || {}), name) ||
            includesName(Object.values(meeting.analysis?.speakerLabels || {}), name) ||
            normalizeWhitespace(currentUser?.name).toLowerCase() === normalizeWhitespace(name).toLowerCase()
        )
        .sort((left, right) => new Date(right.startsAt).getTime() - new Date(left.startsAt).getTime());

      const personTasks = safeArray(tasks)
        .filter((task) => personOwnsTask(task, name))
        .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime());

      const needs = uniqueStrings(personMeetings.flatMap((meeting) => meeting.needs || []));
      const outputs = uniqueStrings(personMeetings.flatMap((meeting) => meeting.desiredOutputs || []));
      const tags = uniqueStrings([
        ...personMeetings.flatMap((meeting) => meeting.tags || []),
        ...personTasks.flatMap((task) => task.tags || []),
      ]);
      const nextMeeting =
        [...personMeetings]
          .filter((meeting) => new Date(meeting.startsAt).getTime() >= Date.now())
          .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())[0] || null;

      return {
        id: slugify(name) || name,
        name,
        meetings: personMeetings,
        tasks: personTasks,
        tags,
        needs,
        outputs,
        nextMeeting,
        completedTasks: personTasks.filter((task) => task.completed).length,
        openTasks: personTasks.filter((task) => !task.completed).length,
        summary: personSummary(name, personMeetings, personTasks, needs, outputs),
        traits: inferTraits(personMeetings, personTasks, needs, outputs),
      };
    })
    .filter((person) => person.name)
    .sort((left, right) => {
      const rightScore = right.meetings.length * 2 + right.tasks.length;
      const leftScore = left.meetings.length * 2 + left.tasks.length;
      return rightScore - leftScore;
    });
}
