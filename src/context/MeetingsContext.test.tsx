import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MeetingsProvider, useMeetingsCtx } from "./MeetingsContext";

const mockMeetings = {
  userMeetings: [{ id: "m1", title: "Demo meeting" }],
  createAdHocMeeting: vi.fn(() => ({ id: "m2" })),
  selectedMeetingId: "m1",
};

vi.mock("../hooks/useMeetings", () => ({
  default: () => mockMeetings,
}));

describe("MeetingsContext", () => {
  test("provides meetings hook result to descendants", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <MeetingsProvider>{children}</MeetingsProvider>;
    const { result } = renderHook(() => useMeetingsCtx(), { wrapper });

    expect(result.current.meetings).toBe(mockMeetings);
    expect(result.current.meetings.userMeetings).toHaveLength(1);
    expect(result.current.meetings.selectedMeetingId).toBe("m1");
  });
});
