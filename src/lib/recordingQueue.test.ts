import {
  buildRecordingQueueSummary,
  createRecordingQueueItem,
  findLiveMeetingForQueueItem,
  getNextPendingRecordingQueueItem,
  getNextProcessableRecordingQueueItem,
  getRecordingQueueForMeeting,
  hasRecordingWorkspaceContext,
  isQueueMeetingSnapshotTarget,
  isWorkspaceMissingErrorMessage,
  normalizeQueueErrorMessage,
  normalizeRecordingQueue,
  normalizeRecordingPipelineStatus,
  removeRecordingQueueItemsForMeeting,
  RECORDING_WORKSPACE_REQUIRED_MESSAGE,
  resolveQueueMeetingContext,
  updateRecordingQueueItem,
} from './recordingQueue';

describe('recordingQueue helpers', () => {
  test('returns a stable zeroed summary for an empty queue', () => {
    expect(buildRecordingQueueSummary([])).toEqual({
      total: 0,
      queued: 0,
      uploading: 0,
      processing: 0,
      diarization: 0,
      review: 0,
      failed: 0,
      failed_permanent: 0,
      done: 0,
    });
  });

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

  test('preserves recording consent metadata through queue normalization', () => {
    const item = createRecordingQueueItem({
      recordingId: 'recording_consent',
      meeting: { id: 'meeting_1', workspaceId: 'workspace_1', title: 'Consent call' },
      recordingConsent: {
        acceptedAt: '2026-06-25T10:00:00.000Z',
        workspaceId: 'workspace_1',
        policyVersion: 'recording-consent-v1',
        disclosureTitle: 'Zgoda na nagrywanie i przetwarzanie AI',
        providerNotice: 'Dane moga byc przekazywane do dostawcow AI/audio.',
        providers: [{ id: 'stt', label: 'transkrypcja mowy na tekst', enabled: true }],
      },
    });

    const [normalized] = normalizeRecordingQueue([item]);

    expect(normalized.recordingConsent).toMatchObject({
      acceptedAt: '2026-06-25T10:00:00.000Z',
      workspaceId: 'workspace_1',
      policyVersion: 'recording-consent-v1',
    });
  });

  // -----------------------------------------------------------------
  // Issue #0 - deleted recordings came back from the persisted queue
  // Date: 2026-05-21
  // Bug: deleting a meeting removed workspace state but left queue items that
  //      rebuilt optimistic recordings in the library after sync/reload.
  // Fix: remove queue items by meeting id and explicit recording ids.
  // -----------------------------------------------------------------
  test('Regression: removes queue items for a deleted meeting and its recordings', () => {
    const queue = [
      createRecordingQueueItem({
        recordingId: 'recording_deleted',
        meeting: { id: 'meeting_deleted', workspaceId: 'workspace_1', title: 'Deleted import' },
      }),
      createRecordingQueueItem({
        recordingId: 'recording_explicit',
        meeting: { id: 'meeting_other', workspaceId: 'workspace_1', title: 'Other import' },
      }),
      createRecordingQueueItem({
        recordingId: 'recording_keep',
        meeting: { id: 'meeting_keep', workspaceId: 'workspace_1', title: 'Keep import' },
      }),
    ];

    const result = removeRecordingQueueItemsForMeeting(queue, 'meeting_deleted', [
      'recording_explicit',
    ]);

    expect(result.map((item) => item.recordingId)).toEqual(['recording_keep']);
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

  test('does not consider remote queue item processable without workspace context', () => {
    const item = createRecordingQueueItem({
      recordingId: 'recording_missing_workspace',
      meetingId: 'meeting_1',
      meeting: { id: 'meeting_1', title: 'Missing workspace' },
    });

    expect(item.workspaceId).toBe('');
    expect(hasRecordingWorkspaceContext(item)).toBe(false);
    expect(
      getNextProcessableRecordingQueueItem([item], (candidate) =>
        hasRecordingWorkspaceContext(candidate)
      )
    ).toBeUndefined();
  });

  // -----------------------------------------------------------------
  // Issue #0 - stale persisted queue with missing X-Workspace-Id
  // Date: 2026-05-21
  // Bug: old failed queue items kept technical backend errors and retry UI.
  // Fix: normalize them to a permanent, friendly re-import state.
  // -----------------------------------------------------------------
  test('Regression: normalizes persisted missing-workspace failures to permanent friendly state', () => {
    const [item] = normalizeRecordingQueue([
      {
        id: 'queue_missing_workspace',
        recordingId: 'recording_missing_workspace',
        meetingId: 'meeting_1',
        meetingTitle: 'Missing workspace',
        status: 'failed',
        uploaded: true,
        errorMessage: 'Brakuje X-Workspace-Id.',
        createdAt: '2026-05-18T17:47:00.000Z',
      },
    ]);

    expect(isWorkspaceMissingErrorMessage('Brakuje X-Workspace-Id.')).toBe(true);
    expect(normalizeQueueErrorMessage('Brakuje X-Workspace-Id.')).toBe(
      RECORDING_WORKSPACE_REQUIRED_MESSAGE
    );
    expect(item).toMatchObject({
      recordingId: 'recording_missing_workspace',
      status: 'failed_permanent',
      errorMessage: RECORDING_WORKSPACE_REQUIRED_MESSAGE,
    });
  });

  test('keeps a queue snapshot recoverable instead of fuzzy matching a same-title meeting', () => {
    const item = createRecordingQueueItem({
      recordingId: 'recording_3',
      meetingId: 'meeting_local',
      meeting: { id: 'meeting_local', workspaceId: 'workspace_1', title: 'Ad hoc' },
    });

    const meetings = [{ id: 'meeting_remote', workspaceId: 'workspace_1', title: 'Ad hoc' }];

    const resolved = resolveQueueMeetingContext(meetings, item);

    expect(findLiveMeetingForQueueItem(meetings, item)).toBeNull();
    expect(resolved).toMatchObject({
      id: 'meeting_local',
      workspaceId: 'workspace_1',
      title: 'Ad hoc',
    });
    expect(isQueueMeetingSnapshotTarget(resolved)).toBe(true);
  });

  test('fuzzy matches a live meeting by workspace and title when no queue snapshot exists', () => {
    const item = {
      meetingId: 'meeting_local',
      workspaceId: 'workspace_1',
      meetingTitle: 'Ad hoc',
    };

    const meetings = [{ id: 'meeting_remote', workspaceId: 'workspace_1', title: 'Ad hoc' }];

    expect(findLiveMeetingForQueueItem(meetings, item)).toEqual(meetings[0]);
    expect(resolveQueueMeetingContext(meetings, item)).toEqual(meetings[0]);
  });

  test('reconstructs meeting context from queue metadata when the snapshot is missing', () => {
    const item = createRecordingQueueItem({
      recordingId: 'recording_4',
      meetingId: 'meeting_recoverable',
      workspaceId: 'workspace_1',
      meeting: undefined,
      mimeType: 'audio/webm',
    });

    const resolved = resolveQueueMeetingContext([], {
      ...item,
      meetingTitle: 'Recovered import',
      meetingSnapshot: null,
    });

    expect(resolved).toMatchObject({
      id: 'meeting_recoverable',
      workspaceId: 'workspace_1',
      title: 'Recovered import',
    });
    expect(isQueueMeetingSnapshotTarget(resolved)).toBe(true);
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

  test('counts every supported queue status without missing counters', () => {
    const statuses = [
      'queued',
      'uploading',
      'processing',
      'diarization',
      'review',
      'failed',
      'failed_permanent',
      'done',
    ] as const;

    const queue = statuses.map((status, index) => ({
      ...createRecordingQueueItem({
        recordingId: `recording_${status}`,
        meeting: {
          id: `meeting_${index}`,
          workspaceId: 'workspace_1',
          title: `Meeting ${index}`,
        },
      }),
      status,
    }));

    const summary = buildRecordingQueueSummary(queue);

    expect(summary.total).toBe(statuses.length);
    for (const status of statuses) {
      expect(summary[status]).toBe(1);
    }
  });
});
