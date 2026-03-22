import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "../lib/storage";
import { createTaskComment } from "../lib/tasks";
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
  const [tagDraft, setTagDraft] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const commentTextareaRef = useRef(null);
  const tagInputRef = useRef(null);
  const [conflictDraft, setConflictDraft] = useState(buildConflictDraft(selectedTask?.googleSyncConflict));
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const tagOptions = useMemo(
    () => [...new Set((tasks || []).flatMap((t) => t.tags || []))].filter(Boolean).sort(),
    [tasks]
  );

  useEffect(() => {
    setCommentDraft("");
    setTagDraft("");
    setShowTagSuggestions(false);
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

  const selectedTags = Array.isArray(selectedTask.tags) ? selectedTask.tags : [];
  const normalizedTagDraft = tagDraft.trim().replace(/,$/, "");
  const tagQuery = normalizedTagDraft.toLowerCase();
  const tagSuggestions = tagOptions
    .filter((tag) => !selectedTags.some((item) => item.toLowerCase() === tag.toLowerCase()))
    .filter((tag) => {
      if (!tagQuery) return true;
      const normalizedTag = tag.toLowerCase();
      return normalizedTag.startsWith(tagQuery);
    })
    .slice(0, 8);
  const canCreateTag = Boolean(normalizedTagDraft) && !selectedTags.some((item) => item.toLowerCase() === normalizedTagDraft.toLowerCase());

  function updateTags(nextTags) {
    onUpdateTask(selectedTask.id, { tags: nextTags });
  }

  function addTag(tag) {
    const normalized = String(tag || "").trim().replace(/,$/, "");
    if (!normalized) return;
    updateTags(toggleItem(selectedTags, normalized));
    setTagDraft("");
    setShowTagSuggestions(false);
    tagInputRef.current?.focus?.();
  }

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
    if (!commentDraft.trim()) return;
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
            <div className="todo-detail-badges" />
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
          <div className="todo-detail-stack">
            <button type="button" className="todo-detail-row add-step" onClick={() => onUpdateTask(selectedTask.id, { notes: selectedTask.notes || "" })}>
              <span className="todo-row-icon">+</span>
              <span>Dodaj krok</span>
            </button>

            <button type="button" className={selectedTask.myDay ? "todo-detail-row active" : "todo-detail-row"} onClick={() => onUpdateTask(selectedTask.id, { myDay: !selectedTask.myDay })}>
              <span className="todo-row-icon">?</span>
              <span>{selectedTask.myDay ? "Dodano do My Day" : "Dodaj do My Day"}</span>
            </button>

            <label className="todo-detail-row field-row">
              <span className="todo-row-icon">??</span>
              <span className="todo-row-label">Przypomnienie</span>
              <input type="datetime-local" value={toInputDateTime(selectedTask.reminderAt)} onChange={(event) => onUpdateTask(selectedTask.id, { reminderAt: event.target.value })} />
            </label>

            <label className="todo-detail-row field-row">
              <span className="todo-row-icon">??</span>
              <span className="todo-row-label">Termin</span>
              <input type="datetime-local" value={toInputDateTime(selectedTask.dueDate)} onChange={(event) => onUpdateTask(selectedTask.id, { dueDate: event.target.value })} />
            </label>

            <button type="button" className="todo-detail-row muted" disabled>
              <span className="todo-row-icon">?</span>
              <span>Powtarzanie</span>
            </button>

            <label className="todo-detail-row field-row">
              <span className="todo-row-icon">??</span>
              <span className="todo-row-label">Kategoria</span>
              <div className="todo-tag-editor">
                <div className="todo-tag-chip-list">
                  {selectedTags.map((tag) => (
                    <button key={tag} type="button" className="todo-tag-chip" onClick={() => updateTags(selectedTags.filter((item) => item !== tag))} title="Usu? tag">
                      <span>{tag}</span>
                      <span aria-hidden="true">?</span>
                    </button>
                  ))}
                  <input
                    ref={tagInputRef}
                    value={tagDraft}
                    onChange={(event) => { setTagDraft(event.target.value); setShowTagSuggestions(true); }}
                    onClick={() => setShowTagSuggestions(true)}
                    onPointerDown={() => setShowTagSuggestions(true)}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 120)}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === ",") && tagDraft.trim()) { event.preventDefault(); addTag(tagDraft); }
                      else if (event.key === "Backspace" && !tagDraft && selectedTags.length) { updateTags(selectedTags.slice(0, -1)); }
                      else if (event.key === "Escape") { setShowTagSuggestions(false); }
                    }}
                    placeholder={selectedTags.length ? "" : "Dodaj tag..."}
                  />
                </div>
                <small className="todo-tag-hint">Wpisz tag, wybierz z listy albo dodaj nowy.</small>
                {showTagSuggestions && tagSuggestions.length > 0 ? (
                  <div className="todo-tag-dropdown">
                    {tagSuggestions.map((tag) => (
                      <button key={tag} type="button" className="todo-tag-option" onMouseDown={(event) => { event.preventDefault(); addTag(tag); }}>
                        {tag}
                      </button>
                    ))}
                    {canCreateTag && !tagSuggestions.some((tag) => tag.toLowerCase() === normalizedTagDraft.toLowerCase()) ? (
                      <button type="button" className="todo-tag-option create" onMouseDown={(event) => { event.preventDefault(); addTag(normalizedTagDraft); }}>
                        Dodaj tag "${normalizedTagDraft}"
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {showTagSuggestions && !tagSuggestions.length && canCreateTag ? (
                  <div className="todo-tag-dropdown">
                    <button type="button" className="todo-tag-option create" onMouseDown={(event) => { event.preventDefault(); addTag(normalizedTagDraft); }}>
                      Dodaj tag "${normalizedTagDraft}"
                    </button>
                  </div>
                ) : null}
              </div>
            </label>

            <label className="todo-detail-row note-row">
              <span className="todo-row-icon">📝</span>
              <span className="todo-row-label">Notatka</span>
              <textarea rows="5" value={selectedTask.notes || ""} onChange={(event) => onUpdateTask(selectedTask.id, { notes: event.target.value })} placeholder="Dodaj notatk?" />
            </label>
          </div>
        </div>

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
            ) : null}
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

        <div className="todo-detail-footer">
          <button
            type="button"
            className="todo-delete-button"
            onClick={() => {
              if (window.confirm("Usunac to zadanie?")) {
                onDeleteTask?.(selectedTask.id);
              }
            }}
            aria-label="Usun zadanie"
            title="Usun zadanie"
          >
            {"🗑"}
          </button>
        </div>

      </div>
    </aside>
  );
}
