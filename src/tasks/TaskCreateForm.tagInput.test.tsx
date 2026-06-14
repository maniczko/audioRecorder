import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskCreateForm from './TaskCreateForm';

vi.mock('../shared/MentionTextarea', () => ({
  default: function MockMentionTextarea({
    value,
    placeholder,
    onChange,
    rows,
  }: {
    value: string;
    placeholder: string;
    onChange: (event: any) => void;
    rows: number;
  }) {
    return (
      <textarea
        value={value}
        placeholder={placeholder}
        rows={rows}
        onChange={onChange}
        data-testid="mock-mention-textarea"
      />
    );
  },
}));

vi.mock('../lib/tasks', () => ({
  TASK_PRIORITIES: [
    { id: 'low', label: 'Niski' },
    { id: 'medium', label: 'Średni' },
    { id: 'high', label: 'Wysoki' },
  ],
  addCustomTaskTag: vi.fn(),
  addCustomTaskPerson: vi.fn(),
}));

const defaultProps = {
  boardColumns: [{ id: 'todo', label: 'Do zrobienia' }],
  peopleOptions: ['iwo'],
  tagOptions: ['iwo', 'ad-hoc'],
  onSubmit: vi.fn(),
};

// -----------------------------------------------------------------
// Issue #0 - tag dropdown selection in task preview/edit form
// Date: 2026-06-14
// Bug: The task preview form showed tag suggestions but choosing one did not
//      persist the selected tag in the editable task draft.
// Fix: Keep tag selection as a stable array patch from the form.
// -----------------------------------------------------------------
describe('Regression: Issue #0 - task tag selection', () => {
  it('adds a clicked tag suggestion to the task draft', () => {
    const onDraftChange = vi.fn();
    render(
      <TaskCreateForm
        {...defaultProps}
        mode="edit"
        showQuickAdd={false}
        resetOnSubmit={false}
        initialDraft={{ title: 'Test', tags: [] }}
        onDraftChange={onDraftChange}
      />
    );

    const tagInput = screen.getByPlaceholderText('Dodaj tag...');
    fireEvent.focus(tagInput);
    fireEvent.mouseDown(screen.getByRole('button', { name: /ad-hoc/i }));

    expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ['ad-hoc'] }), {
      tags: ['ad-hoc'],
    });
  });
});
