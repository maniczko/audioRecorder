import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

vi.mock('../shared/MentionTextarea', () => ({
  default: function MockMentionTextarea({
    value,
    placeholder,
    onChange,
    rows,
  }: {
    value: string;
    placeholder: string;
    onChange: (e: any) => void;
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

  it('renders all form fields matching TaskDetailsPanel', () => {
    render(<TaskCreateForm {...defaultProps} />);

    expect(screen.getByPlaceholderText('Dodaj zadanie (N)...')).toBeInTheDocument();
    expect(screen.getByText('Termin')).toBeInTheDocument();
    expect(screen.getByText('Osoba')).toBeInTheDocument();
    expect(screen.getByText('Priorytet')).toBeInTheDocument();
    expect(screen.getByText('Tagi')).toBeInTheDocument();
    expect(screen.getByText('Opis')).toBeInTheDocument();
    expect(screen.getByText('Notatka')).toBeInTheDocument();
  });

  it('does not render fields absent from TaskDetailsPanel', () => {
    render(<TaskCreateForm {...defaultProps} />);

    expect(screen.queryByText('Przypomnienie')).not.toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Grupa')).not.toBeInTheDocument();
    expect(screen.queryByText('Ważne')).not.toBeInTheDocument();
  });

  it('hides quick-add row when showQuickAdd is false', () => {
    render(<TaskCreateForm {...defaultProps} showQuickAdd={false} />);

    expect(screen.queryByPlaceholderText('Dodaj zadanie (N)...')).not.toBeInTheDocument();
    // Fields still visible
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

  it('renders priority options', () => {
    render(<TaskCreateForm {...defaultProps} />);

    const prioritySelect = screen.getByDisplayValue('Średni');
    expect(prioritySelect).toBeInTheDocument();
  });

  it('uses initialDraft values', () => {
    render(
      <TaskCreateForm {...defaultProps} initialDraft={{ title: 'Wstępny', priority: 'high' }} />
    );

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...') as HTMLInputElement;
    expect(titleInput.value).toBe('Wstępny');
    expect(screen.getByDisplayValue('Wysoki')).toBeInTheDocument();
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

  it('includes description and notes in submitted draft', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} onSubmit={onSubmit} />);

    const textareas = screen.getAllByTestId('mock-mention-textarea');
    fireEvent.change(textareas[0], { target: { value: 'Opis zadania' } });
    fireEvent.change(textareas[1], { target: { value: 'Notatka do zadania' } });

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...');
    fireEvent.change(titleInput, { target: { value: 'Task' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Opis zadania',
        notes: 'Notatka do zadania',
      })
    );
  });
});
