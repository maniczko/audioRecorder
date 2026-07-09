import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskDetailsPanel from './TaskDetailsPanel';

const mockSelectedTask = {
  id: 'task-1',
  title: 'Test Task',
  notes: 'Test notes',
  completed: false,
  sourceType: 'meeting' as const,
  sourceMeetingId: 'meeting-1',
  status: 'todo',
  tags: ['tag1', 'tag2'],
  history: [
    { id: 'h1', actor: 'User', message: 'Created task', createdAt: '2026-03-25T10:00:00Z' },
    {
      id: 'h2',
      actor: 'System',
      message: 'Status changed to todo',
      createdAt: '2026-03-25T11:00:00Z',
    },
  ],
  comments: [],
  googleSyncConflict: null,
};

const mockProps = {
  selectedTask: mockSelectedTask,
  tasks: [mockSelectedTask],
  peopleOptions: [{ id: 'p1', name: 'John' }],
  tagOptions: ['tag1', 'tag2', 'tag3'],
  taskGroups: [],
  boardColumns: [
    { id: 'todo', title: 'To Do' },
    { id: 'done', title: 'Done' },
  ],
  onUpdateTask: vi.fn(),
  onMoveTaskToColumn: vi.fn(),
  onDeleteTask: vi.fn(),
  onOpenMeeting: vi.fn(),
  currentUserName: 'Test User',
  onResolveGoogleTaskConflict: vi.fn(),
};

describe('TaskDetailsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no task selected', () => {
    render(<TaskDetailsPanel {...mockProps} selectedTask={null} />);

    expect(screen.getByText('Wybierz zadanie')).toBeInTheDocument();
    expect(
      screen.getByText('Tutaj zobaczysz szczegóły zadania, status, grupę i notatki.')
    ).toBeInTheDocument();
  });

  it('renders task title and allows editing', async () => {
    render(<TaskDetailsPanel {...mockProps} />);

    const titleInput = screen.getByLabelText('Tytuł zadania') as HTMLInputElement;
    expect(titleInput.value).toBe('Test Task');

    fireEvent.change(titleInput, { target: { value: 'Updated Task' } });

    expect(mockProps.onUpdateTask).toHaveBeenCalledWith('task-1', { title: 'Updated Task' });
  });

  it('toggles task completion status', async () => {
    render(<TaskDetailsPanel {...mockProps} />);

    const checkbox = screen.getByRole('button', { name: /Oznacz jako uko(?:n|ń)czone/i });
    fireEvent.click(checkbox);

    expect(mockProps.onUpdateTask).toHaveBeenCalledWith('task-1', { completed: true });
  });

  it('renders notes textarea and allows editing', async () => {
    render(<TaskDetailsPanel {...mockProps} />);

    const notesTextarea = screen.getByPlaceholderText('Dodaj notatkę...') as HTMLTextAreaElement;
    expect(notesTextarea.value).toBe('Test notes');

    fireEvent.change(notesTextarea, { target: { value: 'Updated notes' } });

    expect(mockProps.onUpdateTask).toHaveBeenCalledWith('task-1', { notes: 'Updated notes' });
  });

  it('renders history section with correct count', () => {
    render(<TaskDetailsPanel {...mockProps} />);

    expect(screen.getByText('Historia zmian')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('expands history when toggle button clicked', async () => {
    render(<TaskDetailsPanel {...mockProps} />);

    // Button has title attribute with the text, not accessible name
    const toggleButton = screen.getByTitle('Pokaż historię');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Created task')).toBeInTheDocument();
    });
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('Status changed to todo')).toBeInTheDocument();
  });

  it('collapses history when expanded', async () => {
    render(<TaskDetailsPanel {...mockProps} />);

    const toggleButton = screen.getByTitle('Pokaż historię');
    fireEvent.click(toggleButton);
    fireEvent.click(toggleButton);

    expect(screen.queryByText('Created task')).not.toBeInTheDocument();
  });

  it('shows empty history message when no history', () => {
    const taskWithoutHistory = { ...mockSelectedTask, history: [] };
    render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithoutHistory} />);

    expect(screen.getByText('Historia pojawi się po pierwszych zmianach.')).toBeInTheDocument();
  });

  it('renders delete button and confirms deletion', async () => {
    render(<TaskDetailsPanel {...mockProps} />);

    const deleteButton = screen.getByRole('button', { name: 'Usun zadanie' });

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(deleteButton);

    expect(mockProps.onDeleteTask).toHaveBeenCalledWith('task-1');

    vi.restoreAllMocks();
  });

  it('cancels deletion when user declines', async () => {
    render(<TaskDetailsPanel {...mockProps} />);

    const deleteButton = screen.getByRole('button', { name: 'Usun zadanie' });

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(deleteButton);

    expect(mockProps.onDeleteTask).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('renders link to meeting when sourceMeetingId exists', async () => {
    render(<TaskDetailsPanel {...mockProps} />);

    const meetingLink = screen.getByRole('button', { name: /Otwórz spotkanie/i });
    fireEvent.click(meetingLink);

    expect(mockProps.onOpenMeeting).toHaveBeenCalledWith('meeting-1');
  });

  it('does not render meeting link when no sourceMeetingId', () => {
    const taskWithoutMeeting = { ...mockSelectedTask, sourceMeetingId: null };
    render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithoutMeeting} />);

    expect(screen.queryByRole('button', { name: /Otwórz spotkanie/i })).not.toBeInTheDocument();
  });

  it('renders Google Tasks eyebrow for google source type', () => {
    const googleTask = { ...mockSelectedTask, sourceType: 'google' as const };
    render(<TaskDetailsPanel {...mockProps} selectedTask={googleTask} />);

    expect(screen.getByText('Google Tasks')).toBeInTheDocument();
  });

  it('opens a blocker task from the dependency section', () => {
    const onOpenTask = vi.fn();
    const blocker = {
      ...mockSelectedTask,
      id: 'task-blocker',
      title: 'Approve budget',
      completed: false,
      dependencies: [],
    };
    const blockedTask = {
      ...mockSelectedTask,
      id: 'task-blocked',
      title: 'Send offer',
      dependencies: ['task-blocker'],
    };

    render(
      <TaskDetailsPanel
        {...mockProps}
        selectedTask={blockedTask}
        tasks={[blockedTask, blocker]}
        onOpenTask={onOpenTask}
        presentation="modal"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Approve budget/i }));
    expect(onOpenTask).toHaveBeenCalledWith('task-blocker');
  });

  it('renders meeting eyebrow for meeting source type', () => {
    render(<TaskDetailsPanel {...mockProps} />);

    expect(screen.getByText('Spotkanie')).toBeInTheDocument();
  });

  it('does not render eyebrow for unknown source type', () => {
    const unknownTask = { ...mockSelectedTask, sourceType: 'manual' as const };
    render(<TaskDetailsPanel {...mockProps} selectedTask={unknownTask} />);

    expect(screen.queryByText('Spotkanie')).not.toBeInTheDocument();
    expect(screen.queryByText('Google Tasks')).not.toBeInTheDocument();
  });

  describe('Google Sync Conflict Resolution', () => {
    const mockConflict = {
      detectedAt: '2026-03-25T12:00:00Z',
      sourceLabel: 'Google Tasks',
      localSnapshot: {
        title: 'Local Task',
        dueDate: '2026-03-26T10:00:00Z',
        notes: 'Local notes',
        completed: false,
      },
      remoteSnapshot: {
        title: 'Remote Task',
        dueDate: '2026-03-27T10:00:00Z',
        notes: 'Remote notes',
        completed: true,
      },
    };

    it('renders conflict resolution panel when conflict exists', () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      expect(screen.getByText('Konflikt synchronizacji Google')).toBeInTheDocument();
      expect(screen.getByText('Lokalne')).toBeInTheDocument();
      expect(screen.getByText('Google')).toBeInTheDocument();
      expect(screen.getByText('Finalna wersja')).toBeInTheDocument();
    });

    it('renders conflict resolution panel from nested googleSync state', () => {
      const taskWithConflict = {
        ...mockSelectedTask,
        googleSyncConflict: null,
        googleSync: {
          provider: 'google_tasks',
          status: 'conflict',
          conflict: mockConflict,
        },
      };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      expect(screen.getByText('Konflikt synchronizacji Google')).toBeInTheDocument();
      expect(screen.getByText('Local Task')).toBeInTheDocument();
      expect(screen.getByText('Remote Task')).toBeInTheDocument();
    });

    it('does not render conflict panel when no conflict', () => {
      render(<TaskDetailsPanel {...mockProps} />);

      expect(screen.queryByText('Konflikt synchronizacji Google')).not.toBeInTheDocument();
    });

    it('renders conflict resolution buttons', () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      expect(screen.getByRole('button', { name: 'Zachowaj Google' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zachowaj lokalne' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zapisz finalną wersję' })).toBeInTheDocument();
    });

    it('calls resolveConflict with google mode', async () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      const keepGoogleButton = screen.getByRole('button', { name: 'Zachowaj Google' });
      fireEvent.click(keepGoogleButton);

      await waitFor(() => {
        expect(mockProps.onResolveGoogleTaskConflict).toHaveBeenCalledWith(
          'task-1',
          'google',
          expect.objectContaining({
            title: 'Local Task',
            completed: false,
          })
        );
      });
    });

    it('calls resolveConflict with local mode', async () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      const keepLocalButton = screen.getByRole('button', { name: 'Zachowaj lokalne' });
      fireEvent.click(keepLocalButton);

      await waitFor(() => {
        expect(mockProps.onResolveGoogleTaskConflict).toHaveBeenCalledWith(
          'task-1',
          'local',
          expect.objectContaining({
            title: 'Local Task',
            completed: false,
          })
        );
      });
    });

    it('calls resolveConflict with merge mode', async () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      const saveFinalButton = screen.getByRole('button', { name: 'Zapisz finalną wersję' });
      fireEvent.click(saveFinalButton);

      await waitFor(() => {
        expect(mockProps.onResolveGoogleTaskConflict).toHaveBeenCalledWith(
          'task-1',
          'merge',
          expect.objectContaining({
            title: 'Local Task',
            completed: false,
          })
        );
      });
    });

    it('allows editing final version title', async () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      const titleInput = screen.getByLabelText('Tytuł') as HTMLInputElement;
      await userEvent.clear(titleInput);
      await userEvent.type(titleInput, 'New Final Title');

      expect(titleInput.value).toBe('New Final Title');
    });

    it('allows editing final version due date', async () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      const dueDateInput = screen.getByLabelText('Termin') as HTMLInputElement;
      // Note: datetime-local input converts to local timezone, so we check for the date part
      expect(dueDateInput.value).toMatch('2026-03-26');

      fireEvent.change(dueDateInput, { target: { value: '2026-03-28T14:00' } });

      expect(dueDateInput.value).toBe('2026-03-28T14:00');
    });

    it('allows editing final version notes', async () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      const notesTextarea = screen.getByLabelText('Notatki') as HTMLTextAreaElement;
      expect(notesTextarea.value).toBe('Local notes');

      await userEvent.type(notesTextarea, ' Updated');

      expect(notesTextarea.value).toBe('Local notes Updated');
    });

    it('allows toggling completed checkbox', async () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithConflict} />);

      const completedCheckbox = screen.getByLabelText('Zakończone') as HTMLInputElement;
      expect(completedCheckbox.checked).toBe(false);

      fireEvent.click(completedCheckbox);

      expect(completedCheckbox.checked).toBe(true);
    });

    it('handles missing conflict snapshots gracefully', () => {
      const partialConflict = {
        detectedAt: '2026-03-25T12:00:00Z',
        sourceLabel: 'Google Tasks',
        localSnapshot: null,
        remoteSnapshot: null,
      };
      const taskWithPartialConflict = { ...mockSelectedTask, googleSyncConflict: partialConflict };

      expect(() => {
        render(<TaskDetailsPanel {...mockProps} selectedTask={taskWithPartialConflict} />);
      }).not.toThrow();
    });

    it('does not call resolveConflict if handler is not provided', async () => {
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      const propsWithoutHandler = { ...mockProps, onResolveGoogleTaskConflict: undefined };

      render(<TaskDetailsPanel {...propsWithoutHandler} selectedTask={taskWithConflict} />);

      const keepGoogleButton = screen.getByRole('button', { name: 'Zachowaj Google' });
      fireEvent.click(keepGoogleButton);

      expect(mockProps.onResolveGoogleTaskConflict).not.toHaveBeenCalled();
    });

    it('logs error when conflict resolution fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const taskWithConflict = { ...mockSelectedTask, googleSyncConflict: mockConflict };
      const propsWithFailingHandler = {
        ...mockProps,
        onResolveGoogleTaskConflict: vi.fn().mockRejectedValue(new Error('API Error')),
      };

      render(<TaskDetailsPanel {...propsWithFailingHandler} selectedTask={taskWithConflict} />);

      const keepGoogleButton = screen.getByRole('button', { name: 'Zachowaj Google' });
      fireEvent.click(keepGoogleButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Google task conflict resolution failed.',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('memoization', () => {
    it('is wrapped with memo', () => {
      expect(TaskDetailsPanel.$$typeof).toBe(Symbol.for('react.memo'));
    });
  });
});

// -----------------------------------------------------------------
// Issue #0 - preview and edit must share the approved task form
// Date: 2026-06-14
// Bug: Task details had a separate metadata editor, so preview/edit looked
//      different from the new-task modal used in Tasks and Studio.
// Fix: Render the same unified task form shell for selected-task editing.
// -----------------------------------------------------------------
describe('Regression: Issue #0 - details panel uses unified task form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the screenshot-first task form controls in task details', () => {
    render(<TaskDetailsPanel {...mockProps} />);

    expect(screen.getByText('Tytuł zadania')).toBeInTheDocument();
    expect(screen.getByLabelText('Wybierz datę')).toBeInTheDocument();
    expect(screen.getByLabelText('Wybierz godzinę')).toBeInTheDocument();
    expect(screen.getByText('Cały dzień')).toBeInTheDocument();
    expect(screen.getByText('Osoba')).toBeInTheDocument();
    expect(screen.getByText('Priorytet')).toBeInTheDocument();
    expect(screen.getByText('Tagi')).toBeInTheDocument();
    expect(screen.getByText('Opis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wybierz źródło/i })).toBeInTheDocument();
  });

  it('autosaves edits from the shared title field', () => {
    render(<TaskDetailsPanel {...mockProps} />);

    fireEvent.change(screen.getByPlaceholderText('Wpisz tytuł zadania...'), {
      target: { value: 'Updated Task' },
    });

    expect(mockProps.onUpdateTask).toHaveBeenCalledWith('task-1', { title: 'Updated Task' });
  });
});
