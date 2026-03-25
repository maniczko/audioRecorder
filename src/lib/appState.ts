import {
  normalizeTaskComments,
  normalizeTaskDependencies,
  normalizeTaskHistory,
  normalizeTaskLinks,
  normalizeTaskPeopleList,
  normalizeTaskRecurrence,
  normalizeTaskSubtasks,
  parseTagInput,
} from './tasks';

export function buildProfileDraft(user) {
  return {
    name: user?.name || '',
    role: user?.role || '',
    company: user?.company || '',
    timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw',
    googleEmail: user?.googleEmail || user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    team: user?.team || '',
    bio: user?.bio || '',
    avatarUrl: user?.avatarUrl || '',
    preferredInsights: Array.isArray(user?.preferredInsights)
      ? user.preferredInsights.join('\n')
      : '',
    notifyDailyDigest: Boolean(user?.notifyDailyDigest ?? true),
    autoTaskCapture: Boolean(user?.autoTaskCapture ?? true),
    autoLearnSpeakerProfiles: Boolean(user?.autoLearnSpeakerProfiles ?? false),
    preferredTaskView: user?.preferredTaskView === 'kanban' ? 'kanban' : 'list',
  };
}

export function normalizeTaskUpdatePayload(previousTask, updates, columns) {
  const openColumnId =
    columns.find((column) => !column.isDone)?.id || columns[0]?.id || previousTask.status;
  const doneColumnId = columns.find((column) => column.isDone)?.id || previousTask.status;
  const statusExists = columns.some((column) => column.id === updates.status);
  let nextStatus = statusExists ? updates.status : previousTask.status;

  if (typeof updates.completed === 'boolean' && !updates.status) {
    nextStatus = updates.completed ? doneColumnId : openColumnId;
  }

  if (!columns.some((column) => column.id === nextStatus)) {
    nextStatus = openColumnId;
  }

  const completed =
    typeof updates.completed === 'boolean'
      ? updates.completed
      : columns.some((column) => column.id === nextStatus && column.isDone);
  let assignedTo =
    updates.assignedTo === undefined
      ? normalizeTaskPeopleList(
          previousTask.assignedTo?.length ? previousTask.assignedTo : previousTask.owner
        )
      : normalizeTaskPeopleList(updates.assignedTo);

  if (updates.owner !== undefined) {
    const nextOwner = String(updates.owner || '').trim();
    if (nextOwner) {
      assignedTo = [
        nextOwner,
        ...assignedTo.filter((person) => person.toLowerCase() !== nextOwner.toLowerCase()),
      ];
    } else if (updates.assignedTo === undefined) {
      assignedTo = [];
    }
  }

  const owner = String(updates.owner ?? assignedTo[0] ?? previousTask.owner ?? '').trim();

  return {
    ...updates,
    title: updates.title ?? previousTask.title,
    owner: owner || 'Nieprzypisane',
    assignedTo,
    group: updates.group ?? previousTask.group,
    description: updates.description ?? previousTask.description,
    dueDate: updates.dueDate ?? previousTask.dueDate,
    notes: updates.notes ?? previousTask.notes,
    reminderAt: updates.reminderAt ?? previousTask.reminderAt,
    myDay: typeof updates.myDay === 'boolean' ? updates.myDay : previousTask.myDay,
    tags:
      updates.tags === undefined
        ? previousTask.tags
        : Array.isArray(updates.tags)
          ? updates.tags
          : parseTagInput(updates.tags),
    important: typeof updates.important === 'boolean' ? updates.important : previousTask.important,
    priority: updates.priority ?? previousTask.priority,
    status: completed ? doneColumnId : nextStatus,
    completed,
    comments:
      updates.comments === undefined
        ? previousTask.comments
        : normalizeTaskComments(updates.comments),
    history:
      updates.history === undefined ? previousTask.history : normalizeTaskHistory(updates.history),
    dependencies:
      updates.dependencies === undefined
        ? previousTask.dependencies
        : normalizeTaskDependencies(updates.dependencies),
    recurrence:
      updates.recurrence === undefined
        ? previousTask.recurrence
        : normalizeTaskRecurrence(updates.recurrence),
    subtasks:
      updates.subtasks === undefined
        ? previousTask.subtasks
        : normalizeTaskSubtasks(updates.subtasks),
    links: updates.links === undefined ? previousTask.links : normalizeTaskLinks(updates.links),
    order: Number.isFinite(Number(updates.order)) ? Number(updates.order) : previousTask.order,
  };
}
