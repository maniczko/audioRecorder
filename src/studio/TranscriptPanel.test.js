import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TranscriptPanel from "./TranscriptPanel";

function renderTranscriptPanel(overrides = {}) {
  const props = {
    displayRecording: {
      transcript: [
        {
          id: "seg_1",
          text: "Potrzebujemy dopiac budzet na przyszly tydzien.",
          timestamp: 4,
          speakerId: 0,
          verificationScore: 0.51,
          verificationStatus: "review",
          verificationReasons: ["tekst rozni sie od przebiegu weryfikujacego"],
          verificationEvidence: {
            comparisonText: "Potrzebujemy domknac budzet na przyszly tydzien.",
          },
        },
        {
          id: "seg_2",
          text: "Wysle podsumowanie i zadania po spotkaniu.",
          timestamp: 11,
          speakerId: 1,
          verificationScore: 0.91,
          verificationStatus: "verified",
          verificationReasons: [],
        },
      ],
    },
    selectedRecording: {
      speakerCount: 2,
      diarizationConfidence: 0.77,
      transcriptionProviderLabel: "OpenAI STT + diarization",
      reviewSummary: {
        needsReview: 1,
        approved: 1,
      },
    },
    displaySpeakerNames: {
      0: "Ania",
      1: "Bartek",
    },
    selectedRecordingAudioUrl: "",
    updateTranscriptSegment: jest.fn(),
    assignSpeakerToTranscriptSegments: jest.fn(),
    mergeTranscriptSegments: jest.fn(),
    splitTranscriptSegment: jest.fn(),
    ...overrides,
  };

  return {
    ...render(<TranscriptPanel {...props} />),
    props,
  };
}

describe("TranscriptPanel", () => {
  test("renders review queue with verification evidence", () => {
    renderTranscriptPanel();

    expect(screen.getByText("Fragmenty wymagajace potwierdzenia")).toBeInTheDocument();
    expect(screen.getByText("Porownanie z przebiegiem weryfikujacym")).toBeInTheDocument();
    expect(screen.getAllByText(/domknac budzet/i).length).toBeGreaterThan(0);
  });

  test("filters transcript list to review items only", async () => {
    renderTranscriptPanel();

    await userEvent.click(screen.getByRole("button", { name: "Do review" }));

    expect(screen.getByDisplayValue("Potrzebujemy dopiac budzet na przyszly tydzien.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Wysle podsumowanie i zadania po spotkaniu.")).not.toBeInTheDocument();
  });

  test("filters transcript by speaker and low confidence", async () => {
    renderTranscriptPanel();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: /^speaker$/i }), "0");
    await userEvent.click(screen.getByRole("button", { name: /confidence < 60%/i }));

    expect(screen.getByDisplayValue("Potrzebujemy dopiac budzet na przyszly tydzien.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Wysle podsumowanie i zadania po spotkaniu.")).not.toBeInTheDocument();
  });

  test("applies speaker change to selected segment range", async () => {
    const { props } = renderTranscriptPanel();

    await userEvent.click(screen.getAllByRole("checkbox")[0]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /speaker dla zakresu/i }), "1");
    await userEvent.click(screen.getByRole("button", { name: /zmien speakera zaznaczonych/i }));

    expect(props.assignSpeakerToTranscriptSegments).toHaveBeenCalledWith(["seg_1"], 1);
  });

  test("assigns speaker to segments inside selected audio range", async () => {
    const { props } = renderTranscriptPanel();

    await userEvent.selectOptions(screen.getByRole("combobox", { name: /speaker dla zakresu/i }), "1");
    fireEvent.change(screen.getByRole("slider", { name: /poczatek zakresu/i }), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /koniec zakresu/i }), {
      target: { value: "9" },
    });

    await userEvent.click(screen.getByRole("button", { name: /przypisz speakera dla zakresu audio/i }));

    expect(props.assignSpeakerToTranscriptSegments).toHaveBeenCalledWith(["seg_1"], 1);
  });

  test("renders clickable timeline segments", () => {
    renderTranscriptPanel();

    expect(screen.getByLabelText(/transcript timeline/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /segment ania 00:04/i })).toBeInTheDocument();
  });
});
