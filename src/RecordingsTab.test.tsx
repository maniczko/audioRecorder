import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import RecordingsTab from './RecordingsTab';
import { ToastProvider } from './shared/Toast';
import { RECORDING_WORKSPACE_REQUIRED_MESSAGE } from './lib/recordingQueue';

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
          transcriptOutcome: 'normal',
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

  test('Regression: shows the currently selected fresh recording before workspace sync catches up', () => {
    const selectedMeeting = {
      id: 'meeting_fresh_recording',
      workspaceId: 'ws1',
      title: 'Ad hoc 15 cze, 15:26',
      startsAt: '2026-06-15T13:26:00.000Z',
      updatedAt: '2026-06-15T13:26:08.000Z',
      latestRecordingId: 'recording_fresh_1526',
      recordings: [
        {
          id: 'recording_fresh_1526',
          createdAt: '2026-06-15T13:26:08.000Z',
          duration: 4,
          pipelineStatus: 'done',
          transcriptionStatus: 'done',
          speakerCount: 1,
          transcript: [{ text: 'Swieze nagranie widoczne od razu.' }],
        },
      ],
    };

    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={mockMeetings}
          selectedMeeting={selectedMeeting}
        />
      </ToastProvider>
    );

    expect(screen.getByText('Ad hoc 15 cze, 15:26')).toBeInTheDocument();
    expect(screen.getByText(/Wyświetlanie 1-3 z\s+3/i)).toBeInTheDocument();
    expect(screen.getByText('1 mówca')).toBeInTheDocument();
  });

  test('renders screenshot-first recordings table controls', () => {
    render(
      <ToastProvider>
        <RecordingsTab {...defaultProps} />
      </ToastProvider>
    );

    expect(screen.getByRole('heading', { name: 'Baza nagrań' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wgraj nagranie/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sortuj: Data/i })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Data i godzina/i })).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    expect(screen.getByText(/Wyświetlanie 1-2 z 2/i)).toBeInTheDocument();
    expect(screen.getByText('2 mówców')).toBeInTheDocument();
    expect(screen.getAllByText('Gotowe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Transkrypcja').length).toBeGreaterThan(0);
  });

  test('Regression: imported recording row uses real audio duration instead of meeting duration', () => {
    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={[
            {
              id: 'meeting_import_allegro',
              title: 'Import: Allegro-rozmowa_2026-05-14',
              startsAt: '2026-06-05T11:44:25.841Z',
              durationMinutes: 45,
              latestRecordingId: 'recording_allegro',
              recordings: [
                {
                  id: 'recording_allegro',
                  duration: 5455.388,
                  transcript: [{ text: 'test' }],
                },
              ],
            },
          ]}
        />
      </ToastProvider>
    );

    const row = screen.getByText('Import: Allegro-rozmowa_2026-05-14').closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('91 min')).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByText('45 min')).not.toBeInTheDocument();
    expect(screen.getByText('1h 31m')).toBeInTheDocument();
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

  test('Regression: retry action shows loading state for empty transcript', async () => {
    const selectedMeeting = {
      ...mockMeetings[0],
      latestRecordingId: 'rec_retry_loading',
      recordings: [
        {
          id: 'rec_retry_loading',
          createdAt: '2026-03-18T10:00:00Z',
          duration: 2700,
          speakerCount: 2,
          transcript: [],
          transcriptOutcome: 'empty',
        },
      ],
    };
    const retryStoredRecording = vi.fn(() => new Promise(() => {}));

    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          selectedMeeting={selectedMeeting}
          retryStoredRecording={retryStoredRecording}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Ponow transkrypcje/i }));

    const retryButton = await screen.findByRole('button', {
      name: /Ponawiam transkrypcje/i,
    });
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute('aria-busy', 'true');
  });

  test('Regression: retry action shows error state for empty transcript', async () => {
    const selectedMeeting = {
      ...mockMeetings[0],
      latestRecordingId: 'rec_retry_error',
      recordings: [
        {
          id: 'rec_retry_error',
          createdAt: '2026-03-18T10:00:00Z',
          duration: 2700,
          speakerCount: 2,
          transcript: [],
          transcriptOutcome: 'empty',
        },
      ],
    };
    const retryStoredRecording = vi.fn().mockRejectedValue(new Error('Retry offline'));

    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          selectedMeeting={selectedMeeting}
          retryStoredRecording={retryStoredRecording}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Ponow transkrypcje/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Retry offline');
    expect(screen.getByRole('button', { name: /Ponow transkrypcje/i })).not.toBeDisabled();
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
    expect(within(importRow as HTMLElement).getByText('Wgrywanie')).toBeInTheDocument();
    expect(within(importRow as HTMLElement).getByText('Oczekuje')).toBeInTheDocument();
  });

  test('Regression: backend recording replaces matching optimistic queue row without duplication', async () => {
    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={[
            {
              id: 'meeting_import_synced',
              workspaceId: 'ws1',
              title: 'Import: Sync complete',
              startsAt: '2026-06-15T13:26:00.000Z',
              durationMinutes: 1,
              latestRecordingId: 'rec_import_synced',
              recordings: [
                {
                  id: 'rec_import_synced',
                  createdAt: '2026-06-15T13:26:04.000Z',
                  duration: 4,
                  uploaded: true,
                  pipelineStatus: 'done',
                  transcriptionStatus: 'completed',
                  transcriptOutcome: 'normal',
                  transcript: [{ text: 'Gotowy transcript.' }],
                },
              ],
            },
          ]}
          recordingQueue={[
            {
              id: 'rec_import_synced',
              recordingId: 'rec_import_synced',
              meetingId: 'meeting_import_synced',
              workspaceId: 'ws1',
              meetingTitle: 'Import: Sync complete',
              meetingSnapshot: {
                id: 'meeting_import_synced',
                workspaceId: 'ws1',
                title: 'Import: Sync complete',
              },
              mimeType: 'audio/webm',
              rawSegments: [],
              duration: 4,
              status: 'queued',
              uploaded: true,
              attempts: 0,
              retryCount: 0,
              backoffUntil: 0,
              lastErrorMessage: '',
              errorMessage: '',
              createdAt: '2026-06-15T13:26:00.000Z',
              updatedAt: '2026-06-15T13:26:00.000Z',
            },
          ]}
        />
      </ToastProvider>
    );

    const table = screen.getByRole('table');
    expect(within(table).getAllByText('Import: Sync complete')).toHaveLength(1);
    const syncedRow = within(table).getByText('Import: Sync complete').closest('tr');
    expect(syncedRow).not.toBeNull();
    expect(within(syncedRow as HTMLElement).getByText('Gotowe')).toBeInTheDocument();
    expect(within(syncedRow as HTMLElement).queryByText('Wgrane')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Szukaj nagrania/i), {
      target: { value: 'Sync complete' },
    });

    await waitFor(() => {
      expect(within(screen.getByRole('table')).getAllByText('Import: Sync complete')).toHaveLength(
        1
      );
    });
    expect(within(screen.getByRole('table')).getByText('Gotowe')).toBeInTheDocument();
  });

  test('Regression: local queue recordings stay visible with actionable processing statuses', () => {
    const queueBase = {
      workspaceId: 'ws1',
      mimeType: 'audio/webm',
      rawSegments: [],
      duration: 4,
      attempts: 0,
      retryCount: 0,
      backoffUntil: 0,
      lastErrorMessage: '',
      errorMessage: '',
      createdAt: '2026-06-15T13:26:00.000Z',
      updatedAt: '2026-06-15T13:26:00.000Z',
    };

    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={[]}
          recordingQueue={[
            {
              ...queueBase,
              id: 'rec_uploading',
              recordingId: 'rec_uploading',
              meetingId: 'meeting_uploading',
              meetingTitle: 'Ad hoc uploading',
              meetingSnapshot: {
                id: 'meeting_uploading',
                workspaceId: 'ws1',
                title: 'Ad hoc uploading',
              },
              status: 'queued',
              uploaded: false,
            },
            {
              ...queueBase,
              id: 'rec_uploaded',
              recordingId: 'rec_uploaded',
              meetingId: 'meeting_uploaded',
              meetingTitle: 'Ad hoc uploaded',
              meetingSnapshot: {
                id: 'meeting_uploaded',
                workspaceId: 'ws1',
                title: 'Ad hoc uploaded',
              },
              status: 'queued',
              uploaded: true,
            },
            {
              ...queueBase,
              id: 'rec_processing',
              recordingId: 'rec_processing',
              meetingId: 'meeting_processing',
              meetingTitle: 'Ad hoc processing',
              meetingSnapshot: {
                id: 'meeting_processing',
                workspaceId: 'ws1',
                title: 'Ad hoc processing',
              },
              status: 'processing',
              uploaded: true,
            },
            {
              ...queueBase,
              id: 'rec_failed',
              recordingId: 'rec_failed',
              meetingId: 'meeting_failed',
              meetingTitle: 'Ad hoc failed',
              meetingSnapshot: { id: 'meeting_failed', workspaceId: 'ws1', title: 'Ad hoc failed' },
              status: 'failed_permanent',
              uploaded: true,
              errorMessage: 'Transkrypcja nie powiodla sie.',
            },
          ]}
        />
      </ToastProvider>
    );

    const table = screen.getByRole('table');
    const uploadingRow = within(table).getByText('Ad hoc uploading').closest('tr');
    const uploadedRow = within(table).getByText('Ad hoc uploaded').closest('tr');
    const processingRow = within(table).getByText('Ad hoc processing').closest('tr');
    const failedRow = within(table).getByText('Ad hoc failed').closest('tr');

    expect(uploadingRow).not.toBeNull();
    expect(uploadedRow).not.toBeNull();
    expect(processingRow).not.toBeNull();
    expect(failedRow).not.toBeNull();
    expect(within(uploadingRow as HTMLElement).getByText('Wgrywanie')).toBeInTheDocument();
    expect(within(uploadedRow as HTMLElement).getByText('Wgrane')).toBeInTheDocument();
    expect(within(processingRow as HTMLElement).getByText('Transkrypcja')).toBeInTheDocument();
    expect(within(failedRow as HTMLElement).getAllByText('Błąd').length).toBeGreaterThan(0);
  });

  test('Regression: stale queued import exposes refresh action and retries the queue item', () => {
    const retryRecordingQueueItem = vi.fn();

    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={[]}
          retryRecordingQueueItem={retryRecordingQueueItem}
          recordingQueue={[
            {
              id: 'rec_stale_queued',
              recordingId: 'rec_stale_queued',
              meetingId: 'meeting_stale_queued',
              workspaceId: 'ws1',
              meetingTitle: 'Ad hoc stale queued',
              meetingSnapshot: {
                id: 'meeting_stale_queued',
                workspaceId: 'ws1',
                title: 'Ad hoc stale queued',
              },
              mimeType: 'audio/webm',
              rawSegments: [],
              duration: 4,
              status: 'queued',
              uploaded: false,
              attempts: 0,
              retryCount: 0,
              backoffUntil: 0,
              lastErrorMessage: '',
              errorMessage: '',
              createdAt: '2026-06-15T13:26:00.000Z',
              updatedAt: '2026-06-15T13:26:00.000Z',
            },
          ]}
        />
      </ToastProvider>
    );

    expect(screen.getAllByText('Ad hoc stale queued').length).toBeGreaterThan(0);
    expect(screen.getByText(/Status nie zmienil sie od kilku minut/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Od.wie. status/i }));
    expect(retryRecordingQueueItem).toHaveBeenCalledWith('rec_stale_queued');
  });

  test('Regression: failed import exposes retry action and retries the queue item', () => {
    const retryRecordingQueueItem = vi.fn();

    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={[]}
          retryRecordingQueueItem={retryRecordingQueueItem}
          recordingQueue={[
            {
              id: 'rec_failed_retry',
              recordingId: 'rec_failed_retry',
              meetingId: 'meeting_failed_retry',
              workspaceId: 'ws1',
              meetingTitle: 'Ad hoc failed retry',
              meetingSnapshot: {
                id: 'meeting_failed_retry',
                workspaceId: 'ws1',
                title: 'Ad hoc failed retry',
              },
              mimeType: 'audio/webm',
              rawSegments: [],
              duration: 4,
              status: 'failed',
              uploaded: false,
              attempts: 1,
              retryCount: 1,
              backoffUntil: 0,
              lastErrorMessage: 'Network timeout',
              errorMessage: 'Network timeout',
              createdAt: '2026-06-15T13:26:00.000Z',
              updatedAt: '2026-06-15T13:27:00.000Z',
            },
          ]}
        />
      </ToastProvider>
    );

    expect(screen.getAllByText('Ad hoc failed retry').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Spr/i }));
    expect(retryRecordingQueueItem).toHaveBeenCalledWith('rec_failed_retry');
  });

  test('Regression: stale remote import is permanent and does not expose retry', () => {
    const { container } = render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={mockMeetings}
          recordingQueue={[
            {
              id: 'rec_stale',
              recordingId: 'rec_stale',
              meetingId: 'meeting_stale',
              workspaceId: 'ws1',
              meetingTitle: 'Import: Stare nagranie',
              meetingSnapshot: {
                id: 'meeting_stale',
                workspaceId: 'ws1',
                title: 'Import: Stare nagranie',
              },
              mimeType: 'audio/webm',
              rawSegments: [],
              duration: 0,
              status: 'failed_permanent',
              uploaded: true,
              attempts: 0,
              retryCount: 0,
              backoffUntil: 0,
              lastErrorMessage: '',
              errorMessage: 'Nagranie nie jest juz dostepne na serwerze.',
              createdAt: '2026-04-06T08:00:00.000Z',
              updatedAt: '2026-04-06T08:00:00.000Z',
            },
          ]}
        />
      </ToastProvider>
    );

    expect(screen.getAllByText('Import: Stare nagranie').length).toBeGreaterThan(0);
    expect(screen.getByText('Nagranie nie jest juz dostepne na serwerze.')).toBeInTheDocument();
    expect(container.querySelector('.pipeline-retry-btn')).toBeNull();
    expect(defaultProps.retryRecordingQueueItem).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------
  // Issue #0 - deleted queued imports returned after success toast
  // Date: 2026-05-21
  // Bug: the library rebuilt deleted rows from recordingQueue optimistic state.
  // Fix: hide deleted meeting/recording ids immediately and pass recording ids
  //      to the parent so the persisted queue can be cleared.
  // -----------------------------------------------------------------
  test('Regression: deleting an optimistic queued import hides it and passes queue recording ids', async () => {
    const onDeleteMeeting = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={[]}
          deleteRecordingAndMeeting={onDeleteMeeting}
          recordingQueue={[
            {
              id: 'recording_deleted',
              recordingId: 'recording_deleted',
              meetingId: 'meeting_deleted',
              workspaceId: 'ws1',
              meetingTitle: 'Import: Do usuniecia',
              meetingSnapshot: {
                id: 'meeting_deleted',
                workspaceId: 'ws1',
                title: 'Import: Do usuniecia',
              },
              mimeType: 'audio/webm',
              rawSegments: [],
              duration: 0,
              status: 'failed_permanent',
              uploaded: true,
              attempts: 0,
              retryCount: 0,
              backoffUntil: 0,
              lastErrorMessage: '',
              errorMessage: 'Nagranie nie jest juz dostepne na serwerze.',
              createdAt: '2026-05-18T18:41:00.000Z',
              updatedAt: '2026-05-18T18:41:00.000Z',
            },
          ]}
        />
      </ToastProvider>
    );

    expect(screen.getAllByText('Import: Do usuniecia').length).toBeGreaterThan(0);

    const deleteButton = container.querySelector('.recordings-library-delete-btn');
    expect(deleteButton).not.toBeNull();
    fireEvent.click(deleteButton as HTMLElement);

    const confirmButton = document.querySelector('.danger-button');
    expect(confirmButton).not.toBeNull();
    fireEvent.click(confirmButton as HTMLElement);

    await waitFor(() => {
      expect(onDeleteMeeting).toHaveBeenCalledWith(
        'meeting_deleted',
        expect.objectContaining({ recordingIds: ['recording_deleted'] })
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Import: Do usuniecia')).not.toBeInTheDocument();
    });
  });

  test('Regression: failed remote deletion restores the library row instead of hiding it until refresh', async () => {
    const onDeleteMeeting = vi.fn().mockRejectedValue(new Error('HTTP 502'));
    const { container } = render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          userMeetings={[
            {
              id: 'meeting_sync_failed',
              title: 'Import: Sync failed',
              startsAt: '2026-05-25T17:17:00.000Z',
              durationMinutes: 2,
              workspaceId: 'ws1',
              recordings: [{ id: 'recording_sync_failed' }],
            },
          ]}
          deleteRecordingAndMeeting={onDeleteMeeting}
        />
      </ToastProvider>
    );

    expect(screen.getByText('Import: Sync failed')).toBeInTheDocument();

    const deleteButton = container.querySelector('.recordings-library-delete-btn');
    expect(deleteButton).not.toBeNull();
    fireEvent.click(deleteButton as HTMLElement);

    const confirmButton = document.querySelector('.danger-button');
    expect(confirmButton).not.toBeNull();
    fireEvent.click(confirmButton as HTMLElement);

    await waitFor(() => {
      expect(onDeleteMeeting).toHaveBeenCalledWith(
        'meeting_sync_failed',
        expect.objectContaining({ recordingIds: ['recording_sync_failed'] })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('Import: Sync failed')).toBeInTheDocument();
    });
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

  test('Regression: import without workspace does not call queueRecording', async () => {
    const onCreateMeeting = vi.fn(async (draft) => ({
      id: 'meeting_without_workspace',
      title: draft.title,
      startsAt: draft.startsAt,
      recordings: [],
    }));
    const queueRecording = vi.fn(async () => 'rec_import');

    render(
      <ToastProvider>
        <RecordingsTab
          {...defaultProps}
          onCreateMeeting={onCreateMeeting}
          queueRecording={queueRecording}
        />
      </ToastProvider>
    );

    const file = new File(['audio'], 'broken-import.webm', { type: 'audio/webm' });
    fireEvent.change(screen.getByTestId('recordings-file-input'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(onCreateMeeting).toHaveBeenCalledTimes(1);
    });
    expect(queueRecording).not.toHaveBeenCalled();
    expect(await screen.findByText(RECORDING_WORKSPACE_REQUIRED_MESSAGE)).toBeInTheDocument();
  });
});
