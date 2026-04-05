import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Calendar, User, Flag, Tag, Layers, Bell, Star, FolderOpen } from 'lucide-react';
import TagInput from '../shared/TagInput';
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
      {showQuickAdd && (
        <div className="relative w-full flex mb-4">
          <input
            ref={titleInputRef}
            value={draft.title}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, title: event.target.value }))
            }
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
      )}

      {/* Form fields — same layout as TaskDetailsPanel */}
      <div className="todo-detail-form">
        <div className="todo-detail-group">
          {/* Termin */}
          <div className="todo-detail-row">
            <span className="todo-row-icon" aria-hidden="true" title="Termin">
              <Calendar size={18} />
            </span>
            <span className="todo-row-label">Termin</span>
            <div className="todo-detail-row-fill">
              <Input
                className="todo-detail-unified-field"
                type="datetime-local"
                value={draft.dueDate}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, dueDate: event.target.value }))
                }
              />
            </div>
          </div>

          {/* Przypomnienie */}
          <div className="todo-detail-row">
            <span className="todo-row-icon" aria-hidden="true" title="Przypomnienie">
              <Bell size={18} />
            </span>
            <span className="todo-row-label">Przypomnienie</span>
            <div className="todo-detail-row-fill">
              <Input
                className="todo-detail-unified-field"
                type="datetime-local"
                value={draft.reminderAt}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, reminderAt: event.target.value }))
                }
              />
            </div>
          </div>

          {/* Osoba */}
          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" aria-hidden="true" title="Przypisz osobę">
              <User size={18} />
            </span>
            <span className="todo-row-label">Osoba</span>
            <div className="todo-detail-row-fill">
              <TagInput
                tags={draft.owner ? [draft.owner] : []}
                suggestions={peopleOptions}
                onChange={(arr) => setDraft((previous) => ({ ...previous, owner: arr[0] || '' }))}
                placeholder="Przypisz..."
                type="person"
              />
            </div>
          </div>

          {/* Priorytet */}
          <div className="todo-detail-row">
            <span className="todo-row-icon" aria-hidden="true" title="Priorytet">
              <Flag size={18} />
            </span>
            <span className="todo-row-label">Priorytet</span>
            <div className="todo-detail-row-fill">
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
            </div>
          </div>

          {/* Status */}
          <div className="todo-detail-row">
            <span className="todo-row-icon" aria-hidden="true" title="Status">
              <Layers size={18} />
            </span>
            <span className="todo-row-label">Status</span>
            <div className="todo-detail-row-fill">
              <select
                className="todo-detail-unified-field"
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
            </div>
          </div>

          {/* Grupa */}
          <div className="todo-detail-row">
            <span className="todo-row-icon" aria-hidden="true" title="Grupa">
              <FolderOpen size={18} />
            </span>
            <span className="todo-row-label">Grupa</span>
            <div className="todo-detail-row-fill">
              <Input
                className="todo-detail-unified-field"
                list="task-groups-list"
                value={draft.group}
                onChange={(event) =>
                  setDraft((previous) => ({ ...previous, group: event.target.value }))
                }
                placeholder="np. Sprint 14"
              />
            </div>
          </div>

          {/* Tagi */}
          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" aria-hidden="true" title="Tagi">
              <Tag size={18} />
            </span>
            <span className="todo-row-label">Tagi</span>
            <div className="todo-detail-row-fill">
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
          </div>

          {/* Ważne */}
          <div className="todo-detail-row">
            <span className="todo-row-icon" aria-hidden="true" title="Ważne">
              <Star size={18} />
            </span>
            <span className="todo-row-label">Ważne</span>
            <div className="todo-detail-row-fill">
              <label className="todo-inline-check" style={{ margin: 0, minHeight: 'auto' }}>
                <input
                  type="checkbox"
                  checked={draft.important}
                  onChange={(event) =>
                    setDraft((previous) => ({ ...previous, important: event.target.checked }))
                  }
                />
                <span>{draft.important ? 'Tak' : 'Nie'}</span>
              </label>
            </div>
          </div>
        </div>
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
    </div>
  );
}
