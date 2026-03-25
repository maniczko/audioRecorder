import { beforeEach, describe, expect, test } from 'vitest';
import { useMeetingsStore } from './meetingsStore';

const initialDraft = useMeetingsStore.getState().meetingDraft;

describe('meetingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useMeetingsStore.setState({
      meetings: [],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      workspaceMessage: '',
      storedMeetingDrafts: {},
      meetingDraft: initialDraft,
      selectedMeetingId: null,
      selectedRecordingId: null,
      isDetachedMeetingDraft: false,
      hasMeetingDraftChanges: false,
    });
  });

  test('supports updater functions across persisted collections', () => {
    const store = useMeetingsStore.getState();

    store.setMeetings(() => [{ id: 'm1' }]);
    store.setManualTasks(() => [{ id: 't1' }]);
    store.setTaskState(() => ({ t1: { done: false } }));
    store.setTaskBoards(() => ({ ws1: [{ id: 'todo' }] }));
    store.setCalendarMeta(() => ({ 'meeting:m1': { googleEventId: 'g1' } }));
    store.setVocabulary(() => ['voice']);

    expect(useMeetingsStore.getState()).toMatchObject({
      meetings: [{ id: 'm1' }],
      manualTasks: [{ id: 't1' }],
      taskState: { t1: { done: false } },
      taskBoards: { ws1: [{ id: 'todo' }] },
      calendarMeta: { 'meeting:m1': { googleEventId: 'g1' } },
      vocabulary: ['voice'],
    });
  });

  test('marks meeting draft as changed and persists stable fields', () => {
    const store = useMeetingsStore.getState();
    store.setMeetingDraft((previous: any) => ({ ...previous, title: 'Nowa notatka' }));
    store.setStoredMeetingDrafts(() => ({ ws1: { title: 'Draft' } }));

    expect(useMeetingsStore.getState().meetingDraft.title).toBe('Nowa notatka');
    expect(useMeetingsStore.getState().hasMeetingDraftChanges).toBe(true);

    const persisted = JSON.parse(localStorage.getItem('voicelog_meetings_store') || '{}');
    expect(persisted.state).toMatchObject({
      meetings: [],
      manualTasks: [],
      storedMeetingDrafts: { ws1: { title: 'Draft' } },
    });
    expect(persisted.state.meetingDraft).toBeUndefined();
  });
});
