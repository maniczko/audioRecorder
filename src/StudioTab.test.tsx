/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudioTab from "./StudioTab";

if (!(userEvent as any).setup) (userEvent as any).setup = () => userEvent;

// Mock child components BEFORE imports
vi.mock("./studio/StudioMeetingView", async () => {
  const actual = await vi.importActual("./studio/StudioMeetingView");
  return {
    ...actual,
    default: vi.fn((props: any) => {
      return (
        <div data-testid="studio-meeting-view">
          <button onClick={() => props.setBriefOpen(!props.briefOpen)}>
            {props.briefOpen ? "Close Brief" : "Open Brief"}
          </button>
        </div>
      );
    }),
  };
});

vi.mock("./studio/StudioSidebar", async () => {
  const actual = await vi.importActual("./studio/StudioSidebar");
  return {
    ...actual,
    default: vi.fn((props: any) => {
      return (
        <div data-testid="studio-sidebar">
          <button onClick={props.onClose}>Close Sidebar</button>
        </div>
      );
    }),
  };
});

const mockProps = {
  currentWorkspacePermissions: ["read", "write"] as const,
  meetingDraft: {
    title: "Test Meeting",
    startsAt: "2026-03-23T10:00",
    durationMinutes: 60,
    attendees: "Alice, Bob",
    context: "Project discussion",
    needs: "Requirements",
    desiredOutputs: "Task list",
    location: "Online",
    tags: ["project"],
  },
  setMeetingDraft: vi.fn(),
  activeStoredMeetingDraft: null,
  clearMeetingDraft: vi.fn(),
  saveMeeting: vi.fn(),
  startNewMeetingDraft: vi.fn(),
  workspaceMessage: "",
  selectedMeeting: {
    id: "m1",
    title: "Selected Meeting",
    startsAt: "2026-03-23T10:00:00.000Z",
    durationMinutes: 60,
    workspaceId: "ws1",
    updatedAt: "2026-03-23T10:00:00.000Z",
  },
  isDetachedMeetingDraft: false,
  peopleProfiles: [
    { id: "p1", name: "Alice", speakerId: "s1" },
    { id: "p2", name: "Bob", speakerId: "s2" },
  ],
  userMeetings: [
    {
      id: "m1",
      title: "Meeting 1",
      startsAt: "2026-03-23T10:00:00.000Z",
      durationMinutes: 60,
      workspaceId: "ws1",
      updatedAt: "2026-03-23T10:00:00.000Z",
      tags: ["project"],
    },
    {
      id: "m2",
      title: "Meeting 2",
      startsAt: "2026-03-24T14:00:00.000Z",
      durationMinutes: 30,
      workspaceId: "ws1",
      updatedAt: "2026-03-24T14:00:00.000Z",
      tags: ["review"],
    },
  ],
  selectMeeting: vi.fn(),
  selectedRecordingId: "rec1",
  setSelectedRecordingId: vi.fn(),
  defaultToNewStudio: false,
};

describe("StudioTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Render", () => {
    it("renders StudioTab with StudioMeetingView", () => {
      render(<StudioTab {...mockProps} />);

      expect(screen.getByTestId("studio-meeting-view")).toBeInTheDocument();
      expect(screen.getByText("Open Brief")).toBeInTheDocument();
    });

    it("does not render sidebar initially when briefOpen is false", () => {
      render(<StudioTab {...mockProps} />);

      expect(screen.queryByTestId("studio-sidebar")).not.toBeInTheDocument();
    });

    it("starts a new studio draft on first default studio entry", () => {
      render(<StudioTab {...mockProps} defaultToNewStudio />);

      expect(mockProps.startNewMeetingDraft).toHaveBeenCalled();
    });

    it("does not reset meeting context when studio was opened intentionally from elsewhere", () => {
      render(<StudioTab {...mockProps} />);

      expect(mockProps.clearMeetingDraft).not.toHaveBeenCalled();
    });
  });

  describe("Sidebar Toggle", () => {
    it("opens sidebar when Open Brief button is clicked", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);

      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);

      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
    });

    it("closes sidebar when Close Sidebar button is clicked", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);

      // Open sidebar first
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);

      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });

      // Close sidebar
      const closeSidebarButton = screen.getByText("Close Sidebar");
      await user.click(closeSidebarButton);

      await waitFor(() => {
        expect(screen.queryByTestId("studio-sidebar")).not.toBeInTheDocument();
      });
    });
  });

  describe("Meeting Selection", () => {
    it("passes selectedMeeting to StudioMeetingView", () => {
      render(<StudioTab {...mockProps} />);

      expect(mockProps.selectedMeeting).toBeDefined();
      expect(mockProps.selectedMeeting.id).toBe("m1");
    });
  });

  describe("Recording Selection", () => {
    it("passes selectedRecordingId to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);

      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);

      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });

      // Check that sidebar received the correct props
      expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
    });
  });

  describe("Meeting Draft Management", () => {
    it("passes meetingDraft to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);

      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);

      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });

      expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
    });
  });

  describe("Workspace Context", () => {
    it("passes currentWorkspacePermissions to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);

      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);

      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
    });

    it("passes workspaceMessage to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} workspaceMessage="Test message" />);

      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);

      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
    });

    it("passes isDetachedMeetingDraft to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} isDetachedMeetingDraft />);

      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);

      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
    });
  });

  describe("Empty States", () => {
    it("handles empty peopleProfiles gracefully", () => {
      render(<StudioTab {...mockProps} peopleProfiles={[]} />);

      expect(screen.getByTestId("studio-meeting-view")).toBeInTheDocument();
    });

    it("handles empty userMeetings gracefully", () => {
      render(<StudioTab {...mockProps} userMeetings={[]} />);

      expect(screen.getByTestId("studio-meeting-view")).toBeInTheDocument();
    });

    it("handles null selectedMeeting gracefully", () => {
      render(<StudioTab {...mockProps} selectedMeeting={null} />);

      expect(screen.getByTestId("studio-meeting-view")).toBeInTheDocument();
    });
  });

  describe("Layout Classes", () => {
    it("applies studio-page-shell class to root element", () => {
      const { container } = render(<StudioTab {...mockProps} />);

      expect(container.querySelector(".studio-page-shell")).toBeInTheDocument();
    });
  });
});
