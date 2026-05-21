import { renderHook, act } from '@testing-library/react';

const apiRequestMock = vi.hoisted(() => vi.fn());
const remoteApiEnabledMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('../services/httpClient', () => ({
  apiRequest: apiRequestMock,
}));

vi.mock('../services/config', () => ({
  remoteApiEnabled: remoteApiEnabledMock,
}));

import useRecordingActions from './useRecordingActions';

describe('useRecordingActions', () => {
  const mockSetMeetings = vi.fn();
  const mockSetManualTasks = vi.fn();
  const mockSetSelectedMeetingId = vi.fn();
  const mockSetSelectedRecordingId = vi.fn();

  const currentUser = { id: 'u1', name: 'User' };
  const baseMeeting = {
    id: 'm1',
    latestRecordingId: 'r1',
    recordings: [
      {
        id: 'r1',
        transcript: [
          { id: 's1', speakerId: '0', text: 'Test', timestamp: 0, verificationStatus: 'review' },
        ],
        speakerNames: { '0': 'Speaker 1' },
        markers: [],
      },
    ],
    speakerNames: { '0': 'Speaker 1' },
    comments: [],
    activity: [],
    tags: ['oldtag'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiRequestMock.mockReset();
    apiRequestMock.mockResolvedValue({ id: 'vp_1' });
    remoteApiEnabledMock.mockReset();
    remoteApiEnabledMock.mockReturnValue(false);
  });

  function setupHook(meetingOverride = baseMeeting, recordingOverride = baseMeeting.recordings[0]) {
    return renderHook(() =>
      useRecordingActions({
        currentUser,
        selectedMeeting: meetingOverride,
        selectedRecording: recordingOverride,
        setMeetings: mockSetMeetings,
        setManualTasks: mockSetManualTasks,
        setSelectedMeetingId: mockSetSelectedMeetingId,
        setSelectedRecordingId: mockSetSelectedRecordingId,
      })
    );
  }

  test('renameSpeaker', () => {
    const { result } = setupHook();
    act(() => {
      result.current.renameSpeaker('0', 'Alice');
    });
    expect(mockSetMeetings).toHaveBeenCalled();
    const updater = mockSetMeetings.mock.calls[0][0];
    const newMeetings = updater([baseMeeting]);
    expect(newMeetings[0].speakerNames['0']).toBe('Alice');
    expect(newMeetings[0].recordings[0].speakerNames['0']).toBe('Alice');
  });

  test('updateTranscriptSegment', () => {
    const { result } = setupHook();
    act(() => {
      result.current.updateTranscriptSegment('s1', { text: 'Updated text' });
    });
    expect(mockSetMeetings).toHaveBeenCalled();
    const updater = mockSetMeetings.mock.calls[0][0];
    const newMeetings = updater([baseMeeting]);
    expect(newMeetings[0].recordings[0].transcript[0].text).toBe('Updated text');
    expect(newMeetings[0].recordings[0].transcript[0].verificationStatus).toBe('verified');
  });

  test('assignSpeakerToTranscriptSegments', () => {
    const { result } = setupHook();
    act(() => {
      result.current.assignSpeakerToTranscriptSegments(['s1'], '2');
    });
    expect(mockSetMeetings).toHaveBeenCalled();
    const updater = mockSetMeetings.mock.calls[0][0];
    const newMeetings = updater([baseMeeting]);
    expect(newMeetings[0].recordings[0].transcript[0].speakerId).toBe(2);
  });

  test('addRecordingMarker, updateRecordingMarker, deleteRecordingMarker', () => {
    const { result } = setupHook();
    act(() => {
      result.current.addRecordingMarker({ timestamp: 120, label: 'Hi' });
    });

    // Apply update to fake a marker addition
    let newMeetings = mockSetMeetings.mock.calls[0][0]([baseMeeting]);
    const markerId = newMeetings[0].recordings[0].markers[0].id;
    expect(markerId).toBeDefined();

    act(() => {
      result.current.updateRecordingMarker(markerId, { note: 'New note' });
    });
    expect(mockSetMeetings).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.deleteRecordingMarker(markerId);
    });
    expect(mockSetMeetings).toHaveBeenCalledTimes(3);
  });

  test('renameTag and deleteTag', () => {
    const { result } = setupHook();
    act(() => {
      result.current.renameTag('oldtag', 'newtag');
    });
    let newMeetings = mockSetMeetings.mock.calls[0][0]([baseMeeting]);
    expect(newMeetings[0].tags).toContain('newtag');

    let newTasks = mockSetManualTasks.mock.calls[0][0]([{ tags: ['oldtag'] }]);
    expect(newTasks[0].tags).toContain('newtag');

    act(() => {
      result.current.deleteTag('newtag');
    });
    newMeetings = mockSetMeetings.mock.calls[1][0](newMeetings);
    expect(newMeetings[0].tags).not.toContain('newtag');
  });

  test('addMeetingComment and attachCompletedRecording', () => {
    const { result } = setupHook();
    act(() => {
      result.current.addMeetingComment('m1', 'Great meeting', 'Bob');
    });
    let newMeetings = mockSetMeetings.mock.calls[0][0]([baseMeeting]);
    expect(newMeetings[0].comments[0].text).toBe('Great meeting');

    act(() => {
      result.current.attachCompletedRecording('m1', {
        id: 'r2',
        analysis: { suggestedTags: ['AI'] },
      });
    });
    newMeetings = mockSetMeetings.mock.calls[1][0](newMeetings);
    // Auto-tagging disabled — AI suggestedTags must NOT be auto-applied
    expect(newMeetings[0].tags).not.toContain('ai');
  });

  test('rescheduleMeeting', () => {
    const { result } = setupHook();
    act(() => {
      result.current.rescheduleMeeting('m1', '2026-04-01T10:00:00Z');
    });
    let newMeetings = mockSetMeetings.mock.calls[0][0]([baseMeeting]);
    expect(newMeetings[0].startsAt).toBe('2026-04-01T10:00:00Z');
  });

  test('mergeTranscriptSegments and splitTranscriptSegment', () => {
    const customMeeting = {
      ...baseMeeting,
      recordings: [
        {
          id: 'r1',
          transcript: [
            { id: 's1', speakerId: '0', text: 'Hello', timestamp: 0, endTimestamp: 1 },
            { id: 's2', speakerId: '0', text: 'world', timestamp: 1, endTimestamp: 2 },
          ],
          speakerNames: { '0': 'Speaker 1' },
          markers: [],
        },
      ],
    };

    const { result } = setupHook(customMeeting, customMeeting.recordings[0]);
    act(() => {
      result.current.mergeTranscriptSegments(['s1', 's2']);
    });
    let newMeetings = mockSetMeetings.mock.calls[0][0]([customMeeting]);
    expect(newMeetings[0].recordings[0].transcript.length).toBe(1);
    expect(newMeetings[0].recordings[0].transcript[0].text).toBe('Hello world');

    act(() => {
      result.current.splitTranscriptSegment('s1', 2); // splits original s1
    });
  });

  test('updateTranscriptSegment preserves status when only non-text fields change', () => {
    const { result } = setupHook();
    act(() => {
      result.current.updateTranscriptSegment('s1', { speakerId: 5 });
    });
    const updater = mockSetMeetings.mock.calls[0][0];
    const newMeetings = updater([baseMeeting]);
    const segment = newMeetings[0].recordings[0].transcript[0];
    expect(segment.speakerId).toBe(5);
    expect(segment.verificationStatus).toBe('review');
  });

  test('updateTranscriptSegment respects explicit verificationStatus', () => {
    const { result } = setupHook();
    act(() => {
      result.current.updateTranscriptSegment('s1', {
        text: 'Changed',
        verificationStatus: 'review',
      });
    });
    const updater = mockSetMeetings.mock.calls[0][0];
    const newMeetings = updater([baseMeeting]);
    const segment = newMeetings[0].recordings[0].transcript[0];
    expect(segment.text).toBe('Changed');
    expect(segment.verificationStatus).toBe('review');
  });

  test('mergeTranscriptSegments handles reversed order IDs', () => {
    const customMeeting = {
      ...baseMeeting,
      recordings: [
        {
          id: 'r1',
          transcript: [
            { id: 's1', speakerId: '0', text: 'Hello', timestamp: 0, endTimestamp: 1 },
            { id: 's2', speakerId: '0', text: 'world', timestamp: 1, endTimestamp: 2 },
          ],
          speakerNames: { '0': 'Speaker 1' },
          markers: [],
        },
      ],
    };
    const { result } = setupHook(customMeeting, customMeeting.recordings[0]);
    act(() => {
      result.current.mergeTranscriptSegments(['s2', 's1']); // reversed order
    });
    const newMeetings = mockSetMeetings.mock.calls[0][0]([customMeeting]);
    expect(newMeetings[0].recordings[0].transcript.length).toBe(1);
    expect(newMeetings[0].recordings[0].transcript[0].text).toBe('Hello world');
  });

  test('mergeTranscriptSegments ignores non-consecutive segments', () => {
    const customMeeting = {
      ...baseMeeting,
      recordings: [
        {
          id: 'r1',
          transcript: [
            { id: 's1', speakerId: '0', text: 'A', timestamp: 0 },
            { id: 's2', speakerId: '0', text: 'B', timestamp: 1 },
            { id: 's3', speakerId: '0', text: 'C', timestamp: 2 },
          ],
          speakerNames: { '0': 'Speaker 1' },
          markers: [],
        },
      ],
    };
    const { result } = setupHook(customMeeting, customMeeting.recordings[0]);
    act(() => {
      result.current.mergeTranscriptSegments(['s1', 's3']); // non-consecutive
    });
    const newMeetings = mockSetMeetings.mock.calls[0][0]([customMeeting]);
    expect(newMeetings[0].recordings[0].transcript.length).toBe(3); // unchanged
  });

  test('splitTranscriptSegment produces correct left and right segments', () => {
    const customMeeting = {
      ...baseMeeting,
      recordings: [
        {
          id: 'r1',
          transcript: [
            { id: 's1', speakerId: '0', text: 'Hello world', timestamp: 0, endTimestamp: 4 },
          ],
          speakerNames: { '0': 'Speaker 1' },
          markers: [],
        },
      ],
    };
    const { result } = setupHook(customMeeting, customMeeting.recordings[0]);
    act(() => {
      result.current.splitTranscriptSegment('s1', 5);
    });
    const newMeetings = mockSetMeetings.mock.calls[0][0]([customMeeting]);
    const transcript = newMeetings[0].recordings[0].transcript;
    expect(transcript.length).toBe(2);
    expect(transcript[0].text).toBe('Hello');
    expect(transcript[1].text).toBe('world');
    expect(transcript[0].verificationStatus).toBe('review');
    expect(transcript[1].verificationStatus).toBe('review');
  });

  test('splitTranscriptSegment clamps out-of-bounds splitIndex', () => {
    const customMeeting = {
      ...baseMeeting,
      recordings: [
        {
          id: 'r1',
          transcript: [{ id: 's1', speakerId: '0', text: 'ABCD', timestamp: 0, endTimestamp: 4 }],
          speakerNames: { '0': 'Speaker 1' },
          markers: [],
        },
      ],
    };
    const { result } = setupHook(customMeeting, customMeeting.recordings[0]);

    // splitIndex=0 is falsy, so normalizedSplit falls to Math.floor(text.length/2) = 2
    act(() => {
      result.current.splitTranscriptSegment('s1', 0);
    });
    const newMeetings = mockSetMeetings.mock.calls[0][0]([customMeeting]);
    const transcript = newMeetings[0].recordings[0].transcript;
    expect(transcript.length).toBe(2);
    expect(transcript[0].text).toBe('AB');
    expect(transcript[1].text).toBe('CD');
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — attachCompletedRecording silently loses recording when meeting missing
  // Date: 2026-04-04
  // Bug: attachCompletedRecording did not indicate success/failure. processQueue
  //      unconditionally removed queue item even if meeting was not found.
  // Fix: attachCompletedRecording returns false when meeting is missing.
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: #0 — attachCompletedRecording returns success indicator', () => {
    test('returns true when meeting is found', () => {
      // Make setMeetings actually call the updater so `attached` flag is set
      mockSetMeetings.mockImplementation((updater) => {
        if (typeof updater === 'function') updater([baseMeeting]);
      });
      const { result } = setupHook();
      let returnValue: any;
      act(() => {
        returnValue = result.current.attachCompletedRecording('m1', {
          id: 'r_new',
          transcript: [{ text: 'Hello' }],
          analysis: {},
        });
      });
      expect(returnValue).toBe(true);
      expect(mockSetSelectedMeetingId).toHaveBeenCalledWith('m1');
      expect(mockSetSelectedRecordingId).toHaveBeenCalledWith('r_new');
    });

    test('returns false when meeting is not found', () => {
      // Make setMeetings call the updater — no match for nonexistent_meeting
      mockSetMeetings.mockImplementation((updater) => {
        if (typeof updater === 'function') updater([baseMeeting]);
      });
      const { result } = setupHook();
      let returnValue: any;
      act(() => {
        returnValue = result.current.attachCompletedRecording('nonexistent_meeting', {
          id: 'r_lost',
          transcript: [{ text: 'Lost' }],
          analysis: {},
        });
      });
      expect(returnValue).toBe(false);
      // Selection should NOT be updated when meeting is missing
      expect(mockSetSelectedMeetingId).not.toHaveBeenCalled();
      expect(mockSetSelectedRecordingId).not.toHaveBeenCalled();
    });

    test('reattaches recording when the live meeting id changed after sync', () => {
      const liveMeeting = {
        ...baseMeeting,
        id: 'm_remote',
        workspaceId: 'ws1',
        title: 'Ad hoc',
      };

      mockSetMeetings.mockImplementation((updater) => {
        if (typeof updater === 'function') updater([liveMeeting]);
      });

      const { result } = setupHook(liveMeeting, liveMeeting.recordings[0]);
      let returnValue: any;
      act(() => {
        returnValue = result.current.attachCompletedRecording(
          { id: 'm_local', workspaceId: 'ws1', title: 'Ad hoc' },
          {
            id: 'r_synced',
            transcript: [{ text: 'Recovered' }],
            analysis: {},
          }
        );
      });

      expect(returnValue).toBe(true);
      expect(mockSetSelectedMeetingId).toHaveBeenCalledWith('m_remote');
      expect(mockSetSelectedRecordingId).toHaveBeenCalledWith('r_synced');
    });

    test('recreates missing optimistic import meeting from queue snapshot', () => {
      let nextMeetings: any[] = [];
      mockSetMeetings.mockImplementation((updater) => {
        if (typeof updater === 'function') nextMeetings = updater([]);
      });

      const { result } = setupHook();
      let returnValue: any;
      act(() => {
        returnValue = result.current.attachCompletedRecording(
          { id: 'm_recovered', workspaceId: 'ws1', title: 'Recovered import' },
          {
            id: 'r_recovered',
            createdAt: '2026-05-18T16:42:10.000Z',
            duration: 120,
            transcript: [{ text: 'Recovered' }],
            speakerNames: {},
            speakerCount: 0,
            analysis: {},
          }
        );
      });

      expect(returnValue).toBe(true);
      expect(nextMeetings[0]).toMatchObject({
        id: 'm_recovered',
        workspaceId: 'ws1',
        title: 'Recovered import',
        latestRecordingId: 'r_recovered',
      });
      expect(nextMeetings[0].recordings[0]).toMatchObject({ id: 'r_recovered' });
      expect(mockSetSelectedMeetingId).toHaveBeenCalledWith('m_recovered');
      expect(mockSetSelectedRecordingId).toHaveBeenCalledWith('r_recovered');
    });
  });

  // -----------------------------------------------------------------
  // Issue #0 - voice profile enrollment posts before transcript is ready
  // Date: 2026-05-21
  // Bug: renaming a speaker could POST /voice-profiles/from-speaker while
  //      the remote recording was still processing or had no matching segment.
  // Fix: only call the backend when the selected recording is transcript-ready
  //      and contains a real segment for the requested speaker.
  // -----------------------------------------------------------------
  describe('Regression: #0 - voice profile enrollment readiness guard', () => {
    test('does not call remote voice profile endpoint while selected recording is processing', async () => {
      remoteApiEnabledMock.mockReturnValue(true);
      const processingRecording = {
        ...baseMeeting.recordings[0],
        id: 'recording_processing',
        pipelineStatus: 'processing',
        transcript: [{ id: 's1', speakerId: '0', text: 'Gotowy tekst lokalny', timestamp: 0 }],
      };

      const { result } = setupHook(
        { ...baseMeeting, recordings: [processingRecording] },
        processingRecording
      );

      let enrolled = true;
      await act(async () => {
        enrolled = await result.current.autoCreateVoiceProfile('0', 'Anna');
      });

      expect(enrolled).toBe(false);
      expect(apiRequestMock).not.toHaveBeenCalled();
    });

    test('does not call remote voice profile endpoint without a matching speaker segment', async () => {
      remoteApiEnabledMock.mockReturnValue(true);
      const readyRecording = {
        ...baseMeeting.recordings[0],
        id: 'recording_ready',
        pipelineStatus: 'done',
        transcript: [{ id: 's1', speakerId: '0', text: 'Tylko pierwszy mowca', timestamp: 0 }],
      };

      const { result } = setupHook(
        { ...baseMeeting, recordings: [readyRecording] },
        readyRecording
      );

      let enrolled = true;
      await act(async () => {
        enrolled = await result.current.autoCreateVoiceProfile('99', 'Anna');
      });

      expect(enrolled).toBe(false);
      expect(apiRequestMock).not.toHaveBeenCalled();
    });

    test('calls remote voice profile endpoint for completed recording with matching speaker', async () => {
      remoteApiEnabledMock.mockReturnValue(true);
      const readyRecording = {
        ...baseMeeting.recordings[0],
        id: 'recording_ready',
        pipelineStatus: 'done',
        transcript: [{ id: 's1', speakerId: '0', text: 'Dobra probka glosu', timestamp: 0 }],
      };

      const { result } = setupHook(
        { ...baseMeeting, recordings: [readyRecording] },
        readyRecording
      );

      let enrolled = false;
      await act(async () => {
        enrolled = await result.current.autoCreateVoiceProfile('0', 'Anna');
      });

      expect(enrolled).toBe(true);
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/media/recordings/recording_ready/voice-profiles/from-speaker',
        {
          method: 'POST',
          body: { speakerId: '0', speakerName: 'Anna' },
        }
      );
    });

    // -----------------------------------------------------------------
    // Issue #0 - voice profile API failures were swallowed
    // Date: 2026-05-21
    // Bug: autoCreateVoiceProfile returned false for backend failures, so
    //      the Studio view could not display the real failure reason.
    // Fix: preserve guard false values, but surface API errors to callers.
    // -----------------------------------------------------------------
    test('surfaces remote voice profile endpoint errors to the caller', async () => {
      remoteApiEnabledMock.mockReturnValue(true);
      apiRequestMock.mockRejectedValueOnce(
        new Error('Nie mozna pobrac pliku audio do probki glosu.')
      );
      const readyRecording = {
        ...baseMeeting.recordings[0],
        id: 'recording_ready',
        pipelineStatus: 'done',
        transcript: [{ id: 's1', speakerId: '0', text: 'Dobra probka glosu', timestamp: 0 }],
      };

      const { result } = setupHook(
        { ...baseMeeting, recordings: [readyRecording] },
        readyRecording
      );

      await expect(result.current.autoCreateVoiceProfile('0', 'Anna')).rejects.toThrow(
        'Nie mozna pobrac pliku audio do probki glosu.'
      );
    });

    test('uses provided transcript override when manual speaker assignment changed local segments', async () => {
      remoteApiEnabledMock.mockReturnValue(true);
      const readyRecording = {
        ...baseMeeting.recordings[0],
        id: 'recording_ready',
        pipelineStatus: 'done',
        transcript: [{ id: 's1', speakerId: '0', text: 'Pierwszy mowca', timestamp: 0 }],
      };
      const assignedSegments = [
        {
          id: 's1',
          speakerId: '99',
          text: 'Fragment przypisany recznie do Barbary',
          timestamp: 0,
          endTimestamp: 5,
        },
      ];

      const { result } = setupHook(
        { ...baseMeeting, recordings: [readyRecording] },
        readyRecording
      );

      let enrolled = false;
      await act(async () => {
        enrolled = await result.current.autoCreateVoiceProfile('99', 'Barbara', {
          transcriptSegments: assignedSegments,
        });
      });

      expect(enrolled).toBe(true);
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/media/recordings/recording_ready/voice-profiles/from-speaker',
        {
          method: 'POST',
          body: {
            speakerId: '99',
            speakerName: 'Barbara',
            segments: assignedSegments,
          },
        }
      );
    });
  });
});
