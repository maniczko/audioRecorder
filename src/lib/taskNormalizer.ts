import type { MeetingTask, TranscriptSegment } from '../shared/types';

export interface TaskInput {
  title?: string;
  text?: string;
  owner?: string;
  assignee?: string;
  sourceQuote?: string;
  quote?: string;
  priority?: string;
  tags?: string[];
  speakerId?: string | number;
}

/**
 * Normalizes a task from various input formats into a consistent MeetingTask shape.
 * Handles both string format ("Owner: Task description") and object format.
 */
export function normalizeTask(
  task: string | TaskInput | null | undefined,
  index: number,
  speakerNames: Record<string, string> = {}
): MeetingTask | null {
  if (!task) {
    return null;
  }

  // Handle string format: "Owner: Task description"
  if (typeof task === 'string') {
    const match = task.match(/^([^:]{2,40}):\s*(.+)$/);
    const title = match ? match[2].trim() : task.trim();
    const owner = match ? match[1].trim() : 'Nieprzypisane';
    const isUrgent = /pilne|asap|natychmiast|krytyczne/i.test(task);

    return {
      title,
      description: undefined,
      owner,
      dueDate: undefined,
      priority: isUrgent ? 'high' : 'medium',
      tags: [],
      sourceQuote: task.trim(),
    };
  }

  // Handle object format
  const title = String(task.title || task.text || '').trim();
  if (!title) {
    return null;
  }

  const owner = String(task.owner || task.assignee || '').trim();
  const resolvedOwner = owner || speakerNames?.[String(task.speakerId)] || 'Nieprzypisane';
  const resolvedPriority = String(task.priority || '').trim() || 'medium';

  return {
    title,
    description: undefined,
    owner: resolvedOwner,
    dueDate: undefined,
    sourceQuote: String(task.sourceQuote || task.quote || title).trim(),
    priority: (resolvedPriority as 'high' | 'medium' | 'low') || 'medium',
    tags: Array.isArray(task.tags) ? task.tags : [],
  };
}

/**
 * Normalizes an array of tasks, filtering out null results.
 */
export function normalizeTasks(
  tasks: Array<string | TaskInput | null | undefined>,
  speakerNames: Record<string, string> = {}
): MeetingTask[] {
  return tasks
    .map((task, index) => normalizeTask(task, index, speakerNames))
    .filter((task): task is MeetingTask => task !== null);
}
