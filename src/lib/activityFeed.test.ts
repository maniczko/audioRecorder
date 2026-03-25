import { describe, test, expect } from 'vitest';
import {
  getMeetingActivityEntries,
  getTaskActivityEntries,
  buildWorkspaceActivityFeed,
} from './activityFeed';

describe('activityFeed library', () => {
  const mockWorkspaceMembers = [
    { id: 'u1', name: 'Jan Kowalski' },
    { id: 'u2', name: 'Anna Nowak' },
  ];

  describe('getMeetingActivityEntries', () => {
    test('should return empty array for null meeting', () => {
      expect(getMeetingActivityEntries(null)).toEqual([]);
    });

    test('should return manual activity entries if present', () => {
      const meeting = {
        id: 'm1',
        title: 'Meeting 1',
        activity: [
          {
            type: 'recording',
            actorName: 'Jan',
            message: 'Nagranie',
            createdAt: '2026-03-20T10:00:00Z',
          },
        ],
      };
      const result = getMeetingActivityEntries(meeting);
      expect(result).toHaveLength(1);
      expect(result[0].actor).toBe('Jan');
      expect(result[0].tone).toBe('info');
    });

    test('should return fallback created entry if no activity', () => {
      const meeting = {
        id: 'm1',
        title: 'Meeting 1',
        createdByUserId: 'u1',
        createdAt: '2026-03-20T10:00:00Z',
      };
      const result = getMeetingActivityEntries(meeting, mockWorkspaceMembers);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('created');
      expect(result[0].actor).toBe('Jan Kowalski');
    });
  });

  describe('getTaskActivityEntries', () => {
    test('should return fallback created entry for task', () => {
      const task = {
        id: 't1',
        title: 'Task 1',
        createdAt: '2026-03-20T10:00:00Z',
        createdByUserId: 'u1',
      };
      const result = getTaskActivityEntries(task);
      expect(result).toHaveLength(1);
      expect(result[0].actor).toBe('u1');
    });

    test('should process task history', () => {
      const task = {
        id: 't1',
        title: 'Task 1',
        history: [
          {
            type: 'status',
            actor: 'Jan Kowalski',
            message: 'Completed',
            createdAt: '2026-03-20T11:00:00Z',
          },
        ],
      };
      const result = getTaskActivityEntries(task);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('status');
      expect(result[0].tone).toBe('warning');
    });
  });

  describe('buildWorkspaceActivityFeed', () => {
    test('should combine, sort and limit entries', () => {
      const meetings = [{ id: 'm1', title: 'M1', createdAt: '2026-03-20T10:00:00Z' }];
      const tasks = [{ id: 't1', title: 'T1', createdAt: '2026-03-20T11:00:00Z' }];

      const result = buildWorkspaceActivityFeed(meetings, tasks, [], [], 1);

      expect(result).toHaveLength(1);
      expect(result[0].entityType).toBe('task'); // T1 is later
      expect(result[0].title).toBe('T1');
    });
  });
});
