import { analyzePersonProfile, analyzeMeeting } from "./analysis";
import { MEETING_FEEDBACK_CATEGORIES } from "../shared/meetingFeedback";

jest.mock("../services/httpClient", () => ({
  apiRequest: jest.fn().mockRejectedValue(new Error("Network error")),
}));

describe("analysis", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("runs analyzePersonProfile with local fallback", async () => {
    const allSegments = [
      { text: "My musimy podjąć decyzję do jutra.", speakerId: 0 },
      { text: "Czy ktoś z was wie, jakie są procentowe statystyki w tym raporcie?", speakerId: 0 },
      { text: "Bardzo zależy mi na naszych relacjach.", speakerId: 0 },
      { text: "Zdecydowaliśmy, że to trzeba zrobić szybko. Bardzo długie zadanie, pełne rozbudowanych i złożonych zdań, aby przetestować analitykę tekstu w tym konkretnym profilu.", speakerId: 0 },
      { text: "Zdecydowaliśmy, że to trzeba zrobić szybko. Bardzo długie zadanie, pełne rozbudowanych i złożonych zdań, aby przetestować analitykę tekstu w tym konkretnym profilu.", speakerId: 0 },
      { text: "Zdecydowaliśmy, że to trzeba zrobić szybko. Bardzo długie zadanie, pełne rozbudowanych i złożonych zdań, aby przetestować analitykę tekstu w tym konkretnym profilu.", speakerId: 0 },
      { text: "Zdecydowaliśmy, że to trzeba zrobić szybko. Bardzo długie zadanie, pełne rozbudowanych i złożonych zdań, aby przetestować analitykę tekstu w tym konkretnym profilu.", speakerId: 0 }
    ];

    const profile = await analyzePersonProfile({
      personName: "Jan",
      meetings: [{}],
      allSegments,
    });

    expect(profile.disc).toBeDefined();
    expect(profile.disc.D).toBeGreaterThan(0);
    expect(profile.meetingsAnalyzed).toBe(1);
    expect(profile.mode).toMatch(/fallback/);
  });

  test("runs analyzeMeeting with local fallback", async () => {
    const meeting = {
      title: "Test Meeting",
      needs: ["Czego potrzebujemy?"],
      desiredOutputs: ["Plan", "Raport"],
    };
    
    const segments = [
      { text: "To długie zdanie powyżej 24 znaków, żeby złapało to jako ważną frazę.", speakerId: 0 },
      { text: "Kolejne ogromnie długie zdanie, które musi stanowić część interesującego nas i badanego testu podsumowania.", speakerId: 1 },
      { text: "Czego potrzebujemy? Mamy problem, to blokuje nasz budżet.", speakerId: 0 },
      { text: "Musimy zrobić raport do jutra.", speakerId: 1 },
      { text: "Czy wszystko rozumiemy?", speakerId: 0 }
    ];

    const speakerNames = { "0": "Alice", "1": "Bob" };

    const result = await analyzeMeeting({
      meeting,
      segments,
      speakerNames,
      diarization: { speakerCount: 2 }
    });

    expect(result.summary).toBeDefined();
    expect(result.decisions.length).toBeDefined();
    expect(result.actionItems.length).toBeDefined();
    expect(result.tasks.length).toBeDefined();
    expect(result.speakerCount).toBe(2);
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.feedback).toBeDefined();
    expect(result.feedback.categoryScores).toHaveLength(MEETING_FEEDBACK_CATEGORIES.length);
    expect(result.feedback.overallScore).toBeGreaterThanOrEqual(1);
  });

  test("runs analyzeMeeting with no segments", async () => {
    const result = await analyzeMeeting({
      meeting: {},
      segments: [],
      speakerNames: {},
      diarization: {}
    });
    expect(result.summary).toMatch(/puste|wiecej tresci/i);
  });
});
