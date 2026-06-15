import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import './TasksWorkspaceViewStyles.css';

export interface TaskDraft {
  title: string;
  owner: string;
  assignedTo: string[];
  group: string;
  priority: string;
  status: string;
  dueDate: string;
  reminderAt: string;
  tags: string | string[];
  important: boolean;
  description: string;
  notes: string;
  allDay?: boolean;
  descriptionSource?: string;
}

interface TaskCreateFormProps {
  initialDraft?: Partial<TaskDraft>;
  boardColumns: any[];
  peopleOptions: Array<string | { id?: string; name?: string; label?: string }>;
  tagOptions: string[];
  onSubmit: (draft: TaskDraft) => void;
  onDraftChange?: (draft: TaskDraft, patch: Partial<TaskDraft>) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  showQuickAdd?: boolean;
  autoFocus?: boolean;
  formId?: string;
  mode?: 'create' | 'edit';
  resetOnSubmit?: boolean;
}

const SOURCE_OPTIONS = [
  { id: 'recording', label: 'Z nagrania' },
  { id: 'note', label: 'Z notatki' },
  { id: 'transcript', label: 'Z transkrypcji' },
];

const WEEK_DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('pl-PL', {
  month: 'long',
  year: 'numeric',
});

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateForInput(date: Date) {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDisplayDate(value: string) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return '';

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return '';
  }

  return formatIsoDate(parsed);
}

function toDisplayDate(value: string) {
  if (!value) return '';

  const [datePart] = value.split('T');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : formatDateForInput(parsed);
}

function splitDraftDateTime(value: string) {
  if (!value) return { date: '', time: '' };
  const [date, timeValue = ''] = value.split('T');
  return {
    date,
    time: /^\d{2}:\d{2}/.test(timeValue) ? timeValue.slice(0, 5) : '',
  };
}

function composeDueDate(displayDate: string, time: string, allDay: boolean) {
  const isoDate = parseDisplayDate(displayDate);
  if (!isoDate) return '';
  return `${isoDate}T${allDay ? '00:00' : time || '00:00'}`;
}

function maskDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function isValidTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function buildTimeOptions() {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 15) {
      options.push(`${pad(hour)}:${pad(minute)}`);
    }
  }
  return options;
}

function getCalendarDays(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(first);
  const dayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - dayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function normalizePeopleOptions(
  peopleOptions: Array<string | { id?: string; name?: string; label?: string }>
) {
  return peopleOptions
    .map((person) => (typeof person === 'string' ? person : person.name || person.label || ''))
    .filter(Boolean);
}

function normalizeDraftTags(tags: string | string[] | undefined) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  return String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isUnassignedPerson(value: string) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return normalized === 'nieprzypisane' || normalized === 'unassigned';
}

function normalizeAssignees(values: string | string[] | undefined) {
  const list = Array.isArray(values)
    ? values
    : String(values || '')
        .split(',')
        .map((value) => value.trim());

  const seen = new Set<string>();
  return list
    .map((value) => String(value || '').trim())
    .filter((value) => value && !isUnassignedPerson(value))
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildInitialDraft(
  initialDraft: Partial<TaskDraft>,
  boardColumns: any[],
  showQuickAdd: boolean
) {
  const today = new Date();
  const defaultDueDate = showQuickAdd ? '' : `${formatIsoDate(today)}T09:00`;
  const assignedTo = normalizeAssignees(
    initialDraft.assignedTo?.length ? initialDraft.assignedTo : initialDraft.owner
  );
  const owner =
    assignedTo[0] || (isUnassignedPerson(initialDraft.owner || '') ? '' : initialDraft.owner || '');

  return {
    title: initialDraft.title || '',
    owner,
    assignedTo,
    group: initialDraft.group || '',
    priority: initialDraft.priority || 'medium',
    status: initialDraft.status || boardColumns[0]?.id || 'todo',
    dueDate: initialDraft.dueDate || defaultDueDate,
    reminderAt: initialDraft.reminderAt || '',
    tags: normalizeDraftTags(initialDraft.tags),
    important: initialDraft.important || false,
    description: initialDraft.description || '',
    notes: initialDraft.notes || '',
    allDay: Boolean(initialDraft.allDay),
    descriptionSource: initialDraft.descriptionSource || '',
  };
}

export default function TaskCreateForm({
  initialDraft = {},
  boardColumns,
  peopleOptions,
  tagOptions,
  onSubmit,
  onDraftChange,
  onCancel,
  showCancel = false,
  showQuickAdd = true,
  autoFocus = true,
  formId,
  mode = 'create',
  resetOnSubmit = mode === 'create',
}: TaskCreateFormProps) {
  const [draft, setDraft] = useState<TaskDraft>(() =>
    buildInitialDraft(initialDraft, boardColumns, showQuickAdd)
  );
  const [dateInput, setDateInput] = useState(() => toDisplayDate(draft.dueDate));
  const [timeInput, setTimeInput] = useState(() => splitDraftDateTime(draft.dueDate).time);
  const [allDay, setAllDay] = useState(Boolean(initialDraft.allDay));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const isoDate = parseDisplayDate(toDisplayDate(draft.dueDate));
    return isoDate ? new Date(`${isoDate}T00:00`) : new Date();
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [dateTouched, setDateTouched] = useState(false);
  const [timeTouched, setTimeTouched] = useState(false);

  const draftRef = useRef<TaskDraft>(draft);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const timePickerRef = useRef<HTMLDivElement>(null);
  const sourcePickerRef = useRef<HTMLDivElement>(null);

  const peopleLabels = useMemo(() => normalizePeopleOptions(peopleOptions), [peopleOptions]);
  const timeOptions = useMemo(buildTimeOptions, []);
  const requiresDetailedValidation = !showQuickAdd;
  const selectedAssignees = normalizeAssignees(
    draft.assignedTo?.length ? draft.assignedTo : draft.owner
  );

  const initialDraftKey = [
    initialDraft.title,
    initialDraft.owner,
    (initialDraft.assignedTo || []).join('|'),
    initialDraft.priority,
    initialDraft.status,
    initialDraft.dueDate,
    Array.isArray(initialDraft.tags) ? initialDraft.tags.join('|') : initialDraft.tags,
    initialDraft.description,
    initialDraft.notes,
  ].join('::');

  useEffect(() => {
    const nextDraft = buildInitialDraft(initialDraft, boardColumns, showQuickAdd);
    const parts = splitDraftDateTime(nextDraft.dueDate);
    const nextDate = toDisplayDate(nextDraft.dueDate);

    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setDateInput(nextDate);
    setTimeInput(parts.time);
    setAllDay(Boolean(nextDraft.allDay));
    setCalendarMonth(parts.date ? new Date(`${parts.date}T00:00`) : new Date());
    setSubmitAttempted(false);
    setTitleTouched(false);
    setDateTouched(false);
    setTimeTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraftKey, boardColumns[0]?.id, showQuickAdd]);

  useEffect(() => {
    if (autoFocus && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (calendarOpen && datePickerRef.current && !datePickerRef.current.contains(target)) {
        setCalendarOpen(false);
      }
      if (timeOpen && timePickerRef.current && !timePickerRef.current.contains(target)) {
        setTimeOpen(false);
      }
      if (sourceOpen && sourcePickerRef.current && !sourcePickerRef.current.contains(target)) {
        setSourceOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setCalendarOpen(false);
      setTimeOpen(false);
      setSourceOpen(false);
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [calendarOpen, sourceOpen, timeOpen]);

  const applyDraftPatch = useCallback(
    (patch: Partial<TaskDraft>) => {
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      onDraftChange?.(next, patch);
    },
    [onDraftChange]
  );

  const updateSchedule = useCallback(
    (nextDateInput: string, nextTimeInput: string, nextAllDay: boolean) => {
      const dueDate = composeDueDate(nextDateInput, nextTimeInput, nextAllDay);
      applyDraftPatch({ dueDate, allDay: nextAllDay });
    },
    [applyDraftPatch]
  );

  const titleInvalid = (submitAttempted || titleTouched) && !draft.title.trim();
  const dateInvalid =
    requiresDetailedValidation && (submitAttempted || dateTouched) && !parseDisplayDate(dateInput);
  const timeInvalid =
    requiresDetailedValidation &&
    !allDay &&
    (submitAttempted || timeTouched) &&
    !isValidTime(timeInput);

  const handleSubmit = useCallback(
    (event: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
      event.preventDefault();
      setSubmitAttempted(true);

      const nextTitleInvalid = !draft.title.trim();
      const nextDateInvalid = requiresDetailedValidation && !parseDisplayDate(dateInput);
      const nextTimeInvalid = requiresDetailedValidation && !allDay && !isValidTime(timeInput);

      if (nextTitleInvalid) {
        titleInputRef.current?.focus();
        return;
      }
      if (nextDateInvalid || nextTimeInvalid) {
        return;
      }

      const dueDate = showQuickAdd ? draft.dueDate : composeDueDate(dateInput, timeInput, allDay);
      onSubmit({
        ...draft,
        title: draft.title.trim(),
        dueDate,
        allDay,
        notes: draft.notes || '',
      });

      if (resetOnSubmit) {
        applyDraftPatch({ title: '' });
        setSubmitAttempted(false);
        setTitleTouched(false);
        titleInputRef.current?.focus();
      }
    },
    [
      allDay,
      applyDraftPatch,
      dateInput,
      draft,
      onSubmit,
      requiresDetailedValidation,
      resetOnSubmit,
      showQuickAdd,
      timeInput,
    ]
  );

  const selectedSource = SOURCE_OPTIONS.find((option) => option.id === draft.descriptionSource);
  const calendarDays = getCalendarDays(calendarMonth);
  const selectedIsoDate = parseDisplayDate(dateInput);
  const selectedMonthLabel = MONTH_FORMATTER.format(calendarMonth);

  return (
    <form
      id={formId}
      className="task-create-form-container task-create-form"
      data-mode={mode}
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
            data-modal-initial-focus="true"
            className="todo-create-title-input"
            value={draft.title}
            onBlur={() => setTitleTouched(true)}
            onChange={(event) => applyDraftPatch({ title: event.target.value })}
            placeholder="Wpisz tytuł zadania..."
            aria-label="Tytuł zadania"
            aria-describedby={titleInvalid ? 'task-create-title-error' : undefined}
            aria-invalid={titleInvalid}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleSubmit(event);
              }
            }}
          />
          {titleInvalid ? (
            <p id="task-create-title-error" className="todo-create-field-error">
              * Pole wymagane
            </p>
          ) : null}
        </div>
      ) : null}

      {showQuickAdd ? (
        <div className="todo-create-quick-row">
          <input
            ref={titleInputRef}
            value={draft.title}
            onChange={(event) => applyDraftPatch({ title: event.target.value })}
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
        <div className="todo-create-field todo-create-picker" ref={datePickerRef}>
          <label htmlFor="task-create-date">
            <Calendar size={16} aria-hidden="true" />
            Termin <span aria-hidden="true">*</span>
          </label>
          <div className="todo-create-picker-control">
            <input
              id="task-create-date"
              className="todo-detail-unified-field"
              value={dateInput}
              onBlur={() => setDateTouched(true)}
              onChange={(event) => {
                const next = maskDateInput(event.target.value);
                setDateInput(next);
                updateSchedule(next, timeInput, allDay);
              }}
              onFocus={() => setCalendarOpen(true)}
              placeholder="dd.mm.rrrr"
              aria-label="Wybierz datę"
              aria-invalid={dateInvalid}
              aria-describedby={dateInvalid ? 'task-create-date-error' : undefined}
            />
            <button
              type="button"
              className="todo-create-picker-button"
              onClick={() => setCalendarOpen((value) => !value)}
              aria-label="Otwórz kalendarz"
              aria-expanded={calendarOpen}
            >
              <Calendar size={18} aria-hidden="true" />
            </button>
          </div>
          {dateInvalid ? (
            <p id="task-create-date-error" className="todo-create-field-error">
              Wpisz datę w formacie dd.mm.rrrr.
            </p>
          ) : null}

          {calendarOpen ? (
            <div className="todo-create-calendar" role="dialog" aria-label="Kalendarz terminu">
              <div className="todo-create-calendar-head">
                <button
                  type="button"
                  aria-label="Poprzedni miesiąc"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                    )
                  }
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
                <strong>{selectedMonthLabel}</strong>
                <button
                  type="button"
                  aria-label="Następny miesiąc"
                  onClick={() =>
                    setCalendarMonth(
                      new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                    )
                  }
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="todo-create-calendar-weekdays" aria-hidden="true">
                {WEEK_DAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="todo-create-calendar-grid">
                {calendarDays.map((day) => {
                  const isoDate = formatIsoDate(day);
                  const displayValue = formatDateForInput(day);
                  const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isSelected = isoDate === selectedIsoDate;
                  return (
                    <button
                      key={isoDate}
                      type="button"
                      className={isSelected ? 'selected' : ''}
                      data-muted={!isCurrentMonth}
                      aria-label={`Wybierz ${displayValue}`}
                      onClick={() => {
                        setDateInput(displayValue);
                        updateSchedule(displayValue, timeInput, allDay);
                        setCalendarOpen(false);
                      }}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="todo-create-calendar-footer">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const displayValue = formatDateForInput(today);
                    setCalendarMonth(today);
                    setDateInput(displayValue);
                    updateSchedule(displayValue, timeInput, allDay);
                    setCalendarOpen(false);
                  }}
                >
                  Dziś
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="todo-create-time-row">
          <div className="todo-create-field todo-create-picker" ref={timePickerRef}>
            <label htmlFor="task-create-time">
              <Clock3 size={16} aria-hidden="true" />
              Godzina
            </label>
            <div className="todo-create-picker-control">
              <input
                id="task-create-time"
                className="todo-detail-unified-field"
                value={timeInput}
                disabled={allDay}
                onBlur={() => setTimeTouched(true)}
                onChange={(event) => {
                  const next = event.target.value.replace(/[^\d:]/g, '').slice(0, 5);
                  setTimeInput(next);
                  updateSchedule(dateInput, next, allDay);
                }}
                onFocus={() => setTimeOpen(true)}
                placeholder="09:00"
                aria-label="Wybierz godzinę"
                aria-invalid={timeInvalid}
                aria-describedby={timeInvalid ? 'task-create-time-error' : undefined}
              />
              <button
                type="button"
                className="todo-create-picker-button"
                disabled={allDay}
                onClick={() => setTimeOpen((value) => !value)}
                aria-label="Otwórz listę godzin"
                aria-expanded={timeOpen}
              >
                <ChevronDown size={18} aria-hidden="true" />
              </button>
            </div>
            {timeInvalid ? (
              <p id="task-create-time-error" className="todo-create-field-error">
                Wybierz godzinę w formacie hh:mm.
              </p>
            ) : null}
            {timeOpen && !allDay ? (
              <div className="todo-create-time-list" role="listbox" aria-label="Lista godzin">
                {timeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={option === timeInput}
                    className={option === timeInput ? 'selected' : ''}
                    onClick={() => {
                      setTimeInput(option);
                      updateSchedule(dateInput, option, allDay);
                      setTimeOpen(false);
                    }}
                  >
                    {option}
                    {option === timeInput ? <Check size={16} aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <label className="todo-create-all-day">
            <span>Cały dzień</span>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => {
                const checked = event.target.checked;
                setAllDay(checked);
                updateSchedule(dateInput, checked ? '00:00' : timeInput, checked);
              }}
              aria-label="Cały dzień"
            />
          </label>
        </div>

        <label className="todo-create-field">
          <span>
            <User size={16} aria-hidden="true" />
            Osoba <span aria-hidden="true">*</span>
          </span>
          <TagInput
            tags={selectedAssignees}
            suggestions={peopleLabels}
            onChange={(values) => {
              const assignedTo = normalizeAssignees(values);
              applyDraftPatch({
                owner: assignedTo[0] || '',
                assignedTo,
              });
            }}
            placeholder="Wybierz osoby..."
            type="person"
          />
          <small className="todo-create-field-hint">
            Możesz przypisać kilka osób. Pierwsza osoba zostanie głównym ownerem.
          </small>
        </label>

        <label className="todo-create-field">
          <span>
            <Flag size={16} aria-hidden="true" />
            Priorytet <span aria-hidden="true">*</span>
          </span>
          <div className="todo-create-select-wrap">
            <select
              className="todo-detail-unified-field"
              value={draft.priority}
              onChange={(event) => applyDraftPatch({ priority: event.target.value })}
              aria-label="Priorytet"
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
            tags={normalizeDraftTags(draft.tags)}
            suggestions={tagOptions}
            onChange={(newTags) => applyDraftPatch({ tags: newTags })}
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
            onChange={(event) => applyDraftPatch({ description: event.target.value })}
            placeholder="Dodaj opis zadania..."
            suggestions={peopleLabels}
          />
        </label>

        <div className="todo-create-ai-helper" ref={sourcePickerRef}>
          <span aria-hidden="true">
            <Lightbulb size={15} />
          </span>
          <p>Uzupełnij opis z nagrania, notatki lub transkrypcji</p>
          <div className="todo-create-source-picker">
            <button
              type="button"
              onClick={() => setSourceOpen((value) => !value)}
              aria-expanded={sourceOpen}
            >
              {selectedSource?.label || 'Wybierz źródło'}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {sourceOpen ? (
              <div className="todo-create-source-list" role="listbox" aria-label="Źródło opisu">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={draft.descriptionSource === option.id}
                    onClick={() => {
                      applyDraftPatch({ descriptionSource: option.id });
                      setSourceOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <button type="submit" className="todo-create-hidden-submit">
        Zapisz formularz zadania
      </button>

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
