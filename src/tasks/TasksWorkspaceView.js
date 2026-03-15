import { useState } from "react";
import { TASK_PRIORITIES } from "../lib/tasks";
import TaskKanbanView from "./TaskKanbanView";
import TaskListView from "./TaskListView";
import TaskChartsView from "./TaskChartsView";
import TaskScheduleView from "./TaskScheduleView";

function statCards(stats, visibleStats) {
  return [
    { id: "open", label: "Otwarte", value: visibleStats.open, tone: "neutral" },
    { id: "today", label: "Na dzisiaj", value: visibleStats.dueToday, tone: "info" },
    { id: "week", label: "Ten tydzien", value: visibleStats.dueThisWeek, tone: "info" },
    { id: "overdue", label: "Po terminie", value: visibleStats.overdue, tone: "danger" },
    { id: "sla-risk", label: "SLA zagrozone", value: visibleStats.slaAtRisk + visibleStats.slaCritical, tone: "warning" },
    { id: "sla-breached", label: "SLA naruszone", value: visibleStats.slaBreached, tone: "danger" },
    { id: "blocked", label: "Zalezne", value: visibleStats.blocked, tone: "warning" },
    { id: "progress", label: "Ukonczone", value: `${stats.progress}%`, tone: "success" },
  ];
}


function NotificationStrip({ notifications = [] }) {
  if (!notifications.length) {
    return null;
  }
  return (
    <div className="todo-notification-strip">
      {notifications.slice(0, 4).map(({ task, sla, dependencies }) => (
        <article key={task.id} className={`todo-notification-card ${sla.tone}`}>
          <strong>{task.title}</strong>
          <span>{sla.label}</span>
          {dependencies.blocking ? <small>Blokuje: {dependencies.unresolved[0]?.title}</small> : null}
        </article>
      ))}
    </div>
  );
}


function BulkToolbar({
  selectedTaskIds,
  clearTaskSelection,
  handleBulkUpdate,
  handleBulkDelete,
  boardColumns,
  peopleOptions,
}) {
  if (!selectedTaskIds.length) {
    return null;
  }
  return (
    <section className="todo-bulk-toolbar" aria-label="Akcje zbiorcze">
      <div className="todo-bulk-summary">
        <strong>{selectedTaskIds.length}</strong>
        <span>zadan zaznaczonych</span>
      </div>
      <div className="todo-bulk-actions">
        <button
          type="button"
          className="todo-command-button"
          onClick={() => handleBulkUpdate({ completed: true }, "Zakonczono zaznaczone zadania.")}
        >
          Zakoncz
        </button>
        <button
          type="button"
          className="todo-command-button"
          onClick={() => handleBulkUpdate({ completed: false }, "Otwarto zaznaczone zadania ponownie.")}
        >
          Otworz
        </button>
        <label className="todo-filter-item compact">
          <span>Status</span>
          <select
            onChange={(event) =>
              event.target.value &&
              handleBulkUpdate({ status: event.target.value }, "Zmieniono status zaznaczonych zadan.")
            }
            defaultValue=""
          >
            <option value="">Zmien status</option>
            {boardColumns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </select>
        </label>
        <label className="todo-filter-item compact">
          <span>Osoba</span>
          <select
            onChange={(event) =>
              handleBulkUpdate({ owner: event.target.value }, "Zmieniono osobe dla zaznaczonych zadan.")
            }
            defaultValue=""
          >
            <option value="">Nieprzypisane</option>
            {peopleOptions.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>
        </label>
        <label className="todo-filter-item compact">
          <span>Priorytet</span>
          <select
            onChange={(event) =>
              event.target.value &&
              handleBulkUpdate({ priority: event.target.value }, "Zmieniono priorytet zaznaczonych zadan.")
            }
            defaultValue=""
          >
            <option value="">Priorytet</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.id} value={priority.id}>
                {priority.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="todo-command-button danger" onClick={handleBulkDelete}>
          Usun
        </button>
        <button type="button" className="todo-command-button" onClick={clearTaskSelection}>
          Wyczysc
        </button>
      </div>
    </section>
  );
}

function SettingsDropdown({ onExportCsv, shareWorkspace, showColumnManager, setShowColumnManager, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="todo-settings-dropdown-wrap" style={{ position: "relative" }}>
      <button
        type="button"
        className="todo-command-button todo-settings-btn"
        onClick={() => setOpen((v) => !v)}
        title="Ustawienia"
        aria-label="Ustawienia widoku"
      >
        ⚙
      </button>
      {open && (
        <div className="todo-settings-dropdown" onBlur={() => setOpen(false)}>
          {typeof onExportCsv === "function" && (
            <button type="button" className="todo-settings-item" onClick={() => { onExportCsv(); setOpen(false); }}>
              Eksport CSV
            </button>
          )}
          <button type="button" className="todo-settings-item" onClick={() => { shareWorkspace(); setOpen(false); }}>
            Udostepnij workspace
          </button>
          <button
            type="button"
            className="todo-settings-item"
            onClick={() => { setShowColumnManager((p) => !p); setOpen(false); }}
          >
            {showColumnManager ? "Ukryj konfigurację kolumn" : "Konfiguracja kolumn"}
          </button>
          {children}
        </div>
      )}
    </div>
  );
}

export default function TasksWorkspaceView({
  selectedListLabel,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  groupBy,
  setGroupBy,
  swimlaneGroupBy,
  setSwimlaneGroupBy,
  shareWorkspace,
  onExportCsv,
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
  quickAddInputRef,
  searchInputRef,
  message,
  groupedTasks,
  allVisibleTasks,
  selectedTask,
  setSelectedTaskId,
  onUpdateTask,
  onMoveTaskToColumn,
  kanbanColumns,
  dropColumnId,
  setDropColumnId,
  handleDrop,
  handleGroupDrop,
  handleTaskDrop,
  setDragTaskId,
  onQuickAddToColumn,
  onReorderColumns,
  stats,
  visibleStats,
  selectedTaskIds,
  toggleTaskSelection,
  clearTaskSelection,
  handleBulkUpdate,
  handleBulkDelete,
  taskNotifications,
  workspaceActivity,
  visibleTaskCount,
  showColumnManager,
  setShowColumnManager,
}) {
  const isCharts = viewMode === "charts";
  const isSchedule = viewMode === "schedule";
  const isKanban = viewMode === "kanban";
  const isSummary = viewMode === "summary";

  return (
    <section className="todo-main">
      <div className="todo-shell">
        <section className="todo-toolbar-panel">
          <div className="todo-commandbar">
            <div className="todo-commandbar-left">
              <div className="todo-view-switch" role="tablist" aria-label="Widok zadan">
                <button
                  type="button"
                  className={isKanban ? "todo-view-button active" : "todo-view-button"}
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
                <button
                  type="button"
                  className={isCharts ? "todo-view-button active" : "todo-view-button"}
                  onClick={() => setViewMode("charts")}
                >
                  Wykresy
                </button>
                <button
                  type="button"
                  className={isSchedule ? "todo-view-button active" : "todo-view-button"}
                  onClick={() => setViewMode("schedule")}
                >
                  Harmonogram
                </button>
                <button
                  type="button"
                  className={isSummary ? "todo-view-button active" : "todo-view-button"}
                  onClick={() => setViewMode("summary")}
                >
                  Podsumowanie
                </button>
              </div>

              {isKanban ? (
                <label className="todo-filter-item compact">
                  <span>Swimlanes</span>
                  <select
                    value={swimlaneGroupBy || "none"}
                    onChange={(event) => setSwimlaneGroupBy?.(event.target.value)}
                  >
                    <option value="none">Brak</option>
                    <option value="person">Osoba</option>
                    <option value="priority">Priorytet</option>
                    <option value="label">Etykieta</option>
                    <option value="due">Termin</option>
                  </select>
                </label>
              ) : null}
            </div>

            <div className="todo-commandbar-right">
              <SettingsDropdown
                onExportCsv={onExportCsv}
                shareWorkspace={shareWorkspace}
                showColumnManager={showColumnManager}
                setShowColumnManager={setShowColumnManager}
              />
            </div>
          </div>

          {!isCharts && !isSchedule && !isSummary ? (
            <div className="todo-filter-row">
              <label className="todo-filter-search">
                <span>Szukaj</span>
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Szukaj w zadaniach"
                />
              </label>
              <label className="todo-filter-item">
                <span>Sortowanie</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="manual">Kolejnosc reczna</option>
                  <option value="updated">Ostatnio zmienione</option>
                  <option value="title">Tytul</option>
                  <option value="due">Termin</option>
                  <option value="owner">Osoba</option>
                  <option value="priority">Priorytet</option>
                </select>
              </label>
              {!isKanban ? (
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
              ) : null}
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
          ) : null}
        </section>

        <NotificationStrip notifications={taskNotifications} />

        <BulkToolbar
          selectedTaskIds={selectedTaskIds}
          clearTaskSelection={clearTaskSelection}
          handleBulkUpdate={handleBulkUpdate}
          handleBulkDelete={handleBulkDelete}
          boardColumns={boardColumns}
          peopleOptions={peopleOptions}
        />

        {!isCharts && !isSchedule && !isSummary ? (
          <section className="todo-create-card">
            <div className="todo-create-head">
              <div>
                <div className="eyebrow">Quick add</div>
                <strong>Nowe zadanie</strong>
              </div>
              <button
                type="button"
                className="todo-command-button"
                onClick={() => setShowAdvancedCreate((previous) => !previous)}
              >
                {showAdvancedCreate ? "Ukryj szczegoly" : "Szczegoly"}
              </button>
            </div>

            <form className="todo-add-row" onSubmit={submitQuickTask}>
              <button
                type="button"
                className="todo-task-circle"
                aria-label="Szybkie dodanie zadania"
                onClick={submitQuickTask}
              />
              <input
                ref={quickAddInputRef}
                value={quickDraft.title}
                onChange={(event) => setQuickDraft((previous) => ({ ...previous, title: event.target.value }))}
                placeholder="Dodaj zadanie"
              />
              <button
                type="button"
                className="todo-command-button primary"
                disabled={!quickDraft.title.trim()}
                onClick={submitQuickTask}
              >
                Dodaj zadanie
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
                  <span>Przypomnienie</span>
                  <input
                    type="datetime-local"
                    value={quickDraft.reminderAt}
                    onChange={(event) =>
                      setQuickDraft((previous) => ({ ...previous, reminderAt: event.target.value }))
                    }
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
                    onChange={(event) =>
                      setQuickDraft((previous) => ({ ...previous, important: event.target.checked }))
                    }
                  />
                  <span>Wazne</span>
                </label>
                <label className="todo-inline-check">
                  <input
                    type="checkbox"
                    checked={quickDraft.myDay}
                    onChange={(event) =>
                      setQuickDraft((previous) => ({ ...previous, myDay: event.target.checked }))
                    }
                  />
                  <span>My Day</span>
                </label>
              </div>
            ) : null}
          </section>
        ) : null}

        <datalist id="task-groups">
          {taskGroups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>

        {message ? <div className="todo-helper banner">{message}</div> : null}

        <section className="todo-view-panel">
          {isSummary ? (
            <div className="todo-summary-view">
              <div className="todo-stats-strip">
                {statCards(stats, visibleStats).map((item) => (
                  <article key={item.id} className={`todo-stat-card ${item.tone}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>
          ) : isCharts ? (
            <TaskChartsView tasks={allVisibleTasks} boardColumns={boardColumns} />
          ) : isSchedule ? (
            <TaskScheduleView
              tasks={allVisibleTasks}
              selectedTask={selectedTask}
              onSelectTask={setSelectedTaskId}
              onUpdateTask={onUpdateTask}
            />
          ) : viewMode === "list" ? (
            <TaskListView
              groupedTasks={groupedTasks}
              allTasks={allVisibleTasks}
              groupBy={groupBy}
              selectedTask={selectedTask}
              selectedTaskIds={selectedTaskIds}
              toggleTaskSelection={toggleTaskSelection}
              setSelectedTaskId={setSelectedTaskId}
              onUpdateTask={onUpdateTask}
              onMoveTaskToColumn={onMoveTaskToColumn}
              peopleOptions={peopleOptions}
              taskGroups={taskGroups}
              boardColumns={boardColumns}
              handleGroupDrop={handleGroupDrop}
              handleTaskDrop={handleTaskDrop}
              setDragTaskId={setDragTaskId}
            />
          ) : (
            <TaskKanbanView
              kanbanColumns={kanbanColumns}
              allTasks={allVisibleTasks}
              dropColumnId={dropColumnId}
              setDropColumnId={setDropColumnId}
              handleDrop={handleDrop}
              handleTaskDrop={handleTaskDrop}
              selectedTask={selectedTask}
              selectedTaskIds={selectedTaskIds}
              toggleTaskSelection={toggleTaskSelection}
              setSelectedTaskId={setSelectedTaskId}
              setDragTaskId={setDragTaskId}
              onUpdateTask={onUpdateTask}
              onMoveTaskToColumn={onMoveTaskToColumn}
              swimlaneGroupBy={swimlaneGroupBy}
              onQuickAddToColumn={onQuickAddToColumn}
              onReorderColumns={onReorderColumns}
            />
          )}
        </section>
      </div>
    </section>
  );
}
