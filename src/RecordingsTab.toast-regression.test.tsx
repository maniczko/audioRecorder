// ─────────────────────────────────────────────────────────────────
// Issue #0 — RecordingsTab crashes with "useToast must be used within ToastProvider"
// Date: 2026-04-05
// Bug: RecordingsTab (and TasksTab) call useToast() which throws if rendered
//      outside ToastProvider context. This caused a hard crash on localhost
//      when the component was rendered before the provider tree was fully ready,
//      or during HMR (Hot Module Replacement) state transitions.
// Fix: Changed useToast() to return a no-op implementation instead of throwing.
//      Components gracefully handle missing ToastProvider without crashing.
// Why tests passed: All existing tests wrap components in <ToastProvider>,
//      so the context was always available. The bug only manifested in the
//      actual app during edge cases (HMR, lazy loading boundaries).
// ─────────────────────────────────────────────────────────────────
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RecordingsTab from './RecordingsTab';
import TasksTab from './TasksTab';
import { useToast } from './shared/Toast';

const defaultProps = {
  userMeetings: [],
  selectedMeeting: null,
  selectMeeting: vi.fn(),
  startNewMeetingDraft: vi.fn(),
  selectedRecordingId: '',
  setSelectedRecordingId: vi.fn(),
  setActiveTab: vi.fn(),
  onCreateMeeting: vi.fn(async () => ({ id: 'test' })),
  queueRecording: vi.fn(async () => 'rec_test'),
  recordingQueue: [],
  activeQueueItem: null,
  analysisStatus: 'idle',
  recordingMessage: '',
  pipelineProgressPercent: 0,
  pipelineStageLabel: '',
  retryRecordingQueueItem: vi.fn(),
  retryStoredRecording: vi.fn(),
};

describe('Regression: Toast context should not crash app when unavailable', () => {
  test('RecordingsTab renders without ToastProvider (uses no-op toast)', () => {
    // This test intentionally does NOT wrap in ToastProvider
    // to verify the component handles missing context gracefully
    expect(() => {
      render(<RecordingsTab {...defaultProps} />);
    }).not.toThrow();

    // Should still render content
    expect(screen.getByText(/Brak spotk/i)).toBeInTheDocument();
  });

  test('TasksTab renders without ToastProvider (uses no-op toast)', () => {
    // TasksTab also uses useToast() - verify it doesn't crash
    const tasksProps = {
      tasks: [],
      onCreateTask: vi.fn(),
      onUpdateTask: vi.fn(),
      onMoveTaskToColumn: vi.fn(),
      onDeleteTask: vi.fn(),
      boardColumns: [{ id: 'todo', label: 'Do zrobienia' }],
      defaultView: 'kanban' as const,
      currentUserName: 'Test User',
      workspaceMembers: [],
      taskNotifications: [],
    };

    expect(() => {
      render(<TasksTab {...tasksProps} />);
    }).not.toThrow();
  });
});

describe('useToast hook behavior', () => {
  test('useToast returns no-op implementation when outside provider', () => {
    // Create a test component that calls useToast outside provider
    function TestComponent() {
      const toast = useToast();
      return (
        <div data-testid="toast-result">
          <button onClick={() => toast.success('test')}>Test</button>
        </div>
      );
    }

    // Should not throw, should render successfully
    render(<TestComponent />);
    expect(screen.getByTestId('toast-result')).toBeInTheDocument();

    // Clicking should not crash (no-op)
    expect(() => screen.getByText('Test').click()).not.toThrow();
  });
});
