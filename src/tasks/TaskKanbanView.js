import { canDrop, formatListDueDate, handleCardKeyDown, writeDragTask } from "./taskViewUtils";

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
        >
          <header className="todo-kanban-header" style={{ "--column-color": column.color }}>
            <strong>{column.label}</strong>
            <span>{column.tasks.length}</span>
          </header>
          <div
            className="todo-kanban-body"
            onDragOver={canDrop}
            onDragEnter={() => setDropColumnId(column.id)}
            onDragLeave={() => setDropColumnId((previous) => (previous === column.id ? "" : previous))}
            onDrop={(event) => handleDrop(column.id, event)}
          >
            {column.tasks.length ? (
              column.tasks.map((task) => (
                <article
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  className={selectedTask?.id === task.id ? "todo-kanban-card active" : "todo-kanban-card"}
                  draggable
                  onDragStart={(event) => {
                    setSelectedTaskId(task.id);
                    setDragTaskId(task.id);
                    writeDragTask(event, task.id);
                  }}
                  onDragEnd={() => {
                    setDragTaskId("");
                    setDropColumnId("");
                  }}
                  onClick={() => setSelectedTaskId(task.id)}
                  onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
                >
                  <div className="todo-kanban-card-top">
                    <div className="todo-kanban-title">
                      <span
                        className="todo-drag-handle"
                        title="Przeciagnij zadanie"
                      >
                        {"\u22EE"}
                      </span>
                      <strong>{task.title}</strong>
                    </div>
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
                    <span>{formatListDueDate(task.dueDate) || "Brak terminu"}</span>
                  </div>
                  <div className="todo-tag-list">
                    {task.group ? <span className="todo-tag">{task.group}</span> : null}
                    {(task.tags || []).slice(0, task.group ? 2 : 3).map((tag) => (
                      <span key={`${task.id}-${tag}`} className="todo-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </article>
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
