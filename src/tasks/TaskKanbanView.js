import { canDrop, formatListDueDate, handleCardKeyDown } from "./taskViewUtils";

export default function TaskKanbanView({
  kanbanColumns,
  dropColumnId,
  setDropColumnId,
  handleDrop,
  selectedTask,
  setSelectedTaskId,
  setDragTaskId,
  onUpdateTask,
}) {
  return (
    <div className="todo-kanban">
      {kanbanColumns.map((column) => (
        <section
          key={column.id}
          className={dropColumnId === column.id ? "todo-kanban-column drop" : "todo-kanban-column"}
          onDragOver={canDrop}
          onDragEnter={() => setDropColumnId(column.id)}
          onDragLeave={() => setDropColumnId((previous) => (previous === column.id ? "" : previous))}
          onDrop={(event) => handleDrop(column.id, event)}
        >
          <header className="todo-kanban-header" style={{ "--column-color": column.color }}>
            <strong>{column.label}</strong>
            <span>{column.tasks.length}</span>
          </header>
          <div className="todo-kanban-body">
            {column.tasks.length ? (
              column.tasks.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  className={selectedTask?.id === task.id ? "todo-kanban-card active" : "todo-kanban-card"}
                  draggable
                  onDragStart={(event) => {
                    setDragTaskId(task.id);
                    event.dataTransfer.setData("text/plain", task.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragTaskId("");
                    setDropColumnId("");
                  }}
                  onClick={() => setSelectedTaskId(task.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
                >
                  <div className="todo-kanban-card-top">
                    <strong>{task.title}</strong>
                    <button
                      type="button"
                      className={task.important ? "todo-star active inline" : "todo-star inline"}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateTask(task.id, { important: !task.important });
                      }}
                    >
                      {"\u2605"}
                    </button>
                  </div>
                  <p>{task.description || task.sourceQuote || "Task powstal na podstawie spotkania."}</p>
                  <div className="todo-kanban-meta">
                    <span>{task.owner || "Nieprzypisane"}</span>
                    <span>{formatListDueDate(task.dueDate) || "No date"}</span>
                  </div>
                  <div className="todo-tag-list">
                    {(task.tags || []).slice(0, 3).map((tag) => (
                      <span key={`${task.id}-${tag}`} className="todo-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="todo-empty">Przeciagnij tu zadanie.</div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
