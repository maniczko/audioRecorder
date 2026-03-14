import { dueTone, formatListDueDate, handleCardKeyDown } from "./taskViewUtils";

export default function TaskListView({ groupedTasks, groupBy, selectedTask, setSelectedTaskId, onUpdateTask }) {
  return (
    <div className="todo-table-wrap">
      <div className="todo-table-head">
        <span />
        <span>Title</span>
        <span>Due Date</span>
        <span>Importance</span>
      </div>

      {groupedTasks.map((group) => (
        <div key={group.id} className="todo-table-group">
          {groupBy !== "none" ? <div className="todo-group-label">{group.label}</div> : null}
          {group.tasks.length ? (
            group.tasks.map((task) => (
              <div
                role="button"
                tabIndex={0}
                key={task.id}
                className={selectedTask?.id === task.id ? "todo-table-row active" : "todo-table-row"}
                onClick={() => setSelectedTaskId(task.id)}
                onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
              >
                <button
                  type="button"
                  className={task.completed ? "todo-task-circle completed" : "todo-task-circle"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onUpdateTask(task.id, { completed: !task.completed });
                  }}
                />
                <span className="todo-title-cell">
                  <strong>{task.title}</strong>
                  <small>{task.owner || "Nieprzypisane"}</small>
                </span>
                <span className={dueTone(task.dueDate) === "danger" ? "todo-date danger" : "todo-date"}>
                  {formatListDueDate(task.dueDate)}
                </span>
                <button
                  type="button"
                  className={task.important ? "todo-star active" : "todo-star"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onUpdateTask(task.id, { important: !task.important });
                  }}
                >
                  {"\u2605"}
                </button>
              </div>
            ))
          ) : (
            <div className="todo-empty">Brak zadan w tej sekcji.</div>
          )}
        </div>
      ))}
    </div>
  );
}
