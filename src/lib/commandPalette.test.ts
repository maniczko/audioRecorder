/**
 * commandPalette.test.ts
 * 
 * Tests for command palette item builder and search functionality
 */

import { describe, it, expect } from 'vitest';
import { buildCommandPaletteItems, searchCommandPalette } from './commandPalette';

describe('commandPalette', () => {
  describe('buildCommandPaletteItems', () => {
    it('returns empty array when no data provided', () => {
      const items = buildCommandPaletteItems({});

      expect(items).toEqual([]);
    });

    it('returns tab items by default', () => {
      const items = buildCommandPaletteItems({});

      expect(items).toHaveLength(5);
      expect(items[0]).toMatchObject({
        id: 'tab:studio',
        type: 'tab',
        title: 'Studio',
        group: 'Zakladki',
      });
    });

    it('includes all default tabs', () => {
      const items = buildCommandPaletteItems({});

      const tabIds = items.map((item) => item.id);
      expect(tabIds).toContain('tab:studio');
      expect(tabIds).toContain('tab:calendar');
      expect(tabIds).toContain('tab:tasks');
      expect(tabIds).toContain('tab:people');
      expect(tabIds).toContain('tab:profile');
    });

    it('adds meeting items when meetings provided', () => {
      const meetings = [
        { id: 'm1', title: 'Meeting 1' },
        { id: 'm2', title: 'Meeting 2' },
      ];

      const items = buildCommandPaletteItems({ meetings });

      const meetingItems = items.filter((item) => item.type === 'meeting');
      expect(meetingItems).toHaveLength(2);
      expect(meetingItems[0]).toMatchObject({
        id: 'meeting:m1',
        title: 'Meeting 1',
        type: 'meeting',
      });
    });

    it('adds task items when tasks provided', () => {
      const tasks = [
        { id: 't1', title: 'Task 1', status: 'todo' },
        { id: 't2', title: 'Task 2', status: 'done' },
      ];

      const items = buildCommandPaletteItems({ tasks });

      const taskItems = items.filter((item) => item.type === 'task');
      expect(taskItems).toHaveLength(2);
      expect(taskItems[0]).toMatchObject({
        id: 'task:t1',
        title: 'Task 1',
        type: 'task',
      });
    });

    it('adds person items when people provided', () => {
      const people = [
        { id: 'p1', name: 'Person 1' },
        { id: 'p2', name: 'Person 2' },
      ];

      const items = buildCommandPaletteItems({ people });

      const personItems = items.filter((item) => item.type === 'person');
      expect(personItems).toHaveLength(2);
      expect(personItems[0]).toMatchObject({
        id: 'person:p1',
        title: 'Person 1',
        type: 'person',
      });
    });

    it('combines all item types', () => {
      const data = {
        meetings: [{ id: 'm1', title: 'Meeting' }],
        tasks: [{ id: 't1', title: 'Task' }],
        people: [{ id: 'p1', name: 'Person' }],
      };

      const items = buildCommandPaletteItems(data);

      expect(items).toHaveLength(8); // 5 tabs + 1 meeting + 1 task + 1 person
    });

    it('handles empty arrays gracefully', () => {
      const items = buildCommandPaletteItems({
        meetings: [],
        tasks: [],
        people: [],
      });

      expect(items).toHaveLength(5); // Only tabs
    });

    it('handles null/undefined data gracefully', () => {
      const items = buildCommandPaletteItems({
        meetings: null as any,
        tasks: undefined as any,
        people: null as any,
      });

      expect(items).toHaveLength(5);
    });
  });

  describe('searchCommandPalette', () => {
    const mockItems = [
      { id: '1', title: 'Studio', keywords: ['studio', 'nagrywanie'], weight: 10 },
      { id: '2', title: 'Kalendarz', keywords: ['kalendarz', 'spotkania'], weight: 10 },
      { id: '3', title: 'Zadania', keywords: ['zadania', 'tasks'], weight: 10 },
      { id: '4', title: 'Meeting with Client', keywords: ['meeting', 'client'], weight: 5 },
      { id: '5', title: 'Task: Fix bug', keywords: ['task', 'bug'], weight: 5 },
    ];

    it('returns all items when no query', () => {
      const results = searchCommandPalette(mockItems, '');

      expect(results).toHaveLength(5);
    });

    it('filters items by title', () => {
      const results = searchCommandPalette(mockItems, 'Studio');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Studio');
    });

    it('filters items case-insensitively', () => {
      const results = searchCommandPalette(mockItems, 'studio');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Studio');
    });

    it('filters items by keywords', () => {
      const results = searchCommandPalette(mockItems, 'nagrywanie');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Studio');
    });

    it('matches partial keywords', () => {
      const results = searchCommandPalette(mockItems, 'stud');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Studio');
    });

    it('returns empty array when no matches', () => {
      const results = searchCommandPalette(mockItems, 'nonexistent');

      expect(results).toHaveLength(0);
    });

    it('sorts results by score', () => {
      const results = searchCommandPalette(mockItems, 'task');

      expect(results).toHaveLength(2);
      // Task item should be first (exact keyword match)
      expect(results[0].title).toContain('Task');
    });

    it('handles special characters in query', () => {
      const results = searchCommandPalette(mockItems, 'Fix bug');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Task: Fix bug');
    });

    it('handles empty items array', () => {
      const results = searchCommandPalette([], 'query');

      expect(results).toHaveLength(0);
    });

    it('prioritizes title start matches', () => {
      const items = [
        { id: '1', title: 'Task Manager', keywords: [], weight: 0 },
        { id: '2', title: 'My Task', keywords: ['task'], weight: 0 },
      ];

      const results = searchCommandPalette(items, 'task');

      // First item should be first (title starts with query)
      expect(results[0].title).toBe('Task Manager');
    });

    it('includes score in results', () => {
      const results = searchCommandPalette(mockItems, 'Studio');

      expect(results[0]).toHaveProperty('score');
      expect(results[0].score).toBeGreaterThan(0);
    });
  });

  describe('normalizeText helper', () => {
    it('normalizes whitespace', () => {
      const items = buildCommandPaletteItems({
        meetings: [{ id: 'm1', title: 'Meeting  with   spaces' }],
      });

      const meeting = items.find((i) => i.type === 'meeting');
      expect(meeting?.keywords).toContain('meeting with spaces');
    });

    it('handles null/undefined values', () => {
      const items = buildCommandPaletteItems({
        meetings: [{ id: 'm1', title: null as any }],
      });

      const meeting = items.find((i) => i.type === 'meeting');
      expect(meeting?.keywords).toEqual([]);
    });
  });
});
