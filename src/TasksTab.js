import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "./lib/storage";
import { TASK_PRIORITIES, taskListStats } from "./lib/tasks";

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
    case "google":
      return "Google Tasks";
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

function handleCardKeyDown(event, callback) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
}

function priorityRank(priority) {
  return ["urgent", "high", "medium", "low"].indexOf(priority);
}

function renderMarkdownPreview(markdown) {
  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = String(markdown || "").split(/\r?\n/);
  const html = [];
  let listBuffer = [];

  function flushList() {
    if (!listBuffer.length) {
      return;
    }
    html.push(`<ul>${listBuffer.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    listBuffer = [];
  }

  lines.forEach((line) => {
    const escaped = escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (/^\s*-\s+/.test(line)) {
      listBuffer.push(escaped.replace(/^\s*-\s+/, ""));
      return;
    }

    flushList();
    if (escaped.trim()) {
      html.push(`<p>${escaped}</p>`);
    }
  });

  flushList();
  return html.join("") || "<p>Brak notatek.</p>";
}

function dueBucket(task) {
  if (!task.dueDate) {
    return "Bez terminu";
  }

  const due = new Date(task.dueDate).getTime();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  if (due < now - day) {
    return "Po terminie";
  }
  if (due < now + day) {
    return "Dzisiaj";
  }
  if (due < now + 7 * day) {
    return "Ten tydzien";
  }
  return "Pozniej";
}

function groupTasks(tasks, groupBy, boardColumns) {
  if (groupBy === "none") {
    return [{ id: "all", label: "Wszystkie", tasks }];
  }

  const groups = new Map();

  tasks.forEach((task) => {
    let key = "Inne";
    let label = "Inne";

    if (groupBy === "status") {
      const column = boardColumns.find((item) => item.id === task.status);
      key = task.status;
      label = column?.label || task.status;
    } else if (groupBy === "owner") {
      key = task.owner || "Nieprzypisane";
      label = key;
    } else if (groupBy === "priority") {
      key = task.priority;
      label = TASK_PRIORITIES.find((item) => item.id === task.priority)?.label || task.priority;
    } else if (groupBy === "source") {
      key = task.sourceType;
      label = task.sourceType === "meeting" ? "Spotkanie" : task.sourceType === "google" ? "Google Tasks" : "Reczne";
    } else if (groupBy === "tag") {
      key = task.tags?.[0] || "Bez tagow";
      label = task.tags?.[0] ? `#${task.tags[0]}` : "Bez tagow";
    } else if (groupBy === "due") {
      key = dueBucket(task);
      label = key;
    }

    const existing = groups.get(key) || { id: key, label, tasks: [] };
    existing.tasks.push(task);
    groups.set(key, existing);
  });

  return [...groups.values()];
}

export default function TasksTab({
  tasks,
  peopleOptions,
  tagOptions,
  boardColumns,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onMoveTaskToColumn,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onOpenMeeting,
  defaultView,
  googleTasksEnabled,
  googleTasksStatus,
  googleTasksMessage,
  googleTaskLists,
  selectedGoogleTaskListId,
  onSelectGoogleTaskList,
  onConnectGoogleTasks,
  onImportGoogleTasks,
  onExportGoogleTasks,
}) {
  const [viewMode, setViewMode] = useState(defaultView || "list");
  const [quickFilter, setQuickFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [groupBy, setGroupBy] = useState("none");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [boardEditorOpen, setBoardEditorOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [dragTaskId, setDragTaskId] = useState("");
  const [taskMessage, setTaskMessage] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    owner: "",
    dueDate: "",
    description: "",
    status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || "",
    important: false,
    priority: "medium",
    tags: "",
    notes: "",
  });
  const [columnDraft, setColumnDraft] = useState({
    label: "",
    color: "#5a92ff",
    isDone: false,
  });
  const notesRef = useRef(null);

  useEffect(() => {
    setViewMode(defaultView || "list");
  }, [defaultView]);

  useEffect(() => {
    if (!boardColumns.some((column) => column.id === draft.status)) {
      setDraft((previous) => ({
        ...previous,
        status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || "",
      }));
    }
  }, [boardColumns, draft.status]);

  const stats = useMemo(() => taskListStats(tasks), [tasks]);

  const smartFilters = useMemo(
    () => [
      { id: "all", label: "Wszystkie", description: "Wszystkie zadania i follow-upy", count: stats.all },
      { id: "assigned", label: "Przypisane", description: "Zadania przypisane do mnie", count: stats.assigned },
      { id: "important", label: "Wazne", description: "Najwazniejsze priorytety", count: stats.important },
      { id: "completed", label: "Zakonczone", description: "Rzeczy juz domkniete", count: stats.completed },
      { id: "manual", label: "Reczne", description: "Dodane recznie poza spotkaniami", count: stats.manual },
      {
        id: "google",
        label: "Google",
        description: "Zadania zaimportowane z Google Tasks",
        count: tasks.filter((task) => task.sourceType === "google").length,
      },
    ],
    [stats, tasks]
  );

  const visibleTasks = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (quickFilter === "assigned" && !task.assignedToMe) {
          return false;
        }
        if (quickFilter === "important" && !task.important) {
          return false;
        }
        if (quickFilter === "completed" && !task.completed) {
          return false;
        }
        if (quickFilter === "manual" && task.sourceType !== "manual") {
          return false;
        }
        if (quickFilter === "google" && task.sourceType !== "google") {
          return false;
        }
        if (ownerFilter !== "all" && task.owner !== ownerFilter) {
          return false;
        }
        if (tagFilter !== "all" && !(task.tags || []).includes(tagFilter)) {
          return false;
        }
        if (priorityFilter !== "all" && task.priority !== priorityFilter) {
          return false;
        }
        if (term) {
          const haystack = `${task.title} ${task.description} ${task.owner} ${task.notes} ${(task.tags || []).join(" ")}`.toLowerCase();
          if (!haystack.includes(term)) {
            return false;
          }
        }
        return true;
      })
      .sort((left, right) => {
        if (sortBy === "title") {
          return left.title.localeCompare(right.title);
        }
        if (sortBy === "owner") {
          return left.owner.localeCompare(right.owner);
        }
        if (sortBy === "due") {
          return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime();
        }
        if (sortBy === "priority") {
          return priorityRank(left.priority) - priorityRank(right.priority);
        }
        return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
      });
  }, [tasks, quickFilter, ownerFilter, tagFilter, priorityFilter, query, sortBy]);

  useEffect(() => {
    if (!visibleTasks.length) {
      setSelectedTaskId("");
      return;
    }

    if (!visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].id);
    }
  }, [selectedTaskId, visibleTasks]);

  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId) || visibleTasks[0] || null;
  const groupedTasks = useMemo(() => groupTasks(visibleTasks, groupBy, boardColumns), [visibleTasks, groupBy, boardColumns]);
  const kanbanColumns = useMemo(
    () =>
      boardColumns.map((column) => ({
        ...column,
        tasks: visibleTasks.filter((task) => task.status === column.id),
      })),
    [boardColumns, visibleTasks]
  );

  function resetDraft() {
    setDraft({
      title: "",
      owner: peopleOptions[0] || "",
      dueDate: "",
      description: "",
      status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || "",
      important: false,
      priority: "medium",
      tags: "",
      notes: "",
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
        setSelectedTaskId(nextId);
      }
    } catch (error) {
      setTaskMessage(error.message);
    }
  }

  function insertMarkdown(type) {
    if (!selectedTask || !notesRef.current) {
      return;
    }

    const field = notesRef.current;
    const start = field.selectionStart || 0;
    const end = field.selectionEnd || 0;
    const currentValue = selectedTask.notes || "";
    const selectedText = currentValue.slice(start, end) || (type === "list" ? "element" : "tekst");
    let replacement = selectedText;

    if (type === "bold") {
      replacement = `**${selectedText}**`;
    }

    if (type === "list") {
      replacement = selectedText
        .split(/\r?\n/)
        .map((item) => `- ${item.replace(/^-\s*/, "")}`)
        .join("\n");
    }

    const nextValue = `${currentValue.slice(0, start)}${replacement}${currentValue.slice(end)}`;
    onUpdateTask(selectedTask.id, { notes: nextValue });
  }

  function submitColumn(event) {
    event.preventDefault();
    try {
      onCreateColumn(columnDraft);
      setColumnDraft({ label: "", color: "#5a92ff", isDone: false });
    } catch (error) {
      setTaskMessage(error.message);
    }
  }

  return (
    <div className="tasks-layout premium">
      <aside className="tasks-sidebar">
        <section className="tasks-brand-panel">
          <div className="eyebrow">Tasks</div>
          <h2>Focus, follow-up i execution</h2>
          <p>
            Widok jest zbudowany jak premium task manager: smart lists, szybkie sortowanie, kanban z drag and drop i
            szczegoly zadania pod reka.
          </p>
        </section>

        <section className="tasks-list-panel">
          {smartFilters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={quickFilter === filter.id ? "task-filter-card active" : "task-filter-card"}
              onClick={() => setQuickFilter(filter.id)}
            >
              <div>
                <strong>{filter.label}</strong>
                <span>{filter.description}</span>
                {filter.id === "completed" ? (
                  <div className="task-progress-row">
                    <div className="task-progress-bar">
                      <span style={{ width: `${stats.progress}%` }} />
                    </div>
                    <small>{stats.progress}%</small>
                  </div>
                ) : null}
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
              <span>W kanbanie</span>
              <strong>{boardColumns.length} kolumn</strong>
            </div>
            <div>
              <span>Tagi</span>
              <strong>{tagOptions.length}</strong>
            </div>
          </div>
        </section>

        <section className="tasks-list-panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Google Tasks</div>
              <h2>Integracja</h2>
            </div>
          </div>
          <div className="integration-card compact">
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={onConnectGoogleTasks}
                disabled={!googleTasksEnabled || googleTasksStatus === "loading"}
              >
                {googleTasksStatus === "loading" ? "Laczenie..." : "Polacz"}
              </button>
              <button type="button" className="ghost-button" onClick={onImportGoogleTasks} disabled={!selectedGoogleTaskListId}>
                Importuj
              </button>
              <button type="button" className="ghost-button" onClick={onExportGoogleTasks} disabled={!selectedGoogleTaskListId}>
                Eksportuj
              </button>
            </div>

            <label>
              <span>Lista zadan Google</span>
              <select value={selectedGoogleTaskListId} onChange={(event) => onSelectGoogleTaskList(event.target.value)}>
                <option value="">Wybierz liste</option>
                {googleTaskLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
              </select>
            </label>

            {googleTasksMessage ? <div className="inline-alert info">{googleTasksMessage}</div> : null}
          </div>
        </section>

        <section className="tasks-list-panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Columns</div>
              <h2>Kanban</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setBoardEditorOpen((previous) => !previous)}>
              {boardEditorOpen ? "Ukryj" : "Edytuj"}
            </button>
          </div>

          <div className="column-badge-list">
            {boardColumns.map((column) => (
              <span key={column.id} className="column-badge" style={{ "--column-color": column.color }}>
                {column.label}
              </span>
            ))}
          </div>

          {boardEditorOpen ? (
            <div className="column-editor">
              {boardColumns.map((column) => (
                <div key={column.id} className="column-editor-row">
                  <input value={column.label} onChange={(event) => onUpdateColumn(column.id, { label: event.target.value })} />
                  <input type="color" value={column.color} onChange={(event) => onUpdateColumn(column.id, { color: event.target.value })} />
                  <label className="toggle-card compact inline">
                    <input type="checkbox" checked={column.isDone} onChange={(event) => onUpdateColumn(column.id, { isDone: event.target.checked })} />
                    <div>
                      <strong>Done</strong>
                    </div>
                  </label>
                  <button type="button" className="ghost-button small danger-hover" onClick={() => onDeleteColumn(column.id)} disabled={column.system}>
                    Usun
                  </button>
                </div>
              ))}

              <form className="column-create-form" onSubmit={submitColumn}>
                <input
                  value={columnDraft.label}
                  onChange={(event) => setColumnDraft((previous) => ({ ...previous, label: event.target.value }))}
                  placeholder="Nowa kolumna"
                />
                <input
                  type="color"
                  value={columnDraft.color}
                  onChange={(event) => setColumnDraft((previous) => ({ ...previous, color: event.target.value }))}
                />
                <label className="toggle-card compact inline">
                  <input
                    type="checkbox"
                    checked={columnDraft.isDone}
                    onChange={(event) => setColumnDraft((previous) => ({ ...previous, isDone: event.target.checked }))}
                  />
                  <div>
                    <strong>Done</strong>
                  </div>
                </label>
                <button type="submit" className="secondary-button small">
                  Dodaj
                </button>
              </form>
            </div>
          ) : null}
        </section>
      </aside>

      <section className="tasks-main-panel">
        <div className="tasks-header premium">
          <div>
            <div className="eyebrow">Task list</div>
            <h2>{filterLabel(quickFilter)}</h2>
          </div>

          <div className="tasks-header-actions">
            <div className="segmented-control">
              <button type="button" className={viewMode === "list" ? "segment active" : "segment"} onClick={() => setViewMode("list")}>
                Lista
              </button>
              <button type="button" className={viewMode === "kanban" ? "segment active" : "segment"} onClick={() => setViewMode("kanban")}>
                Kanban
              </button>
            </div>

            <button type="button" className="primary-button" onClick={() => setComposerOpen((previous) => !previous)}>
              {composerOpen ? "Zamknij" : "Nowe zadanie"}
            </button>
          </div>
        </div>

        <div className="task-toolbar">
          <label className="task-search-field">
            <span>Szukaj</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tytul, owner, tag, notatka..." />
          </label>

          <label>
            <span>Sortuj</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="updated">Ostatnia aktywnosc</option>
              <option value="due">Termin</option>
              <option value="priority">Priorytet</option>
              <option value="owner">Osoba</option>
              <option value="title">Tytul</option>
            </select>
          </label>

          <label>
            <span>Grupuj</span>
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
              <option value="none">Bez grupowania</option>
              <option value="status">Po statusie</option>
              <option value="owner">Po osobie</option>
              <option value="priority">Po priorytecie</option>
              <option value="source">Po zrodle</option>
              <option value="tag">Po tagu</option>
              <option value="due">Po terminie</option>
            </select>
          </label>

          <label>
            <span>Osoba</span>
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="all">Wszystkie osoby</option>
              {peopleOptions.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Tag</span>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="all">Wszystkie tagi</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Priorytet</span>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="all">Kazdy</option>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority.id} value={priority.id}>
                  {priority.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {composerOpen ? (
          <form className="task-composer-card premium" onSubmit={submitTask}>
            <div className="task-composer-header">
              <div>
                <div className="eyebrow">Composer</div>
                <h3>Dodaj zadanie</h3>
              </div>
              <button type="button" className="ghost-button small" onClick={() => setComposerOpen(false)}>
                Zamknij
              </button>
            </div>

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
                <span>Osoba</span>
                <select value={draft.owner} onChange={(event) => setDraft((previous) => ({ ...previous, owner: event.target.value }))}>
                  <option value="">Nieprzypisane</option>
                  {peopleOptions.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Termin</span>
                <input type="datetime-local" value={draft.dueDate} onChange={(event) => setDraft((previous) => ({ ...previous, dueDate: event.target.value }))} />
              </label>
              <label>
                <span>Kolumna</span>
                <select value={draft.status} onChange={(event) => setDraft((previous) => ({ ...previous, status: event.target.value }))}>
                  {boardColumns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priorytet</span>
                <select value={draft.priority} onChange={(event) => setDraft((previous) => ({ ...previous, priority: event.target.value }))}>
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tagi</span>
                <input value={draft.tags} onChange={(event) => setDraft((previous) => ({ ...previous, tags: event.target.value }))} placeholder="np. klient, budzet, follow-up" />
              </label>
            </div>

            <label>
              <span>Opis</span>
              <textarea rows="3" value={draft.description} onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))} />
            </label>

            <label>
              <span>Notatki</span>
              <textarea rows="4" value={draft.notes} onChange={(event) => setDraft((previous) => ({ ...previous, notes: event.target.value }))} />
            </label>

            <div className="composer-footer">
              <label className="toggle-card compact inline">
                <input type="checkbox" checked={draft.important} onChange={(event) => setDraft((previous) => ({ ...previous, important: event.target.checked }))} />
                <div>
                  <strong>Wazne</strong>
                </div>
              </label>

              <div className="button-row">
                <button type="submit" className="primary-button">
                  Dodaj zadanie
                </button>
                <button type="button" className="ghost-button" onClick={resetDraft}>
                  Wyczysc
                </button>
              </div>
            </div>

            {taskMessage ? <div className="inline-alert info">{taskMessage}</div> : null}
          </form>
        ) : null}

        {viewMode === "list" ? (
          <div className="tasks-list-groups">
            {groupedTasks.map((group) => (
              <section key={group.id} className="task-group">
                {groupBy !== "none" ? (
                  <div className="task-group-header">
                    <strong>{group.label}</strong>
                    <span>{group.tasks.length} zadan</span>
                  </div>
                ) : null}

                <div className="tasks-items compact">
                  {group.tasks.length ? (
                    group.tasks.map((task) => {
                      const priority = TASK_PRIORITIES.find((item) => item.id === task.priority);
                      const column = boardColumns.find((item) => item.id === task.status);

                      return (
                        <div
                          key={task.id}
                          role="button"
                          tabIndex={0}
                          className={selectedTask?.id === task.id ? "task-row active dense" : "task-row dense"}
                          onClick={() => setSelectedTaskId(task.id)}
                          onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
                        >
                          <div className="task-row-left">
                            <button
                              type="button"
                              className={task.completed ? "task-check completed" : "task-check"}
                              onClick={(event) => {
                                event.stopPropagation();
                                onUpdateTask(task.id, { completed: !task.completed });
                              }}
                            >
                              {task.completed ? "OK" : ""}
                            </button>
                            <div className="task-copy">
                              <strong>{task.title}</strong>
                              <span>{`${task.owner || "Nieprzypisane"} | ${task.sourceMeetingTitle}`}</span>
                              <div className="task-inline-meta">
                                <span className={`task-status-chip ${task.status}`} style={{ "--status-color": column?.color || "#5a92ff" }}>
                                  {column?.label || task.status}
                                </span>
                                <span className={`priority-chip ${task.priority}`} style={{ "--priority-color": priority?.color || "#75d6c4" }}>
                                  {priority?.label || task.priority}
                                </span>
                                {task.important ? <span className="task-flag">Wazne</span> : null}
                                {(task.tags || []).slice(0, 3).map((tag) => (
                                  <span key={`${task.id}-${tag}`} className="task-tag-chip">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="task-row-right">
                            {task.dueDate ? <span className="task-date">{formatDateTime(task.dueDate)}</span> : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="task-empty-state">
                      <strong>Brak taskow</strong>
                      <span>Ten segment jest pusty.</span>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="kanban-board premium">
            {kanbanColumns.map((column) => (
              <section
                key={column.id}
                className={dragTaskId ? "kanban-column drop-target" : "kanban-column"}
                style={{ "--column-color": column.color }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData("text/plain") || dragTaskId;
                  if (taskId) {
                    onMoveTaskToColumn(taskId, column.id);
                    setDragTaskId("");
                  }
                }}
              >
                <div className="kanban-column-header premium" style={{ "--column-color": column.color }}>
                  <div>
                    <strong>{column.label}</strong>
                    <span>{column.tasks.length} zadan</span>
                  </div>
                </div>

                <div className="kanban-column-body">
                  {column.tasks.length ? (
                    column.tasks.map((task) => {
                      const priority = TASK_PRIORITIES.find((item) => item.id === task.priority);
                      return (
                        <article
                          key={task.id}
                          role="button"
                          tabIndex={0}
                          draggable
                          className={selectedTask?.id === task.id ? "kanban-card active" : "kanban-card"}
                          onClick={() => setSelectedTaskId(task.id)}
                          onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
                          onDragStart={(event) => {
                            setDragTaskId(task.id);
                            event.dataTransfer.setData("text/plain", task.id);
                          }}
                          onDragEnd={() => setDragTaskId("")}
                        >
                          <div className="kanban-card-top">
                            <strong>{task.title}</strong>
                            <span className={`priority-chip ${task.priority}`} style={{ "--priority-color": priority?.color || "#75d6c4" }}>
                              {priority?.label || task.priority}
                            </span>
                          </div>
                          <p>{task.description || task.sourceQuote || "Task z analizy spotkania."}</p>
                          <div className="kanban-card-meta">
                            <span>{task.owner}</span>
                            <span>{task.sourceType === "manual" ? "Reczne" : task.sourceMeetingTitle}</span>
                          </div>
                          <div className="chip-list compact">
                            {task.important ? <span className="task-flag">Wazne</span> : null}
                            {(task.tags || []).slice(0, 3).map((tag) => (
                              <span key={`${task.id}-${tag}`} className="task-tag-chip">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="kanban-empty">Przeciagnij tu zadanie albo dodaj nowe.</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <aside className="task-detail-panel premium">
        {selectedTask ? (
          <>
            <div className="panel-header compact">
              <div>
                <div className="eyebrow">Szczegoly</div>
                <h2>{selectedTask.title}</h2>
              </div>
            </div>

            <div className="task-detail-source">
              <span className="task-source-badge">
                {selectedTask.sourceType === "meeting"
                  ? "Spotkanie"
                  : selectedTask.sourceType === "google"
                    ? "Google Tasks"
                    : "Reczne"}
              </span>
              {selectedTask.sourceMeetingTitle ? <span className="soft-copy">{selectedTask.sourceMeetingTitle}</span> : null}
            </div>

            <div className="task-detail-meta">
              <div className="task-detail-chip">
                <span>Osoba</span>
                <strong>{selectedTask.owner}</strong>
              </div>
              <div className="task-detail-chip">
                <span>Status</span>
                <strong>{boardColumns.find((status) => status.id === selectedTask.status)?.label || selectedTask.status}</strong>
              </div>
              <div className="task-detail-chip">
                <span>Priorytet</span>
                <strong>{TASK_PRIORITIES.find((item) => item.id === selectedTask.priority)?.label || selectedTask.priority}</strong>
              </div>
            </div>

            <div className="stack-form roomy">
              <label>
                <span>Tytul</span>
                <input value={selectedTask.title} onChange={(event) => onUpdateTask(selectedTask.id, { title: event.target.value })} />
              </label>
              <label>
                <span>Osoba</span>
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
                <span>Termin</span>
                <input
                  type="datetime-local"
                  value={toLocalInputValue(selectedTask.dueDate)}
                  onChange={(event) => onUpdateTask(selectedTask.id, { dueDate: event.target.value })}
                />
              </label>
              <label>
                <span>Tagi</span>
                <input value={(selectedTask.tags || []).join(", ")} onChange={(event) => onUpdateTask(selectedTask.id, { tags: event.target.value })} />
              </label>
              <label className="task-note-field">
                <span>Opis</span>
                <textarea rows="3" value={selectedTask.description || ""} onChange={(event) => onUpdateTask(selectedTask.id, { description: event.target.value })} />
              </label>
            </div>

            <div className="markdown-toolbar">
              <button type="button" className="ghost-button small" onClick={() => insertMarkdown("bold")}>
                Pogrub
              </button>
              <button type="button" className="ghost-button small" onClick={() => insertMarkdown("list")}>
                Lista
              </button>
            </div>

            <label className="task-note-field markdown-field">
              <span>Notatki</span>
              <textarea
                ref={notesRef}
                rows="6"
                value={selectedTask.notes || ""}
                onChange={(event) => onUpdateTask(selectedTask.id, { notes: event.target.value })}
                placeholder="Dodaj prywatne notatki, checklisty albo format markdown."
              />
            </label>

            <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(selectedTask.notes) }} />

            <div className="task-detail-actions premium">
              <button
                type="button"
                className={selectedTask.completed ? "secondary-button" : "primary-button"}
                onClick={() => onUpdateTask(selectedTask.id, { completed: !selectedTask.completed })}
              >
                {selectedTask.completed ? "Przywroc jako otwarte" : "Oznacz jako zrobione"}
              </button>
              <button type="button" className={selectedTask.important ? "secondary-button" : "ghost-button"} onClick={() => onUpdateTask(selectedTask.id, { important: !selectedTask.important })}>
                {selectedTask.important ? "Usun waznosc" : "Oznacz jako wazne"}
              </button>
              <button type="button" className="ghost-button danger-hover" onClick={() => onDeleteTask(selectedTask.id)}>
                {selectedTask.sourceType === "meeting" ? "Ukryj z listy" : "Usun zadanie"}
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
            <span>Tutaj zobaczysz szczegoly, ownera, termin, tagi i notatki w Markdown.</span>
          </div>
        )}
      </aside>
    </div>
  );
}
