import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.unmock('./uiStore');

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
      layoutPreset: 'modern',
      pendingTaskId: '',
      pendingPersonId: '',
      studioHomeSignal: 0,
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
    expect(notificationSpy).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().notificationPermission).toBe('granted');
    expect(useUIStore.getState().notificationState).toMatchObject({
      deliveredIds: ['n1'],
      dismissedIds: ['n1'],
    });
  });

  test('stores transient UI toggles without disturbing active tab', () => {
    const store = useUIStore.getState();

    store.setCommandPaletteOpen(true);
    store.setNotificationCenterOpen(true);
    store.setPendingTaskId('task-1');
    store.setPendingPersonId('person-1');
    store.triggerStudioHome();

    expect(useUIStore.getState()).toMatchObject({
      activeTab: 'studio',
      commandPaletteOpen: true,
      notificationCenterOpen: true,
      pendingTaskId: 'task-1',
      pendingPersonId: 'person-1',
      studioHomeSignal: 1,
    });
  });
});
