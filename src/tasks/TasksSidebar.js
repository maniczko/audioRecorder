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
                <small>Jak w task appce, ale pod workspace</small>
              </div>
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
                <strong>Widoki workspace</strong>
                <small>Statusy i glowne przeplywy pracy</small>
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

            {sidebarLists.customGroups.length ? (
              <div className="todo-workspace-group">
                <div className="todo-workspace-title">
                  <strong>Moje grupy</strong>
                  <small>Wlasne grupowanie zadan</small>
                </div>
                {sidebarLists.customGroups.map((item) => (
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
            ) : null}
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

        <div className="todo-column-card">
          <div className="todo-card-head">
            <div>
              <span className="todo-card-eyebrow">Konfiguracja</span>
              <strong>Kolumny workflow</strong>
            </div>
            <button
              type="button"
              className="todo-inline-link"
              onClick={() => setShowColumnManager((previous) => !previous)}
            >
              {showColumnManager ? "Ukryj" : "Rozwin"}
            </button>
          </div>

          {showColumnManager ? (
            <div className="todo-column-manager">
              {boardColumns.map((column) => (
                <div key={column.id} className="todo-column-row">
                  <input value={column.label} onChange={(event) => onUpdateColumn(column.id, { label: event.target.value })} />
                  <input type="color" value={column.color} onChange={(event) => onUpdateColumn(column.id, { color: event.target.value })} />
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={column.wipLimit || ""}
                    placeholder="WIP"
                    title="Limit WIP (opcjonalny)"
                    className="todo-wip-input"
                    onChange={(event) =>
                      onUpdateColumn(column.id, {
                        wipLimit: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                  <label className="todo-inline-check">
                    <input
                      type="checkbox"
                      checked={column.isDone}
                      onChange={(event) => onUpdateColumn(column.id, { isDone: event.target.checked })}
                    />
                    <span>Done</span>
                  </label>
                  <button
                    type="button"
                    className="todo-icon-button danger"
                    onClick={() => onDeleteColumn(column.id)}
                    disabled={column.system}
                  >
                    Usun
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
                    onChange={(event) =>
                      setColumnDraft((previous) => ({ ...previous, isDone: event.target.checked }))
                    }
                  />
                  <span>Done</span>
                </label>
                <button type="submit" className="todo-command-button primary">
                  Dodaj kolumne
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
