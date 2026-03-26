import { memo, useEffect, useState } from 'react';
import { formatDateTime } from '../lib/storage';
import { toInputDateTime } from './taskViewUtils';
import { Input } from '../ui/Input';
import { AlignLeft, History, Trash2, Link } from 'lucide-react';
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
                className="todo-command-button"
                onClick={() => onOpenMeeting(selectedTask.sourceMeetingId)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
