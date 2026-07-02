import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TranscriptPanel from './TranscriptPanel';

function renderTranscriptPanel(overrides = {}) {
  const props = {
    displayRecording: {
      transcript: [
        {
          id: 'seg_1',
          text: 'Potrzebujemy dopiac budzet na przyszly tydzien.',
          timestamp: 4,
          speakerId: 0,
          verificationScore: 0.51,
          verificationStatus: 'review',
          verificationReasons: ['tekst rozni sie od przebiegu weryfikujacego'],
          verificationEvidence: {
            comparisonText: 'Potrzebujemy domknac budzet na przyszly tydzien.',
          },
        },
        {
          id: 'seg_2',
          text: 'Wysle podsumowanie i zadania po spotkaniu.',
          timestamp: 11,
          speakerId: 1,
          verificationScore: 0.91,
          verificationStatus: 'verified',
          verificationReasons: [],
        },
      ],
    },
    selectedRecording: {
      speakerCount: 2,
      diarizationConfidence: 0.77,
      transcriptionProviderLabel: 'OpenAI STT + diarization',
      reviewSummary: {
        needsReview: 1,
        approved: 1,
      },
    },
    displaySpeakerNames: {
      0: 'Ania',
      1: 'Bartek',
    },
    selectedRecordingAudioUrl: '',
    updateTranscriptSegment: vi.fn(),
    assignSpeakerToTranscriptSegments: vi.fn(),
    mergeTranscriptSegments: vi.fn(),
    splitTranscriptSegment: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<TranscriptPanel {...props} />),
    props,
  };
}

describe('TranscriptPanel', () => {
  test('renders review queue with verification evidence', () => {
    renderTranscriptPanel();

    expect(screen.getAllByText(/Do review/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Weryfikacja:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/domknac budzet/i).length).toBeGreaterThan(0);
  });

  test('filters transcript list to review items only', async () => {
    renderTranscriptPanel();

    await userEvent.click(screen.getByRole('button', { name: 'Do review' }));

    expect(
      screen.getByDisplayValue('Potrzebujemy dopiac budzet na przyszly tydzien.')
    ).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue('Wysle podsumowanie i zadania po spotkaniu.')
    ).not.toBeInTheDocument();
  }, 15000);

  test('filters transcript by speaker and low confidence', async () => {
    renderTranscriptPanel();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /^speaker$/i }), '0');
    await userEvent.click(screen.getByRole('button', { name: /confidence < 60%/i }));

    expect(
      screen.getByDisplayValue('Potrzebujemy dopiac budzet na przyszly tydzien.')
    ).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue('Wysle podsumowanie i zadania po spotkaniu.')
    ).not.toBeInTheDocument();
  });

  test('applies speaker change to selected segment range', async () => {
    const { props } = renderTranscriptPanel();

    await userEvent.click(screen.getAllByRole('checkbox')[0]);
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /speaker dla zakresu/i }),
      '1'
    );
    await userEvent.click(screen.getByRole('button', { name: /zmien speakera zaznaczonych/i }));

    expect(props.assignSpeakerToTranscriptSegments).toHaveBeenCalledWith(['seg_1'], 1);
  });

  test('assigns speaker to segments inside selected audio range', async () => {
    const { props } = renderTranscriptPanel();

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /speaker dla zakresu/i }),
      '1'
    );
    fireEvent.change(screen.getByRole('slider', { name: /poczatek zakresu/i }), {
      target: { value: '0' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /koniec zakresu/i }), {
      target: { value: '9' },
    });

    await userEvent.click(
      screen.getByRole('button', { name: /przypisz speakera dla zakresu audio/i })
    );

    expect(props.assignSpeakerToTranscriptSegments).toHaveBeenCalledWith(['seg_1'], 1);
  });

  test('renders clickable timeline segments', () => {
    renderTranscriptPanel();

    expect(screen.getByLabelText(/transcript timeline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /segment ania 00:04/i })).toBeInTheDocument();
  });

  test('shows diagnostic copy when pipeline is done but transcript is empty', () => {
    renderTranscriptPanel({
      displayRecording: { transcript: [] },
      selectedRecording: {
        pipelineStatus: 'done',
        userMessage: 'Pipeline zakonczyl przetwarzanie, ale nie zwrocil segmentow transkrypcji.',
      },
    });

    expect(screen.getByText(/Brak transkrypcji/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Pipeline zakonczyl przetwarzanie, ale nie zwrocil segmentow transkrypcji\./i
      )
    ).toBeInTheDocument();
  });

  test('Regression: shows processing state instead of empty transcript while pipeline is active', () => {
    renderTranscriptPanel({
      displayRecording: { transcript: [] },
      selectedRecording: {
        pipelineStatus: 'processing',
        userMessage: 'Transkrypcja nadal trwa w tle.',
      },
    });

    expect(screen.getByText(/Transkrypcja w toku/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Transkrypcja nadal trwa w tle/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Przetwarzanie/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Brak transkrypcji$/i)).not.toBeInTheDocument();
  });

  test('Regression: explains empty transcript as no detected speech after processing', () => {
    renderTranscriptPanel({
      displayRecording: { transcript: [] },
      selectedRecording: {
        pipelineStatus: 'done',
        transcriptOutcome: 'empty',
      },
    });

    expect(screen.getByText(/Brak wykrytej mowy/i)).toBeInTheDocument();
    expect(screen.getByText(/Nie wykryto wypowiedzi/i)).toBeInTheDocument();
    expect(screen.getByText(/Brak mowy/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Brak transkrypcji$/i)).not.toBeInTheDocument();
  });

  test('Regression: keeps transcript visible when audio is unavailable', () => {
    renderTranscriptPanel({
      displayRecording: {
        audioAvailable: false,
        audioUnavailable: true,
        transcript: [
          {
            id: 'seg_unavailable_audio',
            text: 'Transkrypt ma zostac widoczny bez audio.',
            timestamp: 0,
            speakerId: 0,
          },
        ],
      },
      selectedRecording: {
        pipelineStatus: 'done',
        audioAvailable: false,
        audioUnavailable: true,
      },
      selectedRecordingAudioUrl: '',
    });

    expect(
      screen.getByDisplayValue('Transkrypt ma zostac widoczny bez audio.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Brak transkrypcji/i)).not.toBeInTheDocument();
  });

  // ─────────────────────────────────────────────────────────────────
  // Issue #0 — Transcript panel hides hydrated selected recording transcript
  // Date: 2026-07-02
  // Bug: stale displayRecording data could hide transcript segments that were
  //      already available on selectedRecording.
  // Fix: the panel falls back to selectedRecording.transcript when display data
  //      has no segments.
  // ─────────────────────────────────────────────────────────────────
  test('Regression: falls back to selected recording transcript when display data is stale', () => {
    renderTranscriptPanel({
      displayRecording: { id: 'rec-stale-display', transcript: [] },
      selectedRecording: {
        id: 'rec-selected-rich',
        pipelineStatus: 'done',
        transcript: [
          {
            id: 'seg-selected-rich',
            text: 'Transkrypcja wybranego nagrania zostaje pokazana.',
            timestamp: 0,
            speakerId: 0,
          },
        ],
      },
    });

    expect(
      screen.getByDisplayValue('Transkrypcja wybranego nagrania zostaje pokazana.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Brak transkrypcji/i)).not.toBeInTheDocument();
  });
});
