import { parseTagInput } from "./tasks";

export function buildProfileDraft(user) {
  return {
    name: user?.name || "",
    role: user?.role || "",
    company: user?.company || "",
    timezone: user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw",
    googleEmail: user?.googleEmail || user?.email || "",
    phone: user?.phone || "",
    location: user?.location || "",
    team: user?.team || "",
    bio: user?.bio || "",
    avatarUrl: user?.avatarUrl || "",
    preferredInsights: Array.isArray(user?.preferredInsights) ? user.preferredInsights.join("\n") : "",
    notifyDailyDigest: Boolean(user?.notifyDailyDigest ?? true),
    autoTaskCapture: Boolean(user?.autoTaskCapture ?? true),
    preferredTaskView: user?.preferredTaskView === "kanban" ? "kanban" : "list",
  };
}

export function normalizeTaskUpdatePayload(previousTask, updates, columns) {
  const openColumnId = columns.find((column) => !column.isDone)?.id || columns[0]?.id || previousTask.status;
  const doneColumnId = columns.find((column) => column.isDone)?.id || previousTask.status;
  const statusExists = columns.some((column) => column.id === updates.status);
  let nextStatus = statusExists ? updates.status : previousTask.status;

  if (typeof updates.completed === "boolean" && !updates.status) {
    nextStatus = updates.completed ? doneColumnId : openColumnId;
  }

  if (!columns.some((column) => column.id === nextStatus)) {
    nextStatus = openColumnId;
  }

  const completed =
    typeof updates.completed === "boolean"
      ? updates.completed
      : columns.some((column) => column.id === nextStatus && column.isDone);

  return {
    ...updates,
    title: updates.title ?? previousTask.title,
    owner: updates.owner ?? previousTask.owner,
    group: updates.group ?? previousTask.group,
    description: updates.description ?? previousTask.description,
    dueDate: updates.dueDate ?? previousTask.dueDate,
    notes: updates.notes ?? previousTask.notes,
    tags:
      updates.tags === undefined
        ? previousTask.tags
        : Array.isArray(updates.tags)
          ? updates.tags
          : parseTagInput(updates.tags),
    important: typeof updates.important === "boolean" ? updates.important : previousTask.important,
    priority: updates.priority ?? previousTask.priority,
    status: completed ? doneColumnId : nextStatus,
    completed,
  };
}
