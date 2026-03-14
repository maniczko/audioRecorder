import { formatDateTime } from "./lib/storage";

function filterLabel(filter) {
  switch (filter) {
    case "assigned":
      return "Przypisane do mnie";
    case "important":
      return "Wazne";
    case "completed":
      return "Zakonczone";
    default:
      return "Wszystkie zadania";
  }
}

export default function TasksTab({
  filters,
  activeFilter,
  onFilterChange,
  stats,
  tasks,
  selectedTask,
  onSelectTask,
  onUpdateTaskState,
  onOpenMeeting,
}) {
  return (
    <div className="tasks-layout">
      <aside className="tasks-sidebar">
        <section className="tasks-brand-panel">
          <div className="eyebrow">Tasks</div>
          <h2>Moje zadania</h2>
          <p>Automatycznie wyciagniete ze spotkan, uporzadkowane i przypisane do osob.</p>
        </section>

        <section className="tasks-list-panel">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={activeFilter === filter.id ? "task-filter-card active" : "task-filter-card"}
              onClick={() => onFilterChange(filter.id)}
            >
              <div>
                <strong>{filter.label}</strong>
                <span>{filter.description}</span>
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
              <span>Wazne</span>
              <strong>{stats.important}</strong>
            </div>
            <div>
              <span>Zakonczone</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>
        </section>
      </aside>

      <section className="tasks-main-panel">
        <div className="tasks-header">
          <div>
            <div className="eyebrow">Task list</div>
            <h2>{filterLabel(activeFilter)}</h2>
          </div>
          <div className="status-cluster">
            <span className="status-chip">{tasks.length} pozycji</span>
          </div>
        </div>

        <div className="tasks-items">
          {tasks.length ? (
            tasks.map((task) => (
              <button
                type="button"
                key={task.id}
                className={selectedTask?.id === task.id ? "task-row active" : "task-row"}
                onClick={() => onSelectTask(task.id)}
              >
                <div className="task-row-left">
                  <button
                    type="button"
                    className={task.completed ? "task-check completed" : "task-check"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpdateTaskState(task.id, { completed: !task.completed });
                    }}
                  >
                    {task.completed ? "✓" : ""}
                  </button>
                  <div className="task-copy">
                    <strong>{task.title}</strong>
                    <span>
                      {task.owner} • {task.sourceMeetingTitle}
                    </span>
                  </div>
                </div>
                <div className="task-row-right">
                  {task.important ? <span className="task-flag">Wazne</span> : null}
                  <span className="task-date">{formatDateTime(task.sourceMeetingDate)}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="task-empty-state">
              <strong>Brak taskow w tym widoku</strong>
              <span>Nagraj lub przeanalizuj spotkanie, aby zadania pojawily sie tutaj automatycznie.</span>
            </div>
          )}
        </div>
      </section>

      <aside className="task-detail-panel">
        {selectedTask ? (
          <>
            <div className="panel-header compact">
              <div>
                <div className="eyebrow">Szczegoly</div>
                <h2>{selectedTask.title}</h2>
              </div>
            </div>

            <div className="task-detail-meta">
              <div className="task-detail-chip">
                <span>Owner</span>
                <strong>{selectedTask.owner}</strong>
              </div>
              <div className="task-detail-chip">
                <span>Status</span>
                <strong>{selectedTask.completed ? "Zakonczone" : "Otwarte"}</strong>
              </div>
              <div className="task-detail-chip">
                <span>Spotkanie</span>
                <strong>{selectedTask.sourceMeetingTitle}</strong>
              </div>
            </div>

            <div className="task-detail-actions">
              <button
                type="button"
                className={selectedTask.completed ? "secondary-button" : "primary-button"}
                onClick={() => onUpdateTaskState(selectedTask.id, { completed: !selectedTask.completed })}
              >
                {selectedTask.completed ? "Oznacz jako otwarte" : "Oznacz jako zrobione"}
              </button>
              <button
                type="button"
                className={selectedTask.important ? "secondary-button" : "ghost-button"}
                onClick={() => onUpdateTaskState(selectedTask.id, { important: !selectedTask.important })}
              >
                {selectedTask.important ? "Usun waznosc" : "Oznacz jako wazne"}
              </button>
            </div>

            <label className="task-note-field">
              <span>Notatki</span>
              <textarea
                rows="8"
                value={selectedTask.notes || ""}
                onChange={(event) => onUpdateTaskState(selectedTask.id, { notes: event.target.value })}
                placeholder="Dodaj prywatne notatki do zadania."
              />
            </label>

            <div className="task-source-card">
              <span>Zrodlo</span>
              <p>{selectedTask.sourceQuote || "Task powstal na bazie analizy spotkania."}</p>
              <button type="button" className="ghost-button" onClick={() => onOpenMeeting(selectedTask.sourceMeetingId)}>
                Otworz spotkanie
              </button>
            </div>
          </>
        ) : (
          <div className="task-empty-state detail">
            <strong>Wybierz zadanie</strong>
            <span>Tutaj zobaczysz szczegoly, notatki i szybkie akcje dla taska.</span>
          </div>
        )}
      </aside>
    </div>
  );
}
