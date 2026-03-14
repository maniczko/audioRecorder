import {
  canDrop,
  dueTone,
  formatListDueDate,
  handleCardKeyDown,
  toInputDateTime,
  writeDragTask,
} from "./taskViewUtils";
import { getTaskAssigneeSummary } from "../lib/tasks";

function statusLabel(task, boardColumns) {
  return boardColumns.find((column) => column.id === task.status)?.label || task.status;
}

function buildPlacement(groupBy, groupId, previousTaskId = "", nextTaskId = "") {
  return {
    ...(groupBy === "status" ? { status: groupId } : {}),
    ...(groupBy === "group" ? { group: groupId === "__ungrouped__" ? "" : groupId } : {}),
    previousTaskId,
    nextTaskId,
  };
}

function DropLine({ placement, onDropTask, label = "Upusc tutaj zadanie" }) {
  return (
    <div
      className="todo-row-dropzone"
      aria-label={label}
      onDragOver={canDrop}
      onDrop={(event) => onDropTask(placement, event)}
    />
  );
}

export default function TaskListView({
  groupedTasks,
  groupBy,
  selectedTask,
  setSelectedTaskId,
  onUpdateTask,
  onMoveTaskToColumn,
  peopleOptions,
  taskGroups,
  boardColumns,
  handleGroupDrop,
  handleTaskDrop,
  setDragTaskId,
}) {
  return (
    <div className="todo-table-wrap">
      <div className="todo-table-head">
        <span />
        <span>Tytul i osoby</span>
        <span>Grupa</span>
        <span>Termin</span>
        <span>Status</span>
        <span>Priorytet</span>
      </div>

      {groupedTasks.map((group) => (
        <section
          key={group.id}
          className={groupBy === "status" || groupBy === "group" ? "todo-table-group dropzone" : "todo-table-group"}
          onDragOver={groupBy === "status" || groupBy === "group" ? canDrop : undefined}
          onDrop={groupBy === "status" || groupBy === "group" ? (event) => handleGroupDrop(group.id, event) : undefined}
        >
          {groupBy !== "none" ? (
            <div className="todo-group-label">
              <strong>{group.label}</strong>
              <span>{group.tasks.length}</span>
            </div>
          ) : null}

          {group.tasks.length ? (
            <>
              <DropLine
                placement={buildPlacement(groupBy, group.id, "", group.tasks[0]?.id || "")}
                onDropTask={handleTaskDrop}
                label={`Upusc na poczatku sekcji ${group.label || "zadan"}`}
              />

              {group.tasks.map((task, index) => {
                const isActive = selectedTask?.id === task.id;
                const nextTaskId = group.tasks[index].id;
                const assigneeSummary = getTaskAssigneeSummary(task);
                const hasMoreAssignees = (task.assignedTo || []).length > 1;

                return (
                  <div key={task.id} className="todo-list-row-shell">
                    <div
                      role="button"
                      tabIndex={0}
                      className={isActive ? "todo-table-row active editable" : "todo-table-row"}
                      draggable
                      onDragStart={(event) => {
                        setSelectedTaskId(task.id);
                        setDragTaskId(task.id);
                        writeDragTask(event, task.id);
                      }}
                      onDragEnd={() => setDragTaskId("")}
                      onClick={() => setSelectedTaskId(task.id)}
                      onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
                    >
                      <div className="todo-row-tools">
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
                        <button
                          type="button"
                          className={task.completed ? "todo-task-circle completed" : "todo-task-circle"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onUpdateTask(task.id, { completed: !task.completed });
                          }}
                        />
                      </div>

                      <span className="todo-title-cell">
                        {isActive ? (
                          <>
                            <input
                              value={task.title}
                              onFocus={() => setSelectedTaskId(task.id)}
                              onChange={(event) => onUpdateTask(task.id, { title: event.target.value })}
                            />
                            <select
                              value={task.owner}
                              onFocus={() => setSelectedTaskId(task.id)}
                              onChange={(event) => onUpdateTask(task.id, { owner: event.target.value })}
                            >
                              <option value="">Nieprzypisane</option>
                              {peopleOptions.map((person) => (
                                <option key={person} value={person}>
                                  {person}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <>
                            <strong>{task.title}</strong>
                            <small>
                              {assigneeSummary}
                              {hasMoreAssignees ? " | zespolowe" : ""}
                            </small>
                          </>
                        )}
                      </span>

                      <span className="todo-group-cell">
                        {isActive ? (
                          <>
                            <input
                              list="task-groups-inline"
                              value={task.group || ""}
                              onFocus={() => setSelectedTaskId(task.id)}
                              onChange={(event) => onUpdateTask(task.id, { group: event.target.value })}
                              placeholder="Bez grupy"
                            />
                            <datalist id="task-groups-inline">
                              {taskGroups.map((groupItem) => (
                                <option key={groupItem} value={groupItem} />
                              ))}
                            </datalist>
                          </>
                        ) : (
                          <span className="todo-group-pill">{task.group || "Bez grupy"}</span>
                        )}
                      </span>

                      <span className={dueTone(task.dueDate) === "danger" ? "todo-date danger" : "todo-date"}>
                        {isActive ? (
                          <input
                            type="datetime-local"
                            value={toInputDateTime(task.dueDate)}
                            onFocus={() => setSelectedTaskId(task.id)}
                            onChange={(event) => onUpdateTask(task.id, { dueDate: event.target.value })}
                          />
                        ) : (
                          formatListDueDate(task.dueDate) || "Brak terminu"
                        )}
                      </span>

                      <span className="todo-status-cell">
                        {isActive ? (
                          <select
                            value={task.status}
                            onFocus={() => setSelectedTaskId(task.id)}
                            onChange={(event) => onMoveTaskToColumn(task.id, event.target.value)}
                          >
                            {boardColumns.map((column) => (
                              <option key={column.id} value={column.id}>
                                {column.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="todo-status-badge">{statusLabel(task, boardColumns)}</span>
                        )}
                      </span>

                      <span className="todo-priority-cell">
                        {isActive ? (
                          <select
                            value={task.priority}
                            onFocus={() => setSelectedTaskId(task.id)}
                            onChange={(event) => onUpdateTask(task.id, { priority: event.target.value })}
                          >
                            <option value="low">Niski</option>
                            <option value="medium">Sredni</option>
                            <option value="high">Wysoki</option>
                            <option value="urgent">Krytyczny</option>
                          </select>
                        ) : (
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
                        )}
                      </span>
                    </div>

                    <DropLine
                      placement={buildPlacement(groupBy, group.id, nextTaskId, group.tasks[index + 1]?.id || "")}
                      onDropTask={handleTaskDrop}
                      label={`Upusc po zadaniu ${task.title}`}
                    />
                  </div>
                );
              })}

              <DropLine
                placement={buildPlacement(groupBy, group.id, group.tasks[group.tasks.length - 1]?.id || "", "")}
                onDropTask={handleTaskDrop}
                label={`Upusc na koncu sekcji ${group.label || "zadan"}`}
              />
            </>
          ) : (
            <div className="todo-empty">Brak zadan w tej sekcji.</div>
          )}
        </section>
      ))}
    </div>
  );
}
