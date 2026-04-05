import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TaskCreateForm from './TaskCreateForm';

vi.mock('../shared/TagInput', () => ({
  default: function MockTagInput({
    tags,
    placeholder,
    onChange,
  }: {
    tags: string[];
    placeholder: string;
    onChange: (t: string[]) => void;
  }) {
    return (
      <div data-testid="mock-tag-input">
        <span data-testid="mock-tags-list">{(tags || []).join(',')}</span>
        <input
          placeholder={placeholder}
          data-testid="mock-tag-input-field"
          onChange={(e) => onChange([...tags, e.target.value])}
        />
      </div>
    );
  },
}));

vi.mock('../lib/tasks', () => ({
  TASK_PRIORITIES: [
    { id: 'low', label: 'Niski' },
    { id: 'medium', label: 'Średni' },
    { id: 'high', label: 'Wysoki' },
    { id: 'urgent', label: 'Krytyczny' },
  ],
}));

const defaultBoardColumns = [
  { id: 'todo', label: 'Do zrobienia' },
  { id: 'in-progress', label: 'W toku' },
  { id: 'done', label: 'Gotowe' },
];

const defaultProps = {
  boardColumns: defaultBoardColumns,
  peopleOptions: ['Jan', 'Anna'],
  tagOptions: ['frontend', 'backend'],
  onSubmit: vi.fn(),
};

describe('TaskCreateForm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders all form fields', () => {
    render(<TaskCreateForm {...defaultProps} />);

    expect(screen.getByPlaceholderText('Dodaj zadanie (N)...')).toBeInTheDocument();
    expect(screen.getByText('Osoba')).toBeInTheDocument();
    expect(screen.getByText('Grupa')).toBeInTheDocument();
    expect(screen.getByText('Termin')).toBeInTheDocument();
    expect(screen.getByText('Przypomnienie')).toBeInTheDocument();
    expect(screen.getByText('Priorytet')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Tagi')).toBeInTheDocument();
    expect(screen.getByText('Ważne')).toBeInTheDocument();
  });

  it('hides quick-add row when showQuickAdd is false', () => {
    render(<TaskCreateForm {...defaultProps} showQuickAdd={false} />);

    expect(screen.queryByPlaceholderText('Dodaj zadanie (N)...')).not.toBeInTheDocument();
    // Advanced fields still visible
    expect(screen.getByText('Osoba')).toBeInTheDocument();
    expect(screen.getByText('Priorytet')).toBeInTheDocument();
  });

  it('shows quick-add row by default', () => {
    render(<TaskCreateForm {...defaultProps} />);
    expect(screen.getByPlaceholderText('Dodaj zadanie (N)...')).toBeInTheDocument();
  });

  it('calls onSubmit with draft when title is filled and Enter pressed', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} onSubmit={onSubmit} />);

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...');
    fireEvent.change(titleInput, { target: { value: 'Nowe zadanie' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Nowe zadanie',
        priority: 'medium',
        status: 'todo',
      })
    );
  });

  it('does not submit when title is empty', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} onSubmit={onSubmit} />);

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...');
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears title after successful submit', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} onSubmit={onSubmit} />);

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Test' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(titleInput.value).toBe('');
  });

  it('renders board columns as status options', () => {
    render(<TaskCreateForm {...defaultProps} />);

    const statusSelect = screen.getByDisplayValue('Do zrobienia');
    expect(statusSelect).toBeInTheDocument();

    const options = statusSelect.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Do zrobienia');
    expect(options[1].textContent).toBe('W toku');
    expect(options[2].textContent).toBe('Gotowe');
  });

  it('renders priority options', () => {
    render(<TaskCreateForm {...defaultProps} />);

    const prioritySelect = screen.getByDisplayValue('Średni');
    expect(prioritySelect).toBeInTheDocument();
  });

  it('uses initialDraft values', () => {
    render(
      <TaskCreateForm
        {...defaultProps}
        initialDraft={{ title: 'Wstępny', priority: 'high', group: 'Sprint 1' }}
      />
    );

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...') as HTMLInputElement;
    expect(titleInput.value).toBe('Wstępny');
    expect(screen.getByDisplayValue('Wysoki')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sprint 1')).toBeInTheDocument();
  });

  it('shows cancel button when showCancel and onCancel provided', () => {
    const onCancel = vi.fn();
    render(<TaskCreateForm {...defaultProps} showCancel onCancel={onCancel} />);

    const cancelButton = screen.getByText('Zamknij');
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('hides cancel button when showCancel is false', () => {
    render(<TaskCreateForm {...defaultProps} />);
    expect(screen.queryByText('Zamknij')).not.toBeInTheDocument();
  });

  it('disables submit button when title is empty', () => {
    render(<TaskCreateForm {...defaultProps} />);
    const submitButton = screen.getByTitle('Dodaj zadanie (Enter)');
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when title has text', () => {
    render(<TaskCreateForm {...defaultProps} />);

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...');
    fireEvent.change(titleInput, { target: { value: 'Something' } });

    const submitButton = screen.getByTitle('Dodaj zadanie (Enter)');
    expect(submitButton).not.toBeDisabled();
  });

  it('changes group via input', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} onSubmit={onSubmit} />);

    const groupInput = screen.getByPlaceholderText('np. Sprint 14');
    fireEvent.change(groupInput, { target: { value: 'Sprint 5' } });

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...');
    fireEvent.change(titleInput, { target: { value: 'Task' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ group: 'Sprint 5' }));
  });

  it('changes status via select', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} onSubmit={onSubmit} />);

    const statusSelect = screen.getByDisplayValue('Do zrobienia');
    fireEvent.change(statusSelect, { target: { value: 'done' } });

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...');
    fireEvent.change(titleInput, { target: { value: 'Task' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
  });

  it('toggles important checkbox', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} onSubmit={onSubmit} />);

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...');
    fireEvent.change(titleInput, { target: { value: 'Task' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ important: true }));
  });
});
