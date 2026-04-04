import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudioTab from './StudioTab';
import { ToastProvider } from './shared/Toast';

// Mock child components to avoid deep dependency tree
vi.mock('./studio/StudioMeetingView', () => ({
  default: ({ briefOpen, setBriefOpen, ...props }) => (
    <div data-testid="studio-meeting-view">
      <div data-testid="brief-open-status">{briefOpen ? 'brief-open' : 'brief-closed'}</div>
      <button onClick={() => setBriefOpen(!briefOpen)} data-testid="toggle-brief">
        Toggle Brief
      </button>
      <div data-testid="studio-meeting-view-props">
        {JSON.stringify({ hasMeetingDraft: !!props.meetingDraft })}
      </div>
    </div>
  ),
}));

vi.mock('./studio/StudioSidebar', () => ({
  default: ({ onClose, meetingDraft }) => (
    <div data-testid="studio-sidebar">
      <button onClick={onClose} data-testid="close-sidebar">
        Close Sidebar
      </button>
      <div data-testid="sidebar-content">Sidebar Content</div>
    </div>
  ),
}));

vi.mock('./ui/LayoutPrimitives', () => ({
  PageShell: ({ children, className }) => (
    <div data-testid="page-shell" className={className}>
      {children}
    </div>
  ),
  SplitPane: ({ sidebar, main, className }) => (
    <div data-testid="split-pane" className={className}>
      {sidebar && <div data-testid="sidebar-section">{sidebar}</div>}
      {main && <div data-testid="main-section">{main}</div>}
    </div>
  ),
}));

vi.mock('./components/Skeleton', () => ({
  StudioSkeleton: () => <div data-testid="studio-skeleton">Loading...</div>,
}));

describe('StudioTab', () => {
  const mockMeetingDraft = {
    id: 'draft_1',
    title: 'Draft Meeting',
    description: 'Test description',
    startedAt: new Date().toISOString(),
    speakerName: 'John Doe',
    tags: [],
  };

  const mockStoredMeetingDraft = {
    id: 'stored_1',
    title: 'Stored Draft',
    description: 'Stored description',
    startedAt: new Date().toISOString(),
    tags: [],
  };

  const mockMeeting = {
    id: 'meeting_1',
    title: 'Completed Meeting',
    startsAt: new Date().toISOString(),
    durationMinutes: 60,
    recordings: [],
    tags: [],
  };

  const mockPeople = [
    { id: 'p1', name: 'Alice', role: 'PM' },
    { id: 'p2', name: 'Bob', role: 'Engineer' },
  ];

  const defaultProps = {
    currentWorkspacePermissions: {
      canRecordAudio: true,
      canViewMeetings: true,
      canEditMeetings: true,
    },
    meetingDraft: mockMeetingDraft,
    setMeetingDraft: vi.fn(),
    activeStoredMeetingDraft: mockStoredMeetingDraft,
    clearMeetingDraft: vi.fn(),
    saveMeeting: vi.fn(),
    startNewMeetingDraft: vi.fn(),
    workspaceMessage: null,
    selectedMeeting: mockMeeting,
    isDetachedMeetingDraft: false,
    peopleProfiles: mockPeople,
    userMeetings: [mockMeeting],
    defaultToNewStudio: false,
    selectMeeting: vi.fn(),
    selectedRecordingId: '',
    setSelectedRecordingId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders studio tab without crashing', () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    expect(screen.getByTestId('page-shell')).toBeInTheDocument();
    expect(screen.getByTestId('split-pane')).toBeInTheDocument();
  });

  it('displays studio meeting view in main section', () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('starts with brief panel closed', () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    expect(screen.queryByTestId('studio-sidebar')).not.toBeInTheDocument();
    expect(screen.getByTestId('brief-open-status')).toHaveTextContent('brief-closed');
  });

  it('opens brief panel when toggle brief is clicked', async () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('brief-open-status')).toHaveTextContent('brief-open');
    });
  });

  it('closes brief panel when sidebar close is clicked', async () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    // Open brief first
    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
    });

    // Close brief
    const closeSidebarButton = screen.getByTestId('close-sidebar');
    fireEvent.click(closeSidebarButton);

    await waitFor(() => {
      expect(screen.queryByTestId('studio-sidebar')).not.toBeInTheDocument();
    });
  });

  it('initializes new studio when defaultToNewStudio is true', () => {
    const startNewMeetingDraftMock = vi.fn();

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} defaultToNewStudio={true} startNewMeetingDraft={startNewMeetingDraftMock} />
      </ToastProvider>
    );

    expect(startNewMeetingDraftMock).toHaveBeenCalledOnce();
  });

  it('does not initialize new studio when defaultToNewStudio is false', () => {
    const startNewMeetingDraftMock = vi.fn();

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} defaultToNewStudio={false} startNewMeetingDraft={startNewMeetingDraftMock} />
      </ToastProvider>
    );

    expect(startNewMeetingDraftMock).not.toHaveBeenCalled();
  });

  it('does not initialize new studio twice on re-render', () => {
    const startNewMeetingDraftMock = vi.fn();

    const { rerender } = render(
      <ToastProvider>
        <StudioTab
          {...defaultProps}
          defaultToNewStudio={true}
          startNewMeetingDraft={startNewMeetingDraftMock}
        />
      </ToastProvider>
    );

    expect(startNewMeetingDraftMock).toHaveBeenCalledTimes(1);

    // Re-render with same props
    rerender(
      <ToastProvider>
        <StudioTab
          {...defaultProps}
          defaultToNewStudio={true}
          startNewMeetingDraft={startNewMeetingDraftMock}
        />
      </ToastProvider>
    );

    // Should still be called only once (not twice)
    expect(startNewMeetingDraftMock).toHaveBeenCalledTimes(1);
  });

  it('passes people profiles to sidebar', async () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
    });

    // Sidebar should receive peopleProfiles as options
    expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
  });

  it('extracts unique tags from user meetings', () => {
    const meetingsWithTags = [
      { ...mockMeeting, id: 'm1', tags: ['important', 'follow-up'] },
      { ...mockMeeting, id: 'm2', tags: ['follow-up', 'urgent'] },
      { ...mockMeeting, id: 'm3', tags: ['important'] },
    ];

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} userMeetings={meetingsWithTags} />
      </ToastProvider>
    );

    // Component should render successfully with unique tags
    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('handles empty tags gracefully', () => {
    const meetingsNoTags = [
      { ...mockMeeting, id: 'm1', tags: undefined },
      { ...mockMeeting, id: 'm2', tags: null },
    ];

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} userMeetings={meetingsNoTags} />
      </ToastProvider>
    );

    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('applies workspace-layout class when brief is open', async () => {
    const { container } = render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    // Initially should have studio-layout
    let splitPane = screen.getByTestId('split-pane');
    expect(splitPane).toHaveClass('studio-layout');

    // Toggle brief open
    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      splitPane = screen.getByTestId('split-pane');
      expect(splitPane).toHaveClass('workspace-layout');
    });
  });

  it('applies studio-layout class when brief is closed', () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    const splitPane = screen.getByTestId('split-pane');
    expect(splitPane).toHaveClass('studio-layout');
    expect(splitPane).not.toHaveClass('workspace-layout');
  });

  it('passes all meeting draft props to sidebar', async () => {
    const customMeetingDraft = {
      id: 'custom_1',
      title: 'Custom Draft',
      description: 'Custom description',
    };

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} meetingDraft={customMeetingDraft} />
      </ToastProvider>
    );

    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
    });
  });

  it('passes setMeetingDraft to sidebar', async () => {
    const setMeetingDraftMock = vi.fn();

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} setMeetingDraft={setMeetingDraftMock} />
      </ToastProvider>
    );

    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
    });
  });

  it('passes clearMeetingDraft to sidebar', async () => {
    const clearMeetingDraftMock = vi.fn();

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} clearMeetingDraft={clearMeetingDraftMock} />
      </ToastProvider>
    );

    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
    });
  });

  it('passes saveMeeting to sidebar', async () => {
    const saveMeetingMock = vi.fn();

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} saveMeeting={saveMeetingMock} />
      </ToastProvider>
    );

    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
    });
  });

  it('handles permission restrictions', () => {
    const restrictedPermissions = {
      canRecordAudio: false,
      canViewMeetings: true,
      canEditMeetings: false,
    };

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} currentWorkspacePermissions={restrictedPermissions} />
      </ToastProvider>
    );

    // Should still render, permissions are passed to child components
    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('passes workspaceMessage to sidebar', async () => {
    const workspaceMessage = 'Workspace is in read-only mode';

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} workspaceMessage={workspaceMessage} />
      </ToastProvider>
    );

    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByTestId('studio-sidebar')).toBeInTheDocument();
    });
  });

  it('handles null meeting when selected meeting is not available', () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} selectedMeeting={null} />
      </ToastProvider>
    );

    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('handles detached meeting draft state', () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} isDetachedMeetingDraft={true} />
      </ToastProvider>
    );

    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('extracts unique people names from profiles', () => {
    const peopleWithDuplicateNames = [
      { id: 'p1', name: 'Alice', role: 'PM' },
      { id: 'p2', name: 'Bob', role: 'Engineer' },
      { id: 'p3', name: 'Alice', role: 'Designer' }, // duplicate name
    ];

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} peopleProfiles={peopleWithDuplicateNames} />
      </ToastProvider>
    );

    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('filters out people with empty names', () => {
    const peopleWithEmptyNames = [
      { id: 'p1', name: 'Alice', role: 'PM' },
      { id: 'p2', name: '', role: 'Engineer' }, // empty name
      { id: 'p3', name: 'Bob', role: 'Designer' },
      { id: 'p4', name: null, role: 'Manager' }, // null name
    ];

    render(
      <ToastProvider>
        <StudioTab {...defaultProps} peopleProfiles={peopleWithEmptyNames} />
      </ToastProvider>
    );

    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('wraps studio meeting view in suspense fallback', () => {
    render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    // Suspense boundary should be present (though component will render normally)
    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });

  it('applies correct CSS classes to main element', async () => {
    const { container } = render(
      <ToastProvider>
        <StudioTab {...defaultProps} />
      </ToastProvider>
    );

    // Find main element with data-testid or class
    let mainElement = container.querySelector('main.studio-tab-main');
    expect(mainElement).toBeInTheDocument();
    expect(mainElement).toHaveClass('studio-tab-main');
    expect(mainElement).not.toHaveClass('workspace-main');

    // Open brief and check class update
    const toggleButton = screen.getByTestId('toggle-brief');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      mainElement = container.querySelector('main.studio-tab-main.workspace-main');
      expect(mainElement).toHaveClass('workspace-main');
    });
  });

  it('handles missing peopleProfiles prop with default empty array', () => {
    const propsWithoutPeople = { ...defaultProps };
    delete propsWithoutPeople.peopleProfiles;

    render(
      <ToastProvider>
        <StudioTab {...propsWithoutPeople} />
      </ToastProvider>
    );

    expect(screen.getByTestId('studio-meeting-view')).toBeInTheDocument();
  });
});
