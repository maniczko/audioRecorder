import { describe, test, expect } from 'vitest';
import { buildWorkspaceNotifications, getBrowserNotificationCandidates } from './notifications';

describe('notifications library', () => {
  describe('buildWorkspaceNotifications', () => {
    test('should handle empty input', () => {
      const result = buildWorkspaceNotifications();
      expect(result).toEqual([]);
    });

    test('should build reminder notifications', () => {
      const reminders = [
        {
          id: 'rem1',
          entryType: 'task',
          title: 'Zadanie 1',
          minutes: 15,
          remindAt: '2026-03-20T15:00:00Z',
          entryId: 'task1'
        },
        {
          id: 'rem2',
          entryType: 'google',
          title: 'Google Event',
          minutes: 10,
          remindAt: '2026-03-20T14:50:00Z',
          entryId: 'google1'
        }
      ];

      const result = buildWorkspaceNotifications({ reminders });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('reminder:rem2'); // rem2 is earlier
      expect(result[0].tone).toBe('neutral');
      expect(result[1].tone).toBe('warning');
    });

    test('should build task sla notifications and sort them', () => {
      const taskNotifications = [
        {
          task: { id: 't1', title: 'Task 1', createdAt: '2026-03-20T10:00:00Z' },
          sla: { id: 'sla1', tone: 'danger', label: 'Overdue' },
          dependencies: { blocking: false }
        },
        {
          task: { id: 't2', title: 'Task 2', createdAt: '2026-03-20T09:00:00Z' },
          sla: { id: 'sla2', tone: 'warning', label: 'Soon' },
          dependencies: { blocking: true, unresolved: [{ title: 'Dependency' }] }
        }
      ];

      const result = buildWorkspaceNotifications({ taskNotifications });

      expect(result).toHaveLength(2);
      // t2 is earlier (09:00)
      expect(result[0].title).toBe('Task 2');
      expect(result[0].tone).toBe('warning');
      expect(result[1].title).toBe('Task 1');
      expect(result[1].tone).toBe('danger');
    });
  });

  describe('getBrowserNotificationCandidates', () => {
    const items = [
      { id: '1', deliverAt: '2026-03-20T14:50:00Z' },
      { id: '2', deliverAt: '2026-03-20T14:55:00Z' },
      { id: '3', deliverAt: '2026-03-20T15:10:00Z' }
    ];

    test('should filter out delivered items', () => {
      const deliveredIds = ['1'];
      const now = new Date('2026-03-20T15:00:00Z');
      const result = getBrowserNotificationCandidates(items, deliveredIds, now);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    test('should only return items before now + 1 minute', () => {
      const now = new Date('2026-03-20T14:53:00Z');
      const result = getBrowserNotificationCandidates(items, [], now);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    test('should limit output to 3 items', () => {
      const manyItems = [
        { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }
      ];
      const result = getBrowserNotificationCandidates(manyItems, [], new Date());
      expect(result).toHaveLength(3);
    });
  });
});
