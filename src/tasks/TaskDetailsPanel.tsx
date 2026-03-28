import { memo, useEffect, useState } from 'react';
import { formatDateTime } from '../lib/storage';
import { toInputDateTime } from './taskViewUtils';
import { Input } from '../ui/Input';
import { AlignLeft, History, Trash2, Link, Calendar, User, Flag, Tag } from 'lucide-react';
import TagInput from '../shared/TagInput';
import { TASK_PRIORITIES } from '../lib/tasks';
import './TaskDetailsPanelStyles.css';

function buildConflictDraft(conflict) {
  return {
    title: conflict?.finalSnapshot?.title || conflict?.localSnapshot?.title || '',
    dueDate: toInputDateTime(conflict?.finalSnapshot?.dueDate || conflict?.localSnapshot?.dueDate),
    notes: conflict?.finalSnapshot?.notes || conflict?.localSnapshot?.notes || '',
    completed: Boolean(conflict?.finalSnapshot?.completed ?? conflict?.localSnapshot?.completed),
  };
}

function TaskDetailsPanel({
  selectedTask,
  tasks,
  peopleOptions,
  tagOptions = [],
  taskGroups,
  boardColumns,
  onUpdateTask,
  onMoveTaskToColumn,
  onDeleteTask,
  onOpenMeeting,
  currentUserName,
  onResolveGoogleTaskConflict,
}) {
  const [conflictDraft, setConflictDraft] = useState(
    buildConflictDraft(selectedTask?.googleSyncConflict)
  );
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    setConflictDraft(buildConflictDraft(selectedTask?.googleSyncConflict));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.googleSyncConflict?.detectedAt, selectedTask?.id]);

  if (!selectedTask) {
    return (
      <aside className="todo-details">
        <div className="todo-detail-card empty">
          <h2>Wybierz zadanie</h2>
          <p>Tutaj zobaczysz szczegoly zadania, status, grupe i notatki.</p>
        </div>
      </aside>
    );
  }

  async function resolveConflict(mode) {
    if (typeof onResolveGoogleTaskConflict !== 'function' || !selectedTask.googleSyncConflict) {
      return;
    }

    const finalSnapshot = {
      title: conflictDraft.title,
      dueDate: conflictDraft.dueDate ? new Date(conflictDraft.dueDate).toISOString() : '',
      notes: conflictDraft.notes,
      completed: Boolean(conflictDraft.completed),
    };

    try {
      await onResolveGoogleTaskConflict(selectedTask.id, mode, finalSnapshot);
    } catch (error) {
      console.error('Google task conflict resolution failed.', error);
    }
  }

  return (
    <aside className="todo-details">
      <div className="todo-detail-card">
        <div className="todo-detail-header">
          <div className="todo-detail-title-block">
            {selectedTask.sourceType === 'meeting' || selectedTask.sourceType === 'google' ? (
              <span className="todo-detail-eyebrow">
                {selectedTask.sourceType === 'meeting' ? 'Spotkanie' : 'Google Tasks'}
              </span>
            ) : null}
            <div className="todo-detail-title-row">
              <button
                type="button"
                className={
                  selectedTask.completed ? 'todo-task-checkbox checked' : 'todo-task-checkbox'
                }
                aria-label={
                  selectedTask.completed ? 'Oznacz jako nieukończone' : 'Oznacz jako ukończone'
                }
                onClick={() =>
                  onUpdateTask(selectedTask.id, { completed: !selectedTask.completed })
                }
              >
                {selectedTask.completed ? '✓' : ''}
              </button>
              <Input
                className="todo-detail-title-input"
                value={selectedTask.title}
                onChange={(event) => onUpdateTask(selectedTask.id, { title: event.target.value })}
                aria-label="Tytuł zadania"
              />
            </div>
            <div className="todo-detail-badges" />
          </div>
          <div className="todo-detail-header-actions">
            {selectedTask.sourceMeetingId ? (
              <button
                type="button"
                onClick={() => onOpenMeeting(selectedTask.sourceMeetingId)}
                className="todo-command-button todo-command-button-icon"
              >
                <Link size={16} />
                Otwórz spotkanie
              </button>
            ) : null}
          </div>
        </div>

        {selectedTask.googleSyncConflict ? (
          <section className="todo-detail-section todo-conflict-resolution">
            <div className="todo-section-head">
              <strong>Konflikt synchronizacji Google</strong>
              <span>{selectedTask.googleSyncConflict.sourceLabel || 'Google Tasks'}</span>
            </div>

            <div className="todo-conflict-grid">
              <article className="todo-conflict-panel">
                <span className="todo-card-eyebrow">Lokalne</span>
                <strong>{selectedTask.googleSyncConflict.localSnapshot?.title || 'Brak'}</strong>
                <small>
                  Termin:{' '}
                  {selectedTask.googleSyncConflict.localSnapshot?.dueDate
                    ? formatDateTime(selectedTask.googleSyncConflict.localSnapshot.dueDate)
                    : 'Brak'}
                </small>
                <p>{selectedTask.googleSyncConflict.localSnapshot?.notes || 'Brak notatek.'}</p>
              </article>

              <article className="todo-conflict-panel">
                <span className="todo-card-eyebrow">Google</span>
                <strong>{selectedTask.googleSyncConflict.remoteSnapshot?.title || 'Brak'}</strong>
                <small>
                  Termin:{' '}
                  {selectedTask.googleSyncConflict.remoteSnapshot?.dueDate
                    ? formatDateTime(selectedTask.googleSyncConflict.remoteSnapshot.dueDate)
                    : 'Brak'}
                </small>
                <p>{selectedTask.googleSyncConflict.remoteSnapshot?.notes || 'Brak notatek.'}</p>
              </article>

              <article className="todo-conflict-panel editable">
                <span className="todo-card-eyebrow">Finalna wersja</span>
                <label>
                  <span>Tytuł</span>
                  <Input
                    value={conflictDraft.title}
                    onChange={(event) =>
                      setConflictDraft((previous) => ({ ...previous, title: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Termin</span>
                  <Input
                    type="datetime-local"
                    value={conflictDraft.dueDate}
                    onChange={(event) =>
                      setConflictDraft((previous) => ({ ...previous, dueDate: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Notatki</span>
                  <textarea
                    rows={4}
                    value={conflictDraft.notes}
                    onChange={(event) =>
                      setConflictDraft((previous) => ({ ...previous, notes: event.target.value }))
                    }
                  />
                </label>
                <label className="todo-inline-check">
                  <span>Zakończone</span>
                  <input
                    className="ui-checkbox"
                    type="checkbox"
                    checked={conflictDraft.completed}
                    onChange={(event) =>
                      setConflictDraft((previous) => ({
                        ...previous,
                        completed: event.target.checked,
                      }))
                    }
                  />
                </label>
              </article>
            </div>

            <div className="todo-conflict-actions">
              <button
                type="button"
                className="todo-command-button"
                onClick={() => resolveConflict('google')}
              >
                Zachowaj Google
              </button>
              <button
                type="button"
                className="todo-command-button"
                onClick={() => resolveConflict('local')}
              >
                Zachowaj lokalne
              </button>
              <button
                type="button"
                className="todo-command-button primary"
                onClick={() => resolveConflict('merge')}
              >
                Zapisz finalną wersję
              </button>
            </div>
          </section>
        ) : null}

        <div className="todo-detail-form">
          <div className="todo-detail-stack">
            <div className="todo-detail-row">
              <span className="todo-row-icon" aria-hidden="true" title="Termin">
                <Calendar size={18} />
              </span>
              <span className="todo-row-label">Termin</span>
              <Input
                type="datetime-local"
                value={toInputDateTime(selectedTask.dueDate) || ''}
                onChange={(event) => onUpdateTask(selectedTask.id, { dueDate: event.target.value })}
              />
            </div>

            <div className="todo-detail-row field-row">
              <span className="todo-row-icon" aria-hidden="true" title="Przypisz osobę">
                <User size={18} />
              </span>
              <span className="todo-row-label">Osoba</span>
              <div className="todo-detail-row-fill">
                <TagInput
                  tags={selectedTask.assignedTo?.length ? selectedTask.assignedTo : (selectedTask.owner ? [selectedTask.owner] : [])}
                  suggestions={peopleOptions}
                  onChange={(arr) => onUpdateTask(selectedTask.id, { assignedTo: arr, owner: arr[0] || '' })}
                  placeholder="Przypisz..."
                />
              </div>
            </div>

            <div className="todo-detail-row">
              <span className="todo-row-icon" aria-hidden="true" title="Priorytet">
                <Flag size={18} />
              </span>
              <span className="todo-row-label">Priorytet</span>
              <select
                className="todo-detail-select"
                value={selectedTask.priority || 'medium'}
                onChange={(event) => onUpdateTask(selectedTask.id, { priority: event.target.value })}

              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            
            <div className="todo-detail-row field-row">
              <span className="todo-row-icon" aria-hidden="true" title="Tagi">
                <Tag size={18} />
              </span>
              <span className="todo-row-label">Tagi</span>
              <div className="todo-detail-row-fill">
                <TagInput
                  tags={selectedTask.tags || []}
                  suggestions={tagOptions}
                  onChange={(arr) => onUpdateTask(selectedTask.id, { tags: arr })}
                  placeholder="Dodaj tag..."
                />
              </div>
            </div>

            <label className="todo-detail-row note-row">
              <span className="todo-row-icon" aria-hidden="true">
                <AlignLeft size={18} />
              </span>
              <span className="todo-row-label">Notatka</span>
              <textarea
                rows={5}
                value={selectedTask.notes || ''}
                onChange={(event) => onUpdateTask(selectedTask.id, { notes: event.target.value })}
                placeholder="Dodaj notatkę..."
              />
            </label>
          </div>
        </div>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>
              <span className="todo-section-icon" aria-hidden="true">
                <History size={16} />
              </span>
              Historia zmian
            </strong>
            <div className="todo-section-head-row">
              <span>{(selectedTask.history || []).length}</span>
              {(selectedTask.history || []).length > 0 && (
                <button
                  type="button"
                  className="todo-history-toggle"
                  onClick={() => setHistoryExpanded((v) => !v)}
                  title={historyExpanded ? 'Ukryj historię' : 'Pokaż historię'}
                >
                  {historyExpanded ? '▲' : '▼'}
                </button>
              )}
            </div>
          </div>
          {historyExpanded && (
            <div className="todo-history-list">
              {[...selectedTask.history].reverse().map((entry) => (
                <article key={entry.id} className="todo-history-row">
                  <strong>{entry.actor || 'System'}</strong>
                  <p>{entry.message}</p>
                  <small>{formatDateTime(entry.createdAt)}</small>
                </article>
              ))}
            </div>
          )}
          {!historyExpanded && (selectedTask.history || []).length === 0 && (
            <p className="todo-section-empty">Historia pojawi sie po pierwszych zmianach.</p>
          )}
        </section>

        <div className="todo-detail-footer">
          <button
            type="button"
            className="todo-delete-button"
            onClick={() => {
              if (window.confirm('Usunac to zadanie?')) {
                onDeleteTask?.(selectedTask.id);
              }
            }}
            aria-label="Usun zadanie"
            title="Usun zadanie"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default memo(TaskDetailsPanel);
