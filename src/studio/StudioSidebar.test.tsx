import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import StudioSidebar from "./StudioSidebar";

describe("StudioSidebar", () => {
  const defaultProps = {
    currentWorkspacePermissions: { canEditWorkspace: true },
    isDetachedMeetingDraft: false,
    meetingDraft: {
      title: "Test Meeting",
      context: "",
      startsAt: "2026-03-10T10:00:00Z",
      durationMinutes: 30,
      attendees: "Alice\nBob",
      tags: "",
      needs: "",
      desiredOutputs: "",
      location: "",
    },
    setMeetingDraft: vi.fn(),
    startNewMeetingDraft: vi.fn(),
    saveMeeting: vi.fn(),
    clearMeetingDraft: vi.fn(),
    peopleOptions: ["Charlie", "Dana"],
    tagOptions: ["urgent", "review"],
    userMeetings: [
      {
        id: "m1",
        title: "Meeting 1",
        createdAt: "2026-03-09T00:00:00Z",
        recordings: [{ id: "r1", createdAt: "2026-03-09T00:00:00Z", duration: 100, pipelineStatus: "done" }],
      },
      {
        id: "m2",
        title: "Meeting 2",
        createdAt: "2026-03-10T00:00:00Z",
        recordings: Array.from({ length: 6 }).map((_, index) => ({
          id: `r2_${index}`,
          createdAt: `2026-03-10T00:00:0${index}Z`,
          duration: 200,
          pipelineStatus: "processing",
        })),
      },
    ],
    selectedMeeting: { id: "m1" },
    selectedRecordingId: "r1",
    selectMeeting: vi.fn(),
    setSelectedRecordingId: vi.fn(),
  };

  test("renders StudioSidebar and handles basic inputs", async () => {
    render(<StudioSidebar {...defaultProps} />);

    expect(screen.getByText("Edytuj spotkanie")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Szczeg/ }));
    expect(screen.getByText(/Potrzeby rozm/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Podstawowe" }));

    fireEvent.change(screen.getByDisplayValue("Test Meeting"), {
      target: { value: "Test Meeting modified" },
    });
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();

    const tagInput = screen.getByPlaceholderText("Dodaj tag...");
    fireEvent.focus(tagInput);
    fireEvent.change(tagInput, { target: { value: "urg" } });
    fireEvent.mouseDown(await screen.findByRole("button", { name: /urgent/i }));
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("button", { name: "×" })[0]);
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Dodaj uczestnika..."), {
      target: { value: "Char" },
    });
    fireEvent.mouseDown(await screen.findByRole("button", { name: "Charlie" }));
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "15" } });
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();
  });

  test("handles recordings sidebar", () => {
    render(<StudioSidebar {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/Szukaj nagrania/), {
      target: { value: "Meeting 1" },
    });

    fireEvent.click(screen.getAllByText("Meeting 1")[0]);
    expect(defaultProps.selectMeeting).toHaveBeenCalled();
    expect(defaultProps.setSelectedRecordingId).toHaveBeenCalled();
  });
});
