import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createEmptyMeetingDraft } from '../lib/meeting';

interface MeetingsState {
  meetings: any[];
  manualTasks: any[];
  taskState: Record<string, any>;
  taskBoards: Record<string, any>;
  calendarMeta: Record<string, any>;
  vocabulary: any[];
  workspaceMessage: string;

  storedMeetingDrafts: Record<string, any>;
  meetingDraft: any;
  selectedMeetingId: string | null;
  selectedRecordingId: string | null;
  isDetachedMeetingDraft: boolean;
  hasMeetingDraftChanges: boolean;

  setMeetings: (updater: any[] | ((prev: any[]) => any[])) => void;
  setManualTasks: (updater: any[] | ((prev: any[]) => any[])) => void;
  setTaskState: (
    updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
  ) => void;
  setTaskBoards: (
    updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
  ) => void;
  setCalendarMeta: (
    updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
  ) => void;
  setVocabulary: (updater: any[] | ((prev: any[]) => any[])) => void;
  setWorkspaceMessage: (msg: string) => void;

  setStoredMeetingDrafts: (
    updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)
  ) => void;
  setMeetingDraft: (updater: any | ((prev: any) => any)) => void;
  setSelectedMeetingId: (id: string | null) => void;
  setSelectedRecordingId: (id: string | null) => void;
  setIsDetachedMeetingDraft: (val: boolean) => void;
  setHasMeetingDraftChanges: (val: boolean) => void;
}

export const useMeetingsStore = create<MeetingsState>()(
  persist(
    (set, get) => ({
      meetings: [],
      manualTasks: [],
      taskState: {},
      taskBoards: {},
      calendarMeta: {},
      vocabulary: [],
      workspaceMessage: '',

      storedMeetingDrafts: {},
      meetingDraft: createEmptyMeetingDraft(),
      selectedMeetingId: null,
      selectedRecordingId: null,
      isDetachedMeetingDraft: false,
      hasMeetingDraftChanges: false,

      setMeetings: (updater) =>
        set((state) => ({
          meetings: typeof updater === 'function' ? updater(state.meetings) : updater,
        })),
      setManualTasks: (updater) =>
        set((state) => ({
          manualTasks: typeof updater === 'function' ? updater(state.manualTasks) : updater,
        })),
      setTaskState: (updater) =>
        set((state) => ({
          taskState: typeof updater === 'function' ? updater(state.taskState) : updater,
        })),
      setTaskBoards: (updater) =>
        set((state) => ({
          taskBoards: typeof updater === 'function' ? updater(state.taskBoards) : updater,
        })),
      setCalendarMeta: (updater) =>
        set((state) => ({
          calendarMeta: typeof updater === 'function' ? updater(state.calendarMeta) : updater,
        })),
      setVocabulary: (updater) =>
        set((state) => ({
          vocabulary: typeof updater === 'function' ? updater(state.vocabulary) : updater,
        })),
      setWorkspaceMessage: (msg: string) => set({ workspaceMessage: msg }),

      setStoredMeetingDrafts: (updater) =>
        set((state) => ({
          storedMeetingDrafts:
            typeof updater === 'function' ? updater(state.storedMeetingDrafts) : updater,
        })),
      setMeetingDraft: (updater) =>
        set((state) => {
          const draft = typeof updater === 'function' ? updater(state.meetingDraft) : updater;
          return { meetingDraft: draft, hasMeetingDraftChanges: true };
        }),
      setSelectedMeetingId: (id) => set({ selectedMeetingId: id }),
      setSelectedRecordingId: (id) => set({ selectedRecordingId: id }),
      setIsDetachedMeetingDraft: (val) => set({ isDetachedMeetingDraft: val }),
      setHasMeetingDraftChanges: (val) => set({ hasMeetingDraftChanges: val }),
    }),
    {
      name: 'voicelog_meetings_store',
      partialize: (state) => ({
        meetings: state.meetings,
        manualTasks: state.manualTasks,
        taskState: state.taskState,
        taskBoards: state.taskBoards,
        calendarMeta: state.calendarMeta,
        vocabulary: state.vocabulary,
        storedMeetingDrafts: state.storedMeetingDrafts,
      }),
    }
  )
);
