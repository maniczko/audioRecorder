import { formatDateTime } from "../lib/storage";
import { TASK_PRIORITIES } from "../lib/tasks";
import { toInputDateTime } from "./taskViewUtils";

export default function TaskDetailsPanel({
  selectedTask,
  peopleOptions,
  boardColumns,
  onUpdateTask,
  onMoveTaskToColumn,
  onDeleteTask,
  onOpenMeeting,
}) {
  return (
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
  );
}
