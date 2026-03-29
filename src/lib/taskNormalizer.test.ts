import { describe, it, expect } from 'vitest';
import { normalizeTask, normalizeTasks } from './taskNormalizer';

describe('taskNormalizer', () => {
  // --- normalizeTask ---
  describe('normalizeTask', () => {
    it('returns null for null input', () => {
      expect(normalizeTask(null, 0)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(normalizeTask(undefined, 0)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(normalizeTask('', 0)).toBeNull();
    });

    // --- String format ---
    describe('string input', () => {
      it('parses "Owner: Task description" format', () => {
        const result = normalizeTask('Anna: Przygotuj raport', 0);
        expect(result).toEqual(
          expect.objectContaining({
            title: 'Przygotuj raport',
            owner: 'Anna',
            priority: 'medium',
          })
        );
      });

      it('uses full string as title when no colon pattern', () => {
        const result = normalizeTask('zrob backup', 0);
        expect(result).toEqual(
          expect.objectContaining({
            title: 'zrob backup',
            owner: 'Nieprzypisane',
          })
        );
      });

      it('detects "pilne" as high priority', () => {
        const result = normalizeTask('Jan: pilne - wgraj poprawke', 0);
        expect(result?.priority).toBe('high');
      });

      it('detects "asap" as high priority (case-insensitive)', () => {
        const result = normalizeTask('ASAP deploy fix', 0);
        expect(result?.priority).toBe('high');
      });

      it('detects "natychmiast" as high priority', () => {
        const result = normalizeTask('Kasia: natychmiast napraw blad', 0);
        expect(result?.priority).toBe('high');
      });

      it('detects "krytyczne" as high priority', () => {
        const result = normalizeTask('krytyczne - server down', 0);
        expect(result?.priority).toBe('high');
      });

      it('sets sourceQuote to trimmed input', () => {
        const result = normalizeTask('  some task  ', 0);
        expect(result?.sourceQuote).toBe('some task');
      });

      it('sets empty tags array', () => {
        const result = normalizeTask('a task', 0);
        expect(result?.tags).toEqual([]);
      });

      it('ignores short owner prefix (< 2 chars)', () => {
        const result = normalizeTask('A: do something', 0);
        expect(result?.title).toBe('A: do something');
        expect(result?.owner).toBe('Nieprzypisane');
      });

      it('ignores long owner prefix (> 40 chars)', () => {
        const longName = 'A'.repeat(41);
        const result = normalizeTask(`${longName}: task`, 0);
        expect(result?.owner).toBe('Nieprzypisane');
      });
    });

    // --- Object format ---
    describe('object input', () => {
      it('uses title field', () => {
        const result = normalizeTask({ title: 'Fix bug' }, 0);
        expect(result?.title).toBe('Fix bug');
      });

      it('falls back to text field when title missing', () => {
        const result = normalizeTask({ text: 'Review PR' }, 0);
        expect(result?.title).toBe('Review PR');
      });

      it('returns null for object with no title or text', () => {
        expect(normalizeTask({ owner: 'Jan' }, 0)).toBeNull();
      });

      it('returns null for whitespace-only title', () => {
        expect(normalizeTask({ title: '   ' }, 0)).toBeNull();
      });

      it('uses owner field', () => {
        const result = normalizeTask({ title: 'Task', owner: 'Anna' }, 0);
        expect(result?.owner).toBe('Anna');
      });

      it('falls back to assignee when owner missing', () => {
        const result = normalizeTask({ title: 'Task', assignee: 'Jan' }, 0);
        expect(result?.owner).toBe('Jan');
      });

      it('resolves owner from speakerNames when owner/assignee missing', () => {
        const result = normalizeTask({ title: 'Task', speakerId: 2 }, 0, { '2': 'Kasia' });
        expect(result?.owner).toBe('Kasia');
      });

      it('falls back to "Nieprzypisane" when no owner info', () => {
        const result = normalizeTask({ title: 'Task' }, 0);
        expect(result?.owner).toBe('Nieprzypisane');
      });

      it('preserves explicit priority', () => {
        const result = normalizeTask({ title: 'Task', priority: 'low' }, 0);
        expect(result?.priority).toBe('low');
      });

      it('defaults priority to medium', () => {
        const result = normalizeTask({ title: 'Task' }, 0);
        expect(result?.priority).toBe('medium');
      });

      it('preserves tags array', () => {
        const result = normalizeTask({ title: 'Task', tags: ['bug', 'urgent'] }, 0);
        expect(result?.tags).toEqual(['bug', 'urgent']);
      });

      it('defaults tags to empty array when not an array', () => {
        const result = normalizeTask({ title: 'Task', tags: 'not-array' as any }, 0);
        expect(result?.tags).toEqual([]);
      });

      it('uses sourceQuote field', () => {
        const result = normalizeTask({ title: 'Task', sourceQuote: 'original text' }, 0);
        expect(result?.sourceQuote).toBe('original text');
      });

      it('falls back to quote field for sourceQuote', () => {
        const result = normalizeTask({ title: 'Task', quote: 'quoted text' }, 0);
        expect(result?.sourceQuote).toBe('quoted text');
      });

      it('falls back to title for sourceQuote', () => {
        const result = normalizeTask({ title: 'My task' }, 0);
        expect(result?.sourceQuote).toBe('My task');
      });
    });
  });

  // --- normalizeTasks ---
  describe('normalizeTasks', () => {
    it('returns empty array for empty input', () => {
      expect(normalizeTasks([])).toEqual([]);
    });

    it('filters out null results', () => {
      const result = normalizeTasks([null, 'Valid task', undefined, '']);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Valid task');
    });

    it('processes mixed string and object inputs', () => {
      const result = normalizeTasks(['Anna: deploy', { title: 'Review', owner: 'Jan' }]);
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('deploy');
      expect(result[1].title).toBe('Review');
    });

    it('passes speakerNames to each task', () => {
      const result = normalizeTasks(
        [
          { title: 'Task A', speakerId: 1 },
          { title: 'Task B', speakerId: 2 },
        ],
        { '1': 'Ola', '2': 'Piotr' }
      );
      expect(result[0].owner).toBe('Ola');
      expect(result[1].owner).toBe('Piotr');
    });
  });
});
