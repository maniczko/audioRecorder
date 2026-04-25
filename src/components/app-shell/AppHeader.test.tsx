import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { WorkspaceNotificationItem } from '../../lib/notifications';
import AppHeader from './AppHeader';

vi.mock('../../NotificationCenter', () => ({
  default: ({ unreadCount, onToggle }: { unreadCount: number; onToggle: () => void }) => (
    <button type="button" onClick={onToggle}>
      notifications {unreadCount}
    </button>
  ),
}));

function renderHeader(overrides = {}) {
  const props = {
    sidebarOpen: false,
    currentUser: { name: 'Ala' },
    canRecordAudio: true,
    recorder: {
      isRecording: false,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    },
    notificationCenterOpen: false,
    unreadNotificationCount: 2,
    notificationItems: [] as WorkspaceNotificationItem[],
    notificationPermission: 'default' as NotificationPermission,
    browserNotificationsSupported: true,
    dismissNotification: vi.fn(),
    activateNotification: vi.fn(),
    requestBrowserNotificationPermission: vi.fn(),
    setActiveTab: vi.fn(),
    setCommandPaletteOpen: vi.fn(),
    setNotificationCenterOpen: vi.fn(),
    setSidebarOpen: vi.fn(),
    ...overrides,
  };

  render(<AppHeader {...props} />);
  return props;
}

describe('AppHeader', () => {
  test('opens the command palette from search', async () => {
    const props = renderHeader();

    await userEvent.click(screen.getByRole('button', { name: /szukaj/i }));

    expect(props.setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  test('starts ad hoc recording and returns to studio', async () => {
    const props = renderHeader();

    await userEvent.click(screen.getByRole('button', { name: /rozpocznij nagrywanie/i }));

    expect(props.recorder.startRecording).toHaveBeenCalledWith({ adHoc: true });
    expect(props.setActiveTab).toHaveBeenCalledWith('studio');
  });

  test('stops recording when recorder is active', async () => {
    const recorder = {
      isRecording: true,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
    };
    renderHeader({ recorder });

    await userEvent.click(screen.getByRole('button', { name: /zatrzymaj nagrywanie/i }));

    expect(recorder.stopRecording).toHaveBeenCalledTimes(1);
    expect(recorder.startRecording).not.toHaveBeenCalled();
  });

  test('opens the profile tab from the avatar button', async () => {
    const props = renderHeader();

    await userEvent.click(screen.getByTitle('Ustawienia profilu'));

    expect(props.setActiveTab).toHaveBeenCalledWith('profile');
  });
});
