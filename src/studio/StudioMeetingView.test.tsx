import { render, screen } from "@testing-library/react";
import StudioMeetingView from "./StudioMeetingView";
import React from "react";
import { vi } from "vitest";

// Mock dependencies that we don't need to test for basic rendering
vi.mock("./RecorderPanel", () => ({ default: () => <div data-testid="recorder-panel" /> }));
vi.mock("./StudioSidebar", () => ({ default: () => <div data-testid="studio-sidebar" /> }));
vi.mock("./AiTaskSuggestionsPanel", () => ({ default: () => <div data-testid="ai-task-suggestions" /> }));
vi.mock("../context/MeetingsContext", () => ({
  useMeetingsCtx: () => ({ meetings: { updateMeeting: vi.fn() } }),
}));
vi.mock("../services/config", () => ({
  remoteApiEnabled: () => false,
}));

describe("StudioMeetingView", () => {
  const defaultProps = {
    selectedMeeting: { id: "m1", title: "Test Meeting", tags: [], needs: [], concerns: [] },
    displayRecording: { transcript: [], duration: 60 },
    studioAnalysis: { summary: "", decisions: [], actionItems: [] },
    isRecording: false,
    analysisStatus: "idle",
    activeQueueItem: null,
    selectedMeetingQueue: null,
    elapsed: 0,
    visualBars: [],
    stopRecording: vi.fn(),
    startRecording: vi.fn(),
    retryRecordingQueueItem: vi.fn(),
    recordPermission: "granted",
    speechRecognitionSupported: true,
    liveText: "",
    liveTranscriptEnabled: false,
    setLiveTranscriptEnabled: vi.fn(),
    recordingMessage: "",
    pipelineProgressPercent: 0,
    pipelineStageLabel: "",
    setRecordingMessage: vi.fn(),
    selectedRecording: null,
    displaySpeakerNames: {},
    selectedRecordingAudioUrl: null,
    selectedRecordingAudioError: "",
    selectedRecordingId: null,
    setSelectedRecordingId: vi.fn(),
    exportTranscript: vi.fn(),
    exportMeetingNotes: vi.fn(),
    exportMeetingPdfFile: vi.fn(),
    startNewMeetingDraft: vi.fn(),
    selectMeeting: vi.fn(),
    currentWorkspacePermissions: { canEditMeeting: true, canRecordAudio: true, canExportWorkspaceData: true, canEditWorkspace: true },
    currentWorkspaceRole: "owner",
    currentWorkspace: { id: "w1", name: "Work" },
    userMeetings: [],
    meetingTasks: [],
    onCreateTask: vi.fn(),
    peopleProfiles: [],
    addMeetingComment: vi.fn(),
    currentUserName: "User",
    meetingDraft: { title: "" },
    setMeetingDraft: vi.fn(),
    saveMeeting: vi.fn(),
    renameSpeaker: vi.fn(),
    updateTranscriptSegment: vi.fn(),
    briefOpen: true,
    setBriefOpen: vi.fn(),
    setActiveTab: vi.fn(),
  };

  test("renders without crashing", () => {
    render(<StudioMeetingView {...defaultProps} />);
    expect(screen.getByText(/Test Meeting/i)).toBeInTheDocument();
  });

  test("renders the player bar when there is a message or recording", () => {
    const props = { ...defaultProps, recordingMessage: "Test Message", analysisStatus: "error" };
    render(<StudioMeetingView {...props} />);
    expect(screen.getByText(/Test Message/i)).toBeInTheDocument();
  });

  test("renders empty state when no meeting selected", () => {
    const props = { ...defaultProps, selectedMeeting: null };
    render(<StudioMeetingView {...props} />);
    const els = screen.getAllByText(/Brak aktywnego spotkania/i);
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  test("renders analysis tabs", () => {
    render(<StudioMeetingView {...defaultProps} />);
    expect(screen.getAllByText(/Podsumowanie spotkania/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Potrzeby i obawy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Profil psychologiczny/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Twój feedback/i).length).toBeGreaterThan(0);
  });

  test("renders toolbar buttons", () => {
    render(<StudioMeetingView {...defaultProps} />);
    expect(screen.getByText(/Notatki/i)).toBeInTheDocument();
    expect(screen.getByText(/Transkrypt/i)).toBeInTheDocument();
    expect(screen.getByText(/Rozpocznij nagrywanie/i)).toBeInTheDocument();
  });

  test("shows recording controls when isRecording is true", () => {
    const props = { ...defaultProps, isRecording: true };
    render(<StudioMeetingView {...props} />);
    expect(screen.getByText(/Stop/i)).toBeInTheDocument();
    expect(screen.getByText(/● REC/i)).toBeInTheDocument();
  });
});
