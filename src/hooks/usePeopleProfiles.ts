import { useMemo } from 'react';
import useStoredState from './useStoredState';
import { STORAGE_KEYS } from '../lib/storage';
import { buildPeopleProfiles, createManualPerson, normalizePersonName } from '../lib/people';
import { analyzePersonProfile } from '../lib/analysis';

export default function usePeopleProfiles({
  userMeetings,
  meetingTasks,
  currentUser,
  currentWorkspaceMembers,
  manualPeople = [],
  setManualPeople,
  setMeetings,
  setManualTasks,
  setTaskState,
}) {
  const [personNotes, setPersonNotes] = useStoredState(STORAGE_KEYS.personNotes, {});

  const peopleProfiles = useMemo(() => {
    const base = buildPeopleProfiles(
      userMeetings,
      meetingTasks,
      currentUser,
      currentWorkspaceMembers,
      manualPeople
    );
    return base.map((profile) => {
      const overrides = personNotes[profile.id];
      if (!overrides) return profile;
      return {
        ...profile,
        needs: overrides.needs !== undefined ? overrides.needs : profile.needs,
        concerns: overrides.concerns !== undefined ? overrides.concerns : profile.concerns,
        outputs: overrides.outputs !== undefined ? overrides.outputs : profile.outputs,
      };
    });
  }, [currentUser, currentWorkspaceMembers, manualPeople, meetingTasks, personNotes, userMeetings]);

  function updatePersonNotes(personId, patches) {
    setPersonNotes((previous) => ({
      ...previous,
      [personId]: { ...(previous[personId] || {}), ...patches },
    }));
  }

  function addManualPerson(draft) {
    const name = normalizePersonName(typeof draft === 'string' ? draft : draft?.name);
    if (!name || typeof setManualPeople !== 'function') return null;

    const duplicate = peopleProfiles.some(
      (profile) => normalizePersonName(profile.name).toLowerCase() === name.toLowerCase()
    );
    if (duplicate) return null;

    const person = createManualPerson(name, typeof draft === 'object' ? draft : {});
    setManualPeople((previous) => [person, ...(Array.isArray(previous) ? previous : [])]);
    return person;
  }

  function renamePerson(personId, nextName) {
    const profile = peopleProfiles.find((p) => p.id === personId);
    const oldName = normalizePersonName(profile?.name);
    const name = normalizePersonName(nextName);
    if (!oldName || !name || oldName.toLowerCase() === name.toLowerCase()) return null;

    const now = new Date().toISOString();
    if (typeof setManualPeople === 'function') {
      setManualPeople((previous) => {
        const safePrevious = Array.isArray(previous) ? previous : [];
        const hasManual = safePrevious.some((person) => person.id === personId);
        if (hasManual) {
          return safePrevious.map((person) =>
            person.id === personId ? { ...person, name, updatedAt: now } : person
          );
        }
        return [createManualPerson(name, { id: personId, createdAt: now }), ...safePrevious];
      });
    }

    const renameValue = (value) =>
      normalizePersonName(value).toLowerCase() === oldName.toLowerCase() ? name : value;

    if (typeof setMeetings === 'function') {
      setMeetings((previous) =>
        (Array.isArray(previous) ? previous : []).map((meeting) => ({
          ...meeting,
          attendees: Array.isArray(meeting.attendees)
            ? meeting.attendees.map(renameValue)
            : meeting.attendees,
          speakerNames: Object.fromEntries(
            Object.entries(meeting.speakerNames || {}).map(([key, value]) => [
              key,
              renameValue(value),
            ])
          ),
          analysis: meeting.analysis
            ? {
                ...meeting.analysis,
                speakerLabels: Object.fromEntries(
                  Object.entries(meeting.analysis.speakerLabels || {}).map(([key, value]) => [
                    key,
                    renameValue(value),
                  ])
                ),
                participantInsights: Array.isArray(meeting.analysis.participantInsights)
                  ? meeting.analysis.participantInsights.map((insight) =>
                      normalizePersonName(insight?.speaker).toLowerCase() === oldName.toLowerCase()
                        ? { ...insight, speaker: name }
                        : insight
                    )
                  : meeting.analysis.participantInsights,
              }
            : meeting.analysis,
          recordings: Array.isArray(meeting.recordings)
            ? meeting.recordings.map((recording) => ({
                ...recording,
                speakerNames: Object.fromEntries(
                  Object.entries(recording.speakerNames || {}).map(([key, value]) => [
                    key,
                    renameValue(value),
                  ])
                ),
              }))
            : meeting.recordings,
          updatedAt: now,
        }))
      );
    }

    if (typeof setManualTasks === 'function') {
      setManualTasks((previous) =>
        (Array.isArray(previous) ? previous : []).map((task) => ({
          ...task,
          owner: renameValue(task.owner),
          assignedTo: Array.isArray(task.assignedTo)
            ? task.assignedTo.map(renameValue)
            : task.assignedTo,
          updatedAt: now,
        }))
      );
    }

    if (typeof setTaskState === 'function') {
      setTaskState((previous) =>
        Object.fromEntries(
          Object.entries(previous || {}).map(([taskId, state]) => [
            taskId,
            {
              ...state,
              owner: renameValue((state as any)?.owner),
              assignedTo: Array.isArray((state as any)?.assignedTo)
                ? (state as any).assignedTo.map(renameValue)
                : (state as any)?.assignedTo,
              updatedAt: now,
            },
          ])
        )
      );
    }

    return { id: personId, name };
  }

  function deleteManualPerson(personId) {
    if (typeof setManualPeople !== 'function') return;
    setManualPeople((previous) =>
      (Array.isArray(previous) ? previous : []).filter((person) => person.id !== personId)
    );
    setPersonNotes((previous) => {
      const next = { ...(previous || {}) };
      delete next[personId];
      return next;
    });
  }

  async function analyzePersonPsychProfile(personId) {
    const profile = peopleProfiles.find((p) => p.id === personId);
    if (!profile) return;

    const allSegments: Array<Record<string, unknown> & { meetingTitle?: string }> = [];
    for (const meeting of profile.meetings) {
      for (const recording of meeting.recordings || []) {
        const names = {
          ...(recording.speakerNames || {}),
          ...(recording.analysis?.speakerLabels || {}),
        };
        const targetLower = profile.name.toLowerCase();
        const entry = Object.entries(names).find(([, name]) => {
          const nl = String(name || '').toLowerCase();
          return (
            nl === targetLower ||
            nl.includes(targetLower) ||
            targetLower.includes(nl) ||
            (targetLower.split(' ')[0].length > 2 && nl.split(' ')[0] === targetLower.split(' ')[0])
          );
        });
        if (!entry) continue;
        const speakerId = Number(entry[0]);
        (recording.transcript || [])
          .filter((segment) => segment.speakerId === speakerId)
          .forEach((segment) => allSegments.push({ ...segment, meetingTitle: meeting.title }));
      }
    }

    const result = await analyzePersonProfile({
      personName: profile.name,
      meetings: profile.meetings,
      allSegments,
    });
    updatePersonNotes(personId, { psychProfile: result });
    return result;
  }

  return {
    personNotes,
    peopleProfiles,
    updatePersonNotes,
    addManualPerson,
    renamePerson,
    deleteManualPerson,
    analyzePersonPsychProfile,
  };
}
