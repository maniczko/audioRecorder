import { memo, useEffect, useState } from 'react';
import { AlignLeft, History, Link, Trash2 } from 'lucide-react';
import { formatDateTime } from '../lib/storage';
import { getTaskLifecycleStatus, TASK_LIFECYCLE_STATUSES } from '../lib/tasks';
import { getGoogleTaskSyncConflict } from '../lib/googleSync';
import { toInputDateTime } from './taskViewUtils';
import { Input } from '../ui/Input';
import MentionTextarea from '../shared/MentionTextarea';
import TaskCreateForm, { TaskDraft } from './TaskCreateForm';
import './TaskDetailsPanelStyles.css';

function buildConflictDraft(conflict) {
  return {
    title: conflict?.finalSnapshot?.title || conflict?.localSnapshot?.title || '',
    dueDate: toInputDateTime(conflict?.finalSnapshot?.dueDate || conflict?.localSnapshot?.dueDate),
    notes: conflict?.finalSnapshot?.notes || conflict?.localSnapshot?.notes || '',
    completed: Boolean(conflict?.finalSnapshot?.completed ?? conflict?.localSnapshot?.completed),
  };
}

function buildSelectedTaskDraft(selectedTask, boardColumns): Partial<TaskDraft> {
  return {
    title: selectedTask.title || '',
    owner: selectedTask.owner || '',
    assignedTo: selectedTask.assignedTo || [],
    group: selectedTask.group || '',
    priority: selectedTask.priority || 'medium',
    status: selectedTask.status || boardColumns[0]?.id || 'todo',
    dueDate: selectedTask.dueDate || '',
    reminderAt: selectedTask.reminderAt || '',
    tags: selectedTask.tags || [],
    important: Boolean(selectedTask.important),
    description: selectedTask.description || '',
    notes: selectedTask.notes || '',
  };
}

function buildTaskUpdatePatch(patch: Partial<TaskDraft>) {
  const nextPatch: Record<string, unknown> = {};

  if ('title' in patch) nextPatch.title = patch.title;
  if ('dueDate' in patch) nextPatch.dueDate = patch.dueDate;
  if ('reminderAt' in patch) nextPatch.reminderAt = patch.reminderAt || '';
  if ('myDay' in patch) nextPatch.myDay = Boolean(patch.myDay);
  if ('owner' in patch) nextPatch.owner = patch.owner;
  if ('assignedTo' in patch) nextPatch.assignedTo = patch.assignedTo || [];
  if ('priority' in patch) nextPatch.priority = patch.priority;
  if ('description' in patch) nextPatch.description = patch.description;
  if ('tags' in patch) {
    nextPatch.tags = Array.isArray(patch.tags)
      ? patch.tags
      : String(patch.tags || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
  }

  return nextPatch;
}

function normalizePeopleSuggestions(peopleOptions) {
  return (peopleOptions || [])
    .map((person) => (typeof person === 'string' ? person : person.name || person.label || ''))
    .filter(Boolean);
}

function TaskDetailsPanel(props: any) {
  const {
    selectedTask,
    peopleOptions,
    tagOptions = [],
    boardColumns,
    onUpdateTask,
    onDeleteTask,
    onOpenMeeting,
    onResolveGoogleTaskConflict,
    presentation = 'panel',
  } = props;
  const selectedTaskGoogleConflict = getGoogleTaskSyncConflict(selectedTask);
  const [conflictDraft, setConflictDraft] = useState(
    buildConflictDraft(selectedTaskGoogleConflict)
  );
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    setConflictDraft(buildConflictDraft(selectedTaskGoogleConflict));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskGoogleConflict?.detectedAt, selectedTask?.id]);

  if (!selectedTask) {
    return (
      <aside className="todo-details">
        <div className="todo-detail-card empty">
          <h2>Wybierz zadanie</h2>
          <p>Tutaj zobaczysz szczegóły zadania, status, grupę i notatki.</p>
        </div>
      </aside>
    );
  }

  async function resolveConflict(mode) {
    if (typeof onResolveGoogleTaskConflict !== 'function' || !selectedTaskGoogleConflict) {
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

  const selectedTaskDraft = buildSelectedTaskDraft(selectedTask, boardColumns);
  const selectedTaskLifecycle = getTaskLifecycleStatus(selectedTask, boardColumns, [selectedTask]);
  const selectedTaskDone = selectedTaskLifecycle === TASK_LIFECYCLE_STATUSES.DONE;
  const selectedTaskDoneLabel = selectedTaskDone
    ? 'Oznacz jako nieukonczone'
    : 'Oznacz jako ukonczone';
  const peopleSuggestions = normalizePeopleSuggestions(peopleOptions);
  const sharedTaskForm = (
    <TaskCreateForm
      key={selectedTask.id}
      mode="edit"
      showQuickAdd={false}
      autoFocus={false}
      resetOnSubmit={false}
      initialDraft={selectedTaskDraft}
      boardColumns={boardColumns}
      peopleOptions={peopleSuggestions}
      tagOptions={tagOptions}
      onSubmit={() => {}}
      onDraftChange={(_, patch) => {
        const taskPatch = buildTaskUpdatePatch(patch);
        if (Object.keys(taskPatch).length > 0) {
          onUpdateTask(selectedTask.id, taskPatch);
        }
      }}
    />
  );

  if (presentation === 'modal') {
    return <div className="todo-details todo-details--modal-form">{sharedTaskForm}</div>;
  }

  return (
    <aside className="todo-details">
      <div className="todo-detail-card todo-detail-card--editor">
        <div className="todo-detail-header todo-detail-header--task-form">
          <div className="todo-detail-title-block">
            {selectedTask.sourceType === 'meeting' || selectedTask.sourceType === 'google' ? (
              <span className="todo-detail-eyebrow">
                {selectedTask.sourceType === 'meeting' ? 'Spotkanie' : 'Google Tasks'}
              </span>
            ) : null}
            <div className="todo-detail-title-row">
              <button
                type="button"
                className={selectedTaskDone ? 'todo-task-checkbox checked' : 'todo-task-checkbox'}
                title={selectedTaskDoneLabel}
                aria-label={selectedTaskDoneLabel}
                onClick={() => onUpdateTask(selectedTask.id, { completed: !selectedTaskDone })}
              >
                {selectedTaskDone ? '✓' : ''}
              </button>
              <span className="todo-detail-current-title">{selectedTask.title}</span>
            </div>
          </div>
          <div className="todo-detail-header-actions">
            {selectedTask.sourceMeetingId ? (
              <button
                type="button"
                onClick={() => onOpenMeeting(selectedTask.sourceMeetingId)}
                className="todo-command-button todo-command-button-icon"
              >
                <Link size={16} aria-hidden="true" />
                Otwórz spotkanie
              </button>
            ) : null}
          </div>
        </div>

        {selectedTaskGoogleConflict ? (
          <section className="todo-detail-section todo-conflict-resolution">
            <div className="todo-section-head">
              <strong>Konflikt synchronizacji Google</strong>
              <span>{selectedTaskGoogleConflict.sourceLabel || 'Google Tasks'}</span>
            </div>

            <div className="todo-conflict-grid">
              <article className="todo-conflict-panel">
                <span className="todo-card-eyebrow">Lokalne</span>
                <strong>{selectedTaskGoogleConflict.localSnapshot?.title || 'Brak'}</strong>
                <small>
                  Termin:{' '}
                  {selectedTaskGoogleConflict.localSnapshot?.dueDate
                    ? formatDateTime(selectedTaskGoogleConflict.localSnapshot.dueDate)
                    : 'Brak'}
                </small>
                <p>{selectedTaskGoogleConflict.localSnapshot?.notes || 'Brak notatek.'}</p>
              </article>

              <article className="todo-conflict-panel">
                <span className="todo-card-eyebrow">Google</span>
                <strong>{selectedTaskGoogleConflict.remoteSnapshot?.title || 'Brak'}</strong>
                <small>
                  Termin:{' '}
                  {selectedTaskGoogleConflict.remoteSnapshot?.dueDate
                    ? formatDateTime(selectedTaskGoogleConflict.remoteSnapshot.dueDate)
                    : 'Brak'}
                </small>
                <p>{selectedTaskGoogleConflict.remoteSnapshot?.notes || 'Brak notatek.'}</p>
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

        {sharedTaskForm}

        <section className="todo-detail-section todo-detail-notes-section">
          <label className="todo-detail-row note-row">
            <div className="todo-row-label-container">
              <span className="todo-row-icon" aria-hidden="true">
                <AlignLeft size={18} />
              </span>
              <span className="todo-row-label">Notatka</span>
            </div>
            <MentionTextarea
              rows={4}
              value={selectedTask.notes || ''}
              onChange={(event) => onUpdateTask(selectedTask.id, { notes: event.target.value })}
              placeholder="Dodaj notatkę..."
              suggestions={peopleSuggestions}
            />
          </label>
        </section>

        <section className="todo-detail-section todo-detail-history-section">
          <div className="todo-section-head">
            <div className="todo-section-head-wrapper">
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
                    onClick={() => setHistoryExpanded((value) => !value)}
                    title={historyExpanded ? 'Ukryj historię' : 'Pokaż historię'}
                  >
                    {historyExpanded ? '▲' : '▼'}
                  </button>
                )}
                <button
                  type="button"
                  className="todo-delete-button-inline"
                  onClick={() => {
                    if (window.confirm('Usunac to zadanie?')) {
                      onDeleteTask?.(selectedTask.id);
                    }
                  }}
                  aria-hidden="true"
                  tabIndex={-1}
                  title="Usuń zadanie"
                >
                  <Trash2 size={16} />
                </button>
              </div>
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
            <p className="todo-section-empty">Historia pojawi się po pierwszych zmianach.</p>
          )}
        </section>

        <footer className="todo-detail-editor-footer">
          <span>Zmiany zapisują się automatycznie</span>
          <button
            type="button"
            className="task-create-modal-secondary todo-detail-delete-action"
            aria-label="Usun zadanie"
            onClick={() => {
              if (window.confirm('Usunac to zadanie?')) {
                onDeleteTask?.(selectedTask.id);
              }
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
            Usuń zadanie
          </button>
        </footer>
      </div>
    </aside>
  );
}

export default memo(TaskDetailsPanel);
