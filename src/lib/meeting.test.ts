import { describe, expect, test } from "vitest";
import { attachRecording, buildMeetingAIDebrief, createMeeting } from "./meeting";

describe("meeting ai debrief", () => {
  test("buildMeetingAIDebrief composes a concise debrief from analysis data", () => {
    const debrief = buildMeetingAIDebrief(
      { title: "Sprint review" },
      {
        summary: "Spotkanie przebiegło sprawnie.",
        decisions: ["Dostarczamy wersję 1", "Ownerem jest Asia"],
        risks: [{ risk: "Ryzyko opóźnienia" }],
        followUps: ["Dopięcie QA", "Publikacja changelogu"],
        actionItems: ["Zebrać feedback"],
      }
    );

    expect(debrief.summary).toContain("Spotkanie przebiegło sprawnie.");
    expect(debrief.summary).toContain("Kluczowe decyzje");
    expect(debrief.decisions).toHaveLength(2);
    expect(debrief.risks).toHaveLength(1);
    expect(debrief.followUps).toHaveLength(3);
    expect(debrief.actionItems).toHaveLength(1);
  });

  test("attachRecording persists aiDebrief on the meeting", () => {
    const meeting = createMeeting("u1", { title: "Weekly sync" }, { workspaceId: "ws1" });
    const next = attachRecording(meeting, {
      id: "r1",
      analysis: {
        summary: "Dobre spotkanie.",
        decisions: ["Decyzja 1"],
        risks: [],
        followUps: ["Krok 1"],
        actionItems: ["Akcja 1"],
      },
      speakerNames: { "0": "Anna" },
      speakerCount: 1,
    });

    expect(next.aiDebrief).toBeDefined();
    expect(next.aiDebrief.summary).toContain("Dobre spotkanie.");
    expect(next.aiDebrief.decisions).toEqual(["Decyzja 1"]);
    expect(next.aiDebrief.followUps).toEqual(["Krok 1", "Akcja 1"]);
  });
});
