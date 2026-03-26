import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getBrowserNotificationCandidates } from '../lib/notifications';

export const useUIStore = create<any>()(
  persist(
    (set, get) => ({
      activeTab: 'studio',
      tabHistory: ['studio'],
      theme: 'dark',
      layoutPreset: 'bobr',
      pendingTaskId: '',
      pendingPersonId: '',
      commandPaletteOpen: false,
      notificationCenterOpen: false,
      notificationState: { dismissedIds: [], deliveredIds: [] },
      notificationPermission: 'unsupported',

      setActiveTab: (tab: string) => {
        const { activeTab, tabHistory } = get();
        if (activeTab === tab) return;
        set({ activeTab: tab, tabHistory: [...tabHistory.slice(-19), activeTab] });
      },

      navigateBack: () => {
        const { tabHistory } = get();
        if (!tabHistory.length) return;
        const prev = tabHistory[tabHistory.length - 1];
        set({ activeTab: prev, tabHistory: tabHistory.slice(0, -1) });
      },

      setTheme: (theme: string) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },

      setLayoutPreset: (layoutPreset: string) => {
        document.documentElement.setAttribute('data-layout', layoutPreset);
        set({ layoutPreset });
      },

      setPendingTaskId: (id: string) => set({ pendingTaskId: id }),
      setPendingPersonId: (id: string) => set({ pendingPersonId: id }),
      setCommandPaletteOpen: (open: boolean) => set({ commandPaletteOpen: open }),
      setNotificationCenterOpen: (open: boolean) => set({ notificationCenterOpen: open }),

      setNotificationPermission: (permission: string) =>
        set({ notificationPermission: permission }),

      updateNotificationState: (updater: any) =>
        set((state: any) => ({
          notificationState:
            typeof updater === 'function' ? updater(state.notificationState) : updater,
        })),

      dismissNotification: (notificationId: string) => {
        set((state: any) => ({
          notificationState: {
            ...state.notificationState,
            dismissedIds: [
              ...new Set([...(state.notificationState.dismissedIds || []), notificationId]),
            ],
          },
        }));
      },

      requestBrowserNotificationPermission: async () => {
        if (typeof window === 'undefined' || !window.Notification?.requestPermission) return;
        if (get().notificationPermission === 'granted') return;
        try {
          const nextPermission = await window.Notification.requestPermission();
          set({ notificationPermission: nextPermission });
        } catch (error) {
          console.error('Unable to request notification permission.', error);
        }
      },

      deliverBrowserNotifications: (items: any[]) => {
        const { notificationPermission, notificationState } = get();
        if (
          notificationPermission !== 'granted' ||
          typeof window === 'undefined' ||
          !window.Notification
        )
          return;

        const candidates = getBrowserNotificationCandidates(items, notificationState.deliveredIds);
        if (!candidates.length) return;

        candidates.forEach((item) => {
          try {
            new window.Notification(item.title, { body: item.body, tag: item.id });
          } catch (error) {
            console.error('Browser notification failed.', error);
          }
        });

        set((state: any) => ({
          notificationState: {
            ...state.notificationState,
            deliveredIds: [
              ...new Set([
                ...(state.notificationState.deliveredIds || []),
                ...candidates.map((i: any) => i.id),
              ]),
            ],
          },
        }));
      },
    }),
    {
      name: 'voicelog_ui_store',
      partialize: (state) => ({
        theme: state.theme,
        layoutPreset: state.layoutPreset,
        notificationState: state.notificationState,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme);
        }
        document.documentElement.setAttribute('data-layout', state?.layoutPreset || 'bobr');
      },
    }
  )
);
