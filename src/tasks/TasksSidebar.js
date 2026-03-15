import { formatDateTime } from "../lib/storage";

function StatMiniCard({ label, value, tone = "neutral" }) {
  return (
    <div className={`todo-stat-mini ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function cacheLabel(shellStatus) {
  if (!shellStatus.serviceWorkerSupported) {
    return "Brak wsparcia";
  }
  return shellStatus.serviceWorkerReady ? "Aktywny" : "Startuje";
}

export default function TasksSidebar({
  sidebarLists,
  selectedListId,
  setSelectedListId,
  workspaceName,
  workspaceInviteCode,
  stats,
  visibleStats,
  showColumnManager,
  setShowColumnManager,
  boardColumns,
  onUpdateColumn,
  onDeleteColumn,
  columnDraft,
  setColumnDraft,
  submitColumn,
  currentUserName,
  quickAddInputRef,
  searchInputRef,
  selectedTaskCount = 0,
  clearTaskSelection,
  selectedTasks = [],
  selectedTaskSla,
  shellStatus = {},
  taskNotifications = [],
  conflictTasks = [],
  onFocusConflictTask,
}) {
  const primarySelectedTask = selectedTasks[0];

  return (
    <aside className="todo-sidebar">
      <div className="todo-sidebar-top">
        <section className="todo-sidebar-hero">
          <div className="eyebrow">Task cockpit</div>
          <h2>{workspaceName || "Workspace"}</h2>
          <p>Plan dnia, szybkie follow-upy i przeglad taskow w jednym miejscu.</p>
          <div className="todo-sidebar-meta">
            {currentUserName ? <span className="todo-sidebar-chip">Ty: {currentUserName}</span> : null}
            {workspaceInviteCode ? <span className="todo-sidebar-chip">Kod: {workspaceInviteCode}</span> : null}
            <span className="todo-sidebar-chip">Widok 3-panelowy</span>
          </div>
          <div className="todo-sidebar-actions">
            <button
              type="button"
              className="todo-command-button primary"
              onClick={() => quickAddInputRef?.current?.focus()}
            >
              Nowe zadanie
            </button>
            <button
              type="button"
              className="todo-command-button"
              onClick={() => searchInputRef?.current?.focus()}
            >
              Szukaj
            </button>
            {selectedTaskCount ? (
              <button type="button" className="todo-command-button" onClick={clearTaskSelection}>
                Odznacz {selectedTaskCount}
              </button>
            ) : null}
          </div>
        </section>

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
        {selectedTaskCount ? (
          <div className="todo-focus-card">
            <div className="todo-card-head">
              <div>
                <span className="todo-card-eyebrow">Aktywna selekcja</span>
                <strong>{selectedTaskCount > 1 ? `${selectedTaskCount} zadan zaznaczonych` : primarySelectedTask?.title}</strong>
              </div>
              <button type="button" className="todo-inline-link" onClick={clearTaskSelection}>
                Wyczysc
              </button>
            </div>
            <div className="todo-sync-grid">
              <div className="todo-sync-stat">
                <span>Owner</span>
                <strong>{primarySelectedTask?.owner || "Nieprzypisane"}</strong>
              </div>
              <div className="todo-sync-stat">
                <span>SLA</span>
                <strong>{selectedTaskSla?.label || "Bez terminu"}</strong>
              </div>
            </div>
          </div>
        ) : null}

        <div className="todo-progress-card">
          <div className="todo-card-head">
            <div>
              <span className="todo-card-eyebrow">Postep</span>
              <strong>{stats.completed} zakonczonych</strong>
            </div>
            <span className="todo-status-pill success">{stats.progress}%</span>
          </div>
          <div className="todo-progress-track">
            <span style={{ width: `${stats.progress}%` }} />
          </div>
          <small>{stats.progress}% wszystkich zadan jest zamkniete.</small>
        </div>

        <div className="todo-stats-mini-grid">
          <StatMiniCard label="Otwarte" value={visibleStats.open} />
          <StatMiniCard label="Na dzisiaj" value={visibleStats.dueToday} tone="info" />
          <StatMiniCard label="Po terminie" value={visibleStats.overdue} tone="danger" />
          <StatMiniCard label="SLA risk" value={visibleStats.slaAtRisk + visibleStats.slaCritical} tone="warning" />
          <StatMiniCard label="SLA breach" value={visibleStats.slaBreached} tone="danger" />
          <StatMiniCard label="Bez ownera" value={visibleStats.unassigned} tone="warning" />
          <StatMiniCard label="W toku" value={visibleStats.inProgress} tone="info" />
          <StatMiniCard label="W grupach" value={visibleStats.grouped} tone="success" />
          <StatMiniCard label="Cykliczne" value={visibleStats.recurring} tone="info" />
          <StatMiniCard label="Zalezne" value={visibleStats.blocked} tone="warning" />
          <StatMiniCard label="Komentarze" value={visibleStats.commented} />
          <StatMiniCard label="Podzadania" value={visibleStats.subtasksOpen} tone="success" />
        </div>

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

        <div className="todo-device-card">
          <div className="todo-card-head">
            <div>
              <span className="todo-card-eyebrow">Mobilnie i offline</span>
              <strong>Gotowosc PWA</strong>
            </div>
            <span className={`todo-status-pill ${shellStatus.isOnline ? "success" : "danger"}`}>
              {shellStatus.isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <div className="todo-sync-grid">
            <div className="todo-sync-stat">
              <span>Tryb</span>
              <strong>{shellStatus.isStandalone ? "Aplikacja" : "Przegladarka"}</strong>
            </div>
            <div className="todo-sync-stat">
              <span>Cache offline</span>
              <strong>{cacheLabel(shellStatus)}</strong>
            </div>
          </div>
          <div className="todo-helper">Widok i akcje sa zoptymalizowane pod desktop, mobile i prace w biegu.</div>
        </div>

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
