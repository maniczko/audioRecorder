import { describe, expect, test } from "vitest";
import type { AiPersonProfileResponse, AiSuggestTasksResponse } from "./contracts";
import {
  normalizeMediaTranscriptionResponse,
  normalizeTranscriptionStatusPayload,
  normalizeWorkspaceState,
  serializeWorkspaceState,
} from "./contracts";

describe("shared contracts", () => {
  test("normalizes workspace state with safe defaults", () => {
    expect(
      normalizeWorkspaceState({
        meetings: [{ id: "m1" }],
        vocabulary: ["crm"],
        updatedAt: "2026-03-23T10:00:00.000Z",
      })
    ).toEqual({
      meetings: [{ id: "m1" }],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: ["crm"],
      updatedAt: "2026-03-23T10:00:00.000Z",
    });
  });

  test("serializes workspace state into a stable json snapshot", () => {
    expect(
      serializeWorkspaceState({
        meetings: [{ id: "m1" }],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
      })
    ).toBe(
      JSON.stringify({
        meetings: [{ id: "m1" }],
        manualTasks: [],
        taskState: {},
        taskBoards: {},
        calendarMeta: {},
        vocabulary: [],
        updatedAt: "",
      })
    );
  });

  test("normalizes transcription status payloads from storage rows", () => {
    expect(
      normalizeTranscriptionStatusPayload({
        id: "rec1",
        transcription_status: "completed",
        transcript_json: JSON.stringify([{ id: "seg1", text: "hello" }]),
        diarization_json: JSON.stringify({
          transcriptOutcome: "normal",
          speakerCount: 1,
          speakerNames: { "0": "Anna" },
        }),
        updated_at: "2026-03-23T11:00:00.000Z",
      } as any)
    ).toMatchObject({
      recordingId: "rec1",
      pipelineStatus: "done",
      segments: [{ id: "seg1", text: "hello" }],
      speakerNames: { "0": "Anna" },
      speakerCount: 1,
      updatedAt: "2026-03-23T11:00:00.000Z",
    });
  });

  test("AiSuggestTasksResponse has the correct shape", () => {
    const response: AiSuggestTasksResponse = {
      tasks: [
        { title: "Finish report", owner: "Alice", priority: "high", tags: ["report"], dueDate: "2026-03-27" },
        { title: "Design review", owner: null, priority: "medium", tags: [], description: "review design" },
      ],
    };
    expect(response.tasks).toHaveLength(2);
    expect(response.tasks[0].title).toBe("Finish report");
    expect(response.tasks[1].owner).toBeNull();
  });

  test("AiPersonProfileResponse accepts anthropic mode with full DISC", () => {
    const profile: AiPersonProfileResponse = {
      mode: "anthropic",
      disc: { D: 70, I: 50, S: 40, C: 80 },
      discStyle: "DC — dominujący analityk",
      workingWithTips: ["Przedstawiaj fakty", "Dawaj czas na analizę"],
      meetingsAnalyzed: 3,
      generatedAt: "2026-03-23T00:00:00.000Z",
    };
    expect(profile.disc?.D).toBe(70);
    expect(profile.workingWithTips).toHaveLength(2);
  });

  test("AiPersonProfileResponse accepts no-key fallback mode", () => {
    const profile: AiPersonProfileResponse = { mode: "no-key" };
    expect(profile.mode).toBe("no-key");
    expect(profile.disc).toBeUndefined();
  });

  test("normalizes remote transcription responses through the same contract shape", () => {
    expect(
      normalizeMediaTranscriptionResponse({
        recordingId: "rec2",
        pipelineStatus: "queued",
        segments: [{ id: "seg2", text: "hi" }],
        diarization: {
          transcriptOutcome: "empty",
          emptyReason: "no_segments_from_stt",
          speakerCount: 2,
        },
        userMessage: "Brak wypowiedzi.",
      } as any)
    ).toMatchObject({
      recordingId: "rec2",
      pipelineStatus: "queued",
      transcriptOutcome: "empty",
      emptyReason: "no_segments_from_stt",
      userMessage: "Brak wypowiedzi.",
    });
  });
});
