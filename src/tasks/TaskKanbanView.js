import { getTaskAssigneeSummary, getTaskDependencyDetails, getTaskSlaState } from "../lib/tasks";
import { getTaskLastActivity } from "../lib/activityFeed";
import { canDrop, formatListDueDate, handleCardKeyDown, writeDragTask } from "./taskViewUtils";

function DropSlot({ placement, onDropTask, onDragEnter, label = "Upusc tutaj zadanie" }) {
  return (
    <div
      className="todo-kanban-drop-slot"
      aria-label={label}
      onDragOver={canDrop}
      onDragEnter={onDragEnter}
      onDrop={(event) => onDropTask(placement, event, "Zmieniono kolejnosc zadania w kolumnie.")}
    />
  );
}

export default function TaskKanbanView({
  kanbanColumns,
  allTasks,
  dropColumnId,
  setDropColumnId,
  handleDrop,
  handleTaskDrop,
  selectedTask,
  selectedTaskIds,
  toggleTaskSelection,
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
              <>
                <DropSlot
                  placement={{ status: column.id, nextTaskId: column.tasks[0]?.id || "" }}
                  onDropTask={handleTaskDrop}
                  onDragEnter={() => setDropColumnId(column.id)}
                  label={`Upusc na poczatku kolumny ${column.label}`}
                />

                {column.tasks.map((task, index) => {
                  const dependencyState = getTaskDependencyDetails(task, allTasks);
                  const slaState = getTaskSlaState(task);
                  const isSelected = selectedTaskIds.includes(task.id);
                  const lastActivity = getTaskLastActivity(task);

                  return (
                    <div key={task.id} className="todo-kanban-card-shell">
                      <article
                        role="button"
                        tabIndex={0}
                        className={selectedTask?.id === task.id ? "todo-kanban-card active" : "todo-kanban-card"}
                        data-selected={isSelected}
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
                            <input
                              type="checkbox"
                              checked={isSelected}
                              aria-label={`Zaznacz zadanie ${task.title}`}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleTaskSelection(task.id)}
                            />
                            <span
                              className="todo-drag-handle"
                              title="Przeciagnij zadanie"
                              draggable
                              onDragStart={(event) => {
                                setSelectedTaskId(task.id);
                                setDragTaskId(task.id);
                                writeDragTask(event, task.id);
                              }}
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
                          <span>{getTaskAssigneeSummary(task)}</span>
                          <span>{formatListDueDate(task.dueDate) || "Brak terminu"}</span>
                        </div>
                        {lastActivity ? (
                          <small className="todo-activity-copy">
                            Ostatnia aktywnosc: {lastActivity.actor} - {lastActivity.message}
                          </small>
                        ) : null}
                        <div className="todo-tag-list">
                          {task.group ? <span className="todo-tag">{task.group}</span> : null}
                          {task.recurrence ? <span className="todo-tag tone-info">Cykliczne</span> : null}
                          {dependencyState.blocking ? <span className="todo-tag tone-warning">Blokowane</span> : null}
                          {task.dueDate ? <span className={`todo-tag tone-${slaState.tone}`}>{slaState.label}</span> : null}
                          {(task.tags || []).slice(0, task.group ? 1 : 2).map((tag) => (
                            <span key={`${task.id}-${tag}`} className="todo-tag">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </article>

                      <DropSlot
                        placement={{
                          status: column.id,
                          previousTaskId: task.id,
                          nextTaskId: column.tasks[index + 1]?.id || "",
                        }}
                        onDropTask={handleTaskDrop}
                        onDragEnter={() => setDropColumnId(column.id)}
                        label={`Upusc po zadaniu ${task.title}`}
                      />
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="todo-empty">Przeciagnij tu zadanie.</div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
