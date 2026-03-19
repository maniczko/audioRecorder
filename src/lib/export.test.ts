import { buildMeetingNotesText, slugifyExportTitle } from "./export";

describe("export helpers", () => {
  test("builds meeting notes with key sections", () => {
    const notes = buildMeetingNotesText(
      {
        title: "Kickoff klienta",
        startsAt: "2026-03-14T10:00:00.000Z",
        tags: ["klient", "wdrozenie"],
        needs: ["Budzet"],
        desiredOutputs: ["Plan dzialania"],
      },
      {
        summary: "Ustalono zakres pierwszej fazy.",
        decisions: ["Start w kwietniu"],
        actionItems: ["Anna przygotuje harmonogram"],
      },
      () => "14 mar 2026, 11:00"
    );

    expect(notes).toContain("Spotkanie: Kickoff klienta");
    expect(notes).toContain("Tagi: klient, wdrozenie");
    expect(notes).toContain("Podsumowanie:");
    expect(notes).toContain("- Start w kwietniu");
    expect(notes).toContain("- Anna przygotuje harmonogram");
  });

  test("slugifies export titles and falls back safely", () => {
    expect(slugifyExportTitle("Demo / Q2 Review")).toBe("demo-q2-review");
    expect(slugifyExportTitle("   ")).toBe("meeting");
  });
});
