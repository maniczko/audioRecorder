import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "../lib/storage";
import {
  createTaskComment,
  createTaskSubtask,
  getTaskDependencyDetails,
  getTaskSlaState,
  TASK_PRIORITIES,
  TASK_RECURRENCE_OPTIONS,
} from "../lib/tasks";
import { toInputDateTime } from "./taskViewUtils";
import { COVER_COLORS } from "./TaskKanbanView";

function toggleItem(list, value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return list;
  }

  return list.some((item) => item.toLowerCase() === normalized.toLowerCase())
    ? list.filter((item) => item.toLowerCase() !== normalized.toLowerCase())
    : [...list, normalized];
}

function recurrenceFrequency(task) {
  return task?.recurrence?.frequency || "none";
}

function recurrenceInterval(task) {
  return String(task?.recurrence?.interval || 1);
}

function resolveStatusLabel(task, boardColumns) {
  return boardColumns.find((column) => column.id === task?.status)?.label || task?.status || "Brak";
}

function buildConflictDraft(conflict) {
  return {
    title: conflict?.finalSnapshot?.title || conflict?.localSnapshot?.title || "",
    dueDate: toInputDateTime(conflict?.finalSnapshot?.dueDate || conflict?.localSnapshot?.dueDate),
    notes: conflict?.finalSnapshot?.notes || conflict?.localSnapshot?.notes || "",
    completed: Boolean(conflict?.finalSnapshot?.completed ?? conflict?.localSnapshot?.completed),
  };
}

export default function TaskDetailsPanel({
  selectedTask,
  tasks,
  peopleOptions,
  taskGroups,
  boardColumns,
  onUpdateTask,
  onMoveTaskToColumn,
  onDeleteTask,
  onOpenMeeting,
  currentUserName,
  onResolveGoogleTaskConflict,
}) {
  const [commentDraft, setCommentDraft] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [subtaskAssignee, setSubtaskAssignee] = useState("");
  const [linkDraft, setLinkDraft] = useState("");
  const [linkLabelDraft, setLinkLabelDraft] = useState("");
  const [conflictDraft, setConflictDraft] = useState(buildConflictDraft(selectedTask?.googleSyncConflict));

  useEffect(() => {
    setCommentDraft("");
    setSubtaskDraft("");
    setSubtaskAssignee("");
    setLinkDraft("");
    setLinkLabelDraft("");
    setConflictDraft(buildConflictDraft(selectedTask?.googleSyncConflict));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.googleSyncConflict?.detectedAt, selectedTask?.id]);

  const availableDependencies = useMemo(
    () => (selectedTask ? tasks.filter((task) => task.id !== selectedTask.id) : []),
    [selectedTask, tasks]
  );

  if (!selectedTask) {
    return (
      <aside className="todo-details">
        <div className="todo-detail-card empty">
          <h2>Wybierz zadanie</h2>
          <p>Tutaj zobaczysz szczegoly zadania, ownera, status, grupe i notatki.</p>
        </div>
      </aside>
    );
  }

  const assignedPeople = selectedTask.assignedTo || [];
  const dependencyIds = selectedTask.dependencies || [];
  const activeRecurrence = recurrenceFrequency(selectedTask);
  const dependencyState = getTaskDependencyDetails(selectedTask, tasks);
  const slaState = getTaskSlaState(selectedTask);
  const statusLabel = resolveStatusLabel(selectedTask, boardColumns);

  function updateAssignees(nextAssignees) {
    onUpdateTask(selectedTask.id, {
      assignedTo: nextAssignees,
      owner: nextAssignees[0] || "",
    });
  }

  function addComment() {
    if (!commentDraft.trim()) {
      return;
    }

    onUpdateTask(selectedTask.id, {
      comments: [...(selectedTask.comments || []), createTaskComment(commentDraft, currentUserName || "Ty")],
    });
    setCommentDraft("");
  }

  function addSubtask() {
    if (!subtaskDraft.trim()) {
      return;
    }

    onUpdateTask(selectedTask.id, {
      subtasks: [...(selectedTask.subtasks || []), createTaskSubtask(subtaskDraft, subtaskAssignee)],
    });
    setSubtaskDraft("");
    setSubtaskAssignee("");
  }

  function updateSubtask(subtaskId, updates) {
    onUpdateTask(selectedTask.id, {
      subtasks: (selectedTask.subtasks || []).map((subtask) =>
        subtask.id !== subtaskId
          ? subtask
          : {
              ...subtask,
              ...updates,
            }
      ),
    });
  }

  function removeSubtask(subtaskId) {
    onUpdateTask(selectedTask.id, {
      subtasks: (selectedTask.subtasks || []).filter((subtask) => subtask.id !== subtaskId),
    });
  }

  function addLink() {
    if (!linkDraft.trim()) {
      return;
    }

    onUpdateTask(selectedTask.id, {
      links: [
        ...(selectedTask.links || []),
        {
          label: linkLabelDraft.trim() || linkDraft.trim(),
          url: linkDraft.trim(),
        },
      ],
    });
    setLinkDraft("");
    setLinkLabelDraft("");
  }

  function removeLink(linkId) {
    onUpdateTask(selectedTask.id, {
      links: (selectedTask.links || []).filter((link) => link.id !== linkId),
    });
  }

  async function resolveConflict(mode) {
    if (typeof onResolveGoogleTaskConflict !== "function" || !selectedTask.googleSyncConflict) {
      return;
    }

    const finalSnapshot = {
      title: conflictDraft.title,
      dueDate: conflictDraft.dueDate ? new Date(conflictDraft.dueDate).toISOString() : "",
      notes: conflictDraft.notes,
      completed: Boolean(conflictDraft.completed),
    };

    try {
      await onResolveGoogleTaskConflict(selectedTask.id, mode, finalSnapshot);
    } catch (error) {
      console.error("Google task conflict resolution failed.", error);
    }
  }

  return (
    <aside className="todo-details">
      <div className="todo-detail-card">
        <div className="todo-detail-header">
          <div>
            <span className="todo-detail-eyebrow">
              {selectedTask.sourceType === "meeting"
                ? "Spotkanie"
                : selectedTask.sourceType === "google"
                  ? "Google Tasks"
                  : "Reczne"}
            </span>
            <h2>{selectedTask.title}</h2>
            <div className="todo-detail-badges">
              {selectedTask.dueDate ? <span className={`todo-sla-pill ${slaState.tone}`}>{slaState.label}</span> : null}
              {dependencyState.blocking ? (
                <span className="todo-sla-pill warning">Zablokowane przez {dependencyState.unresolved.length}</span>
              ) : null}
            </div>
          </div>
          <div className="todo-detail-header-actions">
            <button
              type="button"
              className="todo-command-button primary"
              onClick={() => onUpdateTask(selectedTask.id, { completed: !selectedTask.completed })}
            >
              {selectedTask.completed ? "Otworz ponownie" : "Oznacz jako zrobione"}
            </button>
            <button
              type="button"
              className="todo-command-button"
              onClick={() => onUpdateTask(selectedTask.id, { important: !selectedTask.important })}
            >
              {selectedTask.important ? "Usun waznosc" : "Oznacz jako wazne"}
            </button>
            {selectedTask.sourceMeetingId ? (
              <button type="button" className="todo-command-button" onClick={() => onOpenMeeting(selectedTask.sourceMeetingId)}>
                Otworz spotkanie
              </button>
            ) : null}
            <button type="button" className="todo-icon-button danger" onClick={() => onDeleteTask(selectedTask.id)}>
              {selectedTask.sourceType === "meeting" ? "Ukryj" : "Usun"}
            </button>
          </div>
        </div>

        <div className="todo-detail-summary-grid">
          <article className="todo-detail-summary-card">
            <span>Owner</span>
            <strong>{selectedTask.owner || "Nieprzypisane"}</strong>
          </article>
          <article className="todo-detail-summary-card">
            <span>Status</span>
            <strong>{statusLabel}</strong>
          </article>
          <article className="todo-detail-summary-card">
            <span>Termin</span>
            <strong>{selectedTask.dueDate ? formatDateTime(selectedTask.dueDate) : "Brak terminu"}</strong>
          </article>
          <article className="todo-detail-summary-card">
            <span>Priorytet</span>
            <strong>{TASK_PRIORITIES.find((priority) => priority.id === selectedTask.priority)?.label || selectedTask.priority}</strong>
          </article>
        </div>

        {selectedTask.googleSyncConflict ? (
          <section className="todo-detail-section todo-conflict-resolution">
            <div className="todo-section-head">
              <strong>Konflikt synchronizacji Google</strong>
              <span>{selectedTask.googleSyncConflict.sourceLabel || "Google Tasks"}</span>
            </div>

            <div className="todo-conflict-grid">
              <article className="todo-conflict-panel">
                <span className="todo-card-eyebrow">Lokalne</span>
                <strong>{selectedTask.googleSyncConflict.localSnapshot?.title || "Brak"}</strong>
                <small>
                  Termin: {selectedTask.googleSyncConflict.localSnapshot?.dueDate ? formatDateTime(selectedTask.googleSyncConflict.localSnapshot.dueDate) : "Brak"}
                </small>
                <p>{selectedTask.googleSyncConflict.localSnapshot?.notes || "Brak notatek."}</p>
              </article>

              <article className="todo-conflict-panel">
                <span className="todo-card-eyebrow">Google</span>
                <strong>{selectedTask.googleSyncConflict.remoteSnapshot?.title || "Brak"}</strong>
                <small>
                  Termin: {selectedTask.googleSyncConflict.remoteSnapshot?.dueDate ? formatDateTime(selectedTask.googleSyncConflict.remoteSnapshot.dueDate) : "Brak"}
                </small>
                <p>{selectedTask.googleSyncConflict.remoteSnapshot?.notes || "Brak notatek."}</p>
              </article>

              <article className="todo-conflict-panel editable">
                <span className="todo-card-eyebrow">Finalna wersja</span>
                <label>
                  <span>Tytul</span>
                  <input
                    value={conflictDraft.title}
                    onChange={(event) => setConflictDraft((previous) => ({ ...previous, title: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Termin</span>
                  <input
                    type="datetime-local"
                    value={conflictDraft.dueDate}
                    onChange={(event) => setConflictDraft((previous) => ({ ...previous, dueDate: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Notatki</span>
                  <textarea
                    rows="4"
                    value={conflictDraft.notes}
                    onChange={(event) => setConflictDraft((previous) => ({ ...previous, notes: event.target.value }))}
                  />
                </label>
                <label className="todo-inline-check">
                  <span>Zakonczone</span>
                  <input
                    type="checkbox"
                    checked={conflictDraft.completed}
                    onChange={(event) => setConflictDraft((previous) => ({ ...previous, completed: event.target.checked }))}
                  />
                </label>
              </article>
            </div>

            <div className="todo-conflict-actions">
              <button type="button" className="todo-command-button" onClick={() => resolveConflict("google")}>
                Zachowaj Google
              </button>
              <button type="button" className="todo-command-button" onClick={() => resolveConflict("local")}>
                Zachowaj lokalne
              </button>
              <button type="button" className="todo-command-button primary" onClick={() => resolveConflict("merge")}>
                Zapisz finalna wersje
              </button>
            </div>
          </section>
        ) : null}

        <div className="todo-detail-form">
          <div className="full">
            <span className="todo-detail-form-label">Kolor karty</span>
            <div className="kanban-cover-picker">
              {COVER_COLORS.map((cc) => (
                <button
                  key={cc.id}
                  type="button"
                  className={`cover-swatch${(selectedTask.coverColor || "") === cc.value ? " active" : ""}`}
                  style={cc.value ? { backgroundColor: cc.value } : undefined}
                  title={cc.label}
                  onClick={() => onUpdateTask(selectedTask.id, { coverColor: cc.value })}
                >
                  {!cc.value ? "×" : null}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span>Tytul</span>
            <input value={selectedTask.title} onChange={(event) => onUpdateTask(selectedTask.id, { title: event.target.value })} />
          </label>
          <label>
            <span>Glowna osoba</span>
            <select value={selectedTask.owner} onChange={(event) => onUpdateTask(selectedTask.id, { owner: event.target.value })}>
              <option value="">Nieprzypisane</option>
              {peopleOptions.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Grupa</span>
            <input
              list="detail-task-groups"
              value={selectedTask.group || ""}
              onChange={(event) => onUpdateTask(selectedTask.id, { group: event.target.value })}
              placeholder="Bez grupy"
            />
            <datalist id="detail-task-groups">
              {taskGroups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Status</span>
            <select value={selectedTask.status} onChange={(event) => onMoveTaskToColumn(selectedTask.id, event.target.value)}>
              {boardColumns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Termin</span>
            <input
              type="datetime-local"
              value={toInputDateTime(selectedTask.dueDate)}
              onChange={(event) => onUpdateTask(selectedTask.id, { dueDate: event.target.value })}
            />
          </label>
          <label>
            <span>Priorytet</span>
            <select value={selectedTask.priority} onChange={(event) => onUpdateTask(selectedTask.id, { priority: event.target.value })}>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Przypomnienie</span>
            <input
              type="datetime-local"
              value={toInputDateTime(selectedTask.reminderAt)}
              onChange={(event) => onUpdateTask(selectedTask.id, { reminderAt: event.target.value })}
            />
          </label>
          <label className="todo-inline-check">
            <span>My Day</span>
            <input
              type="checkbox"
              checked={Boolean(selectedTask.myDay)}
              onChange={(event) => onUpdateTask(selectedTask.id, { myDay: event.target.checked })}
            />
          </label>
          <label className="full">
            <span>Tagi</span>
            <input value={(selectedTask.tags || []).join(", ")} onChange={(event) => onUpdateTask(selectedTask.id, { tags: event.target.value })} />
          </label>
          <label className="full">
            <span>Opis</span>
            <textarea rows="3" value={selectedTask.description || ""} onChange={(event) => onUpdateTask(selectedTask.id, { description: event.target.value })} />
          </label>
          <label className="full">
            <span>Notatki</span>
            <textarea rows="5" value={selectedTask.notes || ""} onChange={(event) => onUpdateTask(selectedTask.id, { notes: event.target.value })} />
          </label>
        </div>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Przypisane osoby</strong>
            <span>{assignedPeople.length || 0}</span>
          </div>
          <div className="todo-chip-grid">
            {peopleOptions.map((person) => {
              const active = assignedPeople.some((item) => item.toLowerCase() === person.toLowerCase());
              return (
                <button
                  key={person}
                  type="button"
                  className={active ? "todo-chip active" : "todo-chip"}
                  onClick={() => updateAssignees(toggleItem(assignedPeople, person))}
                >
                  {person}
                </button>
              );
            })}
          </div>
        </section>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Linki i materialy</strong>
            <span>{(selectedTask.links || []).length}</span>
          </div>
          <div className="todo-subtask-create">
            <input value={linkLabelDraft} onChange={(event) => setLinkLabelDraft(event.target.value)} placeholder="Etykieta linku" />
            <input value={linkDraft} onChange={(event) => setLinkDraft(event.target.value)} placeholder="https://..." />
            <button type="button" className="todo-command-button primary" onClick={addLink}>
              Dodaj
            </button>
          </div>
          <div className="todo-history-list">
            {(selectedTask.links || []).length ? (
              selectedTask.links.map((link) => (
                <article key={link.id} className="todo-history-row">
                  <strong>{link.label}</strong>
                  <p>{link.url}</p>
                  <div className="todo-detail-actions">
                    <button type="button" className="todo-command-button" onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}>
                      Otworz
                    </button>
                    <button type="button" className="todo-command-button" onClick={() => removeLink(link.id)}>
                      Usun
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="todo-section-empty">Dodaj link do briefu, dokumentu albo ticketu.</p>
            )}
          </div>
        </section>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Cykl</strong>
            <span>{activeRecurrence === "none" ? "Jednorazowe" : "Aktywne"}</span>
          </div>
          <div className="todo-recurrence-grid">
            <label>
              <span>Powtarzanie</span>
              <select
                value={activeRecurrence}
                onChange={(event) =>
                  onUpdateTask(selectedTask.id, {
                    recurrence:
                      event.target.value === "none"
                        ? null
                        : {
                            frequency: event.target.value,
                            interval: Number(recurrenceInterval(selectedTask)) || 1,
                          },
                  })
                }
              >
                {TASK_RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {activeRecurrence !== "none" ? (
              <label>
                <span>Interwal</span>
                <input
                  type="number"
                  min="1"
                  value={recurrenceInterval(selectedTask)}
                  onChange={(event) =>
                    onUpdateTask(selectedTask.id, {
                      recurrence: {
                        frequency: activeRecurrence,
                        interval: Number(event.target.value) || 1,
                      },
                    })
                  }
                />
              </label>
            ) : null}
          </div>
        </section>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Zaleznosci</strong>
            <span>{dependencyIds.length}</span>
          </div>
          {dependencyState.blocking ? (
            <div className="todo-inline-alert warning">
              Najpierw zakoncz: {dependencyState.unresolved.map((task) => task.title).join(", ")}.
            </div>
          ) : null}
          <div className="todo-chip-grid dense">
            {availableDependencies.length ? (
              availableDependencies.map((task) => {
                const active = dependencyIds.includes(task.id);
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={active ? "todo-chip active" : "todo-chip"}
                    onClick={() =>
                      onUpdateTask(selectedTask.id, {
                        dependencies: active
                          ? dependencyIds.filter((item) => item !== task.id)
                          : [...dependencyIds, task.id],
                      })
                    }
                  >
                    {task.title}
                  </button>
                );
              })
            ) : (
              <p className="todo-section-empty">Brak innych zadan do powiazania.</p>
            )}
          </div>
        </section>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Podzadania</strong>
            <span>{(selectedTask.subtasks || []).filter((subtask) => subtask.completed).length}/{(selectedTask.subtasks || []).length}</span>
          </div>
          <div className="todo-subtask-create">
            <input value={subtaskDraft} onChange={(event) => setSubtaskDraft(event.target.value)} placeholder="Dodaj podzadanie" />
            <select value={subtaskAssignee} onChange={(event) => setSubtaskAssignee(event.target.value)}>
              <option value="">Bez osoby</option>
              {peopleOptions.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
            <button type="button" className="todo-command-button primary" onClick={addSubtask}>
              Dodaj
            </button>
          </div>
          <div className="todo-subtask-list">
            {(selectedTask.subtasks || []).length ? (
              selectedTask.subtasks.map((subtask) => (
                <div key={subtask.id} className={subtask.completed ? "todo-subtask-row done" : "todo-subtask-row"}>
                  <button
                    type="button"
                    className={subtask.completed ? "todo-task-circle completed" : "todo-task-circle"}
                    onClick={() =>
                      updateSubtask(subtask.id, {
                        completed: !subtask.completed,
                        completedAt: !subtask.completed ? new Date().toISOString() : "",
                      })
                    }
                  />
                  <input
                    value={subtask.title}
                    onChange={(event) => updateSubtask(subtask.id, { title: event.target.value })}
                  />
                  <select value={subtask.assignee || ""} onChange={(event) => updateSubtask(subtask.id, { assignee: event.target.value })}>
                    <option value="">Bez osoby</option>
                    {peopleOptions.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="todo-icon-button danger subtle" onClick={() => removeSubtask(subtask.id)}>
                    Usun
                  </button>
                </div>
              ))
            ) : (
              <p className="todo-section-empty">Brak podzadan dla tego taska.</p>
            )}
          </div>
        </section>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Komentarze</strong>
            <span>{(selectedTask.comments || []).length}</span>
          </div>
          <div className="todo-comment-create">
            <textarea rows="3" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Dodaj komentarz lub ustalenie" />
            <button type="button" className="todo-command-button primary" onClick={addComment}>
              Dodaj komentarz
            </button>
          </div>
          <div className="todo-comment-list">
            {(selectedTask.comments || []).length ? (
              [...selectedTask.comments].reverse().map((comment) => (
                <article key={comment.id} className="todo-comment-card">
                  <div className="todo-comment-meta">
                    <strong>{comment.author || "Ty"}</strong>
                    <small>{formatDateTime(comment.createdAt)}</small>
                  </div>
                  <p>{comment.text}</p>
                </article>
              ))
            ) : (
              <p className="todo-section-empty">Jeszcze nie ma komentarzy.</p>
            )}
          </div>
        </section>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Historia zmian</strong>
            <span>{(selectedTask.history || []).length}</span>
          </div>
          <div className="todo-history-list">
            {(selectedTask.history || []).length ? (
              [...selectedTask.history].reverse().map((entry) => (
                <article key={entry.id} className="todo-history-row">
                  <strong>{entry.actor || "System"}</strong>
                  <p>{entry.message}</p>
                  <small>{formatDateTime(entry.createdAt)}</small>
                </article>
              ))
            ) : (
              <p className="todo-section-empty">Historia pojawi sie po pierwszych zmianach.</p>
            )}
          </div>
        </section>

        <div className="todo-detail-meta-card">
          <strong>Zrodlo</strong>
          <p>{selectedTask.sourceQuote || selectedTask.sourceMeetingTitle || "Brak cytatu zrodlowego."}</p>
          <small>{formatDateTime(selectedTask.updatedAt || selectedTask.createdAt)}</small>
        </div>
      </div>
    </aside>
  );
}
