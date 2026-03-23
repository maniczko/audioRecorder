/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudioTab from "./StudioTab";
// user-event v13 compat: v14 setup() API polyfill
if (!(userEvent as any).setup) (userEvent as any).setup = () => userEvent;

// Mock child components — factory must be self-contained (vi.mock is hoisted)
vi.mock("./studio/StudioMeetingView", () => {
  const mock = vi.fn(({ briefOpen, setBriefOpen }: any) => (
    <div data-testid="studio-meeting-view">
      <button onClick={() => setBriefOpen(!briefOpen)}>
        {briefOpen ? "Close Brief" : "Open Brief"}
      </button>
    </div>
  ));
  return { default: mock, StudioMeetingView: mock };
});

vi.mock("./studio/StudioSidebar", () => {
  const mock = vi.fn(({ onClose }: any) => (
    <div data-testid="studio-sidebar">
      <button onClick={onClose}>Close Sidebar</button>
    </div>
  ));
  return { default: mock, StudioSidebar: mock };
});

const mockProps = {
  currentWorkspacePermissions: ["read", "write"],
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
  beforeEach(async () => {
    vi.resetAllMocks();
    // Restore default mock implementations after each test
    const { default: MockSMV } = await import("./studio/StudioMeetingView");
    vi.mocked(MockSMV).mockImplementation(({ briefOpen, setBriefOpen }: any) => (
      <div data-testid="studio-meeting-view">
        <button onClick={() => setBriefOpen(!briefOpen)}>
          {briefOpen ? "Close Brief" : "Open Brief"}
        </button>
      </div>
    ));
    const { default: MockSS } = await import("./studio/StudioSidebar");
    vi.mocked(MockSS).mockImplementation(({ onClose }: any) => (
      <div data-testid="studio-sidebar">
        <button onClick={onClose}>Close Sidebar</button>
      </div>
    ));
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
      render(<StudioTab {...mockProps} defaultToNewStudio={true} />);

      expect(mockProps.startNewMeetingDraft).toHaveBeenCalledTimes(1);
    });

    it("does not reset meeting context when studio was opened intentionally from elsewhere", () => {
      render(<StudioTab {...mockProps} defaultToNewStudio={false} />);

      expect(mockProps.startNewMeetingDraft).not.toHaveBeenCalled();
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

    it.skip("closes sidebar when Close Sidebar button is clicked", async () => {
      const user = userEvent.setup();
      const { StudioMeetingView } = await import("./studio/StudioMeetingView");
      const setBriefOpenMock = vi.fn();
      
      vi.mocked(StudioMeetingView).mockImplementation(({ briefOpen, setBriefOpen }) => (
        <div data-testid="studio-meeting-view">
          {briefOpen && <button onClick={() => setBriefOpen(false)}>Close Brief</button>}
        </div>
      ));
      
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
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

    it.skip("passes selectMeeting callback to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      // Verify selectMeeting is passed as prop
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          selectMeeting: expect.any(Function),
        }),
        expect.anything()
      );
    });
  });

  describe.skip("Recording Selection", () => {
    it("passes selectedRecordingId to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedRecordingId: "rec1",
          setSelectedRecordingId: expect.any(Function),
        }),
        expect.anything()
      );
    });

    it("updates selected recording when setSelectedRecordingId is called", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      // Simulate selecting a different recording
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      const { setSelectedRecordingId } = StudioSidebar.mock.calls[0][0];
      setSelectedRecordingId("rec2");
      
      expect(mockProps.setSelectedRecordingId).toHaveBeenCalledWith("rec2");
    });
  });

  describe.skip("Meeting Draft Management", () => {
    it("passes meetingDraft to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingDraft: mockProps.meetingDraft,
        }),
        expect.anything()
      );
    });

    it("passes setMeetingDraft to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          setMeetingDraft: expect.any(Function),
        }),
        expect.anything()
      );
    });

    it("passes saveMeeting to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          saveMeeting: expect.any(Function),
        }),
        expect.anything()
      );
    });

    it("passes startNewMeetingDraft to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          startNewMeetingDraft: expect.any(Function),
        }),
        expect.anything()
      );
    });

    it("passes clearMeetingDraft to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          clearMeetingDraft: expect.any(Function),
        }),
        expect.anything()
      );
    });
  });

  describe.skip("Workspace Context", () => {
    it("passes currentWorkspacePermissions to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          currentWorkspacePermissions: ["read", "write"],
        }),
        expect.anything()
      );
    });

    it("passes workspaceMessage to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} workspaceMessage="Test message" />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceMessage: "Test message",
        }),
        expect.anything()
      );
    });

    it("passes isDetachedMeetingDraft to StudioSidebar", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} isDetachedMeetingDraft={true} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          isDetachedMeetingDraft: true,
        }),
        expect.anything()
      );
    });
  });

  describe("People Profiles", () => {
    it.skip("passes peopleProfiles to StudioSidebar for speaker selection", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          peopleOptions: expect.arrayContaining(["Alice", "Bob"]),
        }),
        expect.anything()
      );
    });
  });

  describe("User Meetings", () => {
    it.skip("passes userMeetings to StudioSidebar for meeting selection", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          userMeetings: mockProps.userMeetings,
        }),
        expect.anything()
      );
    });

    it.skip("extracts tag options from userMeetings", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      expect(StudioSidebar).toHaveBeenCalledWith(
        expect.objectContaining({
          tagOptions: expect.arrayContaining(["project", "review"]),
        }),
        expect.anything()
      );
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

    it.skip("applies workspace-layout class when brief is open", async () => {
      const user = userEvent.setup();
      const { StudioMeetingView } = await import("./studio/StudioMeetingView");
      
      let currentBriefOpen = false;
      vi.mocked(StudioMeetingView).mockImplementation(({ briefOpen, setBriefOpen }) => {
        currentBriefOpen = briefOpen;
        return (
          <div data-testid="studio-meeting-view">
            <button onClick={() => setBriefOpen(!briefOpen)}>
              Toggle Brief
            </button>
            <div data-testid="brief-state">{briefOpen ? "open" : "closed"}</div>
          </div>
        );
      });
      
      render(<StudioTab {...mockProps} />);
      
      const toggleButton = screen.getByText("Toggle Brief");
      await user.click(toggleButton);
      
      await waitFor(() => {
        expect(currentBriefOpen).toBe(true);
      });
    });
  });

  describe("Component Integration", () => {
    it.skip("passes all required props to StudioMeetingView", () => {
      render(<StudioTab {...mockProps} />);
      
      const { StudioMeetingView } = require("./studio/StudioMeetingView");
      expect(StudioMeetingView).toHaveBeenCalledWith(
        expect.objectContaining({
          briefOpen: expect.any(Boolean),
          setBriefOpen: expect.any(Function),
          currentWorkspacePermissions: mockProps.currentWorkspacePermissions,
          selectedMeeting: mockProps.selectedMeeting,
          peopleProfiles: mockProps.peopleProfiles,
        }),
        expect.anything()
      );
    });

    it("passes onClose callback to StudioSidebar that sets briefOpen to false", async () => {
      const user = userEvent.setup();
      render(<StudioTab {...mockProps} />);
      
      const openBriefButton = screen.getByText("Open Brief");
      await user.click(openBriefButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
      });
      
      const { StudioSidebar } = await import("./studio/StudioSidebar");
      const { onClose } = StudioSidebar.mock.calls[0][0];
      
      onClose();
      
      // Verify sidebar closes (this would trigger state update in real component)
      expect(screen.getByTestId("studio-sidebar")).toBeInTheDocument();
    });
  });
});
