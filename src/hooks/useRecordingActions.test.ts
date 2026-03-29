import { renderHook, act } from '@testing-library/react';
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
});
