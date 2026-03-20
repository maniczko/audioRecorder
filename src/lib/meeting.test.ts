import { describe, it, expect } from "vitest";
import { 
  parseList, 
  createMeeting, 
  meetingToDraft, 
} from "./meeting";

describe("meeting lib", () => {
  describe("parseList", () => {
    it("should parse comma-separated strings", () => {
      expect(parseList("one, two, three")).toEqual(["one", "two", "three"]);
    });
    it("should parse newline-separated strings", () => {
      expect(parseList("one\ntwo\nthree")).toEqual(["one", "two", "three"]);
    });
    it("should handle empty or null values", () => {
      expect(parseList("")).toEqual([]);
      expect(parseList(null)).toEqual([]);
    });
  });

  describe("createMeeting", () => {
    it("should create a meeting with defaults", () => {
      const meeting = createMeeting("u1", { title: "Test" });
      expect(meeting.title).toBe("Test");
      expect(meeting.durationMinutes).toBe(45);
      expect(meeting.attendees).toEqual([]);
    });

    it("should respect draft values", () => {
      const draft = { 
        title: "Daily",
        attendees: "Anna, Mark",
        durationMinutes: 15
      };
      const meeting = createMeeting("u1", draft);
      expect(meeting.title).toBe("Daily");
      expect(meeting.attendees).toEqual(["Anna", "Mark"]);
      expect(meeting.durationMinutes).toBe(15);
    });
  });

  describe("meetingToDraft", () => {
    it("should convert a meeting back to a draft for the UI", () => {
      const meeting = {
        title: "Strategic Session",
        attendees: ["A", "B"],
        startsAt: "2026-03-20T10:00:00.000Z",
        durationMinutes: 60,
      };
      const draft = meetingToDraft(meeting as any);
      expect(draft.title).toBe("Strategic Session");
      expect(draft.attendees).toBe("A\nB");
    });
  });
});
