import { render, screen } from "@testing-library/react";
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
});
