import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      tags: "tag1, tag2",
      needs: "",
      desiredOutputs: "",
      location: "",
    },
    setMeetingDraft: jest.fn(),
    startNewMeetingDraft: jest.fn(),
    saveMeeting: jest.fn(),
    clearMeetingDraft: jest.fn(),
    peopleOptions: ["Charlie", "Dana"],
    tagOptions: ["urgent", "review"],
    userMeetings: [
      { id: "m1", title: "Meeting 1", createdAt: "2026-03-09T00:00:00Z", recordings: [{ id: "r1", createdAt: "2026-03-09T00:00:00Z", duration: 100, pipelineStatus: "done" }] },
      { id: "m2", title: "Meeting 2", createdAt: "2026-03-10T00:00:00Z", recordings: Array.from({ length: 6 }).map((_, i) => ({ id: `r2_${i}`, createdAt: `2026-03-10T00:00:0${i}Z`, duration: 200, pipelineStatus: "processing" })) },
    ],
    selectedMeeting: { id: "m1" },
    selectedRecordingId: "r1",
    selectMeeting: jest.fn(),
    setSelectedRecordingId: jest.fn(),
  };

  test("renders StudioSidebar and handles basic inputs", async () => {
    render(<StudioSidebar {...defaultProps} />);
    
    // Check elements
    expect(screen.getByText("Edytuj spotkanie")).toBeInTheDocument();
    
    // Tab switching
    await userEvent.click(screen.getByRole("button", { name: "Szczegóły" }));
    expect(screen.getByText("Potrzeby rozmówców")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Podstawowe" }));
    
    // Title input
    const titleInput = screen.getByDisplayValue("Test Meeting");
    await userEvent.type(titleInput, " modified");
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();
    
    // Tag input and suggestions
    const tagInput = screen.getByPlaceholderText("Dodaj tag...");
    await userEvent.type(tagInput, "urg");
    
    // Should show "urgent" suggestion
    const urgentOption = await screen.findByRole("button", { name: "urgent" });
    fireEvent.mouseDown(urgentOption);
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();
    
    // Attendee remove
    const removeAliceBtn = screen.getAllByRole("button", { name: "×" })[0];
    await userEvent.click(removeAliceBtn);
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();
    
    // Attendee input
    const attendeeInput = screen.getByPlaceholderText("Dodaj uczestnika...");
    await userEvent.type(attendeeInput, "Char");
    const charlieOption = await screen.findByRole("button", { name: "Charlie" });
    fireEvent.mouseDown(charlieOption);
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();

    // Duration picker custom
    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "15");
    expect(defaultProps.setMeetingDraft).toHaveBeenCalled();
  });

  test("handles recordings sidebar", async () => {
    // Because m2 has 6 recordings + m1 has 1 = 7 total -> Search bar will show > 5
    render(<StudioSidebar {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText("Szukaj nagrania…");
    await userEvent.type(searchInput, "Meeting 1");
    
    // Select the filtered recording
    const recItem = screen.getAllByText("Meeting 1")[0];
    fireEvent.click(recItem);
    expect(defaultProps.selectMeeting).toHaveBeenCalled();
    expect(defaultProps.setSelectedRecordingId).toHaveBeenCalled();
  });
});
