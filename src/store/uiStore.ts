import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getBrowserNotificationCandidates } from '../lib/notifications';

const DEFAULT_NOTIFICATION_STATE = { dismissedIds: [], deliveredIds: [] };
const FIXED_LAYOUT_PRESET = 'modern';
const DEFAULT_APPEARANCE_MODE: AppearanceMode = 'premium-light';
const APPEARANCE_FORCE_LIGHT_MIGRATION = 'premium-light-default-2026-06-08';

export type AppearanceMode = 'dark' | 'premium-light';

export function normalizeAppearanceMode(value: unknown): AppearanceMode {
  const raw = String(value || '').trim();
  if (
    raw === 'dark' ||
    raw === 'modern' ||
    raw === 'default' ||
    raw === 'compact' ||
    raw === 'flat' ||
    raw === 'bobr'
  )
    return 'dark';
  if (raw === 'premium-light' || raw === 'light' || raw === 'beaver') return 'premium-light';
  return DEFAULT_APPEARANCE_MODE;
}

function applyAppearanceMode(value: unknown) {
  const appearanceMode = normalizeAppearanceMode(value);
  document.documentElement.setAttribute('data-theme', appearanceMode);
  document.documentElement.setAttribute('data-layout', FIXED_LAYOUT_PRESET);
  return appearanceMode;
}

function normalizeNotificationState(value: any) {
  return {
    dismissedIds: Array.isArray(value?.dismissedIds) ? value.dismissedIds : [],
    deliveredIds: Array.isArray(value?.deliveredIds) ? value.deliveredIds : [],
  };
}

export const useUIStore = create<any>()(
  persist(
    (set, get) => ({
      activeTab: 'studio',
      tabHistory: ['studio'],
      appearanceMode: DEFAULT_APPEARANCE_MODE,
      theme: DEFAULT_APPEARANCE_MODE,
      appearanceForceLightMigration: APPEARANCE_FORCE_LIGHT_MIGRATION,
      layoutPreset: FIXED_LAYOUT_PRESET,
      pendingTaskId: '',
      pendingPersonId: '',
      studioHomeSignal: 0,
      commandPaletteOpen: false,
      notificationCenterOpen: false,
      notificationState: DEFAULT_NOTIFICATION_STATE,
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

      setAppearanceMode: (appearanceMode: AppearanceMode) => {
        const normalized = applyAppearanceMode(appearanceMode);
        set({
          appearanceMode: normalized,
          theme: normalized,
          layoutPreset: FIXED_LAYOUT_PRESET,
        });
      },

      setTheme: (theme: string) => {
        const normalized = applyAppearanceMode(theme);
        set({
          appearanceMode: normalized,
          theme: normalized,
          layoutPreset: FIXED_LAYOUT_PRESET,
        });
      },

      setLayoutPreset: () => {
        document.documentElement.setAttribute('data-layout', FIXED_LAYOUT_PRESET);
        set({ layoutPreset: FIXED_LAYOUT_PRESET });
      },

      setPendingTaskId: (id: string) => set({ pendingTaskId: id }),
      setPendingPersonId: (id: string) => set({ pendingPersonId: id }),
      triggerStudioHome: () =>
        set((state: any) => ({ studioHomeSignal: state.studioHomeSignal + 1 })),
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
        appearanceMode: state.appearanceMode,
        theme: state.theme,
        appearanceForceLightMigration: state.appearanceForceLightMigration,
        layoutPreset: FIXED_LAYOUT_PRESET,
        notificationState: normalizeNotificationState(state.notificationState),
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState || {}) as any;
        const hasForcedLightMigration =
          persisted.appearanceForceLightMigration === APPEARANCE_FORCE_LIGHT_MIGRATION;
        const appearanceMode = hasForcedLightMigration
          ? normalizeAppearanceMode(
              persisted.appearanceMode || persisted.theme || persisted.layoutPreset
            )
          : DEFAULT_APPEARANCE_MODE;
        return {
          ...currentState,
          ...persisted,
          appearanceMode,
          theme: appearanceMode,
          appearanceForceLightMigration: APPEARANCE_FORCE_LIGHT_MIGRATION,
          layoutPreset: FIXED_LAYOUT_PRESET,
          notificationState: normalizeNotificationState(persisted.notificationState),
        };
      },
      onRehydrateStorage: () => (state) => {
        const appearanceMode = applyAppearanceMode(state?.appearanceMode || state?.theme);
        state.appearanceMode = appearanceMode;
        state.theme = appearanceMode;
        state.layoutPreset = FIXED_LAYOUT_PRESET;
      },
    }
  )
);
