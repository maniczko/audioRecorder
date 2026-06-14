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
    activeTab: 'recordings',
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
  test('exposes the mobile navigation button state to assistive tech', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: /otwórz menu/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    renderHeader({ sidebarOpen: true });

    expect(screen.getByRole('button', { name: /zamknij menu/i })).toHaveAttribute(
      'aria-controls',
      'voicebobr-sidebar'
    );
    expect(screen.getByRole('button', { name: /zamknij menu/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  test('opens the command palette from search', async () => {
    const props = renderHeader();

    await userEvent.click(screen.getByRole('button', { name: /szukaj/i }));

    expect(props.setCommandPaletteOpen).toHaveBeenCalledWith(true);
  });

  test('starts ad hoc recording and returns to studio', async () => {
    const props = renderHeader();

    await userEvent.click(screen.getByRole('button', { name: /nowe nagranie/i }));

    expect(props.recorder.startRecording).toHaveBeenCalledWith({ adHoc: true });
    expect(props.setActiveTab).toHaveBeenCalledWith('studio');
  });

  test('hides the global recording shortcut on the Studio screen', () => {
    renderHeader({ activeTab: 'studio' });

    expect(screen.queryByRole('button', { name: /nagrywaj/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nowe nagranie/i })).not.toBeInTheDocument();
  });

  test('shows add person CTA instead of new recording on the People screen', async () => {
    const listener = vi.fn();
    window.addEventListener('voicebobr:add-person-request', listener);

    renderHeader({ activeTab: 'people' });

    expect(screen.queryByRole('button', { name: /nowe nagranie/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /dodaj osobę/i }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('voicebobr:add-person-request', listener);
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
