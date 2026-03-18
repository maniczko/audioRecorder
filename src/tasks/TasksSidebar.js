import { formatDateTime } from "../lib/storage";

export default function TasksSidebar({
  sidebarLists,
  selectedListId,
  setSelectedListId,
  visibleStats,
  showColumnManager,
  setShowColumnManager,
  boardColumns,
  onUpdateColumn,
  onDeleteColumn,
  columnDraft,
  setColumnDraft,
  submitColumn,
  quickAddInputRef,
  searchInputRef,
  selectedTaskCount = 0,
  clearTaskSelection,
  selectedTasks = [],
  selectedTaskSla,
  taskNotifications = [],
  conflictTasks = [],
  onFocusConflictTask,
}) {
  return (
    <aside className="todo-sidebar">
      <div className="todo-sidebar-top">
        <div className="todo-sidebar-scroll">
          <div className="todo-nav-panel">
            <div className="todo-sidebar-group">
              <div className="todo-workspace-title">
                <strong>Inteligentne listy</strong>
              </div>
              {sidebarLists.baseLists.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selectedListId === item.id ? "todo-side-link active" : "todo-side-link"}
                  onClick={() => setSelectedListId(item.id)}
                >
                  <span className="todo-side-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>

            <div className="todo-workspace-group">
              <div className="todo-workspace-title">
                <strong>Widoki workspace</strong>
              </div>
              {sidebarLists.workspaceLists.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selectedListId === item.id ? "todo-side-link active workspace" : "todo-side-link workspace"}
                  onClick={() => setSelectedListId(item.id)}
                >
                  <span className="todo-side-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>

            <div className="todo-workspace-group">
              <div className="todo-workspace-title">
                <strong>Grupy</strong>
              </div>
              {sidebarLists.customGroups.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selectedListId === item.id ? "todo-side-link active workspace" : "todo-side-link workspace"}
                  onClick={() => setSelectedListId(item.id)}
                >
                  <span className="todo-side-icon">📁</span>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>

      <div className="todo-sidebar-footer">
        {taskNotifications.length ? (
          <div className="todo-notification-stack">
            {taskNotifications.slice(0, 3).map(({ task, sla }) => (
              <div key={task.id} className={`todo-helper tone-${sla.tone}`}>
                {task.title}: {sla.label}
              </div>
            ))}
          </div>
        ) : null}

        {conflictTasks.length ? (
          <div className="todo-conflict-card">
            <div className="todo-card-head">
              <div>
                <span className="todo-card-eyebrow">Conflict center</span>
                <strong>{conflictTasks.length} zmian do decyzji</strong>
              </div>
              <span className="todo-status-pill warning">Google</span>
            </div>
            <div className="todo-conflict-list">
              {conflictTasks.slice(0, 4).map((task) => (
                <button
                  type="button"
                  key={task.id}
                  className="todo-conflict-item"
                  onClick={() => onFocusConflictTask?.(task.id)}
                >
                  <strong>{task.title}</strong>
                  <span>
                    Lokalnie: {task.googleSyncConflict?.localUpdatedAt ? formatDateTime(task.googleSyncConflict.localUpdatedAt) : "brak"}
                  </span>
                  <small>
                    Google: {task.googleSyncConflict?.remoteUpdatedAt ? formatDateTime(task.googleSyncConflict.remoteUpdatedAt) : "brak"}
                  </small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

      </div>
    </aside>
  );
}
