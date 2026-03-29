import { memo, useState } from 'react';
import { formatDateTime } from '../lib/storage';

const LS_KEY = 'voicebobr:sidebar-collapsed';

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function TasksSidebar({
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
  taskNotifications = [],
  conflictTasks = [],
  onFocusConflictTask,
}: any) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <aside className="todo-sidebar">
      <div className="todo-sidebar-top">
        <div className="todo-sidebar-scroll">
          <div className="todo-nav-panel">
            <div className="todo-sidebar-group">
              <button
                type="button"
                className="todo-workspace-title todo-workspace-toggle"
                onClick={() => toggle('smart')}
                aria-expanded={!collapsed.smart}
                aria-controls="todo-smart-lists"
              >
                <span
                  className={`todo-workspace-toggle-arrow${collapsed.smart ? ' collapsed' : ''}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
                <strong>Inteligentne listy</strong>
              </button>
              {!collapsed.smart && (
                <div id="todo-smart-lists" role="group" aria-label="Inteligentne listy">
                  {sidebarLists.baseLists.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        selectedListId === item.id ? 'todo-side-link active' : 'todo-side-link'
                      }
                      onClick={() => setSelectedListId(item.id)}
                    >
                      <span className="todo-side-icon">{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <strong style={{ marginLeft: 'auto' }}>{item.count}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="todo-workspace-group">
              <button
                type="button"
                className="todo-workspace-title todo-workspace-toggle"
                onClick={() => toggle('workspace')}
                aria-expanded={!collapsed.workspace}
                aria-controls="todo-workspace-lists"
              >
                <span
                  className={`todo-workspace-toggle-arrow${collapsed.workspace ? ' collapsed' : ''}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
                <strong>Widoki workspace</strong>
              </button>
              {!collapsed.workspace && (
                <div id="todo-workspace-lists" role="group" aria-label="Widoki workspace">
                  {sidebarLists.workspaceLists.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        selectedListId === item.id
                          ? 'todo-side-link active workspace'
                          : 'todo-side-link workspace'
                      }
                      onClick={() => setSelectedListId(item.id)}
                    >
                      <span className="todo-side-icon">{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <strong style={{ marginLeft: 'auto' }}>{item.count}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="todo-sidebar-footer">
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
                    Lokalnie:{' '}
                    {task.googleSyncConflict?.localUpdatedAt
                      ? formatDateTime(task.googleSyncConflict.localUpdatedAt)
                      : 'brak'}
                  </span>
                  <small>
                    Google:{' '}
                    {task.googleSyncConflict?.remoteUpdatedAt
                      ? formatDateTime(task.googleSyncConflict.remoteUpdatedAt)
                      : 'brak'}
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

export default memo(TasksSidebar);
