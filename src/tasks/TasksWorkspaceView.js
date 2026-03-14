import { TASK_PRIORITIES } from "../lib/tasks";
import TaskKanbanView from "./TaskKanbanView";
import TaskListView from "./TaskListView";

export default function TasksWorkspaceView({
  sidebarLists,
  selectedListId,
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
  kanbanColumns,
  dropColumnId,
  setDropColumnId,
  handleDrop,
  setDragTaskId,
}) {
  return (
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
            <button type="button" className="todo-command-button" onClick={shareWorkspace}>
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
          <TaskListView
            groupedTasks={groupedTasks}
            groupBy={groupBy}
            selectedTask={selectedTask}
            setSelectedTaskId={setSelectedTaskId}
            onUpdateTask={onUpdateTask}
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
