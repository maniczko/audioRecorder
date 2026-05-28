import { describe, expect, test, vi } from 'vitest';

import {
  buildDeletedMeetingRemotePayload,
  persistDeletedMeetingRemoteState,
} from './meetingDeletion';

describe('persistDeletedMeetingRemoteState', () => {
  test('Regression: #0 - adds meeting and recording tombstones to delete payload', () => {
    const now = '2026-05-28T07:10:00.000Z';

    expect(
      buildDeletedMeetingRemotePayload({
        meetingId: 'meeting_deleted',
        recordingIds: ['rec_1', 'rec_2', 'rec_1'],
        meetings: [
          { id: 'meeting_deleted', title: 'Deleted' },
          { id: 'meeting_keep', title: 'Keep' },
        ],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {
          recordingTombstones: [{ id: 'rec_existing', deletedAt: '2026-05-27T00:00:00.000Z' }],
        },
        vocabulary: ['crm'],
        now,
      })
    ).toMatchObject({
      meetings: [{ id: 'meeting_keep', title: 'Keep' }],
      calendarMeta: {
        meetingTombstones: [{ id: 'meeting_deleted', deletedAt: now, source: 'meeting-delete' }],
        recordingTombstones: [
          { id: 'rec_1', deletedAt: now, source: 'meeting-delete' },
          { id: 'rec_2', deletedAt: now, source: 'meeting-delete' },
          { id: 'rec_existing', deletedAt: '2026-05-27T00:00:00.000Z' },
        ],
      },
      vocabulary: ['crm'],
    });
  });

  test('Regression: #0 - rejects when remote workspace sync fails instead of allowing a false success toast', async () => {
    const error = new Error('HTTP 502');
    const stateService = {
      mode: 'remote',
      syncWorkspaceState: vi.fn().mockRejectedValueOnce(error),
    };
    const setWorkspaceMessage = vi.fn();

    await expect(
      persistDeletedMeetingRemoteState({
        stateService,
        currentWorkspaceId: 'ws1',
        payload: {
          meetings: [],
          manualTasks: [],
          taskState: {},
          taskBoards: {},
          calendarMeta: {},
          vocabulary: [],
        },
        setWorkspaceMessage,
      })
    ).rejects.toThrow('HTTP 502');

    expect(setWorkspaceMessage).toHaveBeenCalledWith('HTTP 502');
  });
});
