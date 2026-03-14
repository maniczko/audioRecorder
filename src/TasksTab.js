import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "./lib/storage";

function filterLabel(filter) {
  switch (filter) {
    case "assigned":
      return "Przypisane do mnie";
    case "important":
      return "Wazne";
    case "completed":
      return "Zakonczone";
    case "manual":
      return "Reczne zadania";
    default:
      return "Wszystkie zadania";
  }
}

function toLocalInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 16);
  }

  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function moveStatus(statuses, currentStatus, direction) {
  const index = statuses.findIndex((status) => status.id === currentStatus);
  if (index < 0) {
    return currentStatus;
  }

  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= statuses.length) {
    return currentStatus;
  }

  return statuses[nextIndex].id;
}

function handleCardKeyDown(event, callback) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
}

export default function TasksTab({
  filters,
  activeFilter,
  onFilterChange,
  stats,
  tasks,
  selectedTask,
  onSelectTask,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onOpenMeeting,
  peopleOptions,
  defaultView,
  statuses,
}) {
  const [viewMode, setViewMode] = useState(defaultView || "list");
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    owner: "",
    dueDate: "",
    description: "",
    status: "todo",
    important: false,
  });
  const [taskMessage, setTaskMessage] = useState("");

  useEffect(() => {
    setViewMode(defaultView || "list");
  }, [defaultView]);

  const board = useMemo(
    () =>
      statuses.map((status) => ({
        ...status,
        tasks: tasks.filter((task) => task.status === status.id),
      })),
    [statuses, tasks]
  );

  function resetDraft() {
    setDraft({
      title: "",
      owner: "",
      dueDate: "",
      description: "",
      status: "todo",
      important: false,
    });
  }

  function submitTask(event) {
    event.preventDefault();

    try {
      const nextId = onCreateTask(draft);
      resetDraft();
      setComposerOpen(false);
      setTaskMessage("Zadanie dodane.");
      if (nextId) {
        onSelectTask(nextId);
      }
    } catch (error) {
      setTaskMessage(error.message);
    }
  }

  return (
    <div className="tasks-layout">
      <aside className="tasks-sidebar">
        <section className="tasks-brand-panel">
          <div className="eyebrow">Tasks</div>
          <h2>Plan dnia i follow-up</h2>
          <p>Taski ze spotkan trafiaja tu automatycznie, a reczne zadania mozesz dopisac i od razu wrzucic na kanban.</p>
        </section>

        <section className="tasks-list-panel">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={activeFilter === filter.id ? "task-filter-card active" : "task-filter-card"}
              onClick={() => onFilterChange(filter.id)}
            >
              <div>
                <strong>{filter.label}</strong>
                <span>{filter.description}</span>
              </div>
              <div className="task-filter-count">{filter.count}</div>
            </button>
          ))}

          <div className="task-smart-summary">
            <div>
              <span>Otwarte</span>
              <strong>{stats.open}</strong>
            </div>
            <div>
              <span>Reczne</span>
              <strong>{stats.manual}</strong>
            </div>
            <div>
              <span>Zakonczone</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>
        </section>
      </aside>

      <section className="tasks-main-panel">
        <div className="tasks-header">
          <div>
            <div className="eyebrow">Task list</div>
            <h2>{filterLabel(activeFilter)}</h2>
          </div>

          <div className="tasks-header-actions">
            <div className="view-toggle">
              <button
                type="button"
                className={viewMode === "list" ? "pill active" : "pill"}
                onClick={() => setViewMode("list")}
              >
                Lista
              </button>
              <button
                type="button"
                className={viewMode === "kanban" ? "pill active" : "pill"}
                onClick={() => setViewMode("kanban")}
              >
                Kanban
              </button>
            </div>

            <button
              type="button"
              className={composerOpen ? "secondary-button" : "primary-button"}
              onClick={() => {
                setComposerOpen((previous) => !previous);
                setTaskMessage("");
              }}
            >
              {composerOpen ? "Zamknij formularz" : "Nowe zadanie"}
            </button>
          </div>
        </div>

        {composerOpen ? (
          <form className="task-composer-card" onSubmit={submitTask}>
            <div className="task-composer-grid">
              <label>
                <span>Tytul</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="np. Przygotowac podsumowanie dla klienta"
                />
              </label>
              <label>
                <span>Owner</span>
                <input
                  list="task-owner-options"
                  value={draft.owner}
                  onChange={(event) => setDraft((previous) => ({ ...previous, owner: event.target.value }))}
                  placeholder="np. Anna Nowak"
                />
              </label>
              <label>
                <span>Termin</span>
                <input
                  type="datetime-local"
                  value={draft.dueDate}
                  onChange={(event) => setDraft((previous) => ({ ...previous, dueDate: event.target.value }))}
                />
              </label>
              <label>
                <span>Status startowy</span>
                <select
                  value={draft.status}
                  onChange={(event) => setDraft((previous) => ({ ...previous, status: event.target.value }))}
                >
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Opis</span>
              <textarea
                rows="4"
                value={draft.description}
                onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
                placeholder="Krotki kontekst, checklista albo warunek ukonczenia."
              />
            </label>

            <label className="toggle-card compact">
              <input
                type="checkbox"
                checked={draft.important}
                onChange={(event) => setDraft((previous) => ({ ...previous, important: event.target.checked }))}
              />
              <div>
                <strong>Oznacz jako wazne</strong>
                <span>Zadanie bedzie podbite w widokach listy i kanban.</span>
              </div>
            </label>

            <div className="button-row">
              <button type="submit" className="primary-button">
                Dodaj zadanie
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  resetDraft();
                  setComposerOpen(false);
                }}
              >
                Anuluj
              </button>
            </div>

            {taskMessage ? <div className="inline-alert info">{taskMessage}</div> : null}
          </form>
        ) : null}

        <datalist id="task-owner-options">
          {peopleOptions.map((person) => (
            <option key={person} value={person} />
          ))}
        </datalist>

        {viewMode === "list" ? (
          <div className="tasks-items">
            {tasks.length ? (
              tasks.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  className={selectedTask?.id === task.id ? "task-row active" : "task-row"}
                  onClick={() => onSelectTask(task.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, () => onSelectTask(task.id))}
                >
                  <div className="task-row-left">
                    <button
                      type="button"
                      className={task.completed ? "task-check completed" : "task-check"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateTask(task.id, {
                          completed: !task.completed,
                          status: task.completed ? "todo" : "done",
                        });
                      }}
                    >
                      {task.completed ? "OK" : ""}
                    </button>
                    <div className="task-copy">
                      <strong>{task.title}</strong>
                      <span>{`${task.owner} | ${task.sourceMeetingTitle}`}</span>
                    </div>
                  </div>
                  <div className="task-row-right">
                    <span className={`task-status-chip ${task.status}`}>{statuses.find((status) => status.id === task.status)?.shortLabel || task.status}</span>
                    {task.important ? <span className="task-flag">Wazne</span> : null}
                    {task.dueDate ? <span className="task-date">{formatDateTime(task.dueDate)}</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="task-empty-state">
                <strong>Brak taskow w tym widoku</strong>
                <span>Nagraj spotkanie albo dodaj reczne zadanie, aby wypelnic liste.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="kanban-board">
            {board.map((column, index) => (
              <section key={column.id} className="kanban-column">
                <div className="kanban-column-header">
                  <div>
                    <strong>{column.label}</strong>
                    <span>{column.tasks.length} zadan</span>
                  </div>
                </div>

                <div className="kanban-column-body">
                  {column.tasks.length ? (
                    column.tasks.map((task) => (
                      <article
                        key={task.id}
                        role="button"
                        tabIndex={0}
                        className={selectedTask?.id === task.id ? "kanban-card active" : "kanban-card"}
                        onClick={() => onSelectTask(task.id)}
                        onKeyDown={(event) => handleCardKeyDown(event, () => onSelectTask(task.id))}
                      >
                        <div className="kanban-card-top">
                          <strong>{task.title}</strong>
                          {task.important ? <span className="task-flag">Wazne</span> : null}
                        </div>
                        <p>{task.description || task.sourceQuote || "Task z analizy spotkania."}</p>
                        <div className="kanban-card-meta">
                          <span>{task.owner}</span>
                          <span>{task.sourceType === "manual" ? "Reczne" : task.sourceMeetingTitle}</span>
                        </div>
                        <div className="kanban-card-actions">
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={(event) => {
                              event.stopPropagation();
                              onUpdateTask(task.id, { status: moveStatus(statuses, column.id, -1) });
                            }}
                            disabled={index === 0}
                          >
                            Wstecz
                          </button>
                          <button
                            type="button"
                            className="ghost-button small"
                            onClick={(event) => {
                              event.stopPropagation();
                              onUpdateTask(task.id, { status: moveStatus(statuses, column.id, 1) });
                            }}
                            disabled={index === statuses.length - 1}
                          >
                            Dalej
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="kanban-empty">Nic tu jeszcze nie ma.</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <aside className="task-detail-panel">
        {selectedTask ? (
          <>
            <div className="panel-header compact">
              <div>
                <div className="eyebrow">Szczegoly</div>
                <h2>{selectedTask.title}</h2>
              </div>
            </div>

            <div className="task-detail-meta">
              <div className="task-detail-chip">
                <span>Owner</span>
                <strong>{selectedTask.owner}</strong>
              </div>
              <div className="task-detail-chip">
                <span>Status</span>
                <strong>{statuses.find((status) => status.id === selectedTask.status)?.label || selectedTask.status}</strong>
              </div>
              <div className="task-detail-chip">
                <span>Zrodlo</span>
                <strong>{selectedTask.sourceType === "manual" ? "Reczne" : "Spotkanie"}</strong>
              </div>
            </div>

            <div className="stack-form">
              <label>
                <span>Tytul</span>
                <input
                  value={selectedTask.title}
                  onChange={(event) => onUpdateTask(selectedTask.id, { title: event.target.value })}
                />
              </label>
              <label>
                <span>Owner</span>
                <input
                  list="task-owner-options"
                  value={selectedTask.owner}
                  onChange={(event) => onUpdateTask(selectedTask.id, { owner: event.target.value })}
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={selectedTask.status}
                  onChange={(event) => onUpdateTask(selectedTask.id, { status: event.target.value })}
                >
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Termin</span>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(selectedTask.dueDate)}
                  onChange={(event) => onUpdateTask(selectedTask.id, { dueDate: event.target.value })}
                />
              </label>
              <label className="task-note-field">
                <span>Opis</span>
                <textarea
                  rows="4"
                  value={selectedTask.description || ""}
                  onChange={(event) => onUpdateTask(selectedTask.id, { description: event.target.value })}
                />
              </label>
              <label className="task-note-field">
                <span>Notatki</span>
                <textarea
                  rows="6"
                  value={selectedTask.notes || ""}
                  onChange={(event) => onUpdateTask(selectedTask.id, { notes: event.target.value })}
                  placeholder="Dodaj prywatne notatki do zadania."
                />
              </label>
            </div>

            <div className="task-detail-actions">
              <button
                type="button"
                className={selectedTask.completed ? "secondary-button" : "primary-button"}
                onClick={() =>
                  onUpdateTask(selectedTask.id, {
                    completed: !selectedTask.completed,
                    status: selectedTask.completed ? "todo" : "done",
                  })
                }
              >
                {selectedTask.completed ? "Przywroc jako otwarte" : "Oznacz jako zrobione"}
              </button>
              <button
                type="button"
                className={selectedTask.important ? "secondary-button" : "ghost-button"}
                onClick={() => onUpdateTask(selectedTask.id, { important: !selectedTask.important })}
              >
                {selectedTask.important ? "Usun waznosc" : "Oznacz jako wazne"}
              </button>
              <button type="button" className="ghost-button" onClick={() => onDeleteTask(selectedTask.id)}>
                {selectedTask.sourceType === "manual" ? "Usun zadanie" : "Ukryj z listy"}
              </button>
            </div>

            <div className="task-source-card">
              <span>Zrodlo</span>
              <p>{selectedTask.sourceQuote || selectedTask.description || "Task powstal na bazie analizy spotkania."}</p>
              {selectedTask.sourceType === "meeting" ? (
                <button type="button" className="ghost-button" onClick={() => onOpenMeeting(selectedTask.sourceMeetingId)}>
                  Otworz spotkanie
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="task-empty-state detail">
            <strong>Wybierz zadanie</strong>
            <span>Tutaj zobaczysz szczegoly, ownera, termin i status zadania.</span>
          </div>
        )}
      </aside>
    </div>
  );
}
