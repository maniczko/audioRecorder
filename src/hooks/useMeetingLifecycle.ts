```typescript
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
import { apiRequest } from '../services/httpClient';
import { remoteApiEnabled } from '../services/config';

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
      return; // Ensure to return to avoid further execution
    }

    // Add selectedMeeting and selectedRecording to the dependency array
  }, [currentUserId, currentWorkspaceId, selectedMeeting, selectedRecording]);

  // Other effects and logic...

  return {
    meetingDraft,
    setMeetingDraft,
    // Other return values...
  };
}
```