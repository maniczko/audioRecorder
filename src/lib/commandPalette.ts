function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKeywords(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function scoreMatch(item, query) {
  if (!query) {
    return item.weight || 0;
  }

  const normalizedQuery = normalizeText(query).toLowerCase();
  const haystack = [item.title, item.subtitle, ...(item.keywords || [])].join(' ').toLowerCase();
  if (!haystack.includes(normalizedQuery)) {
    return -1;
  }

  if (item.title.toLowerCase().startsWith(normalizedQuery)) {
    return 100 + (item.weight || 0);
  }

  if ((item.keywords || []).some((keyword) => keyword.startsWith(normalizedQuery))) {
    return 80 + (item.weight || 0);
  }

  return 50 + (item.weight || 0);
}

function tabItem(id, title, subtitle) {
  return {
    id: `tab:${id}`,
    type: 'tab',
    title,
    subtitle,
    group: 'Zakladki',
    keywords: normalizeKeywords([title, subtitle, id]),
    payload: { tabId: id },
    weight: 10,
  };
}

export function buildCommandPaletteItems({
  meetings = [] as any[],
  tasks = [] as any[],
  people = [] as any[],
}) {
  const tabs = [
    tabItem('studio', 'Studio', 'Spotkania, nagrania i analiza'),
    tabItem('calendar', 'Kalendarz', 'Planer spotkan i terminow'),
    tabItem('tasks', 'Zadania', 'Lista zadan i kanban'),
    tabItem('people', 'Osoby', 'Profile osob i historia wspolpracy'),
    tabItem('profile', 'Profil', 'Ustawienia konta i integracje'),
  ];

  const meetingItems = meetings.map((meeting) => ({
    id: `meeting:${meeting.id}`,
    type: 'meeting',
    title: meeting.title || 'Spotkanie',
    subtitle: meeting.context || 'Spotkanie',
    group: 'Spotkania',
    keywords: normalizeKeywords([
      meeting.title,
      meeting.context,
      meeting.location,
      ...(meeting.attendees || []),
      ...(meeting.tags || []),
    ]),
    payload: { meetingId: meeting.id },
    weight: 30,
  }));

  const taskItems = tasks.map((task) => ({
    id: `task:${task.id}`,
    type: 'task',
    title: task.title || 'Zadanie',
    subtitle:
      [task.owner, task.group, task.sourceMeetingTitle].filter(Boolean).join(' • ') || 'Zadanie',
    group: 'Zadania',
    keywords: normalizeKeywords([
      task.title,
      task.description,
      task.notes,
      task.owner,
      ...(task.assignedTo || []),
      task.group,
      ...(task.tags || []),
    ]),
    payload: { taskId: task.id },
    weight: task.completed ? 10 : 25,
  }));

  const peopleItems = people.map((person) => ({
    id: `person:${person.id}`,
    type: 'person',
    title: person.name || 'Osoba',
    subtitle: person.summary || `${person.meetings?.length || 0} spotkan`,
    group: 'Osoby',
    keywords: normalizeKeywords([
      person.name,
      person.summary,
      ...(person.tags || []),
      ...(person.traits || []),
      ...(person.needs || []),
      ...(person.outputs || []),
    ]),
    payload: { personId: person.id },
    weight: 20,
  }));

  return [...tabs, ...meetingItems, ...taskItems, ...peopleItems];
}

export function filterCommandPaletteItems(items, query) {
  const normalizedQuery = normalizeText(query);
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      ...item,
      score: scoreMatch(item, normalizedQuery),
    }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 20);
}
