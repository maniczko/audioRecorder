import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  Clock3,
  Flag,
  Lightbulb,
  Plus,
  Sparkles,
  Tag,
  User,
} from 'lucide-react';
import TagInput from '../shared/TagInput';
import MentionTextarea from '../shared/MentionTextarea';
import { TASK_PRIORITIES } from '../lib/tasks';
import { Input } from '../ui/Input';
import './TaskDetailsPanelStyles.css';

export interface TaskDraft {
  title: string;
  owner: string;
  assignedTo: string[];
  group: string;
  priority: string;
  status: string;
  dueDate: string;
  reminderAt: string;
  tags: string;
  important: boolean;
  description: string;
  notes: string;
}

interface TaskCreateFormProps {
  initialDraft?: Partial<TaskDraft>;
  boardColumns: any[];
  peopleOptions: string[];
  tagOptions: string[];
  onSubmit: (draft: TaskDraft) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  showQuickAdd?: boolean;
  autoFocus?: boolean;
  formId?: string;
}

function splitDraftDateTime(value: string) {
  if (!value) return { date: '', time: '' };
  const [date, timeValue = ''] = value.split('T');
  return { date, time: timeValue.slice(0, 5) };
}

export default function TaskCreateForm({
  initialDraft = {},
  boardColumns,
  peopleOptions,
  tagOptions,
  onSubmit,
  onCancel,
  showCancel = false,
  showQuickAdd = true,
  autoFocus = true,
  formId,
}: TaskCreateFormProps) {
  const [draft, setDraft] = useState<TaskDraft>({
    title: initialDraft.title || '',
    owner: initialDraft.owner || '',
    assignedTo: initialDraft.assignedTo || [],
    group: initialDraft.group || '',
    priority: initialDraft.priority || 'medium',
    status: initialDraft.status || boardColumns[0]?.id || 'todo',
    dueDate: initialDraft.dueDate || '',
    reminderAt: initialDraft.reminderAt || '',
    tags: Array.isArray(initialDraft.tags)
      ? (initialDraft.tags as string[]).join(', ')
      : initialDraft.tags || '',
    important: initialDraft.important || false,
    description: initialDraft.description || '',
    notes: '',
  });

  const titleInputRef = useRef<HTMLInputElement>(null);
  const dueParts = splitDraftDateTime(draft.dueDate);
  const [allDay, setAllDay] = useState(false);

  const updateDueDatePart = useCallback((part: 'date' | 'time', value: string) => {
    setDraft((previous) => {
      const current = splitDraftDateTime(previous.dueDate);
      const nextDate = part === 'date' ? value : current.date;
      const nextTime = part === 'time' ? value : current.time;
      return {
        ...previous,
        dueDate: nextDate ? `${nextDate}T${nextTime || '00:00'}` : '',
      };
    });
  }, []);

  useEffect(() => {
    if (autoFocus && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = useCallback(
    (event: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
      event.preventDefault();
      if (!draft.title.trim()) return;
      onSubmit({ ...draft, title: draft.title.trim(), notes: '' });
      setDraft((previous) => ({ ...previous, title: '' }));
      titleInputRef.current?.focus();
    },
    [draft, onSubmit]
  );

  return (
    <form
      id={formId}
      className="task-create-form-container task-create-form"
      onSubmit={handleSubmit}
    >
      {!showQuickAdd ? (
        <div className="todo-create-detail-header">
          <label htmlFor="task-create-title">
            Tytuł zadania <span aria-hidden="true">*</span>
          </label>
          <Input
            id="task-create-title"
            ref={titleInputRef}
            className="todo-create-title-input"
            value={draft.title}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, title: event.target.value }))
            }
            placeholder="Wpisz tytuł zadania..."
            aria-label="Tytuł zadania"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSubmit(event);
              }
            }}
          />
        </div>
      ) : null}

      {showQuickAdd ? (
        <div className="todo-create-quick-row">
          <input
            ref={titleInputRef}
            value={draft.title}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, title: event.target.value }))
            }
            placeholder="Dodaj zadanie (N)..."
            className="todo-create-quick-input"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSubmit(event);
              }
            }}
          />
          <button
            type="button"
            className="todo-create-quick-submit"
            onClick={handleSubmit}
            disabled={!draft.title.trim()}
            title="Dodaj zadanie (Enter)"
            aria-label="Dodaj zadanie"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="todo-create-grid" data-density={showQuickAdd ? 'quick' : 'dialog'}>
        <label className="todo-create-field">
          <span>
            <Calendar size={16} aria-hidden="true" />
            Termin
          </span>
          <Input
            className="todo-detail-unified-field"
            type="date"
            value={dueParts.date}
            onChange={(event) => updateDueDatePart('date', event.target.value)}
            aria-label="Wybierz datę"
          />
        </label>

        <div className="todo-create-time-row">
          <label className="todo-create-field">
            <span>
              <Clock3 size={16} aria-hidden="true" />
              Godzina
            </span>
            <Input
              className="todo-detail-unified-field"
              type="time"
              value={dueParts.time}
              disabled={allDay}
              onChange={(event) => updateDueDatePart('time', event.target.value)}
              aria-label="Wybierz godzinę"
            />
          </label>
          <label className="todo-create-all-day">
            <span>Cały dzień</span>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => {
                setAllDay(event.target.checked);
                if (event.target.checked) {
                  updateDueDatePart('time', '00:00');
                }
              }}
              aria-label="Cały dzień"
            />
          </label>
        </div>

        <label className="todo-create-field">
          <span>
            <User size={16} aria-hidden="true" />
            Osoba
          </span>
          <TagInput
            tags={draft.owner ? [draft.owner] : []}
            suggestions={peopleOptions}
            onChange={(values) => setDraft((previous) => ({ ...previous, owner: values[0] || '' }))}
            placeholder="Wybierz osobę..."
            type="person"
          />
        </label>

        <label className="todo-create-field">
          <span>
            <Flag size={16} aria-hidden="true" />
            Priorytet
          </span>
          <div className="todo-create-select-wrap">
            <select
              className="todo-detail-unified-field"
              value={draft.priority}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, priority: event.target.value }))
              }
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.label}
                </option>
              ))}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </label>

        <label className="todo-create-field todo-create-field--full">
          <span>
            <Tag size={16} aria-hidden="true" />
            Tagi
          </span>
          <TagInput
            tags={(draft.tags || '')
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)}
            suggestions={tagOptions}
            onChange={(newTags) =>
              setDraft((previous) => ({ ...previous, tags: newTags.join(', ') }))
            }
            placeholder="Dodaj tag..."
          />
        </label>

        <label className="todo-create-field todo-create-field--full">
          <span>
            <Sparkles size={16} aria-hidden="true" />
            Opis
          </span>
          <MentionTextarea
            rows={4}
            value={draft.description}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, description: event.target.value }))
            }
            placeholder="Dodaj opis zadania..."
            suggestions={peopleOptions.map((person) =>
              typeof person === 'string' ? person : person
            )}
          />
        </label>

        <div className="todo-create-ai-helper">
          <span aria-hidden="true">
            <Lightbulb size={15} />
          </span>
          <p>Uzupełnij opis z nagrania, notatki lub transkrypcji</p>
          <button type="button">
            Wybierz źródło
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {showCancel && onCancel ? (
        <div className="todo-create-inline-footer">
          <button type="button" className="todo-create-cancel-button" onClick={onCancel}>
            Anuluj
          </button>
        </div>
      ) : null}
    </form>
  );
}
