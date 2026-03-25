import { useCallback, useEffect, useRef, useState } from 'react';
import useStoredState from './useStoredState';
import { STORAGE_KEYS } from '../lib/storage';
import {
  createEmptyMeetingDraft,
  createMeeting,
  meetingToDraft,
  updateMeeting,
  upsertMeeting,
} from '../lib/meeting';
import { createId } from '../lib/storage';

const MEETING_DRAFT_FIELDS = [
  'title',
  'context',
  'startsAt',
  'durationMinutes',
  'attendees',
  'tags',
  'needs',
  'concerns',
  'desiredOutputs',
  'location',
];

function normalizeMeetingDraftValue(draft) {
  const safeDraft = draft && typeof draft === 'object' ? draft : createEmptyMeetingDraft();
  return MEETING_DRAFT_FIELDS.reduce((accumulator, field) => {
    accumulator[field] =
      field === 'durationMinutes' ? Number(safeDraft[field]) || 45 : String(safeDraft[field] ?? '');
    return accumulator;
  }, {} as any);
}

function areMeetingDraftsEqual(left, right) {
  return (
    JSON.stringify(normalizeMeetingDraftValue(left)) ===
    JSON.stringify(normalizeMeetingDraftValue(right))
  );
}

export default function useMeetingLifecycle({
  currentUser,
  currentUserId,
  currentWorkspaceId,
  currentWorkspaceMembers,
  userMeetings,
  setMeetings,
  setWorkspaceMessage,
}) {
  const [storedMeetingDrafts, setStoredMeetingDrafts] = useStoredState(
    STORAGE_KEYS.meetingDrafts,
    {}
  );
  const [meetingDraft, setMeetingDraftState] = useState(createEmptyMeetingDraft());
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState(null);
  const [isDetachedMeetingDraft, setIsDetachedMeetingDraft] = useState(false);
  const [hasMeetingDraftChanges, setHasMeetingDraftChanges] = useState(false);

  const restoredDraftWorkspaceRef = useRef('');
  const skipSelectedMeetingDraftSyncRef = useRef('');
  const draftBaselineRef = useRef(createEmptyMeetingDraft());

  const setMeetingDraft = useCallback((value) => {
    setHasMeetingDraftChanges(true);
    setMeetingDraftState((previous) => (typeof value === 'function' ? value(previous) : value));
  }, []);

  const selectedMeeting = userMeetings.find((meeting) => meeting.id === selectedMeetingId) || null;
  const selectedRecording =
    selectedMeeting?.recordings.find((recording) => recording.id === selectedRecordingId) ||
    selectedMeeting?.recordings[0] ||
    null;
  const activeStoredMeetingDraft = currentWorkspaceId
    ? storedMeetingDrafts[currentWorkspaceId] || null
    : null;

  // -- Draft Restoration Effect --
  useEffect(() => {
    if (!currentUserId || !currentWorkspaceId) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      setIsDetachedMeetingDraft(false);
      const freshDraft = createEmptyMeetingDraft();
      draftBaselineRef.current = freshDraft;
      restoredDraftWorkspaceRef.current = '';
      skipSelectedMeetingDraftSyncRef.current = '';
      setHasMeetingDraftChanges(false);
      setMeetingDraftState(freshDraft);
      return;
    }

    const storedDraft = storedMeetingDrafts[currentWorkspaceId] || null;
    if (storedDraft && restoredDraftWorkspaceRef.current !== currentWorkspaceId) {
      if (storedDraft.selectedMeetingId && !userMeetings.length) {
        return;
      }

      const matchingMeeting = storedDraft.selectedMeetingId
        ? userMeetings.find((meeting) => meeting.id === storedDraft.selectedMeetingId) || null
        : null;
      const baselineDraft =
        storedDraft.baselineDraft ||
        (matchingMeeting ? meetingToDraft(matchingMeeting) : createEmptyMeetingDraft());
      const nextDraft = normalizeMeetingDraftValue(storedDraft.draft || baselineDraft);

      restoredDraftWorkspaceRef.current = currentWorkspaceId;
      draftBaselineRef.current = baselineDraft;
      skipSelectedMeetingDraftSyncRef.current = matchingMeeting?.id || '';
      setSelectedMeetingId(matchingMeeting?.id || null);
      setSelectedRecordingId(
        matchingMeeting?.latestRecordingId || matchingMeeting?.recordings[0]?.id || null
      );
      setIsDetachedMeetingDraft(!matchingMeeting);
      setHasMeetingDraftChanges(false);
      setMeetingDraftState(nextDraft);
      setWorkspaceMessage('Przywrocono ostatni autosave briefu.');
      return;
    }

    if (!userMeetings.length) {
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
      return;
    }

    if (isDetachedMeetingDraft) {
      return;
    }

    const nextSelectedMeeting =
      userMeetings.find((meeting) => meeting.id === selectedMeetingId) || userMeetings[0];
    if (nextSelectedMeeting.id !== selectedMeetingId) {
      const nextDraft = meetingToDraft(nextSelectedMeeting);
      setSelectedMeetingId(nextSelectedMeeting.id);
      setSelectedRecordingId(
        nextSelectedMeeting.latestRecordingId || nextSelectedMeeting.recordings[0]?.id || null
      );
      draftBaselineRef.current = nextDraft;
      setHasMeetingDraftChanges(false);
      setMeetingDraftState(nextDraft);
    }
  }, [
    currentUserId,
    currentWorkspaceId,
    isDetachedMeetingDraft,
    selectedMeetingId,
    storedMeetingDrafts,
    userMeetings,
    setWorkspaceMessage,
  ]);

  // -- Reflect Meeting Selection to Draft Effect --
  useEffect(() => {
    if (!selectedMeeting) return;

    if (skipSelectedMeetingDraftSyncRef.current === selectedMeeting.id) {
      skipSelectedMeetingDraftSyncRef.current = '';
      return;
    }

    const nextDraft = meetingToDraft(selectedMeeting);
    draftBaselineRef.current = nextDraft;
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(nextDraft);
  }, [selectedMeeting]);

  // -- Autosave Effect --
  useEffect(() => {
    if (!currentWorkspaceId) return;

    const baselineDraft = selectedMeeting
      ? meetingToDraft(selectedMeeting)
      : draftBaselineRef.current;
    const hasDraftChanges = !areMeetingDraftsEqual(meetingDraft, baselineDraft);
    if (!hasMeetingDraftChanges && !activeStoredMeetingDraft) {
      return;
    }

    setStoredMeetingDrafts((previous) => {
      const next = { ...previous };
      if (!hasDraftChanges) {
        if (!next[currentWorkspaceId]) return previous;
        delete next[currentWorkspaceId];
        return next;
      }

      const currentEntry = next[currentWorkspaceId];
      const normalizedDraft = normalizeMeetingDraftValue(meetingDraft);
      const normalizedBaselineDraft = normalizeMeetingDraftValue(baselineDraft);
      if (
        currentEntry &&
        areMeetingDraftsEqual(currentEntry.draft, normalizedDraft) &&
        areMeetingDraftsEqual(currentEntry.baselineDraft, normalizedBaselineDraft) &&
        String(currentEntry.selectedMeetingId || '') === String(selectedMeeting?.id || '')
      ) {
        return previous;
      }

      next[currentWorkspaceId] = {
        draft: normalizedDraft,
        baselineDraft: normalizedBaselineDraft,
        selectedMeetingId: selectedMeeting?.id || '',
        updatedAt: new Date().toISOString(),
      };
      return next;
    });
  }, [
    currentWorkspaceId,
    hasMeetingDraftChanges,
    meetingDraft,
    selectedMeeting,
    activeStoredMeetingDraft,
    setStoredMeetingDrafts,
  ]);

  function selectMeeting(meeting) {
    setSelectedMeetingId(meeting.id);
    setSelectedRecordingId(meeting.latestRecordingId || meeting.recordings[0]?.id || null);
    setIsDetachedMeetingDraft(false);
    const nextDraft = meetingToDraft(meeting);
    draftBaselineRef.current = nextDraft;
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(nextDraft);
    setWorkspaceMessage('');
  }

  function startNewMeetingDraft(prefill = null) {
    const freshDraft = createEmptyMeetingDraft();
    let nextDraft = freshDraft;
    if (prefill) {
      nextDraft = {
        ...freshDraft,
        ...(prefill.title ? { title: prefill.title } : {}),
        ...(prefill.context ? { context: prefill.context } : {}),
        ...(prefill.attendees ? { attendees: prefill.attendees } : {}),
      };
      if (prefill.startsAt) {
        const d = new Date(prefill.startsAt);
        nextDraft.startsAt = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      }
    }
    restoredDraftWorkspaceRef.current = currentWorkspaceId || '';
    draftBaselineRef.current = nextDraft;
    setSelectedMeetingId(null);
    setSelectedRecordingId(null);
    setIsDetachedMeetingDraft(true);
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(nextDraft);
    if (currentWorkspaceId) {
      setStoredMeetingDrafts((previous) => {
        if (!previous[currentWorkspaceId]) return previous;
        const next = { ...previous };
        delete next[currentWorkspaceId];
        return next;
      });
    }
  }

  function clearMeetingDraft() {
    const nextDraft = selectedMeeting ? meetingToDraft(selectedMeeting) : createEmptyMeetingDraft();
    draftBaselineRef.current = nextDraft;
    restoredDraftWorkspaceRef.current = currentWorkspaceId || '';
    if (!selectedMeeting) {
      setIsDetachedMeetingDraft(true);
      setSelectedMeetingId(null);
      setSelectedRecordingId(null);
    }
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(nextDraft);
    setWorkspaceMessage(
      selectedMeeting
        ? 'Przywrocono ostatnia zapisana wersje spotkania.'
        : 'Wyczyszczono draft spotkania.'
    );
    if (currentWorkspaceId) {
      setStoredMeetingDrafts((previous) => {
        if (!previous[currentWorkspaceId]) return previous;
        const next = { ...previous };
        delete next[currentWorkspaceId];
        return next;
      });
    }
  }

  function createAdHocMeeting() {
    if (!currentUser || !currentWorkspaceId) return null;

    const timestamp = new Date();
    const adHocMeeting = createMeeting(
      currentUser.id,
      {
        title: `Ad hoc ${new Intl.DateTimeFormat('pl-PL', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }).format(timestamp)}`,
        context: 'Szybkie nagranie bez wczesniejszego briefu.',
        startsAt: new Date(timestamp.getTime() - timestamp.getTimezoneOffset() * 60 * 1000)
          .toISOString()
          .slice(0, 16),
        durationMinutes: 30,
        attendees: currentWorkspaceMembers
          .map((member) => member.name)
          .filter(Boolean)
          .join('\n'),
        tags: 'ad-hoc',
        needs: '',
        desiredOutputs: '',
        location: '',
      },
      {
        workspaceId: currentWorkspaceId,
        createdByUserId: currentUser.id,
        createdByUserName: currentUser.name || currentUser.email || 'Ty',
      }
    );

    setMeetings((previous) => upsertMeeting(previous, adHocMeeting));
    selectMeeting(adHocMeeting);
    setWorkspaceMessage('Utworzono spotkanie ad hoc.');
    return adHocMeeting;
  }

  function saveMeeting(draftOverride?) {
    if (!currentUser || !currentWorkspaceId) return;

    if (!selectedMeeting) {
      const meeting = createMeeting(currentUser.id, meetingDraft, {
        workspaceId: currentWorkspaceId,
        createdByUserId: currentUser.id,
        createdByUserName: currentUser.name || currentUser.email || 'Ty',
      });
      setMeetings((previous) => upsertMeeting(previous, meeting));
      setIsDetachedMeetingDraft(false);
      selectMeeting(meeting);
      return;
    }

    const nextMeeting = {
      ...updateMeeting(selectedMeeting, draftOverride || meetingDraft),
      activity: [
        ...(selectedMeeting.activity || []),
        {
          id: createId('meeting_activity'),
          type: 'updated',
          actorId: currentUser.id,
          actorName: currentUser.name || currentUser.email || 'Ty',
          message: 'Zmieniono brief spotkania.',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    setMeetings((previous) => upsertMeeting(previous, nextMeeting));
    setIsDetachedMeetingDraft(false);
    selectMeeting(nextMeeting);
  }

  function createMeetingDirect(draft) {
    if (!currentUser || !currentWorkspaceId) return null;
    const meeting = createMeeting(currentUser.id, draft, {
      workspaceId: currentWorkspaceId,
      createdByUserId: currentUser.id,
      createdByUserName: currentUser.name || currentUser.email || 'Ty',
    });
    setMeetings((previous) => upsertMeeting(previous, meeting));
    return meeting;
  }

  function resetSelectionState() {
    const freshDraft = createEmptyMeetingDraft();
    setSelectedMeetingId(null);
    setSelectedRecordingId(null);
    setIsDetachedMeetingDraft(false);
    draftBaselineRef.current = freshDraft;
    restoredDraftWorkspaceRef.current = '';
    skipSelectedMeetingDraftSyncRef.current = '';
    setHasMeetingDraftChanges(false);
    setMeetingDraftState(freshDraft);
    setWorkspaceMessage('');
  }

  return {
    meetingDraft,
    setMeetingDraft,
    activeStoredMeetingDraft,
    isDetachedMeetingDraft,
    selectedMeetingId,
    setSelectedMeetingId,
    selectedRecordingId,
    setSelectedRecordingId,
    selectedMeeting,
    selectedRecording,
    selectMeeting,
    startNewMeetingDraft,
    clearMeetingDraft,
    createAdHocMeeting,
    saveMeeting,
    createMeetingDirect,
    resetSelectionState,
  };
}
