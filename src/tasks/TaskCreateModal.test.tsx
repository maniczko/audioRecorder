import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TaskCreateModal from './TaskCreateModal';

// ─────────────────────────────────────────────────────────────────
// Regression: Issue #0 — TaskCreateModal styling breaks in Studio
// Date: 2026-03-29
// Bug: TaskCreateModal lacked explicit import of tasks.css leading to
//      unformatted UI when opened outside of the main Tasks view.
// Fix: Added `import '../styles/tasks.css';` to the modal component.
// ─────────────────────────────────────────────────────────────────
describe('Regression: Issue #0 — TaskCreateModal layout relies on tasks.css', () => {
  it('renders with the correct CSS context classes', () => {
    render(
      <TaskCreateModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={() => {}}
        boardColumns={[{ id: 'todo', label: 'Todo' }]}
        peopleOptions={['User A']}
        tagOptions={['urgent']}
      />
    );

    // Verify modal content is rendered
    expect(screen.getByText('Utwórz nowe zadanie')).toBeInTheDocument();

    // The modal's styling relies on tasks-layout ms-todo wrapper
    // We target it by looking around the form elements.
    // The wrapper explicitly applies `.tasks-layout.ms-todo`
    const wrapper = document.querySelector('.tasks-layout.ms-todo');
    expect(wrapper).toBeInTheDocument();

    // The form uses `.todo-detail-form` layout (unified with TaskDetailsPanel)
    const formLayout = document.querySelector('.todo-detail-form');
    expect(formLayout).toBeInTheDocument();
  });
});
