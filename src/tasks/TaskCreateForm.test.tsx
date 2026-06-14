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

  it('renders create task fields without existing-task detail sections', () => {
    render(<TaskCreateForm {...defaultProps} />);

    expect(screen.getByPlaceholderText('Dodaj zadanie (N)...')).toBeInTheDocument();
    expect(screen.getByText('Termin')).toBeInTheDocument();
    expect(screen.getByText('Godzina')).toBeInTheDocument();
    expect(screen.getByLabelText('Cały dzień')).toBeInTheDocument();
    expect(screen.getByText('Osoba')).toBeInTheDocument();
    expect(screen.getByText('Priorytet')).toBeInTheDocument();
    expect(screen.getByText('Tagi')).toBeInTheDocument();
    expect(screen.getByText('Opis')).toBeInTheDocument();
    expect(screen.getByText(/Uzupełnij opis z nagrania/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wybierz źródło/i })).toBeInTheDocument();
    expect(screen.queryByText('Notatka')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aktywność' })).not.toBeInTheDocument();
  });

  it('does not render fields absent from the create modal reference', () => {
    render(<TaskCreateForm {...defaultProps} />);

    expect(screen.queryByText('Przypomnienie')).not.toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    expect(screen.queryByText('Grupa')).not.toBeInTheDocument();
    expect(screen.queryByText('Ważne')).not.toBeInTheDocument();
  });

  it('hides quick-add row when showQuickAdd is false', () => {
    render(<TaskCreateForm {...defaultProps} showQuickAdd={false} />);

    expect(screen.queryByPlaceholderText('Dodaj zadanie (N)...')).not.toBeInTheDocument();
    expect(screen.getByText('Tytuł zadania')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Wpisz tytuł zadania...')).toBeInTheDocument();
    expect(screen.getByText('Osoba')).toBeInTheDocument();
    expect(screen.getByText('Priorytet')).toBeInTheDocument();
  });

  it('renders screenshot-first date and time controls in detail create mode', () => {
    render(
      <TaskCreateForm
        {...defaultProps}
        showQuickAdd={false}
        initialDraft={{ dueDate: '2026-06-09T08:32' }}
      />
    );

    expect(screen.getByLabelText('Wybierz datę')).toHaveValue('09.06.2026');
    expect(screen.getByLabelText('Wybierz godzinę')).toHaveValue('08:32');
    expect(screen.queryByRole('heading', { name: 'Aktywność' })).not.toBeInTheDocument();
  });

  it('submits from the detail title field when Enter is pressed', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} showQuickAdd={false} onSubmit={onSubmit} />);

    const titleInput = screen.getByPlaceholderText('Wpisz tytuł zadania...');
    fireEvent.change(titleInput, { target: { value: 'Nowe zadanie z panelu' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Nowe zadanie z panelu' })
    );
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

    const cancelButton = screen.getByText('Anuluj');
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('hides cancel button when showCancel is false', () => {
    render(<TaskCreateForm {...defaultProps} />);
    expect(screen.queryByText('Anuluj')).not.toBeInTheDocument();
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

  it('includes description and keeps notes empty in submitted draft', () => {
    const onSubmit = vi.fn();
    render(<TaskCreateForm {...defaultProps} onSubmit={onSubmit} />);

    const textareas = screen.getAllByTestId('mock-mention-textarea');
    fireEvent.change(textareas[0], { target: { value: 'Opis zadania' } });

    const titleInput = screen.getByPlaceholderText('Dodaj zadanie (N)...');
    fireEvent.change(titleInput, { target: { value: 'Task' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Opis zadania',
        notes: '',
      })
    );
  });
});

// -----------------------------------------------------------------
// Issue #0 - task forms must use one screenshot-first form everywhere
// Date: 2026-06-14
// Bug: Create/edit task forms used native date/time inputs and divergent
//      layouts, so Studio, Tasks and details did not match the approved modal.
// Fix: Reuse the same form shell with custom date, time and source pickers.
// -----------------------------------------------------------------
describe('Regression: Issue #0 - unified screenshot task form', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a calendar popover and writes selected date in Polish format', () => {
    render(
      <TaskCreateForm
        {...defaultProps}
        showQuickAdd={false}
        initialDraft={{ dueDate: '2026-06-09T08:32' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Otwórz kalendarz' }));
    expect(screen.getByRole('dialog', { name: 'Kalendarz terminu' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wybierz 14.06.2026' }));

    expect(screen.getByLabelText('Wybierz datę')).toHaveValue('14.06.2026');
  });

  it('opens a time list and selects a 15-minute slot', () => {
    render(
      <TaskCreateForm
        {...defaultProps}
        showQuickAdd={false}
        initialDraft={{ dueDate: '2026-06-09T08:32' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Otwórz listę godzin' }));
    expect(screen.getByRole('listbox', { name: 'Lista godzin' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: '09:00' }));

    expect(screen.getByLabelText('Wybierz godzinę')).toHaveValue('09:00');
  });

  it('shows required title validation only after submit attempt', () => {
    render(<TaskCreateForm {...defaultProps} showQuickAdd={false} />);

    expect(screen.queryByText('* Pole wymagane')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz formularz zadania' }));

    expect(screen.getByText('* Pole wymagane')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Wpisz tytuł zadania...')).toHaveFocus();
  });

  it('renders source picker options for description enrichment', () => {
    render(<TaskCreateForm {...defaultProps} showQuickAdd={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Wybierz źródło/i }));

    expect(screen.getByRole('option', { name: 'Z nagrania' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Z notatki' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Z transkrypcji' })).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------
// Issue #0 - task assignee could not replace "Nieprzypisane"
// Date: 2026-06-14
// Bug: The person field appended a selected person after the existing
//      "Nieprzypisane" token, while the form kept values[0] as owner.
// Fix: Treat the person field as single-select and use the newest value.
// -----------------------------------------------------------------
describe('Regression: Issue #0 - task assignee selection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces the unassigned token when a person is selected', () => {
    const onDraftChange = vi.fn();
    render(
      <TaskCreateForm
        {...defaultProps}
        showQuickAdd={false}
        initialDraft={{
          title: 'Test',
          owner: 'Nieprzypisane',
          assignedTo: ['Nieprzypisane'],
        }}
        peopleOptions={['iwo']}
        onDraftChange={onDraftChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Wybierz osobę...'), {
      target: { value: 'iwo' },
    });

    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ owner: 'iwo', assignedTo: ['iwo'] }),
      { owner: 'iwo', assignedTo: ['iwo'] }
    );
  });
});
