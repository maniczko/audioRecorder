import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  type: 'runtime' | 'unhandled-rejection' | 'react-boundary' | 'network' | 'manual';
  message: string;
  stack?: string;
  source?: string;
  context?: string;
}

interface ErrorLogState {
  errors: ErrorLogEntry[];
  maxErrors: number;
  addError: (entry: Omit<ErrorLogEntry, 'id' | 'timestamp'>) => void;
  clearErrors: () => void;
  exportErrors: () => string;
  getErrorCount: () => number;
}

export const useErrorLogStore = create<ErrorLogState>()(
  persist(
    (set, get) => ({
      errors: [],
      maxErrors: 200,

      addError: (entry) => {
        const newEntry: ErrorLogEntry = {
          ...entry,
          id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({
          errors: [...state.errors, newEntry].slice(-state.maxErrors),
        }));
      },

      clearErrors: () => set({ errors: [] }),

      exportErrors: () => {
        const { errors } = get();
        return JSON.stringify(errors, null, 2);
      },

      getErrorCount: () => get().errors.length,
    }),
    {
      name: 'voicelog-error-log',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ errors: state.errors }),
    }
  )
);
