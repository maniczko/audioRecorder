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

  test('Regression: #0 - infers tombstones from latestRecordingId when caller omits recordingIds', () => {
    const now = '2026-05-28T08:45:00.000Z';

    const payload = buildDeletedMeetingRemotePayload({
      meetingId: 'meeting_latest_only',
      meetings: [
        {
          id: 'meeting_latest_only',
          title: 'Ad hoc',
          latestRecordingId: 'recording_latest_only',
          recordings: [],
        },
      ],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      now,
    });

    expect(payload.meetings).toEqual([]);
    expect(payload.calendarMeta).toEqual(
      expect.objectContaining({
        meetingTombstones: [
          { id: 'meeting_latest_only', deletedAt: now, source: 'meeting-delete' },
        ],
        recordingTombstones: [
          { id: 'recording_latest_only', deletedAt: now, source: 'meeting-delete' },
        ],
      })
    );
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
