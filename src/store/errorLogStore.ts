import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { API_BASE_URL, apiBaseUrlConfigured } from '../services/config';

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
  flushToServer: () => Promise<void>;
}

// Queue for batching errors to send to server
let pendingErrors: ErrorLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY_MS = 5000; // batch & send every 5s
let isFlushing = false;

async function sendErrorsToServer(errors: ErrorLogEntry[]): Promise<boolean> {
  if (!apiBaseUrlConfigured() || errors.length === 0) {
    if (errors.length > 0) {
      console.warn('[VoiceLog] auto-send skipped — API not configured');
    }
    return false;
  }
  try {
    const url = `${API_BASE_URL}/api/client-errors`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        errors.map((e) => ({
          ...e,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }))
      ),
    });
    if (!resp.ok) {
      console.warn(`[VoiceLog] auto-send failed: ${resp.status} ${resp.statusText}`);
    }
    return resp.ok;
  } catch (err) {
    console.warn('[VoiceLog] auto-send error:', err);
    return false;
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    if (isFlushing || pendingErrors.length === 0) return;
    isFlushing = true;
    const batch = pendingErrors.splice(0, 50);
    await sendErrorsToServer(batch);
    isFlushing = false;
    // If more accumulated during flush, schedule again
    if (pendingErrors.length > 0) scheduleFlush();
  }, FLUSH_DELAY_MS);
}

/** @internal — reset module state between tests */
export function _resetPendingForTest() {
  pendingErrors.length = 0;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  isFlushing = false;
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
        // Auto-send to server
        pendingErrors.push(newEntry);
        scheduleFlush();
      },

      clearErrors: () => set({ errors: [] }),

      exportErrors: () => {
        const { errors } = get();
        return JSON.stringify(errors, null, 2);
      },

      getErrorCount: () => get().errors.length,

      flushToServer: async () => {
        if (pendingErrors.length > 0) {
          const batch = pendingErrors.splice(0, pendingErrors.length);
          await sendErrorsToServer(batch);
        }
      },
    }),
    {
      name: 'voicelog-error-log',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ errors: state.errors }),
    }
  )
);

// Expose manual flush for debugging (browser console: __voicelogFlush())
if (typeof window !== 'undefined') {
  (window as any).__voicelogFlush = async () => {
    const store = useErrorLogStore.getState();
    await store.flushToServer();
    console.info(
      `[VoiceLog] flushed. pending=${pendingErrors.length}, stored=${store.errors.length}`
    );
  };
  console.info('[VoiceLog] error auto-send active, API_BASE_URL =', API_BASE_URL);
}
