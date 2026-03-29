import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import TagInput from '../shared/TagInput';
import { TASK_PRIORITIES } from '../lib/tasks';

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
}

interface TaskCreateFormProps {
  initialDraft?: Partial<TaskDraft>;
  boardColumns: any[];
  peopleOptions: string[];
  tagOptions: string[];
  onSubmit: (draft: TaskDraft) => void;
  onCancel?: () => void;
  showCancel?: boolean;
  autoFocus?: boolean;
}

export default function TaskCreateForm({
  initialDraft = {},
  boardColumns,
  peopleOptions,
  tagOptions,
  onSubmit,
  onCancel,
  showCancel = false,
  autoFocus = true,
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
  });

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = useCallback(
    (e: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
      e.preventDefault();
      if (!draft.title.trim()) return;
      onSubmit(draft);
      setDraft((prev) => ({ ...prev, title: '' }));
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
    },
    [draft, onSubmit]
  );

  return (
    <div className="task-create-form-container">
      {/* Quick Add Row */}
      <div className="relative w-full flex mb-4">
        <input
          ref={titleInputRef}
          value={draft.title}
          onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))}
          placeholder="Dodaj zadanie (N)..."
          className="w-full pl-4 pr-10 py-2 bg-slate-800 border border-slate-700/80 rounded-full text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="button"
          className="absolute right-1 top-1 bottom-1 aspect-square flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer"
          onClick={handleSubmit}
          disabled={!draft.title.trim()}
          title="Dodaj zadanie (Enter)"
        >
          <Plus className="w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Advanced Options */}
      <section className="todo-create-card todo-create-advanced" style={{ marginTop: 0 }}>
        <div className="todo-add-advanced">
          <label style={{ overflow: 'visible' }}>
            <span>Osoba</span>
            <TagInput
              tags={draft.owner ? [draft.owner] : []}
              suggestions={peopleOptions}
              onChange={(arr) => setDraft((previous) => ({ ...previous, owner: arr[0] || '' }))}
              placeholder="Wpisz lub wybierz osobę..."
              type="person"
            />
          </label>
          <label>
            <span>Grupa</span>
            <input
              list="task-groups-list"
              value={draft.group}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, group: event.target.value }))
              }
              placeholder="np. Sprint 14"
            />
          </label>
          <label>
            <span>Termin</span>
            <input
              type="datetime-local"
              value={draft.dueDate}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, dueDate: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Przypomnienie</span>
            <input
              type="datetime-local"
              value={draft.reminderAt}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, reminderAt: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Priorytet</span>
            <select
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
          </label>
          <label>
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, status: event.target.value }))
              }
            >
              {boardColumns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Tagi</span>
            <div style={{ flex: 1 }}>
              <TagInput
                tags={(draft.tags || '')
                  .split(',')
                  .map((t: string) => t.trim())
                  .filter(Boolean)}
                suggestions={tagOptions}
                onChange={(newTags: string[]) =>
                  setDraft((p) => ({ ...p, tags: newTags.join(', ') }))
                }
                placeholder="Dodaj tag..."
              />
            </div>
          </label>
          <label className="todo-inline-check">
            <input
              type="checkbox"
              checked={draft.important}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, important: event.target.checked }))
              }
            />
            <span>Ważne</span>
          </label>
        </div>
        {showCancel && onCancel && (
          <div className="flex justify-end mt-4">
            <button
              type="button"
              className="ghost-button"
              onClick={onCancel}
              style={{ fontSize: '13px', padding: '6px 16px' }}
            >
              Zamknij
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
