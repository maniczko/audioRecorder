/**
 * @vitest-environment jsdom
 * Topbar component tests - renders tabs, actions, and handles user interactions
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import Topbar from './Topbar';

const mockUI = vi.hoisted(() => ({
  activeTab: 'studio' as string,
  setActiveTab: vi.fn(),
  openStudio: vi.fn(),
  navigateBack: vi.fn(),
  canGoBack: false,
  switchWorkspace: vi.fn(),
  setNotificationCenterOpen: vi.fn(),
  notificationCenterOpen: false,
  unreadNotificationCount: 0,
  notificationItems: [],
  notificationPermission: 'default' as string,
  browserNotificationsSupported: true,
  requestBrowserNotificationPermission: vi.fn(),
  dismissNotification: vi.fn(),
  activateNotification: vi.fn(),
  setCommandPaletteOpen: vi.fn(),
  setLayoutPreset: vi.fn(),
}));

const mockWorkspace = vi.hoisted(() => ({
  currentUser: { id: 'u1', name: 'Anna', role: 'PM', provider: 'local', avatarUrl: '' },
  currentWorkspaceId: 'ws1',
  currentWorkspace: { id: 'ws1', name: 'Team One' },
  currentWorkspacePermissions: { canRecordAudio: true },
  availableWorkspaces: [] as { id: string; name: string }[],
}));

const mockRecorder = vi.hoisted(() => ({
  isRecording: false,
  startRecording: vi.fn(),
}));

const mockGoogle = vi.hoisted(() => ({
  googleEnabled: false,
}));

vi.mock('./hooks/useUI', () => ({ default: () => mockUI }));
vi.mock('./store/workspaceStore', () => ({ useWorkspaceSelectors: () => mockWorkspace }));
vi.mock('./context/RecorderContext', () => ({ useRecorderCtx: () => mockRecorder }));
vi.mock('./context/GoogleContext', () => ({ useGoogleCtx: () => mockGoogle }));
vi.mock('./NotificationCenter', () => ({
  default: (props: any) => (
    <div data-testid="notification-center" data-open={props.open} data-unread={props.unreadCount} />
  ),
}));

describe('Topbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUI.activeTab = 'studio';
    mockUI.canGoBack = false;
    mockWorkspace.availableWorkspaces = [];
    mockRecorder.isRecording = false;
    mockGoogle.googleEnabled = false;
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
    mockUI.activeTab = 'calendar';
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Tab Kalendarz' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Tab Studio' })).not.toHaveClass('active');
  });

  it('calls setActiveTab when clicking a tab', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Tab Zadania' }));
    expect(mockUI.setActiveTab).toHaveBeenCalledWith('tasks');
  });

  it('calls openStudio when clicking Studio tab', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Tab Studio' }));
    expect(mockUI.openStudio).toHaveBeenCalled();
  });

  it('back button is disabled when canGoBack is false', () => {
    mockUI.canGoBack = false;
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Wroc do poprzedniego obiektu' })).toBeDisabled();
  });

  it('back button calls navigateBack when enabled', async () => {
    mockUI.canGoBack = true;
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Wroc do poprzedniego obiektu' }));
    expect(mockUI.navigateBack).toHaveBeenCalled();
  });

  it('record button starts ad-hoc recording', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Nagraj ad hoc' }));
    expect(mockRecorder.startRecording).toHaveBeenCalledWith({ adHoc: true });
    expect(mockUI.setActiveTab).toHaveBeenCalledWith('studio');
  });

  it('record button switches to studio when already recording', async () => {
    mockRecorder.isRecording = true;
    render(<Topbar />);
    const btn = screen.getByRole('button', { name: 'Przejdz do aktywnego nagrania' });
    expect(btn).toHaveClass('recording');
    await userEvent.click(btn);
    expect(mockRecorder.startRecording).not.toHaveBeenCalled();
    expect(mockUI.setActiveTab).toHaveBeenCalledWith('studio');
  });

  it('record button is disabled when no recording permission', () => {
    mockWorkspace.currentWorkspacePermissions = { canRecordAudio: false } as any;
    render(<Topbar />);
    expect(screen.getByRole('button', { name: 'Nagraj ad hoc' })).toBeDisabled();
    mockWorkspace.currentWorkspacePermissions = { canRecordAudio: true } as any;
  });

  it('shows Google ready chip when googleEnabled', () => {
    mockGoogle.googleEnabled = true;
    render(<Topbar />);
    expect(screen.getByText('Google ready')).toBeInTheDocument();
  });

  it('hides Google chip when googleEnabled is false', () => {
    render(<Topbar />);
    expect(screen.queryByText('Google ready')).not.toBeInTheDocument();
  });

  it('shows workspace switcher when multiple workspaces', () => {
    mockWorkspace.availableWorkspaces = [
      { id: 'ws1', name: 'Team One' },
      { id: 'ws2', name: 'Team Two' },
    ];
    render(<Topbar />);
    const select = screen.getByLabelText('Workspace');
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('ws1');
  });

  it('calls switchWorkspace on workspace select change', async () => {
    mockWorkspace.availableWorkspaces = [
      { id: 'ws1', name: 'Team One' },
      { id: 'ws2', name: 'Team Two' },
    ];
    render(<Topbar />);
    await userEvent.selectOptions(screen.getByLabelText('Workspace'), 'ws2');
    expect(mockUI.switchWorkspace).toHaveBeenCalledWith('ws2');
  });

  it('shows workspace name chip when only one workspace', () => {
    mockWorkspace.availableWorkspaces = [];
    render(<Topbar />);
    expect(screen.getByText('Team One')).toBeInTheDocument();
  });

  it('opens command palette on Szukaj click', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Szukaj' }));
    expect(mockUI.setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  it('displays current user name', () => {
    render(<Topbar />);
    expect(screen.getByText('Anna')).toBeInTheDocument();
  });

  it('opens settings on gear button click', async () => {
    render(<Topbar />);
    await userEvent.click(screen.getByRole('button', { name: 'Otworz ustawienia' }));
    expect(mockUI.setActiveTab).toHaveBeenCalledWith('profile');
  });

  it('shows user role when present', () => {
    render(<Topbar />);
    expect(screen.getByText('PM')).toBeInTheDocument();
  });

  it('passes NotificationCenter correct props', () => {
    mockUI.notificationCenterOpen = true;
    mockUI.unreadNotificationCount = 3;
    render(<Topbar />);
    const nc = screen.getByTestId('notification-center');
    expect(nc).toHaveAttribute('data-open', 'true');
    expect(nc).toHaveAttribute('data-unread', '3');
  });
});
