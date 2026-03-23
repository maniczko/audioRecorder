import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    onCreateMeeting: jest.fn(async (draft) => ({
      id: "meeting_import",
      title: draft.title,
      startsAt: draft.startsAt,
      durationMinutes: 30,
      recordings: [],
    })),
    queueRecording: jest.fn(async () => "rec_import"),
    recordingQueue: [],
    activeQueueItem: null,
    analysisStatus: "idle",
    recordingMessage: "",
    pipelineProgressPercent: 0,
    pipelineStageLabel: "",
    retryRecordingQueueItem: jest.fn(),
    retryStoredRecording: jest.fn(),
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

  test("shows pipeline diagnostics for selected meeting latest recording", () => {
    render(
      <RecordingsTab
        {...defaultProps}
        selectedMeeting={{
          ...mockMeetings[0],
          latestRecordingId: "rec_1",
          recordings: [
            {
              id: "rec_1",
              createdAt: "2026-03-18T10:00:00Z",
              duration: 2700,
              speakerCount: 2,
              transcript: [{}, {}],
              pipelineGitSha: "abc1234",
              transcriptOutcome: "empty",
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/Pipeline: empty transcript · Build: abc1234/i)).toBeInTheDocument();
  });

  test("calls selectMeeting and setActiveTab when a meeting is clicked in the table", () => {
    render(<RecordingsTab {...defaultProps} />);
    const meetingRow = screen.getByText("Project Alpha");
    fireEvent.click(meetingRow);
    
    expect(defaultProps.selectMeeting).toHaveBeenCalledWith(mockMeetings[1]);
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith("studio");
  });

  test("shows retry action for selected meeting with empty transcript", () => {
    const selectedMeeting = {
      ...mockMeetings[0],
      latestRecordingId: "rec_1",
      recordings: [
        {
          id: "rec_1",
          createdAt: "2026-03-18T10:00:00Z",
          duration: 2700,
          speakerCount: 2,
          transcript: [],
          transcriptOutcome: "empty",
          emptyReason: "no_segments_from_stt",
          transcriptionDiagnostics: { chunksWithText: 0, chunksAttempted: 2 },
        },
      ],
    };

    render(<RecordingsTab {...defaultProps} selectedMeeting={selectedMeeting} />);

    fireEvent.click(screen.getByRole("button", { name: /Ponow transkrypcje/i }));
    expect(defaultProps.retryStoredRecording).toHaveBeenCalledWith(selectedMeeting, selectedMeeting.recordings[0]);
    expect(screen.getByText(/Chunki z tekstem: 0\/2/i)).toBeInTheDocument();
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

  test("shows pending imported file in recordings list with queue status", () => {
    render(
      <RecordingsTab
        {...defaultProps}
        activeQueueItem={{ recordingId: "rec_pending" }}
        pipelineProgressPercent={42}
        pipelineStageLabel="Wgrywanie audio na serwer"
        recordingMessage="Wgrywanie nagrania na serwer..."
        recordingQueue={[
          {
            recordingId: "rec_pending",
            meetingTitle: "Import: demo-call",
            status: "uploading",
            createdAt: "2026-03-21T10:00:00.000Z",
            errorMessage: "",
            pipelineGitSha: "abc1234",
          },
        ]}
      />
    );

    expect(screen.getByText(/Pliki wgrywane i przetwarzane/i)).toBeInTheDocument();
    expect(screen.getByText("Import: demo-call")).toBeInTheDocument();
    expect(screen.getByText(/Wgrywanie audio na serwer \(42%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Build: abc1234/i)).toBeInTheDocument();
  });

  test("shows retry action and diagnostics for failed queued item", () => {
    render(
      <RecordingsTab
        {...defaultProps}
        recordingQueue={[
          {
            recordingId: "rec_failed",
            meetingTitle: "Import: failed-call",
            status: "failed",
            createdAt: "2026-03-21T10:00:00.000Z",
            errorMessage: "Backend jest chwilowo niedostepny. Sprobuj ponownie za chwile.",
            pipelineGitSha: "def5678",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /ponownie/i }));
    expect(defaultProps.retryRecordingQueueItem).toHaveBeenCalledWith("rec_failed");
    expect(screen.getByText(/Build: def5678/i)).toBeInTheDocument();
  });

  test("queues imported file immediately after selecting it", async () => {
    render(<RecordingsTab {...defaultProps} />);

    const input = screen.getByTestId("recordings-file-input");
    const file = new File(["audio"], "demo-call.webm", { type: "audio/webm" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(defaultProps.onCreateMeeting).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Import: demo-call",
        })
      );
    });
    await waitFor(() => {
      expect(defaultProps.queueRecording).toHaveBeenCalledWith("meeting_import", file);
    });
  });
});
