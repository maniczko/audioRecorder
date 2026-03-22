import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "../lib/storage";
import {
  createTaskComment,
  getTaskSlaState,
  TASK_PRIORITIES,
} from "../lib/tasks";
import { toInputDateTime } from "./taskViewUtils";
import './TaskDetailsPanelStyles.css';

function toggleItem(list, value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return list;
  }

  return list.some((item) => item.toLowerCase() === normalized.toLowerCase())
    ? list.filter((item) => item.toLowerCase() !== normalized.toLowerCase())
    : [...list, normalized];
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
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [showAssigneeSuggestions, setShowAssigneeSuggestions] = useState(false);
  const commentTextareaRef = useRef(null);
  const assigneeInputRef = useRef(null);
  const [conflictDraft, setConflictDraft] = useState(buildConflictDraft(selectedTask?.googleSyncConflict));
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const tagOptions = useMemo(
    () => [...new Set((tasks || []).flatMap((t) => t.tags || []))].filter(Boolean).sort(),
    [tasks]
  );

  useEffect(() => {
    setCommentDraft("");
    setAssigneeDraft("");
    setShowAssigneeSuggestions(false);
    setConflictDraft(buildConflictDraft(selectedTask?.googleSyncConflict));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask?.googleSyncConflict?.detectedAt, selectedTask?.id]);


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
  const slaState = getTaskSlaState(selectedTask);

  function updateAssignees(nextAssignees) {
    onUpdateTask(selectedTask.id, {
      assignedTo: nextAssignees,
      owner: nextAssignees[0] || "",
    });
  }

  function addAssignee(person) {
    if (!person) return;
    updateAssignees(toggleItem(assignedPeople, person));
    setAssigneeDraft("");
    setShowAssigneeSuggestions(false);
    assigneeInputRef.current?.focus?.();
  }

  const assigneeSuggestions = peopleOptions.filter((person) => {
    const query = assigneeDraft.trim().toLowerCase();
    if (!query) return true;
    if (assignedPeople.some((item) => item.toLowerCase() === person.toLowerCase())) return false;
    return person.toLowerCase().includes(query);
  });

  function handleCommentChange(event) {
    const val = event.target.value;
    setCommentDraft(val);
    const cursorPos = event.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  }

  function insertMention(person) {
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    const val = commentDraft;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (!atMatch) return;
    const atStart = cursorPos - atMatch[0].length;
    const newVal = val.slice(0, atStart) + `@${person} ` + val.slice(cursorPos);
    setCommentDraft(newVal);
    setShowMentions(false);
    setMentionQuery("");
    setTimeout(() => {
      textarea.focus();
      const newPos = atStart + person.length + 2;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  function addComment() {
    if (!commentDraft.trim()) {
      return;
    }

    onUpdateTask(selectedTask.id, {
      comments: [...(selectedTask.comments || []), createTaskComment(commentDraft, currentUserName || "Ty")],
    });
    setCommentDraft("");
    setShowMentions(false);
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
          <div className="todo-detail-title-block">
            {selectedTask.sourceType === "meeting" || selectedTask.sourceType === "google" ? (
              <span className="todo-detail-eyebrow">
                {selectedTask.sourceType === "meeting" ? "Spotkanie" : "Google Tasks"}
              </span>
            ) : null}
            <div className="todo-detail-title-row">
              <button
                type="button"
                className={selectedTask.completed ? "todo-task-checkbox checked" : "todo-task-checkbox"}
                aria-label={selectedTask.completed ? "Oznacz jako nieukończone" : "Oznacz jako ukończone"}
                onClick={() => onUpdateTask(selectedTask.id, { completed: !selectedTask.completed })}
              >
                {selectedTask.completed ? "✓" : ""}
              </button>
              <h2>{selectedTask.title}</h2>
            </div>
            <div className="todo-detail-badges">
              {selectedTask.dueDate ? <span className={`todo-sla-pill ${slaState.tone}`}>{slaState.label}</span> : null}
            </div>
          </div>
          <div className="todo-detail-header-actions">
            {selectedTask.sourceMeetingId ? (
              <button type="button" className="todo-command-button" onClick={() => onOpenMeeting(selectedTask.sourceMeetingId)}>
                Otworz spotkanie
              </button>
            ) : null}
          </div>
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
          <label className="full">
            <span>Tytul</span>
            <input value={selectedTask.title} onChange={(event) => onUpdateTask(selectedTask.id, { title: event.target.value })} />
          </label>
          <label>
            <span>Osoba odpowiedzialna</span>
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
            <input
              list="task-detail-tags-list"
              value={(selectedTask.tags || []).join(", ")}
              onChange={(event) => onUpdateTask(selectedTask.id, { tags: event.target.value })}
              placeholder="np. klient, budzet"
            />
            <datalist id="task-detail-tags-list">
              {tagOptions.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
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
          <div className="todo-assignee-picker">
            <input
              ref={assigneeInputRef}
              value={assigneeDraft}
              onChange={(event) => {
                setAssigneeDraft(event.target.value);
                setShowAssigneeSuggestions(true);
              }}
              onFocus={() => setShowAssigneeSuggestions(true)}
              onBlur={() => setTimeout(() => setShowAssigneeSuggestions(false), 120)}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === ",") && assigneeDraft.trim()) {
                  event.preventDefault();
                  addAssignee(assigneeDraft.trim().replace(/,$/, ""));
                } else if (event.key === "Escape") {
                  setShowAssigneeSuggestions(false);
                }
              }}
              placeholder="Dodaj osobe..."
            />
            {showAssigneeSuggestions && assigneeSuggestions.length > 0 ? (
              <div className="todo-assignee-dropdown">
                {assigneeSuggestions.map((person) => (
                  <button
                    key={person}
                    type="button"
                    className="todo-assignee-option"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      addAssignee(person);
                    }}
                  >
                    {person}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Komentarze</strong>
            <span>{(selectedTask.comments || []).length}</span>
          </div>
          <div className="todo-comment-create" style={{ position: "relative" }}>
            <textarea
              ref={commentTextareaRef}
              rows="3"
              value={commentDraft}
              onChange={handleCommentChange}
              placeholder="Dodaj komentarz... wpisz @ aby wspomnieć osobę"
            />
            {showMentions && (
              <div className="todo-mention-dropdown">
                {peopleOptions
                  .filter((p) => p.toLowerCase().startsWith(mentionQuery.toLowerCase()))
                  .map((person) => (
                    <button key={person} type="button" className="todo-mention-option" onMouseDown={() => insertMention(person)}>
                      @{person}
                    </button>
                  ))}
              </div>
            )}
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
              null
            )}
          </div>
        </section>

        <section className="todo-detail-section">
          <div className="todo-section-head">
            <strong>Historia zmian</strong>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>{(selectedTask.history || []).length}</span>
              {(selectedTask.history || []).length > 0 && (
                <button
                  type="button"
                  className="todo-history-toggle"
                  onClick={() => setHistoryExpanded((v) => !v)}
                  title={historyExpanded ? "Ukryj historię" : "Pokaż historię"}
                >
                  {historyExpanded ? "▲" : "▼"}
                </button>
              )}
            </div>
          </div>
          {historyExpanded && (
            <div className="todo-history-list">
              {[...selectedTask.history].reverse().map((entry) => (
                <article key={entry.id} className="todo-history-row">
                  <strong>{entry.actor || "System"}</strong>
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

      </div>
    </aside>
  );
}
