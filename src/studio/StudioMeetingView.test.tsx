import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StudioMeetingView from './StudioMeetingView';
import { getVerifiedSpeakerNames } from './StudioMeetingView';
import React from 'react';
import { vi } from 'vitest';

const apiRequestMock = vi.hoisted(() => vi.fn());
const remoteApiEnabledMock = vi.hoisted(() => vi.fn(() => false));

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
  remoteApiEnabled: () => remoteApiEnabledMock(),
}));

vi.mock('../services/httpClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/httpClient')>();
  return {
    ...actual,
    apiRequest: (...args: any[]) => apiRequestMock(...args),
  };
});

function renderWithContext(ui: React.ReactElement) {
  return render(ui);
}

describe('StudioMeetingView', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    remoteApiEnabledMock.mockReturnValue(false);
  });

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

  test('Regression: normalizes verified speaker names from remote profiles', () => {
    expect(
      getVerifiedSpeakerNames([
        { hasEmbedding: true, speakerName: ' Adam ' },
        { hasEmbedding: false, speakerName: 'Ignored' },
        { hasEmbedding: true, speakerName: 'Adam' },
        { hasEmbedding: true, speakerName: '' },
        { hasEmbedding: true, speakerName: 'Ewa' },
        null,
      ])
    ).toEqual(['Adam', 'Ewa']);
  });

  test('Regression: Issue #1332 - shows voice profile labeling diagnostics for completed transcripts', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{
          id: 'rec-profile-labels',
          transcript: [
            {
              id: 'seg-1',
              speakerId: '0',
              text: 'Profile diagnostics should be visible.',
              timestamp: 0,
              endTimestamp: 3,
            },
          ],
          duration: 60,
          voiceProfileLabeling: {
            applied: true,
            reason: 'matched',
            mode: 'full',
            profileCount: 1,
            attemptedSpeakerCount: 1,
            matchedSpeakerCount: 1,
          },
        }}
      />
    );

    expect(screen.getByText(/Profile glosowe: uzyte/i)).toBeInTheDocument();
  });

  test('Regression: Issue #1332 - hides voice profile labeling diagnostics when no status is available', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{
          id: 'rec-no-profile-labels',
          transcript: [
            {
              id: 'seg-1',
              speakerId: '0',
              text: 'No diagnostics should stay quiet.',
              timestamp: 0,
              endTimestamp: 3,
            },
          ],
          duration: 60,
        }}
      />
    );

    expect(screen.queryByText(/Profile glosowe:/i)).not.toBeInTheDocument();
  });

  test('Regression: offers verified voice profiles as assignable transcript speaker names', async () => {
    remoteApiEnabledMock.mockReturnValue(true);
    apiRequestMock.mockImplementation((url: string) => {
      if (url === '/voice-profiles') {
        return Promise.resolve({
          profiles: [{ hasEmbedding: true, speakerName: 'Barbara' }],
        });
      }
      return Promise.resolve({});
    });
    const renameSpeaker = vi.fn();

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        renameSpeaker={renameSpeaker}
        displaySpeakerNames={{ '4': 'Speaker 5' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: '4',
              text: 'Fragment, ktory powinien zostac przypisany do Barbary.',
              timestamp: 30,
              endTimestamp: 35,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          pipelineStatus: 'done',
          transcript: [
            {
              id: 'seg-1',
              speakerId: '4',
              text: 'Fragment, ktory powinien zostac przypisany do Barbary.',
              timestamp: 30,
              endTimestamp: 35,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /speaker 5/i }));

    const barbaraOption = await screen.findByRole('menuitem', { name: /Barbara/i });
    fireEvent.click(barbaraOption);

    expect(renameSpeaker).toHaveBeenCalledWith('4', 'Barbara');
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
  }, 15000);

  // -----------------------------------------------------------------
  // Issue #0 - permanent queue failures exposed retry in Studio
  // Date: 2026-05-21
  // Bug: a re-import-only queue item could still show "Ponow przetwarzanie".
  // Fix: only retry transient failed items, never failed_permanent.
  // -----------------------------------------------------------------
  test('Regression: hides retry action for permanent queue failures', () => {
    const retryRecordingQueueItem = vi.fn();

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        recordingMessage="Nagranie nie jest juz dostepne na serwerze."
        analysisStatus="error"
        retryRecordingQueueItem={retryRecordingQueueItem}
        selectedMeetingQueue={[
          { recordingId: 'rec-permanent', meetingId: 'm1', status: 'failed_permanent' },
        ]}
      />
    );

    expect(screen.queryByRole('button', { name: /Ponow przetwarzanie/i })).not.toBeInTheDocument();
    expect(retryRecordingQueueItem).not.toHaveBeenCalled();
  }, 15000);

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
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={{ id: 'rec404', transcript: [], duration: 60 }}
        selectedRecordingAudioStatus="error"
        selectedRecordingAudioError="Nie znaleziono nagrania."
        hydrateRecordingAudio={hydrateRecordingAudio}
      />
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

  test('Regression: empty transcript retry shows loading state', async () => {
    const retryStoredRecording = vi.fn(() => new Promise(() => {}));
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={{
          id: 'rec-empty-loading',
          transcript: [],
          duration: 60,
          transcriptOutcome: 'empty',
        }}
        retryStoredRecording={retryStoredRecording}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Ponow transkrypcje/i })[0]);

    const retryButtons = await screen.findAllByRole('button', {
      name: /Ponawiam transkrypcje/i,
    });
    const retryButton = retryButtons[0];
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute('aria-busy', 'true');
  });

  test('Regression: empty transcript retry shows error state', async () => {
    const retryStoredRecording = vi.fn().mockRejectedValue(new Error('Retry failed'));
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={{
          id: 'rec-empty-error',
          transcript: [],
          duration: 60,
          transcriptOutcome: 'empty',
        }}
        retryStoredRecording={retryStoredRecording}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Ponow transkrypcje/i })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Retry failed');
    expect(screen.getAllByRole('button', { name: /Ponow transkrypcje/i })[0]).not.toBeDisabled();
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

  test('Regression: rediarize button uses display recording id when selected recording is missing', async () => {
    remoteApiEnabledMock.mockReturnValue(true);
    const updateTranscriptSegment = vi.fn();
    apiRequestMock.mockImplementation((url: string) => {
      if (url === '/voice-profiles') return Promise.resolve({ profiles: [] });
      return Promise.resolve({
        speakerCount: 2,
        segments: [{ id: 'seg-1', speakerId: 'speaker_2', rawSpeakerLabel: 'Speaker 2' }],
      });
    });

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={null}
        displayRecording={{
          id: 'rec-display-only',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'To jest testowy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
          ],
          duration: 60,
        }}
        displaySpeakerNames={{ speaker_1: 'Iwo', speaker_2: 'Barbara' }}
        updateTranscriptSegment={updateTranscriptSegment}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Wykryj m/i }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        '/media/recordings/rec-display-only/rediarize',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(updateTranscriptSegment).toHaveBeenCalledWith('seg-1', {
      speakerId: 'speaker_2',
      rawSpeakerLabel: 'Speaker 2',
    });
    expect(await screen.findByText(/Wykryto 2/i)).toBeInTheDocument();
  });

  test('Regression: rediarize shows progress feedback while speaker detection is running', async () => {
    remoteApiEnabledMock.mockReturnValue(true);
    let resolveRediarize: ((value: unknown) => void) | undefined;
    apiRequestMock.mockImplementation((url: string) => {
      if (url === '/voice-profiles') return Promise.resolve({ profiles: [] });
      if (url === '/media/recordings/rec-display-only/rediarize') {
        return new Promise((resolve) => {
          resolveRediarize = resolve;
        });
      }
      return Promise.resolve({});
    });

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={null}
        displayRecording={{
          id: 'rec-display-only',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'To jest testowy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Wykryj m/i }));

    expect(await screen.findByText(/Wykrywanie m[óo]wc[óo]w/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wykrywam/i })).toBeDisabled();

    resolveRediarize?.({ speakerCount: 2, segments: [] });
    expect(await screen.findByText(/Wykryto 2/i)).toBeInTheDocument();
  });

  test('Regression: rediarize no_changes keeps transcript intact and shows non-terminal feedback', async () => {
    remoteApiEnabledMock.mockReturnValue(true);
    const updateTranscriptSegment = vi.fn();
    apiRequestMock.mockImplementation((url: string) => {
      if (url === '/voice-profiles') return Promise.resolve({ profiles: [] });
      if (url === '/media/recordings/rec-display-only/rediarize') {
        return Promise.resolve({
          status: 'no_changes',
          code: 'rediarization_unavailable',
          message: 'Nie udało się wykryć nowych mówców. Transkrypt pozostaje bez zmian.',
          speakerCount: 0,
          segments: [],
        });
      }
      return Promise.resolve({});
    });

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={null}
        displayRecording={{
          id: 'rec-display-only',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'To jest testowy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
          ],
          duration: 60,
        }}
        updateTranscriptSegment={updateTranscriptSegment}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Wykryj m/i }));

    expect(await screen.findByText(/Transkrypt pozostaje bez zmian/i)).toBeInTheDocument();
    expect(updateTranscriptSegment).not.toHaveBeenCalled();
    expect(screen.queryByText(/Wykryto 0/i)).not.toBeInTheDocument();
  });

  test('Regression: rediarize maps technical API errors to user-facing copy', async () => {
    remoteApiEnabledMock.mockReturnValue(true);
    apiRequestMock.mockImplementation((url: string) => {
      if (url === '/voice-profiles') return Promise.resolve({ profiles: [] });
      if (url === '/media/recordings/rec-display-only/rediarize') {
        return Promise.reject(
          Object.assign(new Error('Failed Dependency'), {
            status: 424,
            code: 'audio_source_unavailable',
            requestId: 'cle1::technical-request-id',
          })
        );
      }
      return Promise.resolve({});
    });

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={null}
        displayRecording={{
          id: 'rec-display-only',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'To jest testowy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Wykryj m/i }));

    expect(
      await screen.findByText(
        /Nie (?:udało|udalo) się wykryć mówców\. Spróbuj ponownie za chwilę\./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Failed Dependency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cle1::technical-request-id/i)).not.toBeInTheDocument();
  });

  test('keeps rediarize button disabled when transcript has no stored recording id', () => {
    remoteApiEnabledMock.mockReturnValue(true);
    apiRequestMock.mockImplementation((url: string) => {
      if (url === '/voice-profiles') return Promise.resolve({ profiles: [] });
      return Promise.resolve({});
    });

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={null}
        displayRecording={{
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'To jest testowy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
          ],
          duration: 60,
        }}
      />
    );

    expect(screen.getByRole('button', { name: /Wykryj m/i })).toBeDisabled();
  });

  test('opens voice profile enrollment modal after renaming a speaker', async () => {
    const renameSpeaker = vi.fn();
    const autoCreateVoiceProfile = vi.fn(() => Promise.resolve(true));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        renameSpeaker={renameSpeaker}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
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
      expect(screen.getByText(/nazwa mowcy zostala zapisana/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Anna/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /zapisz do profilu glosu/i }));

    await waitFor(() => {
      expect(autoCreateVoiceProfile).toHaveBeenCalledWith(
        'speaker_1',
        'Anna',
        expect.objectContaining({
          recordingId: 'rec-1',
          transcriptSegments: [
            expect.objectContaining({
              id: 'seg-1',
              speakerId: 'speaker_1',
              speakerName: 'Anna',
            }),
          ],
        })
      );
    });
  });

  test('Regression: renaming one speaker segment opens a single editor for repeated speakers', async () => {
    const renameSpeaker = vi.fn();

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        renameSpeaker={renameSpeaker}
        displaySpeakerNames={{ '0': 'Speaker 1' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 0,
              text: 'Pierwszy fragment tego samego mowcy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 0,
              text: 'Drugi fragment tego samego mowcy.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 0,
              text: 'Pierwszy fragment tego samego mowcy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 0,
              text: 'Drugi fragment tego samego mowcy.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /speaker 1/i })[1]);
    fireEvent.click(screen.getByRole('menuitem', { name: /nazw/i }));

    await waitFor(() => {
      expect(screen.getAllByLabelText(/nowa nazwa/i)).toHaveLength(1);
    });

    fireEvent.change(screen.getByLabelText(/nowa nazwa/i), {
      target: { value: 'Iwo' },
    });
    fireEvent.keyDown(screen.getByLabelText(/nowa nazwa/i), { key: 'Enter' });

    expect(renameSpeaker).toHaveBeenCalledWith('0', 'Iwo');
  });

  test('Regression: auto-learns a voice profile sample after assigning a segment to a named speaker', async () => {
    const updateTranscriptSegment = vi.fn();
    const autoCreateVoiceProfile = vi.fn(() => Promise.resolve(true));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        currentUser={{ id: 'u1', autoLearnSpeakerProfiles: true }}
        updateTranscriptSegment={updateTranscriptSegment}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
        displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Barbara' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Pierwszy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 'speaker_2',
              text: 'Fragment Barbary jako gotowa probka.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          pipelineStatus: 'done',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Pierwszy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 'speaker_2',
              text: 'Fragment Barbary jako gotowa probka.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /iwo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Barbara/i }));

    expect(updateTranscriptSegment).toHaveBeenCalledWith('seg-1', { speakerId: 'speaker_2' });
    await waitFor(() => {
      expect(autoCreateVoiceProfile).toHaveBeenCalledWith(
        'speaker_2',
        'Barbara',
        expect.objectContaining({
          transcriptSegments: expect.arrayContaining([
            expect.objectContaining({ id: 'seg-1', speakerId: 'speaker_2' }),
          ]),
        })
      );
    });
  });

  test('Regression: auto-learns voice profile from display recording when selectedRecording is missing', async () => {
    const updateTranscriptSegment = vi.fn();
    const autoCreateVoiceProfile = vi.fn(() => Promise.resolve(true));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        currentUser={{ id: 'u1', autoLearnSpeakerProfiles: true }}
        updateTranscriptSegment={updateTranscriptSegment}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
        displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Barbara' }}
        displayRecording={{
          id: 'rec-display',
          transcript: [
            {
              id: 'seg-display',
              speakerId: 'speaker_1',
              text: 'Widoczny fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-barbara',
              speakerId: 'speaker_2',
              text: 'Fragment Barbary jako probka.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
        selectedRecording={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /iwo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Barbara/i }));

    await waitFor(() => {
      expect(autoCreateVoiceProfile).toHaveBeenCalledWith(
        'speaker_2',
        'Barbara',
        expect.objectContaining({
          recordingId: 'rec-display',
          transcriptSegments: expect.arrayContaining([
            expect.objectContaining({ id: 'seg-display', speakerId: 'speaker_2' }),
          ]),
        })
      );
    });
  });

  test('Regression: clicking new speaker asks for a name before saving a voice profile', async () => {
    const updateTranscriptSegment = vi.fn();
    const autoCreateVoiceProfile = vi.fn(() => Promise.resolve(true));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        currentUser={{ id: 'u1', autoLearnSpeakerProfiles: true }}
        updateTranscriptSegment={updateTranscriptSegment}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
        displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Speaker 2' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_2',
              text: 'Fragment nowej osoby.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          pipelineStatus: 'done',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_2',
              text: 'Fragment nowej osoby.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Speaker 2/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Nowy m/i }));

    expect(screen.getByRole('dialog', { name: /Nazwij nowego m/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nazwa nowego m/i)).toBeInTheDocument();
    expect(updateTranscriptSegment).not.toHaveBeenCalled();
    expect(autoCreateVoiceProfile).not.toHaveBeenCalled();
  });

  test('Regression: saves a new speaker voice profile only after the speaker is named', async () => {
    const updateTranscriptSegment = vi.fn();
    const renameSpeaker = vi.fn();
    const autoCreateVoiceProfile = vi.fn(() => Promise.resolve(true));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        currentUser={{ id: 'u1', autoLearnSpeakerProfiles: true }}
        updateTranscriptSegment={updateTranscriptSegment}
        renameSpeaker={renameSpeaker}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
        displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Speaker 2' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_2',
              text: 'Fragment nowej osoby.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          pipelineStatus: 'done',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_2',
              text: 'Fragment nowej osoby.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Speaker 2/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Nowy m/i }));

    fireEvent.change(screen.getByLabelText(/Nazwa nowego m/i), {
      target: { value: 'Adam' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Utworz mowce/i }));

    expect(updateTranscriptSegment).toHaveBeenCalledWith('seg-1', { speakerId: '3' });
    expect(renameSpeaker).toHaveBeenCalledWith('3', 'Adam');
    await waitFor(() => {
      expect(autoCreateVoiceProfile).toHaveBeenCalledWith(
        '3',
        'Adam',
        expect.objectContaining({
          recordingId: 'rec-1',
          transcriptSegments: [
            expect.objectContaining({ id: 'seg-1', speakerId: '3', text: 'Fragment nowej osoby.' }),
          ],
        })
      );
    });
  });

  test('Regression: shows loading feedback while creating a new speaker voice profile', async () => {
    let resolveEnrollment: ((value: boolean) => void) | undefined;
    const updateTranscriptSegment = vi.fn();
    const renameSpeaker = vi.fn();
    const autoCreateVoiceProfile = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveEnrollment = resolve;
        })
    );

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        currentUser={{ id: 'u1', autoLearnSpeakerProfiles: true }}
        updateTranscriptSegment={updateTranscriptSegment}
        renameSpeaker={renameSpeaker}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
        displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Speaker 2' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_2',
              text: 'Fragment nowej osoby.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          pipelineStatus: 'done',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_2',
              text: 'Fragment nowej osoby.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Speaker 2/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Nowy m/i }));
    fireEvent.change(screen.getByLabelText(/Nazwa nowego m/i), {
      target: { value: 'Adam' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Utworz mowce/i }));

    expect(await screen.findByRole('button', { name: /Zapisywanie/i })).toBeDisabled();
    expect(screen.getByText(/Zapisuj(?:ę|e) pr(?:ó|o)bkę g(?:ł|l)osu dla/i)).toBeInTheDocument();

    resolveEnrollment?.(true);

    expect(await screen.findByText(/Profil (?:głosowy|glosowy) zapisany dla/i)).toBeInTheDocument();
  });

  test('Regression: asks to save a voice profile sample after assigning a segment when auto-learn is off', async () => {
    const updateTranscriptSegment = vi.fn();
    const autoCreateVoiceProfile = vi.fn(() => Promise.resolve(true));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        currentUser={{ id: 'u1', autoLearnSpeakerProfiles: false }}
        updateTranscriptSegment={updateTranscriptSegment}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
        displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Barbara' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Pierwszy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 'speaker_2',
              text: 'Fragment Barbary jako gotowa probka.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          pipelineStatus: 'done',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Pierwszy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 'speaker_2',
              text: 'Fragment Barbary jako gotowa probka.',
              timestamp: 6,
              endTimestamp: 12,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /iwo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Barbara/i }));

    expect(updateTranscriptSegment).toHaveBeenCalledWith('seg-1', { speakerId: 'speaker_2' });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Zapisz do profilu glosu/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Zapisz do profilu glosu/i }));

    await waitFor(() => {
      expect(autoCreateVoiceProfile).toHaveBeenCalledWith(
        'speaker_2',
        'Barbara',
        expect.objectContaining({
          transcriptSegments: expect.arrayContaining([
            expect.objectContaining({ id: 'seg-1', speakerId: 'speaker_2' }),
          ]),
        })
      );
    });
  });

  // -----------------------------------------------------------------
  // Issue #0 - voice profile sample failures were console-only
  // Date: 2026-05-21
  // Bug: clicking "Zapisz do profilu glosu" could fail with HTTP 400
  //      without any user-facing feedback.
  // Fix: catch enrollment errors and show the backend-safe message.
  // -----------------------------------------------------------------
  test('Regression: shows feedback when saving a voice profile sample fails', async () => {
    const updateTranscriptSegment = vi.fn();
    const autoCreateVoiceProfile = vi.fn(() =>
      Promise.reject(new Error('Nie mozna pobrac pliku audio do probki glosu.'))
    );

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        currentUser={{ id: 'u1', autoLearnSpeakerProfiles: false }}
        updateTranscriptSegment={updateTranscriptSegment}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
        displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Barbara' }}
        displayRecording={{
          id: 'rec-1',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Pierwszy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 'speaker_2',
              text: 'Fragment Barbary.',
              timestamp: 6,
              endTimestamp: 10,
            },
          ],
          duration: 60,
        }}
        selectedRecording={{
          id: 'rec-1',
          pipelineStatus: 'done',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Pierwszy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 'speaker_2',
              text: 'Fragment Barbary.',
              timestamp: 6,
              endTimestamp: 10,
            },
          ],
          duration: 60,
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /iwo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Barbara/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Zapisz do profilu glosu/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Zapisz do profilu glosu/i }));

    await waitFor(() => {
      expect(screen.getByText(/Nie mozna pobrac pliku audio do probki glosu/i)).toBeInTheDocument();
    });
  });

  test('Regression: maps voice profile 424 to an actionable audio recovery message', async () => {
    const updateTranscriptSegment = vi.fn();
    const failedDependency = Object.assign(new Error('Failed Dependency'), {
      status: 424,
      code: 'audio_source_unavailable',
      stage: 'audio_source',
      requestId: 'req-prod-424',
    });
    const autoCreateVoiceProfile = vi.fn(() => Promise.reject(failedDependency));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        currentUser={{ id: 'u1', autoLearnSpeakerProfiles: false }}
        updateTranscriptSegment={updateTranscriptSegment}
        autoCreateVoiceProfile={autoCreateVoiceProfile}
        displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Barbara' }}
        displayRecording={{
          id: 'recording_posay27m_mpf8zed7',
          transcript: [
            {
              id: 'seg-1',
              speakerId: 'speaker_1',
              text: 'Pierwszy fragment rozmowy.',
              timestamp: 0,
              endTimestamp: 5,
            },
            {
              id: 'seg-2',
              speakerId: 'speaker_2',
              text: 'Fragment Barbary.',
              timestamp: 6,
              endTimestamp: 10,
            },
          ],
          duration: 60,
        }}
        selectedRecording={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /iwo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Barbara/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Zapisz do profilu glosu/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Zapisz do profilu glosu/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          /Dla tego nagrania nie da sie utworzyc probki glosu, bo audio nie jest dostepne na serwerze\. Zaimportuj plik ponownie\./i
        )
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/Failed Dependency/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nie udalo sie zapisac probki glosu/i)).not.toBeInTheDocument();
  });

  test.each([
    ['missing_speaker_id', 400, /Wybierz mowce i osobe przed zapisaniem probki glosu\./i],
    [
      'transcription_not_ready',
      409,
      /Profil glosu mozna zapisac dopiero po gotowej transkrypcji\./i,
    ],
    [
      'speaker_segment_not_found',
      422,
      /Nie znaleziono przypisanego fragmentu wypowiedzi dla tej osoby\./i,
    ],
    [
      'embedding_failed',
      502,
      /Nie udalo sie utworzyc profilu glosu\. Sprobuj ponownie za chwile\./i,
    ],
    ['profile_save_failed', 500, /Nie udalo sie zapisac profilu glosu\. Sprobuj ponownie\./i],
  ])(
    'Regression: maps voice profile error %s to actionable copy',
    async (code, status, expectedCopy) => {
      const updateTranscriptSegment = vi.fn();
      const technicalError = Object.assign(new Error('Bad Request'), {
        status,
        code,
        requestId: 'req-hidden',
      });
      const autoCreateVoiceProfile = vi.fn(() => Promise.reject(technicalError));

      renderWithContext(
        <StudioMeetingView
          {...defaultProps}
          currentUser={{ id: 'u1', autoLearnSpeakerProfiles: false }}
          updateTranscriptSegment={updateTranscriptSegment}
          autoCreateVoiceProfile={autoCreateVoiceProfile}
          displaySpeakerNames={{ speaker_1: 'iwo', speaker_2: 'Barbara' }}
          displayRecording={{
            id: 'recording_ready',
            transcript: [
              {
                id: 'seg-1',
                speakerId: 'speaker_1',
                text: 'Pierwszy fragment rozmowy.',
                timestamp: 0,
                endTimestamp: 5,
              },
              {
                id: 'seg-2',
                speakerId: 'speaker_2',
                text: 'Fragment Barbary.',
                timestamp: 6,
                endTimestamp: 10,
              },
            ],
            duration: 60,
          }}
          selectedRecording={null}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /iwo/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /Barbara/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Zapisz do profilu glosu/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Zapisz do profilu glosu/i }));

      expect(await screen.findByText(expectedCopy)).toBeInTheDocument();
      expect(screen.queryByText(/Bad Request/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/req-hidden/i)).not.toBeInTheDocument();
    }
  );

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

  test('Regression: hydrates and shows player for display recording when selected recording is missing', async () => {
    const hydrateRecordingAudio = vi.fn(() => Promise.resolve(null));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{ id: 'rec-display-only', transcript: [], duration: 120 }}
        selectedRecording={null}
        selectedRecordingAudioStatus="idle"
        hydrateRecordingAudio={hydrateRecordingAudio}
      />
    );

    expect(screen.getByTestId('player-loading-audio')).toBeInTheDocument();
    await waitFor(() => {
      expect(hydrateRecordingAudio).toHaveBeenCalledWith('rec-display-only', { priority: true });
    });
  });

  // -----------------------------------------------------------------
  // Issue #0 - Display-only unavailable audio still requested /audio
  // Date: 2026-05-30
  // Bug: production audit seeded a display recording with audioUnavailable=true,
  //      but the Studio view only checked selectedRecording flags and still
  //      requested /media/recordings/:id/audio, producing a 404.
  // Fix: player hydration uses the active playback recording, including
  //      displayRecording when selectedRecording is missing.
  // -----------------------------------------------------------------
  test('Regression: does not hydrate display recording audio when it is marked unavailable', async () => {
    const hydrateRecordingAudio = vi.fn(() => Promise.resolve(null));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{
          id: 'rec-display-unavailable',
          transcript: [],
          duration: 120,
          audioAvailable: false,
          audioUnavailable: true,
          audioUnavailableReason: 'production_audit_ui_fixture',
        }}
        selectedRecording={null}
        selectedRecordingAudioStatus="idle"
        hydrateRecordingAudio={hydrateRecordingAudio}
      />
    );

    expect(screen.getByTestId('player-audio-error')).toBeInTheDocument();
    expect(screen.getByText(/Audio nie jest dostepne/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(hydrateRecordingAudio).not.toHaveBeenCalled();
    });
  });

  test('Regression: shows transcript while unavailable audio disables playback hydration', async () => {
    const hydrateRecordingAudio = vi.fn(() => Promise.resolve(null));

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{
          id: 'rec-display-transcript-unavailable',
          transcript: [
            {
              id: 'seg-display-transcript-unavailable',
              text: 'Transkrypt zostaje po aktualizacji.',
              timestamp: 0,
              speakerId: 0,
            },
          ],
          duration: 120,
          pipelineStatus: 'done',
          audioAvailable: false,
          audioUnavailable: true,
          audioUnavailableReason: 'audio_source_unavailable',
        }}
        selectedRecording={null}
        selectedRecordingAudioStatus="idle"
        hydrateRecordingAudio={hydrateRecordingAudio}
      />
    );

    expect(screen.getByText(/Audio nie jest dostepne/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Transkrypt zostaje po aktualizacji.')).toBeInTheDocument();
    await waitFor(() => {
      expect(hydrateRecordingAudio).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // Issue #0 - Studio transcript hidden after returning to an existing recording
  // Date: 2026-07-02
  // Bug: the right transcript rail used displayRecording.transcript only, so a
  //      hydrated selectedRecording with transcript could still render empty.
  // Fix: the rail falls back to selectedRecording.transcript when display data
  //      is missing or stale.
  // -----------------------------------------------------------------
  test('Regression: renders selected recording transcript when display recording is stale', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{ id: 'rec-stale-display', transcript: [], duration: 120 }}
        selectedRecording={{
          id: 'rec-selected-rich',
          transcript: [
            {
              id: 'seg-selected-rich',
              speakerId: '0',
              text: 'Transkrypcja z wybranego nagrania ma zostac widoczna.',
              timestamp: 0,
              endTimestamp: 4,
            },
          ],
          duration: 120,
          pipelineStatus: 'done',
        }}
      />
    );

    expect(
      screen.getByDisplayValue('Transkrypcja z wybranego nagrania ma zostac widoczna.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Brak transkrypcji/i)).not.toBeInTheDocument();
  });

  test('Regression: playback controls remain visible for display recording audio without selected recording', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{ id: 'rec-display-only', transcript: [], duration: 120 }}
        selectedRecording={null}
        selectedRecordingAudioUrl="blob:test-audio"
      />
    );

    expect(screen.getByRole('slider', { name: /Pozycja odtwarzania/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Odtworsz/i })).toBeInTheDocument();
  });

  test('renders empty state when no meeting selected', () => {
    const props = {
      ...defaultProps,
      selectedMeeting: null,
      displayRecording: null,
      selectedRecording: null,
      briefOpen: false,
    };
    renderWithContext(<StudioMeetingView {...props} />);
    const els = screen.getAllByText(/Brak aktywnego spotkania/i);
    expect(els.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Centrum pracy')).toBeInTheDocument();
    expect(screen.getByText('Dziś w kalendarzu')).toBeInTheDocument();
    expect(screen.getByText('Ostatnie nagrania')).toBeInTheDocument();
    expect(screen.getByText('Brak wydarzeń na dziś')).toBeInTheDocument();
    expect(screen.getByText('Brak nagrań')).toBeInTheDocument();
    expect(screen.queryByText('Daily standup')).not.toBeInTheDocument();
    expect(screen.queryByText('Kickoff projektu Mercury')).not.toBeInTheDocument();
    expect(screen.getByText('Nagrania w tym miesiącu')).toBeInTheDocument();
    expect(screen.getByText('Gotowe podsumowania')).toBeInTheDocument();
  });

  test('routes Studio home quick actions through existing handlers', () => {
    const props = {
      ...defaultProps,
      selectedMeeting: null,
      displayRecording: null,
      selectedRecording: null,
      briefOpen: false,
      setBriefOpen: vi.fn(),
      setActiveTab: vi.fn(),
      startNewMeetingDraft: vi.fn(),
      startRecording: vi.fn(),
    };

    renderWithContext(<StudioMeetingView {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /^Nagraj ad hoc$/i }));
    expect(props.startRecording).toHaveBeenCalledWith({ adHoc: true });

    fireEvent.click(screen.getAllByRole('button', { name: /^Przygotuj brief$/i })[0]);
    expect(props.startNewMeetingDraft).toHaveBeenCalledTimes(1);
    expect(props.setBriefOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: /Otwórz kalendarz/i }));
    expect(props.setActiveTab).toHaveBeenCalledWith('calendar');

    fireEvent.click(screen.getByRole('button', { name: /Zobacz wszystkie/i }));
    expect(props.setActiveTab).toHaveBeenCalledWith('recordings');
  });

  test('renders analysis tabs', () => {
    renderWithContext(<StudioMeetingView {...defaultProps} />);
    expect(screen.getAllByText(/Podsumowanie spotkania/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Potrzeby i obawy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Profil psychologiczny/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/feedback/i).length).toBeGreaterThan(0);
  });

  test('renders richer empty state in needs and concerns section', () => {
    renderWithContext(<StudioMeetingView {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Potrzeby i obawy/i }));

    expect(screen.getByText(/Co warto uchwycic w rozmowie/i)).toBeInTheDocument();
    expect(screen.getByText(/Co jest teraz wazne/i)).toBeInTheDocument();
    expect(screen.getByText(/Co moze blokowac decyzje/i)).toBeInTheDocument();
    expect(screen.getByText(/Brak potrzeb/i)).toBeInTheDocument();
    expect(screen.getByText(/Brak obaw/i)).toBeInTheDocument();
  });

  test('renders descriptive headers across analysis tabs', () => {
    renderWithContext(<StudioMeetingView {...defaultProps} />);

    expect(
      screen.getByText(/Najwazniejsze wnioski, decyzje i kolejne kroki zebrane w jednym miejscu/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Profil psychologiczny/i }));
    expect(
      screen.getByText(/Portrety uczestnikow, dynamika rozmowy i sygnaly/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Zadania/i }));
    expect(
      screen.getByText(/Zamien ustalenia ze spotkania w konkretne zadania/i)
    ).toBeInTheDocument();
  });

  test('Regression: keeps meeting tasks tab manual-only without AI suggestions panel', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        selectedRecording={{
          id: 'rec-with-transcript',
          duration: 60,
          transcript: [
            {
              id: 'seg-1',
              speakerId: '0',
              text: 'Prosze przygotowac follow-up po spotkaniu.',
              timestamp: 0,
              endTimestamp: 4,
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Zadania/i }));

    expect(screen.getByRole('button', { name: /\+ Dodaj zadanie/i })).toBeInTheDocument();
    expect(screen.queryByTestId('ai-task-suggestions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generuj sugestie/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sugestie zada/i)).not.toBeInTheDocument();
  });

  test('Regression: does not auto-create tasks from meeting analysis without user action', () => {
    const onCreateTask = vi.fn();

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        onCreateTask={onCreateTask}
        selectedMeeting={{ id: 'meeting-auto-task', title: 'Manual tasks only' }}
        selectedRecording={{ id: 'recording-auto-task', duration: 60, transcript: [] }}
        studioAnalysis={{
          summary: 'Spotkanie ma action items.',
          decisions: [],
          actionItems: ['Wyslac podsumowanie'],
          tasks: [
            {
              title: 'Przygotowac follow-up',
              description: 'Opis z analizy',
              owner: 'Iwo',
              priority: 'high',
              tags: ['follow-up'],
              sourceQuote: 'Ustalmy follow-up',
            },
          ],
        }}
      />
    );

    expect(onCreateTask).not.toHaveBeenCalled();
  });

  test('Regression: creates a Studio task manually with multiple assignees', async () => {
    const onCreateTask = vi.fn();

    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        onCreateTask={onCreateTask}
        selectedMeeting={{ id: 'meeting-manual-task', title: 'Manual task meeting' }}
        selectedRecording={{ id: 'recording-manual-task', duration: 60, transcript: [] }}
        peopleProfiles={[{ name: 'Iwo' }, { name: 'Marta' }]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Zadania/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Dodaj zadanie/i }));

    fireEvent.change(await screen.findByLabelText(/Tytuł zadania/i), {
      target: { value: 'Przygotowac follow-up' },
    });

    const personInput = screen.getByPlaceholderText('Wybierz osoby...');
    fireEvent.focus(personInput);
    fireEvent.change(personInput, { target: { value: 'Iw' } });
    fireEvent.keyDown(personInput, { key: 'Enter' });
    fireEvent.change(personInput, { target: { value: 'Mar' } });
    fireEvent.keyDown(personInput, { key: 'Enter' });

    const submitButtons = screen.getAllByRole('button', { name: /^Dodaj zadanie$/i });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(onCreateTask).toHaveBeenCalledTimes(1));
    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Przygotowac follow-up',
        assignedTo: ['Iwo', 'Marta'],
        owner: 'Iwo',
        meetingId: 'recording-manual-task',
      })
    );
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

  test('renders summary highlights as multiline bullets instead of semicolon text', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        studioAnalysis={{
          summary: 'Spotkanie dotyczyło błędów.',
          decisions: ['Zgłoszenie błędów do adminów', 'Przygotowanie PEC-ów'],
          actionItems: ['Wysłać podsumowanie', 'Ustalić ownera'],
          followUps: ['Ustalić termin kolejnego spotkania', 'Przygotować dokumentację'],
          risks: [{ risk: 'Brak aktualizacji w projekcie' }],
          blockers: ['Brak odpowiedzi od adminów'],
        }}
      />
    );

    const decisionsHighlight = screen.getByText(/Decyzje:/i).closest('.summary-highlight-body');
    expect(decisionsHighlight?.textContent).toContain('•');
    expect(decisionsHighlight?.textContent).not.toContain(';');
  });

  test.skip('allows editing action items from the summary editor', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        studioAnalysis={{
          summary: 'Pierwotne podsumowanie',
          decisions: ['Stara decyzja'],
          actionItems: ['Stary action item'],
          followUps: ['Stary follow-up'],
          risks: [{ risk: 'Stare ryzyko' }],
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Edytuj/i }));
    fireEvent.change(screen.getByDisplayValue('Stary action item'), {
      target: { value: 'Nowy action item\nDrugi action item' },
    });

    expect(screen.getByDisplayValue('Nowy action item\nDrugi action item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Zapisz$/i })).toBeInTheDocument();
  });

  test('shows degraded AI status when meeting analysis was fallback-generated', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        studioAnalysis={{
          mode: 'no-key',
          analysisSource: 'fallback',
          fallbackReason: 'no-key',
          summary: 'Lokalne podsumowanie testowe.',
          decisions: [],
          actionItems: [],
        }}
      />
    );

    expect(screen.getByRole('status', { name: /status analizy ai/i })).toHaveTextContent(
      /Analiza lokalna/i
    );
    expect(screen.getByText(/brak skonfigurowanego klucza/i)).toBeInTheDocument();
  });

  test('renders toolbar buttons', () => {
    renderWithContext(<StudioMeetingView {...defaultProps} />);
    expect(screen.getByText(/Eksport/i)).toBeInTheDocument();
    expect(screen.getByText(/Transkrypcja/i)).toBeInTheDocument();
    expect(screen.getByText(/Rozpocznij nagrywanie/i)).toBeInTheDocument();
  });

  test('Regression: meeting summary uses Polish copy and clear brief action', () => {
    renderWithContext(<StudioMeetingView {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Dodaj brief/i })).toHaveAttribute(
      'title',
      'Dodaj kontekst spotkania, cele i oczekiwane rezultaty.'
    );
    expect(screen.getByText('PODSUMOWANIE AI')).toBeInTheDocument();
    expect(screen.queryByText(/Share of Voice/i)).not.toBeInTheDocument();
  });

  test('Regression: speaker share legend maps colors to names and percentages', () => {
    renderWithContext(
      <StudioMeetingView
        {...defaultProps}
        displayRecording={{
          transcript: [
            { text: 'A', speakerId: 's1', timestamp: 0, endTimestamp: 62 },
            { text: 'B', speakerId: 's2', timestamp: 62, endTimestamp: 88 },
            { text: 'C', speakerId: 's3', timestamp: 88, endTimestamp: 100 },
          ],
          duration: 100,
        }}
        displaySpeakerNames={{ s1: 'Iwo', s2: 'Mówca 2', s3: 'Mówca 3' }}
      />
    );

    expect(screen.getByText('Udział w rozmowie')).toBeInTheDocument();
    expect(screen.getByText('Iwo — 62%')).toBeInTheDocument();
    expect(screen.getByText('Mówca 2 — 26%')).toBeInTheDocument();
    expect(screen.getByText('Mówca 3 — 12%')).toBeInTheDocument();
  });

  test('shows recording controls when isRecording is true', () => {
    const props = { ...defaultProps, isRecording: true };
    renderWithContext(<StudioMeetingView {...props} />);
    expect(screen.getByText(/Stop/i)).toBeInTheDocument();
    expect(screen.getByText(/● REC/i)).toBeInTheDocument();
  });
  test.skip('shows task creation entry points in the tasks tab', async () => {
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

    expect(screen.getByRole('heading', { name: /Zadania/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Dodaj zadanie/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /\+ Dodaj zadanie/i }));
    expect(await screen.findByPlaceholderText('Dodaj zadanie (N)...')).toBeInTheDocument();
  });

  test.skip('task actions can navigate to tasks and open task details', () => {
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

  test.skip('opens the task create modal from the tasks tab', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /\+ Dodaj zadanie/i }));

    expect(await screen.findByPlaceholderText('Dodaj zadanie (N)...')).toBeInTheDocument();
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
