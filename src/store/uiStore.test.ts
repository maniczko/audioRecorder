import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-layout');
    useUIStore.setState({
      activeTab: 'studio',
      tabHistory: ['studio'],
      theme: 'dark',
      layoutPreset: 'default',
      pendingTaskId: '',
      pendingPersonId: '',
      commandPaletteOpen: false,
      notificationCenterOpen: false,
      notificationState: { dismissedIds: [], deliveredIds: [] },
      notificationPermission: 'unsupported',
    });
  });

  test('tracks tab history and browser-facing layout attributes', () => {
    const store = useUIStore.getState();

    store.setActiveTab('tasks');
    store.setActiveTab('calendar');
    store.navigateBack();
    store.setTheme('light');
    store.setLayoutPreset('bobr');

    expect(useUIStore.getState().activeTab).toBe('tasks');
    expect(useUIStore.getState().tabHistory).toEqual(['studio', 'studio']);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-layout')).toBe('bobr');
  });

  test('requests notification permission and delivers only new notifications', async () => {
    const notificationSpy = vi.fn();
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', Object.assign(notificationSpy, { requestPermission }));

    const store = useUIStore.getState();
    await store.requestBrowserNotificationPermission();
    store.deliverBrowserNotifications([{ id: 'n1', title: 'Task', body: 'Do zrobienia' }]);
    store.deliverBrowserNotifications([{ id: 'n1', title: 'Task', body: 'Do zrobienia' }]);
    store.dismissNotification('n1');

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().notificationPermission).toBe('granted');
    expect(notificationSpy).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().notificationState).toMatchObject({
      deliveredIds: ['n1'],
      dismissedIds: ['n1'],
    });

    const persisted = JSON.parse(localStorage.getItem('voicelog_ui_store') || '{}');
    expect(persisted.state).toMatchObject({
      theme: 'dark',
      layoutPreset: 'default',
      notificationState: {
        deliveredIds: ['n1'],
        dismissedIds: ['n1'],
      },
    });
  });
});
