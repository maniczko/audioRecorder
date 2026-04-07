import { render, screen, fireEvent, within } from '@testing-library/react';
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

  test('Regression: pending import is visible in the main list before meetings store catches up', () => {
    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={mockMeetings}
          recordingQueue={[
            {
              id: 'rec_import',
              recordingId: 'rec_import',
              meetingId: 'meeting_import',
              workspaceId: 'ws1',
              meetingTitle: 'Import: Nowe nagranie',
              meetingSnapshot: {
                id: 'meeting_import',
                workspaceId: 'ws1',
                title: 'Import: Nowe nagranie',
              },
              mimeType: 'audio/webm',
              rawSegments: [],
              duration: 0,
              status: 'queued',
              uploaded: false,
              attempts: 0,
              retryCount: 0,
              backoffUntil: 0,
              lastErrorMessage: '',
              errorMessage: '',
              createdAt: '2026-04-06T08:00:00.000Z',
              updatedAt: '2026-04-06T08:00:00.000Z',
            },
          ]}
        />
      </ToastProvider>
    );

    const table = screen.getByRole('table');
    const titleCell = within(table).getByText('Import: Nowe nagranie');
    expect(titleCell).toBeInTheDocument();
    const importRow = titleCell.closest('tr');
    expect(importRow).not.toBeNull();
    expect(within(importRow as HTMLElement).getByText('W toku')).toBeInTheDocument();
  });

  test('Regression: optimistic imports without owner, guests, or tags do not break filtering', () => {
    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={mockMeetings}
          recordingQueue={[
            {
              id: 'rec_import',
              recordingId: 'rec_import',
              meetingId: 'meeting_import',
              workspaceId: 'ws1',
              meetingTitle: 'Import bez metadanych',
              meetingSnapshot: {
                id: 'meeting_import',
                workspaceId: 'ws1',
                title: 'Import bez metadanych',
              },
              mimeType: 'audio/webm',
              rawSegments: [],
              duration: 0,
              status: 'queued',
              uploaded: false,
              attempts: 0,
              retryCount: 0,
              backoffUntil: 0,
              lastErrorMessage: '',
              errorMessage: '',
              createdAt: '2026-04-06T08:00:00.000Z',
              updatedAt: '2026-04-06T08:00:00.000Z',
            },
          ]}
        />
      </ToastProvider>
    );

    const searchInput = screen.getByPlaceholderText(/szukaj/i);
    fireEvent.change(searchInput, { target: { value: 'Import bez metadanych' } });

    expect(screen.getAllByText('Import bez metadanych').length).toBeGreaterThan(0);
  });
});
