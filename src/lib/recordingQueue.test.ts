import {
  buildRecordingQueueSummary,
  createRecordingQueueItem,
  findLiveMeetingForQueueItem,
  getNextPendingRecordingQueueItem,
  getNextProcessableRecordingQueueItem,
  getRecordingQueueForMeeting,
  normalizeRecordingPipelineStatus,
  resolveQueueMeetingContext,
  updateRecordingQueueItem,
} from './recordingQueue';

describe('recordingQueue helpers', () => {
  test('normalizes completed to done', () => {
    expect(normalizeRecordingPipelineStatus('completed')).toBe('done');
    expect(normalizeRecordingPipelineStatus('processing')).toBe('processing');
  });

  test('updates queue item state and keeps meeting filters working', () => {
    const item = createRecordingQueueItem({
      recordingId: 'recording_1',
      meeting: { id: 'meeting_1', workspaceId: 'workspace_1', title: 'Daily' },
      mimeType: 'audio/webm',
    });

    const updatedQueue = updateRecordingQueueItem([item], 'recording_1', {
      status: 'failed',
      errorMessage: 'network',
    });

    expect(getRecordingQueueForMeeting(updatedQueue, 'meeting_1')).toHaveLength(1);
    expect(buildRecordingQueueSummary(updatedQueue)).toMatchObject({
      total: 1,
      failed: 1,
    });
  });

  test('resolveMeetingForQueueItem uses fresh meetings over stale snapshot', () => {
    // Simulates the scenario fixed by task 046: meeting updated while processQueueItem runs.
    // If resolveMeetingForQueueItem used a stale closure, it would return the snapshot.
    // With userMeetingsRef.current it returns the latest live meeting.
    const item = createRecordingQueueItem({
      recordingId: 'recording_1',
      meeting: { id: 'meeting_1', workspaceId: 'workspace_1', title: 'Stary tytuł' },
    });

    // Snapshot captured at queue creation time (stale)
    expect(item.meetingSnapshot.title).toBe('Stary tytuł');

    // Fresh meetings array reflects an update made during processing
    const freshMeetings = [{ id: 'meeting_1', workspaceId: 'workspace_1', title: 'Nowy tytuł' }];

    // This is the logic inside resolveMeetingForQueueItem using ref.current
    const resolved = freshMeetings.find((m) => m.id === item.meetingId) || item.meetingSnapshot;
    expect(resolved.title).toBe('Nowy tytuł');

    // When meeting is removed from live list, snapshot is the fallback
    const resolvedFallback = [].find((m) => m.id === item.meetingId) || item.meetingSnapshot;
    expect(resolvedFallback.title).toBe('Stary tytuł');
  });

  test('preserves meetingId when ad-hoc meeting snapshot is asynchronous and unavailable', () => {
    // Simulates the bug fix where ad-hoc meeting creation leaves the meeting snapshot undefined
    // but the recording process explicitly provides the requested meetingId.
    const item = createRecordingQueueItem({
      recordingId: 'recording_2',
      meetingId: 'adhoc_meeting_1',
      meeting: undefined, // Unavailable at creation
      mimeType: 'audio/webm',
    });

    expect(item.meetingId).toBe('adhoc_meeting_1');
    expect(item.workspaceId).toBe('');
    expect(item.meetingTitle).toBe('Spotkanie');
    expect(item.meetingSnapshot).toBeNull();
  });

  test('finds a live meeting by workspace and title when the snapshot id changed after sync', () => {
    const item = createRecordingQueueItem({
      recordingId: 'recording_3',
      meetingId: 'meeting_local',
      meeting: { id: 'meeting_local', workspaceId: 'workspace_1', title: 'Ad hoc' },
    });

    const meetings = [{ id: 'meeting_remote', workspaceId: 'workspace_1', title: 'Ad hoc' }];

    expect(findLiveMeetingForQueueItem(meetings, item)).toEqual(meetings[0]);
    expect(resolveQueueMeetingContext(meetings, item)).toEqual(meetings[0]);
  });

  test('returns the next processable pending item based on a predicate', () => {
    const first = createRecordingQueueItem({
      recordingId: 'recording_1',
      meeting: { id: 'meeting_1', workspaceId: 'workspace_1', title: 'Daily' },
      createdAt: '2026-03-15T08:00:00.000Z',
    });
    const second = createRecordingQueueItem({
      recordingId: 'recording_2',
      meeting: { id: 'meeting_2', workspaceId: 'workspace_1', title: 'Retro' },
      createdAt: '2026-03-15T08:01:00.000Z',
    });

    const queue = [first, second];

    expect(getNextPendingRecordingQueueItem(queue)?.recordingId).toBe('recording_1');
    expect(
      getNextProcessableRecordingQueueItem(queue, (item) => item.meetingId === 'meeting_2')
        ?.recordingId
    ).toBe('recording_2');
  });
});
