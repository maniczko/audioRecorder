import { describe, test, expect } from 'vitest';
import { buildProfileDraft, normalizeTaskUpdatePayload } from './appState';

describe('appState library', () => {
  test('buildProfileDraft should provide defaults', () => {
    const draft = buildProfileDraft(null);
    expect(draft.name).toBe('');
    expect(draft.preferredTaskView).toBe('list');
    expect(draft.autoLearnSpeakerProfiles).toBe(false);
    expect(draft.timezone).toBeDefined();
  });

  test('buildProfileDraft should map user fields', () => {
    const user = { name: 'Jan', email: 'jan@ex.com', preferredInsights: ['a', 'b'], preferredTaskView: 'kanban', autoLearnSpeakerProfiles: true };
    const draft = buildProfileDraft(user);
    expect(draft.name).toBe('Jan');
    expect(draft.googleEmail).toBe('jan@ex.com');
    expect(draft.preferredInsights).toBe('a\nb');
    expect(draft.autoLearnSpeakerProfiles).toBe(true);
    expect(draft.preferredTaskView).toBe('kanban');
  });

  describe('normalizeTaskUpdatePayload', () => {
    const columns = [
      { id: 'todo', isDone: false },
      { id: 'done', isDone: true }
    ];
    const previousTask = {
      id: 't1',
      title: 'Old Title',
      status: 'todo',
      completed: false,
      owner: 'Jan'
    };

    test('should update basic fields', () => {
      const updates = { title: 'New Title', owner: 'Anna' };
      const result = normalizeTaskUpdatePayload(previousTask, updates, columns);
      
      expect(result.title).toBe('New Title');
      expect(result.owner).toBe('Anna');
      expect(result.status).toBe('todo');
    });

    test('should sync completed status with columns', () => {
      // Set status to done, should auto-complete
      const result = normalizeTaskUpdatePayload(previousTask, { status: 'done' }, columns);
      expect(result.completed).toBe(true);
      expect(result.status).toBe('done');

      // Set completed to false manually, should move to todo
      const result2 = normalizeTaskUpdatePayload({ ...previousTask, status: 'done', completed: true }, { completed: false }, columns);
      expect(result2.status).toBe('todo');
      expect(result2.completed).toBe(false);
    });

    test('should handle tags', () => {
      const result = normalizeTaskUpdatePayload(previousTask, { tags: 'a, b' }, columns);
      expect(result.tags).toEqual(['a', 'b']);

      const result2 = normalizeTaskUpdatePayload(previousTask, { tags: ['x', 'y'] }, columns);
      expect(result2.tags).toEqual(['x', 'y']);
    });

    test('should normalize assignedTo', () => {
      const result = normalizeTaskUpdatePayload(previousTask, { assignedTo: 'Jan, Bob' }, columns);
      expect(result.assignedTo).toContain('Jan');
      expect(result.assignedTo).toContain('Bob');
    });

    test('should handle owner vs assignedTo priority', () => {
      // If owner is updated, it should be first in assignedTo
      const result = normalizeTaskUpdatePayload(previousTask, { owner: 'Marek', assignedTo: ['Anna'] }, columns);
      expect(result.owner).toBe('Marek');
      expect(result.assignedTo[0]).toBe('Marek');
      expect(result.assignedTo).toContain('Anna');
    });
  });
});
