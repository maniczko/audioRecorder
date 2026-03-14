import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "./lib/storage";
import { TASK_PRIORITIES, taskListStats } from "./lib/tasks";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toInputDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatListDueDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function dueTone(value) {
  if (!value) {
    return "normal";
  }

  const date = new Date(value).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today.getTime()) {
    return "danger";
  }

  return "normal";
}

function buildSidebarLists(tasks, boardColumns) {
  const baseLists = [
    {
      id: "smart:my_day",
      label: "My Day",
      count: tasks.filter((task) => {
        if (!task.dueDate || task.completed) {
          return false;
        }
        return new Date(task.dueDate).toDateString() === new Date().toDateString();
      }).length,
    },
    { id: "smart:important", label: "Important", count: tasks.filter((task) => task.important).length },
    { id: "smart:planned", label: "Planned", count: tasks.filter((task) => task.dueDate).length },
    { id: "smart:assigned", label: "Assigned to me", count: tasks.filter((task) => task.assignedToMe).length },
    { id: "smart:all", label: "Tasks", count: tasks.length },
  ];

  const workspaceLists = boardColumns.map((column) => ({
    id: `column:${column.id}`,
    label: column.label,
    count: tasks.filter((task) => task.status === column.id).length,
  }));

  return { baseLists, workspaceLists };
}

function applyMainListFilter(tasks, mainListId, boardColumns) {
  if (!mainListId || mainListId === "smart:all") {
    return tasks;
  }

  if (mainListId === "smart:my_day") {
    const today = new Date().toDateString();
    return tasks.filter((task) => task.dueDate && !task.completed && new Date(task.dueDate).toDateString() === today);
  }

  if (mainListId === "smart:important") {
    return tasks.filter((task) => task.important);
  }

  if (mainListId === "smart:planned") {
    return tasks.filter((task) => Boolean(task.dueDate));
  }

  if (mainListId === "smart:assigned") {
    return tasks.filter((task) => task.assignedToMe);
  }

  if (mainListId.startsWith("column:")) {
    const columnId = mainListId.slice("column:".length);
    if (boardColumns.some((column) => column.id === columnId)) {
      return tasks.filter((task) => task.status === columnId);
    }
  }

  return tasks;
}

function priorityRank(priority) {
  return ["urgent", "high", "medium", "low"].indexOf(priority);
}

function groupTasks(tasks, groupBy, boardColumns) {
  if (groupBy === "none") {
    return [{ id: "all", label: "", tasks }];
  }

  const map = new Map();
  tasks.forEach((task) => {
    let key = "other";
    let label = "Other";

    if (groupBy === "status") {
      key = task.status;
      label = boardColumns.find((column) => column.id === task.status)?.label || task.status;
    } else if (groupBy === "owner") {
      key = task.owner || "unassigned";
      label = task.owner || "Nieprzypisane";
    } else if (groupBy === "priority") {
      key = task.priority;
      label = TASK_PRIORITIES.find((priority) => priority.id === task.priority)?.label || task.priority;
    } else if (groupBy === "source") {
      key = task.sourceType;
      label = task.sourceType === "meeting" ? "Spotkania" : task.sourceType === "google" ? "Google Tasks" : "Reczne";
    }

    const bucket = map.get(key) || { id: key, label, tasks: [] };
    bucket.tasks.push(task);
    map.set(key, bucket);
  });

  return [...map.values()];
}

function createQuickDraft(boardColumns) {
  return {
    title: "",
    owner: "",
    dueDate: "",
    description: "",
    status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || "",
    important: false,
    priority: "medium",
    tags: "",
    notes: "",
  };
}

function canDrop(event) {
  if (event.dataTransfer) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }
}

function handleCardKeyDown(event, callback) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
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
  workspaceName,
  workspaceInviteCode,
}) {
  const [viewMode, setViewMode] = useState(defaultView === "kanban" ? "kanban" : "list");
  const [selectedListId, setSelectedListId] = useState("smart:all");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [groupBy, setGroupBy] = useState("none");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [dragTaskId, setDragTaskId] = useState("");
  const [dropColumnId, setDropColumnId] = useState("");
  const [message, setMessage] = useState("");
  const [quickDraft, setQuickDraft] = useState(() => createQuickDraft(boardColumns));
  const [columnDraft, setColumnDraft] = useState({ label: "", color: "#5a92ff", isDone: false });

  useEffect(() => {
    setViewMode(defaultView === "kanban" ? "kanban" : "list");
  }, [defaultView]);

  useEffect(() => {
    if (!boardColumns.some((column) => column.id === quickDraft.status)) {
      setQuickDraft((previous) => ({
        ...previous,
        status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || "",
      }));
    }
  }, [boardColumns, quickDraft.status]);

  const stats = useMemo(() => taskListStats(tasks), [tasks]);
  const sidebarLists = useMemo(() => buildSidebarLists(tasks, boardColumns), [tasks, boardColumns]);

  const visibleTasks = useMemo(() => {
    const filtered = applyMainListFilter(tasks, selectedListId, boardColumns).filter((task) => {
      if (ownerFilter !== "all" && task.owner !== ownerFilter) {
        return false;
      }
      if (tagFilter !== "all" && !(task.tags || []).includes(tagFilter)) {
        return false;
      }
      if (query.trim()) {
        const haystack = [
          task.title,
          task.owner,
          task.description,
          task.notes,
          safeArray(task.tags).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    return [...filtered].sort((left, right) => {
      if (sortBy === "title") {
        return left.title.localeCompare(right.title);
      }
      if (sortBy === "due") {
        return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime();
      }
      if (sortBy === "owner") {
        return (left.owner || "").localeCompare(right.owner || "");
      }
      if (sortBy === "priority") {
        return priorityRank(left.priority) - priorityRank(right.priority);
      }
      return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
    });
  }, [tasks, selectedListId, boardColumns, ownerFilter, tagFilter, query, sortBy]);

  useEffect(() => {
    if (!visibleTasks.length) {
      setSelectedTaskId("");
      return;
    }

    if (!visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].id);
    }
  }, [visibleTasks, selectedTaskId]);

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

  function submitQuickTask(event) {
    event.preventDefault();
    try {
      const taskId = onCreateTask(quickDraft);
      setQuickDraft(createQuickDraft(boardColumns));
      setMessage("Dodano zadanie.");
      if (taskId) {
        setSelectedTaskId(taskId);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submitColumn(event) {
    event.preventDefault();
    try {
      onCreateColumn(columnDraft);
      setColumnDraft({ label: "", color: "#5a92ff", isDone: false });
      setMessage("Dodano kolumne.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleDrop(columnId, event) {
    canDrop(event);
    const taskId = event.dataTransfer?.getData("text/plain") || dragTaskId;
    if (!taskId) {
      return;
    }

    onMoveTaskToColumn(taskId, columnId);
    setDragTaskId("");
    setDropColumnId("");
    setMessage("Przeniesiono zadanie.");
  }

  async function shareWorkspace() {
    if (!workspaceInviteCode) {
      setMessage("Brak kodu workspace.");
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(workspaceInviteCode);
        setMessage(`Skopiowano kod workspace: ${workspaceInviteCode}`);
        return;
      }
    } catch (error) {
      console.error("Clipboard write failed.", error);
    }

    setMessage(`Udostepnij workspace kodem: ${workspaceInviteCode}`);
  }

  return (
    <div className="tasks-layout ms-todo">
      <aside className="todo-sidebar">
        <div className="todo-sidebar-top">
          <button type="button" className="todo-menu-button" aria-label="Menu">
            <span />
            <span />
            <span />
          </button>

          <div className="todo-sidebar-scroll">
            <div className="todo-sidebar-group">
              {sidebarLists.baseLists.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selectedListId === item.id ? "todo-side-link active" : "todo-side-link"}
                  onClick={() => setSelectedListId(item.id)}
                >
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>

            <div className="todo-workspace-group">
              <div className="todo-workspace-title">
                <strong>{workspaceName || "Workspace"}</strong>
                {workspaceInviteCode ? <small>Kod: {workspaceInviteCode}</small> : null}
              </div>
              {sidebarLists.workspaceLists.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selectedListId === item.id ? "todo-side-link active workspace" : "todo-side-link workspace"}
                  onClick={() => setSelectedListId(item.id)}
                >
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="todo-sidebar-footer">
          <div className="todo-progress-card">
            <span>Zakonczone</span>
            <strong>{stats.completed}</strong>
            <div className="todo-progress-track">
              <span style={{ width: `${stats.progress}%` }} />
            </div>
          </div>

          <div className="todo-google-card">
            <div className="todo-google-head">
              <strong>Google Tasks</strong>
              <span>
                {googleTasksStatus === "connected"
                  ? "Polaczone"
                  : googleTasksStatus === "loading"
                    ? "Laczenie..."
                    : "Offline"}
              </span>
            </div>
            <div className="todo-google-actions">
              <button
                type="button"
                className="todo-command-button"
                onClick={onConnectGoogleTasks}
                disabled={!googleTasksEnabled || googleTasksStatus === "loading"}
              >
                Connect
              </button>
              <button type="button" className="todo-command-button" onClick={onImportGoogleTasks} disabled={!selectedGoogleTaskListId}>
                Import
              </button>
              <button type="button" className="todo-command-button" onClick={onExportGoogleTasks} disabled={!selectedGoogleTaskListId}>
                Export
              </button>
            </div>
            <select value={selectedGoogleTaskListId} onChange={(event) => onSelectGoogleTaskList(event.target.value)}>
              <option value="">Wybierz liste</option>
              {googleTaskLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
            {googleTasksMessage ? <div className="todo-helper">{googleTasksMessage}</div> : null}
          </div>

          <button type="button" className="todo-inline-link" onClick={() => setShowColumnManager((previous) => !previous)}>
            {showColumnManager ? "Ukryj kolumny" : "Manage columns"}
          </button>

          {showColumnManager ? (
            <div className="todo-column-manager">
              {boardColumns.map((column) => (
                <div key={column.id} className="todo-column-row">
                  <input value={column.label} onChange={(event) => onUpdateColumn(column.id, { label: event.target.value })} />
                  <input type="color" value={column.color} onChange={(event) => onUpdateColumn(column.id, { color: event.target.value })} />
                  <label className="todo-inline-check">
                    <input
                      type="checkbox"
                      checked={column.isDone}
                      onChange={(event) => onUpdateColumn(column.id, { isDone: event.target.checked })}
                    />
                    <span>Done</span>
                  </label>
                  <button type="button" className="todo-icon-button danger" onClick={() => onDeleteColumn(column.id)} disabled={column.system}>
                    Remove
                  </button>
                </div>
              ))}

              <form className="todo-column-create" onSubmit={submitColumn}>
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
                <label className="todo-inline-check">
                  <input
                    type="checkbox"
                    checked={columnDraft.isDone}
                    onChange={(event) => setColumnDraft((previous) => ({ ...previous, isDone: event.target.checked }))}
                  />
                  <span>Done</span>
                </label>
                <button type="submit" className="todo-command-button primary">
                  Add
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="todo-main">
        <div className="todo-shell">
          <div className="todo-commandbar">
            <div className="todo-commandbar-left">
              <div className="todo-list-title">
                <span className="todo-list-icon" />
                <strong>
                  {sidebarLists.baseLists.find((item) => item.id === selectedListId)?.label ||
                    sidebarLists.workspaceLists.find((item) => item.id === selectedListId)?.label ||
                    "Tasks"}
                </strong>
              </div>

              <div className="todo-view-switch">
                <button
                  type="button"
                  className={viewMode === "kanban" ? "todo-view-button active" : "todo-view-button"}
                  onClick={() => setViewMode("kanban")}
                >
                  Grid
                </button>
                <button
                  type="button"
                  className={viewMode === "list" ? "todo-view-button active" : "todo-view-button"}
                  onClick={() => setViewMode("list")}
                >
                  List
                </button>
              </div>
            </div>

            <div className="todo-commandbar-right">
              <label className="todo-filter-item">
                <span>Sort</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="updated">Updated</option>
                  <option value="title">Title</option>
                  <option value="due">Due date</option>
                  <option value="owner">Owner</option>
                  <option value="priority">Importance</option>
                </select>
              </label>
              <label className="todo-filter-item">
                <span>Group</span>
                <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
                  <option value="none">None</option>
                  <option value="status">Status</option>
                  <option value="owner">Owner</option>
                  <option value="priority">Priority</option>
                  <option value="source">Source</option>
                </select>
              </label>
              <button
                type="button"
                className="todo-command-button"
                onClick={shareWorkspace}
              >
                Share
              </button>
            </div>
          </div>

          <form className="todo-add-row" onSubmit={submitQuickTask}>
            <button type="submit" className="todo-task-circle" aria-label="Dodaj zadanie" />
            <input
              value={quickDraft.title}
              onChange={(event) => setQuickDraft((previous) => ({ ...previous, title: event.target.value }))}
              placeholder="Add a task"
            />
            <button type="button" className="todo-command-button" onClick={() => setShowAdvancedCreate((previous) => !previous)}>
              {showAdvancedCreate ? "Hide details" : "Details"}
            </button>
            <button type="submit" className="todo-command-button primary">
              Add
            </button>
          </form>

          {showAdvancedCreate ? (
            <div className="todo-add-advanced">
              <label>
                <span>Owner</span>
                <select value={quickDraft.owner} onChange={(event) => setQuickDraft((previous) => ({ ...previous, owner: event.target.value }))}>
                  <option value="">Nieprzypisane</option>
                  {peopleOptions.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Due date</span>
                <input
                  type="datetime-local"
                  value={quickDraft.dueDate}
                  onChange={(event) => setQuickDraft((previous) => ({ ...previous, dueDate: event.target.value }))}
                />
              </label>
              <label>
                <span>Importance</span>
                <select value={quickDraft.priority} onChange={(event) => setQuickDraft((previous) => ({ ...previous, priority: event.target.value }))}>
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={quickDraft.status} onChange={(event) => setQuickDraft((previous) => ({ ...previous, status: event.target.value }))}>
                  {boardColumns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tags</span>
                <input value={quickDraft.tags} onChange={(event) => setQuickDraft((previous) => ({ ...previous, tags: event.target.value }))} placeholder="client, budget" />
              </label>
              <label className="todo-inline-check">
                <input
                  type="checkbox"
                  checked={quickDraft.important}
                  onChange={(event) => setQuickDraft((previous) => ({ ...previous, important: event.target.checked }))}
                />
                <span>Important</span>
              </label>
            </div>
          ) : null}

          <div className="todo-filter-row">
            <label className="todo-filter-search">
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" />
            </label>
            <label className="todo-filter-item">
              <span>Person</span>
              <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                <option value="all">All</option>
                {peopleOptions.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </label>
            <label className="todo-filter-item">
              <span>Tag</span>
              <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                <option value="all">All</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    #{tag}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {message ? <div className="todo-helper banner">{message}</div> : null}

          {viewMode === "list" ? (
            <div className="todo-table-wrap">
              <div className="todo-table-head">
                <span />
                <span>Title</span>
                <span>Due Date</span>
                <span>Importance</span>
              </div>

              {groupedTasks.map((group) => (
                <div key={group.id} className="todo-table-group">
                  {groupBy !== "none" ? <div className="todo-group-label">{group.label}</div> : null}
                  {group.tasks.length ? (
                    group.tasks.map((task) => (
                      <div
                        role="button"
                        tabIndex={0}
                        key={task.id}
                        className={selectedTask?.id === task.id ? "todo-table-row active" : "todo-table-row"}
                        onClick={() => setSelectedTaskId(task.id)}
                        onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
                      >
                        <button
                          type="button"
                          className={task.completed ? "todo-task-circle completed" : "todo-task-circle"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onUpdateTask(task.id, { completed: !task.completed });
                          }}
                        />
                        <span className="todo-title-cell">
                          <strong>{task.title}</strong>
                          <small>{task.owner || "Nieprzypisane"}</small>
                        </span>
                        <span className={dueTone(task.dueDate) === "danger" ? "todo-date danger" : "todo-date"}>
                          {formatListDueDate(task.dueDate)}
                        </span>
                        <button
                          type="button"
                          className={task.important ? "todo-star active" : "todo-star"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onUpdateTask(task.id, { important: !task.important });
                          }}
                        >
                          {"\u2605"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="todo-empty">Brak zadan w tej sekcji.</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="todo-kanban">
              {kanbanColumns.map((column) => (
                <section
                  key={column.id}
                  className={dropColumnId === column.id ? "todo-kanban-column drop" : "todo-kanban-column"}
                  onDragOver={canDrop}
                  onDragEnter={() => setDropColumnId(column.id)}
                  onDragLeave={() => setDropColumnId((previous) => (previous === column.id ? "" : previous))}
                  onDrop={(event) => handleDrop(column.id, event)}
                >
                  <header className="todo-kanban-header" style={{ "--column-color": column.color }}>
                    <strong>{column.label}</strong>
                    <span>{column.tasks.length}</span>
                  </header>
                  <div className="todo-kanban-body">
                    {column.tasks.length ? (
                      column.tasks.map((task) => (
                        <div
                          key={task.id}
                          role="button"
                          tabIndex={0}
                          className={selectedTask?.id === task.id ? "todo-kanban-card active" : "todo-kanban-card"}
                          draggable
                          onDragStart={(event) => {
                            setDragTaskId(task.id);
                            event.dataTransfer.setData("text/plain", task.id);
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDragTaskId("");
                            setDropColumnId("");
                          }}
                          onClick={() => setSelectedTaskId(task.id)}
                          onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
                        >
                          <div className="todo-kanban-card-top">
                            <strong>{task.title}</strong>
                            <button
                              type="button"
                              className={task.important ? "todo-star active inline" : "todo-star inline"}
                              onClick={(event) => {
                                event.stopPropagation();
                                onUpdateTask(task.id, { important: !task.important });
                              }}
                            >
                              {"\u2605"}
                            </button>
                          </div>
                          <p>{task.description || task.sourceQuote || "Task powstal na podstawie spotkania."}</p>
                          <div className="todo-kanban-meta">
                            <span>{task.owner || "Nieprzypisane"}</span>
                            <span>{formatListDueDate(task.dueDate) || "No date"}</span>
                          </div>
                          <div className="todo-tag-list">
                            {(task.tags || []).slice(0, 3).map((tag) => (
                              <span key={`${task.id}-${tag}`} className="todo-tag">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="todo-empty">Przeciagnij tu zadanie.</div>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="todo-details">
        {selectedTask ? (
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
              </div>
              <button type="button" className="todo-icon-button danger" onClick={() => onDeleteTask(selectedTask.id)}>
                {selectedTask.sourceType === "meeting" ? "Hide" : "Delete"}
              </button>
            </div>

            <div className="todo-detail-form">
              <label>
                <span>Title</span>
                <input value={selectedTask.title} onChange={(event) => onUpdateTask(selectedTask.id, { title: event.target.value })} />
              </label>
              <label>
                <span>Owner</span>
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
                <span>Due date</span>
                <input
                  type="datetime-local"
                  value={toInputDateTime(selectedTask.dueDate)}
                  onChange={(event) => onUpdateTask(selectedTask.id, { dueDate: event.target.value })}
                />
              </label>
              <label>
                <span>Priority</span>
                <select value={selectedTask.priority} onChange={(event) => onUpdateTask(selectedTask.id, { priority: event.target.value })}>
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tags</span>
                <input value={(selectedTask.tags || []).join(", ")} onChange={(event) => onUpdateTask(selectedTask.id, { tags: event.target.value })} />
              </label>
              <label className="full">
                <span>Description</span>
                <textarea rows="3" value={selectedTask.description || ""} onChange={(event) => onUpdateTask(selectedTask.id, { description: event.target.value })} />
              </label>
              <label className="full">
                <span>Notes</span>
                <textarea rows="6" value={selectedTask.notes || ""} onChange={(event) => onUpdateTask(selectedTask.id, { notes: event.target.value })} />
              </label>
            </div>

            <div className="todo-detail-actions">
              <button type="button" className="todo-command-button primary" onClick={() => onUpdateTask(selectedTask.id, { completed: !selectedTask.completed })}>
                {selectedTask.completed ? "Reopen" : "Mark complete"}
              </button>
              <button type="button" className="todo-command-button" onClick={() => onUpdateTask(selectedTask.id, { important: !selectedTask.important })}>
                {selectedTask.important ? "Remove star" : "Add star"}
              </button>
              {selectedTask.sourceMeetingId ? (
                <button type="button" className="todo-command-button" onClick={() => onOpenMeeting(selectedTask.sourceMeetingId)}>
                  Open meeting
                </button>
              ) : null}
            </div>

            <div className="todo-detail-meta-card">
              <strong>Source</strong>
              <p>{selectedTask.sourceQuote || selectedTask.sourceMeetingTitle || "Brak cytatu zrodlowego."}</p>
              <small>{formatDateTime(selectedTask.updatedAt || selectedTask.createdAt)}</small>
            </div>
          </div>
        ) : (
          <div className="todo-detail-card empty">
            <h2>Select a task</h2>
            <p>Tutaj zobaczysz szczegoly zadania, ownera, status i notatki.</p>
          </div>
        )}
      </aside>
    </div>
  );
}


