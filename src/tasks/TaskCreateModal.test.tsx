import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TaskCreateModal from './TaskCreateModal';

// -----------------------------------------------------------------
// Issue #0 - new task create must be a floating dialog
// Date: 2026-06-11
// Bug: Creating a task reused inline/aside detail UI, which narrowed the list
//      workspace and mixed create mode with existing-task details.
// Fix: Render create mode in a right-side modal with close/cancel/outside
//      dismissal and without notes/activity detail-only sections.
// -----------------------------------------------------------------
describe('Regression: Issue #0 - task create uses floating modal', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    boardColumns: [{ id: 'todo', label: 'Todo' }],
    peopleOptions: ['User A'],
    tagOptions: ['urgent'],
  };

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders the create dialog anatomy and create-only form', () => {
    render(<TaskCreateModal {...baseProps} />);

    expect(screen.getByRole('dialog', { name: 'Nowe zadanie' })).toBeInTheDocument();
    expect(screen.getByText('Tytuł zadania')).toBeInTheDocument();
    expect(screen.getByText(/Uzupełnij opis z nagrania/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj zadanie' })).toBeInTheDocument();
    expect(screen.queryByText('Notatka')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aktywność' })).not.toBeInTheDocument();
  });

  it('closes from Escape, outside click, X and cancel', () => {
    const onClose = vi.fn();
    const { rerender } = render(<TaskCreateModal {...baseProps} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    const overlay = document.querySelector('.task-create-modal-overlay') as HTMLElement;
    fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(<TaskCreateModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(<TaskCreateModal {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------
  // Issue #0 - task modal scroll lock must restore previous body state
  // Date: 2026-06-23
  // Bug: Closing the create modal cleared body overflow instead of restoring
  //      the value that existed before opening the dialog.
  // Fix: Keep the previous overflow value and restore it on cleanup.
  // -----------------------------------------------------------------
  it('restores the previous body overflow after the modal closes', () => {
    document.body.style.overflow = 'clip';

    const { unmount } = render(<TaskCreateModal {...baseProps} />);

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('clip');
  });
});
