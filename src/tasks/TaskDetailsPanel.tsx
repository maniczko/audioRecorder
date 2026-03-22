import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "../lib/storage";
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
  const [tagDraft, setTagDraft] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef(null);
  const [conflictDraft, setConflictDraft] = useState(buildConflictDraft(selectedTask?.googleSyncConflict));
  const tagOptions = useMemo(
    () => [...new Set((tasks || []).flatMap((t) => t.tags || []))].filter(Boolean).sort(),
    [tasks]
  );

  useEffect(() => {
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
      return normalizedTag.startsWith(tagQuery) || normalizedTag.includes(tagQuery);
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

            <button type="button" className="todo-detail-row muted" disabled>
              <span className="todo-row-icon">??</span>
              <span>Dodaj plik</span>
            </button>

            <label className="todo-detail-row note-row">
              <span className="todo-row-icon">??</span>
              <span className="todo-row-label">Notatka</span>
              <textarea rows="5" value={selectedTask.notes || ""} onChange={(event) => onUpdateTask(selectedTask.id, { notes: event.target.value })} placeholder="Dodaj notatk?" />
            </label>
          </div>
        </div>

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
