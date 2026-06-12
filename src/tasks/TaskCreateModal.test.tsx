import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
});
