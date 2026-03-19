import { render, screen } from "@testing-library/react";
import StudioMeetingView from "./StudioMeetingView";
import React from "react";

// Mock dependencies that we don't need to test for basic rendering
jest.mock("./RecorderPanel", () => () => <div data-testid="recorder-panel" />);
jest.mock("./StudioSidebar", () => () => <div data-testid="studio-sidebar" />);

describe("StudioMeetingView", () => {
  const defaultProps = {
    selectedMeeting: { id: "m1", title: "Test Meeting", tags: [] },
    displayRecording: { transcript: [], duration: 60 },
    studioAnalysis: { summary: "", decisions: [], actionItems: [] },
    isRecording: false,
    analysisStatus: "idle",
    activeQueueItem: null,
    selectedMeetingQueue: [],
    elapsed: 0,
    visualBars: [],
    stopRecording: jest.fn(),
    startRecording: jest.fn(),
    retryRecordingQueueItem: jest.fn(),
    recordPermission: "granted",
    speechRecognitionSupported: true,
    liveText: "",
    liveTranscriptEnabled: false,
    setLiveTranscriptEnabled: jest.fn(),
    recordingMessage: "",
    setRecordingMessage: jest.fn(), // This was missing and caused a crash
    selectedRecording: null,
    displaySpeakerNames: {},
    selectedRecordingAudioUrl: null,
    selectedRecordingAudioError: "",
    selectedRecordingId: null,
    setSelectedRecordingId: jest.fn(),
    exportTranscript: jest.fn(),
    exportMeetingNotes: jest.fn(),
    exportMeetingPdfFile: jest.fn(),
    startNewMeetingDraft: jest.fn(),
    selectMeeting: jest.fn(),
    currentWorkspacePermissions: { canEditMeeting: true },
    currentWorkspaceRole: "owner",
    currentWorkspace: { id: "w1", name: "Work" },
    userMeetings: [],
    meetingTasks: [],
    onCreateTask: jest.fn(),
    peopleProfiles: [],
    addMeetingComment: jest.fn(),
    currentUserName: "User",
    meetingDraft: { title: "" },
    setMeetingDraft: jest.fn(),
    saveMeeting: jest.fn(),
    renameSpeaker: jest.fn(),
    updateTranscriptSegment: jest.fn(),
    briefOpen: true,
    setBriefOpen: jest.fn(),
    setActiveTab: jest.fn(),
  };

  test("renders without crashing", () => {
    render(<StudioMeetingView {...defaultProps} />);
    // Check for some header text
    expect(screen.getByText(/Test Meeting/i)).toBeInTheDocument();
  });

  test("renders the player bar when there is a message or recording", () => {
    const props = { ...defaultProps, recordingMessage: "Test Message", analysisStatus: "error" };
    render(<StudioMeetingView {...props} />);
    expect(screen.getByText(/Test Message/i)).toBeInTheDocument();
  });
});
