function StatMiniCard({ label, value, tone = "neutral" }) {
  return (
    <div className={`todo-stat-mini ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function TasksSidebar({
  sidebarLists,
  selectedListId,
  setSelectedListId,
  workspaceName,
  workspaceInviteCode,
  stats,
  visibleStats,
  googleTasksEnabled,
  googleTasksStatus,
  googleTasksMessage,
  selectedGoogleTaskListId,
  onSelectGoogleTaskList,
  googleTaskLists,
  onConnectGoogleTasks,
  onImportGoogleTasks,
  onExportGoogleTasks,
  showColumnManager,
  setShowColumnManager,
  boardColumns,
  onUpdateColumn,
  onDeleteColumn,
  columnDraft,
  setColumnDraft,
  submitColumn,
}) {
  return (
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

      <div className="todo-sidebar-footer">
        <div className="todo-progress-card">
          <span>Postep workspace</span>
          <strong>{stats.completed} zakonczonych</strong>
          <div className="todo-progress-track">
            <span style={{ width: `${stats.progress}%` }} />
          </div>
          <small>{stats.progress}% wszystkich zadan jest zamkniete.</small>
        </div>

        <div className="todo-stats-mini-grid">
          <StatMiniCard label="Otwarte" value={visibleStats.open} />
          <StatMiniCard label="Na dzisiaj" value={visibleStats.dueToday} tone="info" />
          <StatMiniCard label="Po terminie" value={visibleStats.overdue} tone="danger" />
          <StatMiniCard label="Bez ownera" value={visibleStats.unassigned} tone="warning" />
          <StatMiniCard label="W toku" value={visibleStats.inProgress} tone="info" />
          <StatMiniCard label="W grupach" value={visibleStats.grouped} tone="success" />
          <StatMiniCard label="Cykliczne" value={visibleStats.recurring} tone="info" />
          <StatMiniCard label="Zalezne" value={visibleStats.blocked} tone="warning" />
          <StatMiniCard label="Komentarze" value={visibleStats.commented} />
          <StatMiniCard label="Podzadania" value={visibleStats.subtasksOpen} tone="success" />
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
              Polacz
            </button>
            <button
              type="button"
              className="todo-command-button"
              onClick={onImportGoogleTasks}
              disabled={!selectedGoogleTaskListId}
            >
              Import
            </button>
            <button
              type="button"
              className="todo-command-button"
              onClick={onExportGoogleTasks}
              disabled={!selectedGoogleTaskListId}
            >
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

        <button
          type="button"
          className="todo-inline-link"
          onClick={() => setShowColumnManager((previous) => !previous)}
        >
          {showColumnManager ? "Ukryj kolumny" : "Zarzadzaj kolumnami"}
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
    </aside>
  );
}
