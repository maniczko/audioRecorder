import { render, screen, fireEvent } from '@testing-library/react';
import RecordingsTab from './RecordingsTab';
import { ToastProvider } from './shared/Toast';

describe('RecordingsTab', () => {
  const mockMeetings = [
    {
      id: 'meeting_1',
      title: 'Weekly Sync',
      startsAt: '2026-03-18T10:00:00Z',
      durationMinutes: 45,
      recordings: [
        {
          id: 'rec_1',
          createdAt: '2026-03-18T10:00:00Z',
          duration: 2700,
          speakerCount: 2,
          transcript: [{}, {}],
        },
      ],
    },
    {
      id: 'meeting_2',
      title: 'Project Alpha',
      startsAt: '2026-03-17T14:30:00Z',
      durationMinutes: 30,
      recordings: [],
    },
  ];

  const defaultProps = {
    userMeetings: mockMeetings,
    selectedMeeting: null,
    selectMeeting: vi.fn(),
    startNewMeetingDraft: vi.fn(),
    selectedRecordingId: '',
    setSelectedRecordingId: vi.fn(),
    setActiveTab: vi.fn(),
    onCreateMeeting: vi.fn(async (draft) => ({
      id: 'meeting_import',
      title: draft.title,
      startsAt: draft.startsAt,
      durationMinutes: 30,
      recordings: [],
    })),
    queueRecording: vi.fn(async () => 'rec_import'),
    recordingQueue: [],
    activeQueueItem: null,
    analysisStatus: 'idle',
    recordingMessage: '',
    pipelineProgressPercent: 0,
    pipelineStageLabel: '',
    retryRecordingQueueItem: vi.fn(),
    retryStoredRecording: vi.fn(),
  };

  test('renders empty state when no meetings are provided', () => {
    render(
      <ToastProvider>
        <RecordingsTab {...defaultProps} userMeetings={[]} />
      </ToastProvider>
    );
    expect(screen.getByText(/Brak spotk/i)).toBeInTheDocument();
  });

  test('renders list of meetings and recordings', () => {
    render(
      <ToastProvider>
        <RecordingsTab {...defaultProps} />
      </ToastProvider>
    );
    expect(screen.getByText('Weekly Sync')).toBeInTheDocument();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
  });

  test('shows pipeline diagnostics for selected meeting latest recording', () => {
    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          selectedMeeting={{
            ...mockMeetings[0],
            latestRecordingId: 'rec_1',
            recordings: [
              {
                id: 'rec_1',
                createdAt: '2026-03-18T10:00:00Z',
                duration: 2700,
                speakerCount: 2,
                transcript: [{}, {}],
                pipelineGitSha: 'abc1234',
                transcriptOutcome: 'empty',
              },
            ],
          }}
        />
      </ToastProvider>
    );

    expect(screen.getByText(/Build: abc1234/i)).toBeInTheDocument();
  });

  test('calls selectMeeting and setActiveTab when a meeting is clicked in the table', () => {
    render(
      <ToastProvider>
        <RecordingsTab {...defaultProps} />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Project Alpha'));

    expect(defaultProps.selectMeeting).toHaveBeenCalledWith(mockMeetings[1]);
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('studio');
  });

  test('shows retry action for selected meeting with empty transcript', () => {
    const selectedMeeting = {
      ...mockMeetings[0],
      latestRecordingId: 'rec_1',
      recordings: [
        {
          id: 'rec_1',
          createdAt: '2026-03-18T10:00:00Z',
          duration: 2700,
          speakerCount: 2,
          transcript: [],
          transcriptOutcome: 'empty',
          emptyReason: 'no_segments_from_stt',
          transcriptionDiagnostics: { chunksWithText: 0, chunksAttempted: 2 },
        },
      ],
    };

    render(
      <ToastProvider>
        <RecordingsTab {...defaultProps} selectedMeeting={selectedMeeting} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Ponow transkrypcje/i }));
    expect(defaultProps.retryStoredRecording).toHaveBeenCalledWith(
      selectedMeeting,
      selectedMeeting.recordings[0]
    );
    expect(screen.getByText(/Chunki z tekstem: 0\/2/i)).toBeInTheDocument();
  });
});
