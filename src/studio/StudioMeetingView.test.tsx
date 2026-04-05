import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudioMeetingView from './StudioMeetingView';
import React from 'react';
import { vi } from 'vitest';
import AppProviders from '../AppProviders';

const apiRequestMock = vi.hoisted(() => vi.fn());

// Mock dependencies that we don't need to test for basic rendering
vi.mock('./RecorderPanel', () => ({ default: () => <div data-testid="recorder-panel" /> }));
vi.mock('./AiTaskSuggestionsPanel', () => ({
  default: () => <div data-testid="ai-task-suggestions" />,
}));
vi.mock('../services/config', () => ({
  APP_DATA_PROVIDER: 'local',
  MEDIA_PIPELINE_PROVIDER: 'local',
  API_BASE_URL: '',
  apiBaseUrlConfigured: () => false,
  remoteApiEnabled: () => false,
}));

vi.mock('../services/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/httpClient')>();
  return {
    ...actual,
    apiRequest: (...args: any[]) => apiRequestMock(...args),
  };
});

function renderWithContext(ui: React.ReactElement) {
  return render(<AppProviders>{ui}</AppProviders>);
}

describe('StudioMeetingView', () => {
  const sampleFeedback = {
    overallScore: 8,
    summary: 'Spotkanie było konkretne i dobrze prowadzone.',
    strengths: ['Były decyzje', 'Był konkretny kierunek', 'Atmosfera była spokojna'],
    improvementAreas: ['Mocniej domykaj ownera i termin'],
    perceptionNotes: ['Możesz być odbierany jako konkretny i zadaniowy'],
    communicationTips: ['Skracaj wstępy', 'Po decyzji podsumuj ownera i termin'],
    nextSteps: ['Spisz ustalenia', 'Przypisz właścicieli', 'Ustal termin follow-upu'],
    whatWentWell: ['Rozmowa prowadziła do ustaleń', 'Było miejsce na pytania'],
    whatCouldBeBetter: ['Domknij więcej tematów jednym zdaniem'],
    categoryScores: [
      {
        key: 'facilitation',
        label: 'Prowadzenie spotkania',
        score: 8,
        observation: 'Było konkretnie',
        improvementTip: 'Domykaj tematy szybciej',
      },
      {
        key: 'expertise',
        label: 'Wiedza merytoryczna',
        score: 7,
        observation: 'Było merytorycznie',
        improvementTip: 'Podawaj więcej przykładów',
      },
      {
        key: 'clarity',
        label: 'Jasność wypowiedzi',
        score: 9,
        observation: 'Przekaz był czytelny',
        improvementTip: 'Zostawaj przy krótszych blokach',
      },
      {
        key: 'structure',
        label: 'Struktura i organizacja',
        score: 8,
        observation: 'Struktura była widoczna',
        improvementTip: 'Dopisz ownera do każdej decyzji',
      },
      {
        key: 'listening',
        label: 'Słuchanie i reagowanie',
        score: 7,
        observation: 'Było miejsce na odpowiedzi',
        improvementTip: 'Częściej parafrazuj',
      },
      {
        key: 'closing',
        label: 'Domykanie ustaleń',
        score: 8,
        observation: 'Ustalenia były domykane',
        improvementTip: 'Zapisuj terminy od razu',
      },
      {
        key: 'pace',
        label: 'Tempo i zarządzanie czasem',
        score: 7,
        observation: 'Tempo było w porządku',
        improvementTip: 'Pilnuj krótszych podsumowań',
      },
      {
        key: 'collaboration',
        label: 'Współpraca i atmosfera',
        score: 8,
        observation: 'Atmosfera była dobra',
        improvementTip: 'Oddawaj częściej głos',
      },
    ],
  };

  const defaultProps = {
    selectedMeeting: { id: 'm1', title: 'Test Meeting', tags: [], needs: [], concerns: [] },
    displayRecording: { transcript: [], duration: 60 },
    studioAnalysis: { summary: '', decisions: [], actionItems: [] },
    isRecording: false,
    analysisStatus: 'idle',
    activeQueueItem: null,
    selectedMeetingQueue: null,
    elapsed: 0,
    visualBars: [],
    stopRecording: vi.fn(),
    startRecording: vi.fn(),
    retryRecordingQueueItem: vi.fn(),
    recordPermission: 'granted',
    speechRecognitionSupported: true,
    liveText: '',
    liveTranscriptEnabled: false,
    setLiveTranscriptEnabled: vi.fn(),
    recordingMessage: '',
    pipelineProgressPercent: 0,
    pipelineStageLabel: '',
    setRecordingMessage: vi.fn(),
    selectedRecording: null,
    displaySpeakerNames: {},
    selectedRecordingAudioUrl: null,
    selectedRecordingAudioError: '',
    selectedRecordingAudioStatus: 'idle',
    hydrateRecordingAudio: vi.fn(() => Promise.resolve(null)),
    clearAudioHydrationError: vi.fn(),
    selectedRecordingId: null,
    setSelectedRecordingId: vi.fn(),
    exportTranscript: vi.fn(),
    exportMeetingNotes: vi.fn(),
    exportMeetingPdfFile: vi.fn(),
    startNewMeetingDraft: vi.fn(),
    selectMeeting: vi.fn(),
    currentWorkspacePermissions: {
      canEditMeeting: true,
      canRecordAudio: true,
      canExportWorkspaceData: true,
      canEditWorkspace: true,
    },
    currentWorkspaceRole: 'owner',
    currentWorkspace: { id: 'w1', name: 'Work' },
    userMeetings: [],
    meetingTasks: [],
    onCreateTask: vi.fn(),
    peopleProfiles: [],
    addMeetingComment: vi.fn(),
    currentUserName: 'User',
    meetingDraft: { title: '' },
    setMeetingDraft: vi.fn(),
    saveMeeting: vi.fn(),
    renameSpeaker: vi.fn(),
    updateTranscriptSegment: vi.fn(),
    retryStoredRecording: vi.fn(),
    onOpenTask: vi.fn(),
    briefOpen: true,
    setBriefOpen: vi.fn(),
    setActiveTab: vi.fn(),
  };

  test('renders without crashing', () => {
    renderWithContext(<StudioMeetingView {...defaultProps} />);
    expect(screen.getByText(/Test Meeting/i)).toBeInTheDocument();
  });

  test('renders the player bar when there is a message or recording', () => {
    const props = { ...defaultProps, recordingMessage: 'Test Message', analysisStatus: 'error' };
    renderWithContext(<StudioMeetingView {...props} />);
    expect(screen.getByText(/Test Message/i)).toBeInTheDocument();
  });

  test('shows retry action for failed selected meeting queue item', () => {
    const retryRecordingQueueItem = vi.fn();

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        recordingMessage="Blad w kolejce: Serwer chwilowo przeciążony pamięciowo."
        analysisStatus="error"
        retryRecordingQueueItem={retryRecordingQueueItem}
        selectedMeetingQueue={[{ recordingId: 'rec-failed', meetingId: 'm1', status: 'failed' }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ponow przetwarzanie/i }));

    expect(retryRecordingQueueItem).toHaveBeenCalledWith('rec-failed');
  });

  test('renders workspace backend warning banner when workspaceMessage is set', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        workspaceMessage="Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile."
      />
    );

    expect(
      screen.getByText(/Backend jest chwilowo niedostepny\. Sprobuj ponownie za chwile\./i)
    ).toBeInTheDocument();
  });

  test('renders player shell while selected recording audio is loading', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={{ id: 'rec1', transcript: [], duration: 60 }}
        selectedRecordingAudioStatus="loading"
      />
    );

    expect(screen.getByTestId('player-loading-audio')).toBeInTheDocument();
    expect(screen.getByText(/Ladowanie audio/i)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------
  // Issue #0 - StudioMeetingView retried missing audio on every rerender
  // Date: 2026-04-05
  // Bug: the view re-triggered hydrateRecordingAudio even after the selected
  //      recording had already failed with status "error", causing repeated 404s.
  // Fix: automatic hydration now skips "error" state and leaves retry to the user.
  // -----------------------------------------------------------------
  test('Regression: does not auto-retry hydration when selected recording audio is in error state', () => {
    const hydrateRecordingAudio = vi.fn(() => Promise.resolve(null));

    const { rerender } = renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={{ id: 'rec404', transcript: [], duration: 60 }}
        selectedRecordingAudioStatus="error"
        selectedRecordingAudioError="Nie znaleziono nagrania."
        hydrateRecordingAudio={hydrateRecordingAudio}
      />
    );

    rerender(
      <AppProviders>
        <StudioMeetingView
          {...defaultProps}
          selectedRecording={{ id: 'rec404', transcript: [], duration: 60 }}
          selectedRecordingAudioStatus="error"
          selectedRecordingAudioError="Nie znaleziono nagrania."
          hydrateRecordingAudio={hydrateRecordingAudio}
        />
      </AppProviders>
    );

    expect(hydrateRecordingAudio).not.toHaveBeenCalled();
  });

  test('shows empty transcript banner and retry action', () => {
    const retryStoredRecording = vi.fn();
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={{
          id: 'rec-empty',
          transcript: [],
          duration: 60,
          transcriptOutcome: 'empty',
          emptyReason: 'no_segments_from_stt',
          pipelineGitSha: 'abcdef1',
          transcriptionDiagnostics: {
            usedChunking: true,
            chunksWithText: 0,
            chunksAttempted: 2,
          },
        }}
        retryStoredRecording={retryStoredRecording}
      />
    );

    expect(screen.getByTestId('empty-transcript-banner')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Ponow transkrypcje/i })[0]);
    expect(retryStoredRecording).toHaveBeenCalled();
    expect(screen.getByText(/Build: abcdef1/i)).toBeInTheDocument();
  });

  test('shows summary fallback for empty transcript', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        studioAnalysis={{ summary: '', decisions: [], actionItems: [] }}
        selectedRecording={{
          id: 'rec-empty',
          transcript: [],
          duration: 60,
          transcriptOutcome: 'empty',
        }}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Podsumowanie spotkania/i })[0]);
    expect(
      screen.getByText(
        /Nie wykryto wypowiedzi w nagraniu\. Sprawdz jakosc pliku, glosnosc albo sprobuj ponownie innym formatem\./i
      )
    ).toBeInTheDocument();
  });

  test('shows polished no-data state for empty transcript', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedMeeting={{ id: 'm1', title: 'Test Meeting', tags: [], needs: [], concerns: [] }}
        selectedRecording={{
          id: 'rec-empty-sketchnote',
          transcript: [],
          duration: 60,
          transcriptOutcome: 'empty',
          userMessage: 'Nie wykryto wypowiedzi w nagraniu.',
        }}
        displayRecording={{
          id: 'rec-empty-sketchnote',
          transcript: [],
          duration: 60,
          transcriptOutcome: 'empty',
        }}
      />
    );

    expect(screen.getByText(/Nie ma jeszcze materiału do podsumowania/i)).toBeInTheDocument();
    expect(screen.getByText(/Brak danych do analizy/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Ponow transkrypcje/i }).length).toBeGreaterThan(
      0
    );
    expect(
      screen.queryByRole('button', { name: /Wygeneruj sketchnotkę/i })
    ).not.toBeInTheDocument();
  });

  test('treats done recording with zero segments as empty transcript', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={{
          id: 'rec-done-empty',
          transcript: [],
          duration: 60,
          pipelineStatus: 'done',
          userMessage: 'Pipeline zakonczyl przetwarzanie, ale nie zwrocil segmentow transkrypcji.',
        }}
      />
    );

    expect(screen.getByTestId('empty-transcript-banner')).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /Pipeline zakonczyl przetwarzanie, ale nie zwrocil segmentow transkrypcji\./i
      ).length
    ).toBeGreaterThan(0);
  });

  test('generates sketchnote using displayRecording id when selectedRecording is missing', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    apiRequestMock.mockResolvedValueOnce({
      sketchnoteUrl: 'data:image/png;base64,ZmFrZQ==',
    });

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={null}
        displayRecording={{ id: 'rec-display-only', transcript: [], duration: 60 }}
        studioAnalysis={{ summary: 'Podsumowanie testowe', decisions: [], actionItems: [] }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Generuj sketchnotk/i }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/media/recordings/rec-display-only/sketchnote',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(alertSpy).not.toHaveBeenCalledWith(
      'Brak zapisanego nagrania do wygenerowania wizualizacji.'
    );
    alertSpy.mockRestore();
  });

  test('opens voice profile enrollment modal after renaming a speaker', async () => {
    const renameSpeaker = vi.fn();

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        renameSpeaker={renameSpeaker}
        autoCreateVoiceProfile={vi.fn()}
        displaySpeakerNames={{ speaker_1: 'Speaker 1' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Test segment',
              timestamp: 0,
              endTimestamp: 5,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Test segment',
              timestamp: 0,
              endTimestamp: 5,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /zmień mówcę: speaker 1/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /zmień nazwę/i }));

    const renameInput = screen.getByLabelText(/nowa nazwa mówcy/i);
    fireEvent.change(renameInput, { target: { value: 'Anna' } });
    fireEvent.blur(renameInput);

    expect(renameSpeaker).toHaveBeenCalledWith('speaker_1', 'Anna');
    await waitFor(() => {
      expect(screen.getByText(/zmieniono nazwe mowcy na/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Anna/i)).toBeInTheDocument();
  });

  test('renders playback scrubber and lets user seek audio', async () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{ transcript: [], duration: 120 }}
        selectedRecording={{ id: 'rec-audio', transcript: [], duration: 120 }}
        selectedRecordingAudioUrl="blob:test-audio"
      />
    );

    const slider = screen.getByRole('slider', { name: /Pozycja odtwarzania/i });
    expect(slider).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '42' } });
    expect(screen.getByText('00:42 / 02:00')).toBeInTheDocument();
  });

  test('renders empty state when no meeting selected', () => {
    const props = {
      ...defaultProps,
      selectedMeeting: null,
      displayRecording: null,
      selectedRecording: null,
    };
    renderWithContext(<StudioMeetingView {...props} />);
    const els = screen.getAllByText(/Brak aktywnego spotkania/i);
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  test('renders analysis tabs', () => {
    renderWithContext(<StudioMeetingView {...defaultProps} />);
    expect(screen.getAllByText(/Podsumowanie spotkania/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Potrzeby i obawy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Profil psychologiczny/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/feedback/i).length).toBeGreaterThan(0);
  });

  test('renders detailed feedback cards and category scores', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        studioAnalysis={{
          summary: 'Spotkanie konkretne',
          decisions: [],
          actionItems: [],
          feedback: sampleFeedback,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /feedback/i }));

    expect(screen.getByLabelText(/Ocena spotkania 8 na 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Co można poprawić/i)).toBeInTheDocument();
    expect(screen.getByText(/Prowadzenie spotkania/i)).toBeInTheDocument();
    expect(screen.getByText(/Następne kroki/i)).toBeInTheDocument();
  });

  test('builds fallback feedback for older analyses without feedback', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{
          transcript: [
            { text: 'Ustalmy plan działania.', speakerId: 0, timestamp: 0, endTimestamp: 4 },
            { text: 'Potrzebujemy decyzji do jutra.', speakerId: 1, timestamp: 5, endTimestamp: 9 },
            {
              text: 'Przypiszmy właściciela i termin.',
              speakerId: 0,
              timestamp: 10,
              endTimestamp: 14,
            },
          ],
          duration: 60,
        }}
        studioAnalysis={{
          summary: 'Rozmowa o planie działania i decyzjach.',
          decisions: ['Decyzja o planie'],
          actionItems: ['Przypisać właściciela'],
          tasks: [],
          followUps: ['Sprawdzić postęp'],
          participantInsights: [{ speaker: 'Alice', mainTopic: 'Plan', stance: 'proactive' }],
          risks: [],
          blockers: [],
          tensions: [],
          keyQuotes: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /feedback/i }));

    expect(screen.getByText(/Oceny 1-10/i)).toBeInTheDocument();
    expect(screen.getByText(/Prowadzenie spotkania/i)).toBeInTheDocument();
    expect(screen.getByText(/Jak możesz być odbierany/i)).toBeInTheDocument();
  });

  test('renders toolbar buttons', () => {
    renderWithContext(<StudioMeetingView {...defaultProps} />);
    expect(screen.getByText(/Eksport/i)).toBeInTheDocument();
    expect(screen.getByText(/Transkrypcja/i)).toBeInTheDocument();
    expect(screen.getByText(/Rozpocznij nagrywanie/i)).toBeInTheDocument();
  });

  test('shows recording controls when isRecording is true', () => {
    const props = { ...defaultProps, isRecording: true };
    renderWithContext(<StudioMeetingView {...props} />);
    expect(screen.getByText(/Stop/i)).toBeInTheDocument();
    expect(screen.getByText(/● REC/i)).toBeInTheDocument();
  });
  test('shows meeting tasks in the tasks tab', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        meetingTasks={[
          {
            id: 'task_1',
            title: 'Przygotuj follow-up',
            description: 'Wyslij podsumowanie po rozmowie',
            owner: 'Anna Nowak',
            dueDate: '2026-03-23T10:00:00.000Z',
            priority: 'high',
            tags: ['follow-up'],
            sourceType: 'meeting',
            sourceMeetingId: 'm1',
            sourceMeetingTitle: 'Test Meeting',
            sourceMeetingDate: '2026-03-22T09:00:00.000Z',
            sourceRecordingId: 'rec1',
            sourceQuote: '',
            createdAt: '2026-03-22T09:10:00.000Z',
            updatedAt: '2026-03-22T09:10:00.000Z',
          },
        ]}
        selectedRecording={{ id: 'rec1', transcript: [], duration: 60 }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Zadania/i }));

    expect(screen.getByText('Przygotuj follow-up')).toBeInTheDocument();
    expect(screen.getByText('@Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('Wysoki')).toBeInTheDocument();
  });

  test('task actions can navigate to tasks and open task details', () => {
    const onOpenTask = vi.fn();
    const setActiveTab = vi.fn();
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        onOpenTask={onOpenTask}
        setActiveTab={setActiveTab}
        meetingTasks={[
          {
            id: 'task_1',
            title: 'Przygotuj follow-up',
            description: 'Wyslij podsumowanie po rozmowie',
            owner: 'Anna Nowak',
            dueDate: '2026-03-23T10:00:00.000Z',
            priority: 'high',
            tags: ['follow-up'],
            sourceType: 'meeting',
            sourceMeetingId: 'm1',
            sourceMeetingTitle: 'Test Meeting',
            sourceMeetingDate: '2026-03-22T09:00:00.000Z',
            sourceRecordingId: 'rec1',
            sourceQuote: '',
            createdAt: '2026-03-22T09:10:00.000Z',
            updatedAt: '2026-03-22T09:10:00.000Z',
          },
        ]}
        selectedRecording={{ id: 'rec1', transcript: [], duration: 60 }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Zadania/i }));

    fireEvent.click(screen.getByRole('button', { name: /Przejdź do zadań/i }));
    fireEvent.click(screen.getByRole('button', { name: /Otwórz szczegóły/i }));

    expect(onOpenTask).toHaveBeenCalledWith({ taskId: 'task_1', mode: 'tab' });
    expect(onOpenTask).toHaveBeenCalledWith({ taskId: 'task_1', mode: 'detail' });
  });

  test('renders participants as a list', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        studioAnalysis={{
          summary: 'Podsumowanie spotkania',
          decisions: [],
          actionItems: [],
          participantInsights: [{ speaker: 'Alice', mainTopic: 'Budzet', stance: 'ostrozna' }],
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Profil psychologiczny/i }));

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading').some((item) => item.className.includes('icard-name'))
    ).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — StudioMeetingView: analysisStatus derived from array .status (always undefined)
  // Date: 2026-04-04
  // Bug: selectedMeetingQueue is an array, but .status was accessed on it → always undefined.
  //      Pipeline progress was never shown during import queue processing.
  // Fix: derive analysisStatus from the first active queue item in the array.
  // ─────────────────────────────────────────────────────────────────
  describe('Regression: #0 — analysisStatus derived from queue array', () => {
    test('shows pipeline progress when selectedMeetingQueue has active items', () => {
      renderWithContext(
        <StudioMeetingView
          {...defaultProps}
          selectedMeetingQueue={[{ recordingId: 'rec_1', meetingId: 'm1', status: 'processing' }]}
          recordingMessage="Serwer przetwarza nagranie..."
          pipelineProgressPercent={50}
          pipelineStageLabel="Transkrypcja"
        />
      );

      expect(screen.getByText(/Serwer przetwarza nagranie/i)).toBeInTheDocument();
    });

    test('shows queued state when selectedMeetingQueue has queued items', () => {
      renderWithContext(
        <StudioMeetingView
          {...defaultProps}
          selectedMeetingQueue={[{ recordingId: 'rec_2', meetingId: 'm1', status: 'queued' }]}
          recordingMessage="Nagranie czeka na wolny slot przetwarzania..."
          pipelineProgressPercent={10}
          pipelineStageLabel="Oczekiwanie"
        />
      );

      expect(screen.getByText(/Nagranie czeka na wolny slot przetwarzania/i)).toBeInTheDocument();
    });

    test('analysisStatus is undefined when selectedMeetingQueue is empty array', () => {
      renderWithContext(
        <StudioMeetingView {...defaultProps} selectedMeetingQueue={[]} recordingMessage="" />
      );

      expect(
        screen.getByText(/Automatyczne podsumowanie AI pojawi sie po zakonczeniu analizy/i)
      ).toBeInTheDocument();
    });
  });
});
