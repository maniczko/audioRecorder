function toTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function resolveActorName(actorName, actorId, workspaceMembers = [], users = []) {
  if (String(actorName || '').trim()) {
    return String(actorName).trim();
  }

  const match = [
    ...(Array.isArray(workspaceMembers) ? workspaceMembers : []),
    ...(Array.isArray(users) ? users : []),
  ].find((item) => item?.id === actorId);
  return match?.name || match?.email || 'System';
}

function latestEntry(entries = []) {
  return (
    [...(Array.isArray(entries) ? entries : [])].sort(
      (left, right) =>
        toTimestamp(right.createdAt || right.timestamp) -
        toTimestamp(left.createdAt || left.timestamp)
    )[0] || null
  );
}

export function getMeetingActivityEntries(meeting, workspaceMembers = [], users = []) {
  if (!meeting) {
    return [];
  }

  const explicitEntries = Array.isArray(meeting.activity)
    ? meeting.activity.map((entry) => ({
        id: entry.id || `${meeting.id}:${entry.type || 'meeting'}`,
        entityId: meeting.id,
        entityType: 'meeting',
        type: entry.type || 'updated',
        title: meeting.title,
        actor: resolveActorName(entry.actorName, entry.actorId, workspaceMembers, users),
        message: entry.message || 'Zmieniono spotkanie.',
        createdAt: entry.createdAt || meeting.updatedAt || meeting.createdAt,
        tone: entry.type === 'recording' ? 'info' : 'neutral',
      }))
    : [];

  if (explicitEntries.length) {
    return explicitEntries;
  }

  const fallbackActor = resolveActorName('', meeting.createdByUserId, workspaceMembers, users);
  const entries = [
    {
      id: `${meeting.id}:created`,
      entityId: meeting.id,
      entityType: 'meeting',
      type: 'created',
      title: meeting.title,
      actor: fallbackActor,
      message: 'Utworzono spotkanie.',
      createdAt: meeting.createdAt,
      tone: 'neutral',
    },
  ];

  if (meeting.updatedAt && meeting.updatedAt !== meeting.createdAt) {
    entries.push({
      id: `${meeting.id}:updated`,
      entityId: meeting.id,
      entityType: 'meeting',
      type: 'updated',
      title: meeting.title,
      actor: fallbackActor,
      message: 'Zmieniono brief spotkania.',
      createdAt: meeting.updatedAt,
      tone: 'info',
    });
  }

  return entries;
}

export function getMeetingLastActivity(meeting, workspaceMembers = [], users = []) {
  return latestEntry(getMeetingActivityEntries(meeting, workspaceMembers, users));
}

export function getTaskActivityEntries(task) {
  if (!task) {
    return [];
  }

  const historyEntries = Array.isArray(task.history)
    ? task.history.map((entry) => ({
        id: entry.id || `${task.id}:${entry.type || 'task'}`,
        entityId: task.id,
        entityType: 'task',
        type: entry.type || 'updated',
        title: task.title,
        actor: entry.actor || 'System',
        message: entry.message || 'Zmieniono zadanie.',
        createdAt: entry.createdAt || task.updatedAt || task.createdAt,
        tone: entry.type === 'comment' ? 'info' : entry.type === 'status' ? 'warning' : 'neutral',
      }))
    : [];

  if (historyEntries.length) {
    return historyEntries;
  }

  return [
    {
      id: `${task.id}:created`,
      entityId: task.id,
      entityType: 'task',
      type: 'created',
      title: task.title,
      actor: task.createdByUserId || 'System',
      message: 'Utworzono zadanie.',
      createdAt: task.createdAt || task.updatedAt,
      tone: 'neutral',
    },
  ];
}

export function getTaskLastActivity(task) {
  return latestEntry(getTaskActivityEntries(task));
}

export function buildWorkspaceActivityFeed(
  meetings = [],
  tasks = [],
  workspaceMembers = [],
  users = [],
  limit = 18
) {
  return [
    ...(Array.isArray(meetings) ? meetings : []).flatMap((meeting) =>
      getMeetingActivityEntries(meeting, workspaceMembers, users)
    ),
    ...(Array.isArray(tasks) ? tasks : []).flatMap((task) =>
      getTaskActivityEntries(task).filter((entry) =>
        ['created', 'status', 'comment', 'updated'].includes(entry.type)
      )
    ),
  ]
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, limit);
}
