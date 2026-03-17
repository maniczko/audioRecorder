import { useMemo } from "react";
import useStoredState from "./useStoredState";
import { STORAGE_KEYS } from "../lib/storage";
import { buildPeopleProfiles } from "../lib/people";
import { analyzePersonProfile } from "../lib/analysis";

export default function usePeopleProfiles({
  userMeetings,
  meetingTasks,
  currentUser,
  currentWorkspaceMembers,
}) {
  const [personNotes, setPersonNotes] = useStoredState(STORAGE_KEYS.personNotes, {});

  const peopleProfiles = useMemo(() => {
    const base = buildPeopleProfiles(userMeetings, meetingTasks, currentUser, currentWorkspaceMembers);
    return base.map((profile) => {
      const overrides = personNotes[profile.id];
      if (!overrides) return profile;
      return {
        ...profile,
        needs: overrides.needs !== undefined ? overrides.needs : profile.needs,
        outputs: overrides.outputs !== undefined ? overrides.outputs : profile.outputs,
      };
    });
  }, [currentUser, currentWorkspaceMembers, meetingTasks, personNotes, userMeetings]);

  function updatePersonNotes(personId, patches) {
    setPersonNotes((previous) => ({
      ...previous,
      [personId]: { ...(previous[personId] || {}), ...patches },
    }));
  }

  async function analyzePersonPsychProfile(personId) {
    const profile = peopleProfiles.find((p) => p.id === personId);
    if (!profile) return;

    const allSegments = [];
    for (const meeting of profile.meetings) {
      for (const recording of meeting.recordings || []) {
        const names = {
          ...(recording.speakerNames || {}),
          ...(recording.analysis?.speakerLabels || {}),
        };
        const targetLower = profile.name.toLowerCase();
        const entry = Object.entries(names).find(([, name]) => {
          const nl = String(name || "").toLowerCase();
          return (
            nl === targetLower ||
            nl.includes(targetLower) ||
            targetLower.includes(nl) ||
            (targetLower.split(" ")[0].length > 2 && nl.split(" ")[0] === targetLower.split(" ")[0])
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
    analyzePersonPsychProfile,
  };
}
