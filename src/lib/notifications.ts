import { reminderLabel } from './calendarView';

export type NotificationTone = 'danger' | 'warning' | 'success' | 'neutral' | 'info' | string;

interface ReminderNotificationInput {
  id: string;
  entryType: 'meeting' | 'task' | 'google' | string;
  title: string;
  minutes: number;
  remindAt: string;
  entryId: string;
}

export interface TaskNotificationInput {
  task: {
    id: string;
    title: string;
    dueDate?: string;
    updatedAt?: string;
    createdAt?: string;
  };
  sla: {
    id: string;
    tone?: NotificationTone;
    label: string;
  };
  dependencies: {
    blocking: boolean;
    unresolved: Array<{ title?: string }>;
  };
}

export interface WorkspaceNotificationItem {
  id: string;
  kind: 'reminder' | 'task';
  tone: NotificationTone;
  title: string;
  body: string;
  sortAt: string;
  deliverAt: string;
  action:
    | { type: 'meeting'; id: string }
    | { type: 'task'; id: string }
    | { type: 'calendar'; id: string };
}

function taskToneLabel(tone?: NotificationTone) {
  if (tone === 'danger') {
    return 'Pilne';
  }
  if (tone === 'warning') {
    return 'Uwaga';
  }
  if (tone === 'success') {
    return 'OK';
  }
  return 'Info';
}

export function buildWorkspaceNotifications({
  reminders = [],
  taskNotifications = [],
}: {
  reminders?: ReminderNotificationInput[];
  taskNotifications?: TaskNotificationInput[];
} = {}): WorkspaceNotificationItem[] {
  const reminderItems: WorkspaceNotificationItem[] = (
    Array.isArray(reminders) ? reminders : []
  ).map((reminder) => ({
    id: `reminder:${reminder.id}`,
    kind: 'reminder' as const,
    tone:
      reminder.entryType === 'task'
        ? 'warning'
        : reminder.entryType === 'google'
          ? 'neutral'
          : 'info',
    title: reminder.title,
    body:
      reminder.entryType === 'task'
        ? `Termin zadania za ${reminderLabel(reminder.minutes)}.`
        : reminder.entryType === 'google'
          ? `Google event startuje za ${reminderLabel(reminder.minutes)}.`
          : `Spotkanie startuje za ${reminderLabel(reminder.minutes)}.`,
    sortAt: reminder.remindAt,
    deliverAt: reminder.remindAt,
    action:
      reminder.entryType === 'meeting'
        ? { type: 'meeting' as const, id: reminder.entryId }
        : reminder.entryType === 'task'
          ? { type: 'task' as const, id: reminder.entryId }
          : { type: 'calendar' as const, id: reminder.entryId },
  }));

  const taskItems: WorkspaceNotificationItem[] = (
    Array.isArray(taskNotifications) ? taskNotifications : []
  ).map(({ task, sla, dependencies }) => ({
    id: `task:${task.id}:${sla.id}:${dependencies.blocking ? 'blocked' : 'open'}`,
    kind: 'task' as const,
    tone: sla.tone || 'warning',
    title: task.title,
    body: dependencies.blocking
      ? `Zablokowane przez: ${dependencies.unresolved[0]?.title || 'inne zadanie'}.`
      : `${taskToneLabel(sla.tone)}: ${sla.label}.`,
    sortAt: task.dueDate || task.updatedAt || task.createdAt || '',
    deliverAt: task.dueDate || task.updatedAt || task.createdAt || '',
    action: { type: 'task' as const, id: task.id },
  }));

  return [...reminderItems, ...taskItems].sort(
    (left, right) => new Date(left.sortAt || 0).getTime() - new Date(right.sortAt || 0).getTime()
  );
}

export function getBrowserNotificationCandidates(
  items: WorkspaceNotificationItem[] = [],
  deliveredIds: string[] = [],
  now = new Date()
): WorkspaceNotificationItem[] {
  const deliveredSet = new Set(Array.isArray(deliveredIds) ? deliveredIds : []);
  const nowTime = now.getTime();

  return (Array.isArray(items) ? items : [])
    .filter((item) => {
      if (!item?.id || deliveredSet.has(item.id)) {
        return false;
      }

      const deliverAt = new Date(item.deliverAt || item.sortAt || 0).getTime();
      if (!deliverAt) {
        return true;
      }

      return deliverAt <= nowTime + 60 * 1000;
    })
    .slice(0, 3);
}
