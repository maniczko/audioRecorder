import { TASK_PRIORITIES } from "../lib/tasks";
import TaskKanbanView from "./TaskKanbanView";
import TaskListView from "./TaskListView";

function statCards(stats, visibleStats) {
  return [
    { id: "open", label: "Otwarte", value: visibleStats.open, tone: "neutral" },
    { id: "today", label: "Na dzisiaj", value: visibleStats.dueToday, tone: "info" },
    { id: "week", label: "Ten tydzien", value: visibleStats.dueThisWeek, tone: "info" },
    { id: "overdue", label: "Po terminie", value: visibleStats.overdue, tone: "danger" },
    { id: "assigned", label: "Przypisane", value: visibleStats.assigned, tone: "neutral" },
    { id: "progress", label: "Ukonczone", value: `${stats.progress}%`, tone: "success" },
  ];
}

export default function TasksWorkspaceView({
  selectedListLabel,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  groupBy,
  setGroupBy,
  shareWorkspace,
  submitQuickTask,
  quickDraft,
  setQuickDraft,
  showAdvancedCreate,
  setShowAdvancedCreate,
  peopleOptions,
  taskGroups,
  boardColumns,
  query,
  setQuery,
  ownerFilter,
  setOwnerFilter,
  tagFilter,
  setTagFilter,
  tagOptions,
  message,
  groupedTasks,
  selectedTask,
  setSelectedTaskId,
  onUpdateTask,
  onMoveTaskToColumn,
  kanbanColumns,
  dropColumnId,
  setDropColumnId,
  handleDrop,
  handleGroupDrop,
  setDragTaskId,
  stats,
  visibleStats,
}) {
  return (
    <section className="todo-main">
      <div className="todo-shell">
        <div className="todo-commandbar">
          <div className="todo-commandbar-left">
            <div className="todo-list-title">
              <span className="todo-list-icon" />
              <strong>{selectedListLabel}</strong>
            </div>

            <div className="todo-view-switch" role="tablist" aria-label="Widok zadan">
              <button
                type="button"
                className={viewMode === "kanban" ? "todo-view-button active" : "todo-view-button"}
                onClick={() => setViewMode("kanban")}
              >
                Kanban
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "todo-view-button active" : "todo-view-button"}
                onClick={() => setViewMode("list")}
              >
                Lista
              </button>
            </div>
          </div>

          <div className="todo-commandbar-right">
            <label className="todo-filter-item">
              <span>Sortowanie</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="updated">Ostatnio zmienione</option>
                <option value="title">Tytul</option>
                <option value="due">Termin</option>
                <option value="owner">Osoba</option>
                <option value="priority">Priorytet</option>
              </select>
            </label>
            <label className="todo-filter-item">
              <span>Grupowanie</span>
              <select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>
                <option value="none">Brak</option>
                <option value="status">Kolumna</option>
                <option value="group">Grupa wlasna</option>
                <option value="owner">Osoba</option>
                <option value="priority">Priorytet</option>
                <option value="source">Zrodlo</option>
              </select>
            </label>
            <button type="button" className="todo-command-button" onClick={shareWorkspace}>
              Udostepnij
            </button>
          </div>
        </div>

        <div className="todo-stats-strip">
          {statCards(stats, visibleStats).map((item) => (
            <article key={item.id} className={`todo-stat-card ${item.tone}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          ))}
        </div>

        <form className="todo-add-row" onSubmit={submitQuickTask}>
          <button type="submit" className="todo-task-circle" aria-label="Dodaj zadanie" />
          <input
            value={quickDraft.title}
            onChange={(event) => setQuickDraft((previous) => ({ ...previous, title: event.target.value }))}
            placeholder="Dodaj zadanie"
          />
          <button
            type="button"
            className="todo-command-button"
            onClick={() => setShowAdvancedCreate((previous) => !previous)}
          >
            {showAdvancedCreate ? "Ukryj szczegoly" : "Szczegoly"}
          </button>
          <button type="submit" className="todo-command-button primary" disabled={!quickDraft.title.trim()}>
            Dodaj
          </button>
        </form>

        {showAdvancedCreate ? (
          <div className="todo-add-advanced">
            <label>
              <span>Osoba</span>
              <select
                value={quickDraft.owner}
                onChange={(event) => setQuickDraft((previous) => ({ ...previous, owner: event.target.value }))}
              >
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
                list="task-groups"
                value={quickDraft.group}
                onChange={(event) => setQuickDraft((previous) => ({ ...previous, group: event.target.value }))}
                placeholder="np. Sprint 14"
              />
            </label>
            <label>
              <span>Termin</span>
              <input
                type="datetime-local"
                value={quickDraft.dueDate}
                onChange={(event) => setQuickDraft((previous) => ({ ...previous, dueDate: event.target.value }))}
              />
            </label>
            <label>
              <span>Priorytet</span>
              <select
                value={quickDraft.priority}
                onChange={(event) => setQuickDraft((previous) => ({ ...previous, priority: event.target.value }))}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority.id} value={priority.id}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={quickDraft.status}
                onChange={(event) => setQuickDraft((previous) => ({ ...previous, status: event.target.value }))}
              >
                {boardColumns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Tagi</span>
              <input
                value={quickDraft.tags}
                onChange={(event) => setQuickDraft((previous) => ({ ...previous, tags: event.target.value }))}
                placeholder="klient, budzet"
              />
            </label>
            <label className="todo-inline-check">
              <input
                type="checkbox"
                checked={quickDraft.important}
                onChange={(event) => setQuickDraft((previous) => ({ ...previous, important: event.target.checked }))}
              />
              <span>Wazne</span>
            </label>
          </div>
        ) : null}

        <datalist id="task-groups">
          {taskGroups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>

        <div className="todo-filter-row">
          <label className="todo-filter-search">
            <span>Szukaj</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj w zadaniach" />
          </label>
          <label className="todo-filter-item">
            <span>Osoba</span>
            <select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="all">Wszystkie</option>
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
              <option value="all">Wszystkie</option>
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
          <TaskListView
            groupedTasks={groupedTasks}
            groupBy={groupBy}
            selectedTask={selectedTask}
            setSelectedTaskId={setSelectedTaskId}
            onUpdateTask={onUpdateTask}
            onMoveTaskToColumn={onMoveTaskToColumn}
            peopleOptions={peopleOptions}
            taskGroups={taskGroups}
            boardColumns={boardColumns}
            handleGroupDrop={handleGroupDrop}
            setDragTaskId={setDragTaskId}
          />
        ) : (
          <TaskKanbanView
            kanbanColumns={kanbanColumns}
            dropColumnId={dropColumnId}
            setDropColumnId={setDropColumnId}
            handleDrop={handleDrop}
            selectedTask={selectedTask}
            setSelectedTaskId={setSelectedTaskId}
            setDragTaskId={setDragTaskId}
            onUpdateTask={onUpdateTask}
          />
        )}
      </div>
    </section>
  );
}
