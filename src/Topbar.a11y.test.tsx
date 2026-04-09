/**
 * @vitest-environment jsdom
 * Topbar component tests - renders tabs, actions, and handles user interactions
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockState = vi.hoisted(() => ({
  ui: {
    activeTab: 'studio',
    canGoBack: false,
    setActiveTab: vi.fn(),
    openStudio: vi.fn(),
    navigateBack: vi.fn(),
    switchWorkspace: vi.fn(),
    setNotificationCenterOpen: vi.fn(),
    notificationCenterOpen: false,
    unreadNotificationCount: 0,
    notificationItems: [],
    notificationPermission: 'default',
    browserNotificationsSupported: true,
    requestBrowserNotificationPermission: vi.fn(),
    dismissNotification: vi.fn(),
    activateNotification: vi.fn(),
    setCommandPaletteOpen: vi.fn(),
    setLayoutPreset: vi.fn(),
  },
  workspace: {
    currentUser: { id: 'u1', name: 'Anna', role: 'PM', provider: 'local', avatarUrl: '' },
    currentWorkspaceId: 'ws1',
    currentWorkspace: { id: 'ws1', name: 'Team One' },
    currentWorkspacePermissions: { canRecordAudio: true },
    availableWorkspaces: [] as { id: string; name: string }[],
    isHydratingSession: false,
    logout: vi.fn(),
    session: { userId: 'u1' },
    updateWorkspaceMemberRole: vi.fn(),
    removeWorkspaceMember: vi.fn(),
  },
  recorder: {
    isRecording: false,
    startRecording: vi.fn(),
    elapsed: 0,
  },
  google: {
    googleEnabled: false,
  },
}));

vi.mock('./hooks/useUI', () => ({
  default: () => mockState.ui,
}));

vi.mock('./store/workspaceStore', () => ({
  useWorkspaceSelectors: () => mockState.workspace,
}));

vi.mock('./context/RecorderContext', () => ({
  useRecorderCtx: () => mockState.recorder,
}));

vi.mock('./context/GoogleContext', () => ({
  useGoogleCtx: () => mockState.google,
}));

vi.mock('./NotificationCenter', () => ({
  default: (props: any) => (
    <div data-testid="notification-center" data-open={props.open} data-unread={props.unreadCount} />
  ),
}));

import Topbar from './Topbar';

describe('Topbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.ui.activeTab = 'studio';
    mockState.ui.canGoBack = false;
    mockState.ui.notificationCenterOpen = false;
    mockState.ui.unreadNotificationCount = 0;
    mockState.workspace.currentWorkspacePermissions = { canRecordAudio: true };
    mockState.workspace.availableWorkspaces = [];
    mockState.workspace.currentWorkspace = { id: 'ws1', name: 'Team One' };
    mockState.recorder.isRecording = false;
    mockState.recorder.elapsed = 0;
    mockState.google.googleEnabled = false;
  });

  it('renders all navigation tabs', () => {
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Tab Studio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab Nagrania' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab Kalendarz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab Zadania' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab Osoby' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tab Notatki' })).toBeInTheDocument();
  });

  it('marks active tab with active class', () => {
    mockState.ui.activeTab = 'calendar';
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Tab Kalendarz' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Tab Studio' })).not.toHaveClass('active');
  });

  it('calls setActiveTab when clicking a tab', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Tab Zadania' }));
    expect(mockState.ui.setActiveTab).toHaveBeenCalledWith('tasks');
  });

  it('calls openStudio when clicking Studio tab', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Tab Studio' }));
    expect(mockState.ui.openStudio).toHaveBeenCalled();
  });

  it('back button is disabled when canGoBack is false', () => {
    mockState.ui.canGoBack = false;
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Wroc do poprzedniego obiektu' })).toBeDisabled();
  });

  it('back button calls navigateBack when enabled', async () => {
    mockState.ui.canGoBack = true;
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Wroc do poprzedniego obiektu' }));
    expect(mockState.ui.navigateBack).toHaveBeenCalled();
  });

  it('record button starts ad-hoc recording', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Nagraj ad hoc' }));
    expect(mockState.recorder.startRecording).toHaveBeenCalledWith({ adHoc: true });
    expect(mockState.ui.setActiveTab).toHaveBeenCalledWith('studio');
  });

  it('record button switches to studio when already recording', async () => {
    mockState.recorder.isRecording = true;
    mockState.recorder.elapsed = 15;
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Przejdz do aktywnego nagrania' }));
    expect(mockState.recorder.startRecording).not.toHaveBeenCalled();
    expect(mockState.ui.setActiveTab).toHaveBeenCalledWith('studio');
  });

  it('record button is disabled when no recording permission', () => {
    mockState.workspace.currentWorkspacePermissions = { canRecordAudio: false };
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Nagraj ad hoc' })).toBeDisabled();
  });

  it('shows Google ready chip when googleEnabled', () => {
    mockState.google.googleEnabled = true;
    render(<Topbar />);
    expect(screen.getByText('Google ready')).toBeInTheDocument();
  });

  it('hides Google chip when googleEnabled is false', () => {
    render(<Topbar />);
    expect(screen.queryByText('Google ready')).not.toBeInTheDocument();
  });

  it('shows workspace switcher when multiple workspaces', () => {
    mockState.workspace.availableWorkspaces = [
      { id: 'ws1', name: 'Team One' },
      { id: 'ws2', name: 'Team Two' },
    ];
    render(<Topbar />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('ws1');
  });

  it('calls switchWorkspace on workspace select change', async () => {
    mockState.workspace.availableWorkspaces = [
      { id: 'ws1', name: 'Team One' },
      { id: 'ws2', name: 'Team Two' },
    ];
    render(<Topbar />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ws2');
    expect(mockState.ui.switchWorkspace).toHaveBeenCalledWith('ws2');
  });

  it('shows workspace name chip when only one workspace', () => {
    render(<Topbar />);
    expect(screen.getByText('Team One')).toBeInTheDocument();
  });

  it('opens command palette on Szukaj click', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Szukaj' }));
    expect(mockState.ui.setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  it('displays current user name', () => {
    render(<Topbar />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
  });

  it('opens settings on gear button click', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Otworz ustawienia' }));
    expect(mockState.ui.setActiveTab).toHaveBeenCalledWith('profile');
  });

  it('shows user role when present', () => {
    render(<Topbar />);
    expect(screen.getByText('PM')).toBeInTheDocument();
  });

  it('passes NotificationCenter correct props', () => {
    mockState.ui.notificationCenterOpen = true;
    mockState.ui.unreadNotificationCount = 3;
    render(<Topbar />);
    const nc = screen.getByTestId('notification-center');
    expect(nc).toHaveAttribute('data-open', 'true');
    expect(nc).toHaveAttribute('data-unread', '3');
  });
});
