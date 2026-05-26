import { describe, expect, test, vi } from 'vitest';

import { persistDeletedMeetingRemoteState } from './meetingDeletion';

describe('persistDeletedMeetingRemoteState', () => {
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
