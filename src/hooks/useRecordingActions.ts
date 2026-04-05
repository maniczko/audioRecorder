import { createId } from '../lib/storage';
import { attachRecording } from '../lib/meeting';
import { apiRequest } from '../services/httpClient';
import { remoteApiEnabled } from '../services/config';

export default function useRecordingActions({
  currentUser,
  selectedMeeting,
  selectedRecording,
  setMeetings,
  setManualTasks,
  setSelectedMeetingId,
  setSelectedRecordingId,
}) {
  interface ReviewableTranscriptSegment {
    id: string;
    text?: string;
    timestamp?: number;
    endTimestamp?: number;
    speakerId?: number | string;
    rawConfidence?: number;
    verificationScore?: number;
    verificationStatus?: 'review' | 'verified';
    verificationReasons?: string[];
    verificationEvidence?: { comparisonText?: string };
    [key: string]: any;
  }

  interface RecordingMarker {
    id: string;
    timestamp: number;
    label: string;
    note: string;
    createdAt: string;
  }

  function updateSelectedRecording(mutator) {
    if (!selectedMeeting || !selectedRecording) return;

    setMeetings((previous) =>
      previous.map((meeting) => {
        if (meeting.id !== selectedMeeting.id) return meeting;

        let nextSelectedRecording: any = null;
        const nextRecordings = (meeting.recordings || []).map((recording) => {
          if (recording.id !== selectedRecording.id) return recording;
          nextSelectedRecording = mutator(recording);
          return nextSelectedRecording;
        });

        if (!nextSelectedRecording) return meeting;

        const isLatestRecording = meeting.latestRecordingId === nextSelectedRecording.id;
        return {
          ...meeting,
          recordings: nextRecordings,
          speakerNames: isLatestRecording
            ? nextSelectedRecording.speakerNames
            : meeting.speakerNames,
          speakerCount: isLatestRecording
            ? nextSelectedRecording.speakerCount
            : meeting.speakerCount,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }

  function buildTranscriptReviewSummary(transcript: ReviewableTranscriptSegment[]) {
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    return {
      needsReview: safeTranscript.filter((segment) => segment.verificationStatus === 'review')
        .length,
      approved: safeTranscript.filter((segment) => segment.verificationStatus === 'verified')
        .length,
    };
  }

  function normalizeRecordingMarkers(markers: any[] = []): RecordingMarker[] {
    return (Array.isArray(markers) ? markers : [])
      .map((marker, index) => {
        const timestamp = Number(marker?.timestamp);
        if (!Number.isFinite(timestamp) || timestamp < 0) return null;
        return {
          id: String(marker?.id || createId(`marker_${index}`)),
          timestamp,
          label: String(marker?.label || `Marker ${index + 1}`).trim() || `Marker ${index + 1}`,
          note: String(marker?.note || '').trim(),
          createdAt: marker?.createdAt || new Date().toISOString(),
        };
      })
      .filter((marker): marker is RecordingMarker => Boolean(marker))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  function finalizeRecordingTranscript(recording: any, transcript: any, overrides: any = {}) {
    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    const speakerNames = { ...(recording.speakerNames || {}), ...(overrides?.speakerNames || {}) };
    const uniqueSpeakerIds = [
      ...new Set(safeTranscript.map((s) => String(s.speakerId)).filter(Boolean)),
    ];
    uniqueSpeakerIds.forEach((sid) => {
      if (!speakerNames[sid]) speakerNames[sid] = `Speaker ${Number(sid) + 1}`;
    });

    return {
      ...recording,
      ...overrides,
      transcript: safeTranscript,
      speakerNames,
      speakerCount: uniqueSpeakerIds.length,
      markers: normalizeRecordingMarkers(overrides?.markers || recording.markers),
      reviewSummary: buildTranscriptReviewSummary(safeTranscript),
    };
  }

  function renameSpeaker(speakerId, nextValue) {
    if (!selectedMeeting || !selectedRecording) return;
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== selectedMeeting.id) return m;
        return {
          ...m,
          speakerNames:
            m.latestRecordingId === selectedRecording.id
              ? { ...m.speakerNames, [String(speakerId)]: nextValue }
              : m.speakerNames,
          recordings: m.recordings.map((r) =>
            r.id !== selectedRecording.id
              ? r
              : {
                  ...r,
                  speakerNames: { ...r.speakerNames, [String(speakerId)]: nextValue },
                  analysis: r.analysis
                    ? {
                        ...r.analysis,
                        speakerLabels: {
                          ...(r.analysis.speakerLabels || r.speakerNames),
                          [String(speakerId)]: nextValue,
                        },
                      }
                    : r.analysis,
                }
          ),
        };
      })
    );
  }

  function updateTranscriptSegment(segmentId, updates) {
    updateSelectedRecording((recording) => {
      const transcript = (recording.transcript || []).map((s) =>
        s.id !== segmentId
          ? s
          : {
              ...s,
              ...updates,
              verificationStatus:
                updates.verificationStatus || (updates.text ? 'verified' : s.verificationStatus),
              verificationReasons:
                updates.verificationReasons || (updates.text ? [] : s.verificationReasons),
            }
      );
      return finalizeRecordingTranscript(recording, transcript);
    });
  }

  function assignSpeakerToTranscriptSegments(segmentIds, nextSpeakerId) {
    const selectedIds = new Set((Array.isArray(segmentIds) ? segmentIds : []).map(String));
    if (!selectedIds.size) return;
    updateSelectedRecording((recording) => {
      const transcript = (recording.transcript || []).map((s) =>
        selectedIds.has(s.id)
          ? {
              ...s,
              speakerId: Number(nextSpeakerId),
              verificationReasons: [
                ...new Set([
                  ...(s.verificationReasons || []),
                  'speaker zmieniony recznie dla zakresu',
                ]),
              ],
            }
          : s
      );
      return finalizeRecordingTranscript(recording, transcript);
    });
  }

  function mergeTranscriptSegments(segmentIds) {
    const selectedIds = new Set((Array.isArray(segmentIds) ? segmentIds : []).map(String));
    if (selectedIds.size < 2) return;
    updateSelectedRecording((recording) => {
      const transcript = Array.isArray(recording.transcript) ? [...recording.transcript] : [];
      const indexed = transcript.map((s, i) => ({ s, i })).filter(({ s }) => selectedIds.has(s.id));
      if (indexed.length < 2) return recording;
      const sorted = [...indexed].sort((a, b) => a.i - b.i);
      const firstI = sorted[0].i;
      const lastI = sorted[sorted.length - 1].i;
      if (!sorted.every((item, idx) => item.i === firstI + idx)) return recording;

      const firstS = sorted[0].s;
      const lastS = sorted[sorted.length - 1].s;
      const merged = {
        ...firstS,
        text: sorted
          .map(({ s }) => String(s.text || '').trim())
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
        timestamp: firstS.timestamp,
        endTimestamp:
          lastS.endTimestamp || lastS.timestamp || firstS.endTimestamp || firstS.timestamp,
        speakerId: firstS.speakerId,
        rawConfidence:
          sorted.reduce((sum, { s }) => sum + Number(s.rawConfidence || 0), 0) / sorted.length,
        verificationScore:
          sorted.reduce((sum, { s }) => sum + Number(s.verificationScore || 0), 0) / sorted.length,
        verificationStatus: sorted.some(({ s }) => s.verificationStatus === 'review')
          ? 'review'
          : 'verified',
        verificationReasons: [
          ...new Set(
            sorted
              .flatMap(({ s }) => s.verificationReasons || [])
              .concat('polaczono recznie z kilku segmentow')
          ),
        ],
        verificationEvidence: {
          comparisonText: sorted
            .map(({ s }) => s.verificationEvidence?.comparisonText || '')
            .filter(Boolean)
            .join(' '),
        },
      };

      const nextTranscript = [
        ...transcript.slice(0, firstI),
        merged,
        ...transcript.slice(lastI + 1),
      ];
      return finalizeRecordingTranscript(recording, nextTranscript);
    });
  }

  function splitTranscriptSegment(segmentId, splitIndex) {
    updateSelectedRecording((recording) => {
      const transcript = Array.isArray(recording.transcript) ? [...recording.transcript] : [];
      const idx = transcript.findIndex((s) => s.id === segmentId);
      if (idx === -1) return recording;
      const s = transcript[idx];
      const text = String(s.text || '');
      const normalizedSplit = Math.max(
        1,
        Math.min(text.length - 1, Number(splitIndex) || Math.floor(text.length / 2))
      );
      const leftT = text.slice(0, normalizedSplit).trim();
      const rightT = text.slice(normalizedSplit).trim();
      if (!leftT || !rightT) return recording;

      const startT = Number(s.timestamp || 0);
      const endT = Number(s.endTimestamp || s.timestamp || startT + 2) || startT + 2;
      const ratio = normalizedSplit / Math.max(text.length, 1);
      const midT = startT + (endT - startT) * ratio;
      const reasons = [
        ...new Set([...(s.verificationReasons || []), 'podzielono recznie - sprawdz ponownie']),
      ];
      const leftS = {
        ...s,
        text: leftT,
        endTimestamp: midT,
        verificationStatus: 'review',
        verificationReasons: reasons,
      };
      const rightS = {
        ...s,
        id: createId('segment'),
        text: rightT,
        timestamp: midT,
        endTimestamp: endT,
        verificationStatus: 'review',
        verificationReasons: reasons,
      };

      const nextTranscript = [
        ...transcript.slice(0, idx),
        leftS,
        rightS,
        ...transcript.slice(idx + 1),
      ];
      return finalizeRecordingTranscript(recording, nextTranscript);
    });
  }

  function addRecordingMarker(marker) {
    if (!selectedRecording) return;
    updateSelectedRecording((r) =>
      finalizeRecordingTranscript(r, r.transcript || [], {
        markers: normalizeRecordingMarkers([
          ...(r.markers || []),
          {
            id: createId('marker'),
            timestamp: marker?.timestamp,
            label: marker?.label,
            note: marker?.note,
            createdAt: new Date().toISOString(),
          },
        ]),
      })
    );
  }

  function updateRecordingMarker(markerId, updates) {
    if (!selectedRecording || !markerId) return;
    updateSelectedRecording((r) =>
      finalizeRecordingTranscript(r, r.transcript || [], {
        markers: normalizeRecordingMarkers(
          (r.markers || []).map((m) => (m.id !== markerId ? m : { ...m, ...updates }))
        ),
      })
    );
  }

  function deleteRecordingMarker(markerId) {
    if (!selectedRecording || !markerId) return;
    updateSelectedRecording((r) =>
      finalizeRecordingTranscript(r, r.transcript || [], {
        markers: normalizeRecordingMarkers((r.markers || []).filter((m) => m.id !== markerId)),
      })
    );
  }

  function addMeetingComment(meetingId, text, authorName) {
    const now = new Date().toISOString();
    const comment = {
      id: createId('comment'),
      text: String(text || '').trim(),
      author: String(authorName || 'Ty'),
      createdAt: now,
      mentions: (String(text || '').match(/@(\w+)/g) || []).map((m) => m.slice(1)),
    };
    const activity = {
      id: createId('meeting_activity'),
      type: 'comment',
      actorName: String(authorName || 'Ty'),
      message: text.length > 80 ? text.slice(0, 77) + '...' : text,
      createdAt: now,
    };
    setMeetings((prev) =>
      prev.map((m) =>
        m.id !== meetingId
          ? m
          : {
              ...m,
              comments: [...(Array.isArray(m.comments) ? m.comments : []), comment],
              activity: [...(Array.isArray(m.activity) ? m.activity : []), activity],
            }
      )
    );
  }

  function attachCompletedRecording(recordingMeetingId, recording) {
    let attached = false;
    setMeetings((prev) =>
      prev.map((m) => {
        if (m.id !== recordingMeetingId) return m;
        attached = true;
        const base = attachRecording(m, recording);
        return {
          ...base,
          tags: m.tags || [],
          activity: [
            ...(m.activity || []),
            {
              id: createId('meeting_activity'),
              type: 'recording',
              actorId: currentUser?.id || '',
              actorName: currentUser?.name || currentUser?.email || 'Ty',
              message: 'Dodano nowe nagranie do spotkania.',
              createdAt: new Date().toISOString(),
            },
          ],
        };
      })
    );
    if (!attached) return false;
    setSelectedMeetingId(recordingMeetingId);
    setSelectedRecordingId(recording.id);
    return true;
  }

  function rescheduleMeeting(meetingId, startsAt) {
    setMeetings((prev) =>
      prev.map((m) =>
        m.id !== meetingId ? m : { ...m, startsAt, updatedAt: new Date().toISOString() }
      )
    );
  }

  function renameTag(oldTag, newTag) {
    const norm = newTag.trim().toLowerCase();
    if (!norm || norm === oldTag) return;
    setMeetings((prev) =>
      prev.map((m) => ({ ...m, tags: (m.tags || []).map((t) => (t === oldTag ? norm : t)) }))
    );
    setManualTasks((prev) =>
      prev.map((t) => ({ ...t, tags: (t.tags || []).map((tag) => (tag === oldTag ? norm : tag)) }))
    );
  }

  function deleteTag(tag) {
    setMeetings((prev) =>
      prev.map((m) => ({ ...m, tags: (m.tags || []).filter((t) => t !== tag) }))
    );
    setManualTasks((prev) =>
      prev.map((t) => ({ ...t, tags: (t.tags || []).filter((existing) => existing !== tag) }))
    );
  }

  async function autoCreateVoiceProfile(
    speakerId: string | number,
    speakerName: string
  ): Promise<boolean> {
    if (!selectedRecording?.id || !remoteApiEnabled()) return false;
    // Don't create profile for generic auto-labels like "Speaker 1"
    if (/^speaker\s*\d+$/i.test(speakerName.trim())) return false;
    try {
      await apiRequest(`/media/recordings/${selectedRecording.id}/voice-profiles/from-speaker`, {
        method: 'POST',
        body: { speakerId: String(speakerId), speakerName: speakerName.trim() },
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  return {
    renameSpeaker,
    autoCreateVoiceProfile,
    updateTranscriptSegment,
    assignSpeakerToTranscriptSegments,
    mergeTranscriptSegments,
    splitTranscriptSegment,
    addRecordingMarker,
    updateRecordingMarker,
    deleteRecordingMarker,
    addMeetingComment,
    attachCompletedRecording,
    rescheduleMeeting,
    renameTag,
    deleteTag,
  };
}
