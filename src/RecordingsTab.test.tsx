import { render, screen, fireEvent } from "@testing-library/react";
import RecordingsTab from "./RecordingsTab";

describe("RecordingsTab", () => {
  const mockMeetings = [
    {
      id: "meeting_1",
      title: "Weekly Sync",
      startsAt: "2026-03-18T10:00:00Z",
      durationMinutes: 45,
      recordings: [
        { id: "rec_1", createdAt: "2026-03-18T10:00:00Z", duration: 2700, speakerCount: 2, transcript: [{}, {}] }
      ]
    },
    {
      id: "meeting_2",
      title: "Project Alpha",
      startsAt: "2026-03-17T14:30:00Z",
      durationMinutes: 30,
      recordings: []
    }
  ];

  const defaultProps = {
    userMeetings: mockMeetings,
    selectedMeeting: null,
    selectMeeting: jest.fn(),
    startNewMeetingDraft: jest.fn(),
    selectedRecordingId: "",
    setSelectedRecordingId: jest.fn(),
    setActiveTab: jest.fn(),
    analysisStatus: "idle",
    recordingMessage: "",
    pipelineProgressPercent: 0,
    pipelineStageLabel: "",
  };

  test("renders empty state when no meetings are provided", () => {
    render(<RecordingsTab {...defaultProps} userMeetings={[]} />);
    expect(screen.getByText(/Brak spotkań spełniających kryteria/i)).toBeInTheDocument();
  });

  test("renders list of meetings and recordings", () => {
    render(<RecordingsTab {...defaultProps} />);
    expect(screen.getAllByText("Weekly Sync")[0]).toBeInTheDocument();
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    
    // Filters should be displayed
    const tagFilter = screen.getByText("Wszystkie tagi");
    expect(tagFilter).toBeInTheDocument();
  });

  test("calls selectMeeting and setActiveTab when a meeting is clicked in the table", () => {
    render(<RecordingsTab {...defaultProps} />);
    const meetingRow = screen.getByText("Project Alpha");
    fireEvent.click(meetingRow);
    
    expect(defaultProps.selectMeeting).toHaveBeenCalledWith(mockMeetings[1]);
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith("studio");
  });

  test("opens meeting picker and filters results", () => {
    render(<RecordingsTab {...defaultProps} />);
    
    // Open picker
    const changeBtn = screen.getByText(/Zmień/i);
    fireEvent.click(changeBtn);
    
    const searchInput = screen.getByPlaceholderText(/Szukaj spotkania/i);
    fireEvent.change(searchInput, { target: { value: "Weekly" } });
    
    expect(screen.getAllByText("Weekly Sync")[0]).toBeInTheDocument();
    // "Project Alpha" should be filtered out from the DROPDOWN list (but not necessarily from the table which is separate)
    // Actually the dropdown uses 'filtered' variable.
    // Let's check the items inside the dropdown.
    const items = screen.getAllByRole("button").filter(b => b.className.includes("studio-picker-item"));
    expect(items.length).toBe(1);
    expect(items[0]).toHaveTextContent("Weekly Sync");
  });

  test("renders real recording pipeline progress when background processing is active", () => {
    render(
      <RecordingsTab
        {...defaultProps}
        analysisStatus="processing"
        recordingMessage="Audio przeslane. Oczekiwanie na przetwarzanie..."
        pipelineProgressPercent={64}
        pipelineStageLabel="Serwer przygotowuje transkrypcje"
      />
    );

    expect(screen.getByText(/Status przetwarzania nagrania/i)).toBeInTheDocument();
    expect(screen.getByText(/Serwer przygotowuje transkrypcje \(64%\)/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /Postep przetwarzania nagrania/i })).toBeInTheDocument();
  });
});
