import {
  canDrop,
  dueTone,
  formatListDueDate,
  handleCardKeyDown,
  toInputDateTime,
  writeDragTask,
} from "./taskViewUtils";
import { getTaskAssigneeSummary, getTaskSlaState } from "../lib/tasks";

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
  allTasks,
  groupBy,
  sortBy = "manual",
  setSortBy = () => {},
  selectedTask,
  selectedTaskIds,
  toggleTaskSelection,
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
        <button type="button" className={`todo-col-sort-btn${sortBy === "title" || sortBy === "owner" ? " active" : ""}`} onClick={() => setSortBy(sortBy === "title" ? "owner" : "title")}>
          Tytul i osoby {sortBy === "title" ? "↑" : sortBy === "owner" ? "↑" : ""}
        </button>
        <span>Grupa</span>
        <button type="button" className={`todo-col-sort-btn${sortBy === "due" ? " active" : ""}`} onClick={() => setSortBy("due")}>
          Termin {sortBy === "due" ? "↑" : ""}
        </button>
        <button type="button" className={`todo-col-sort-btn${sortBy === "updated" ? " active" : ""}`} onClick={() => setSortBy("updated")}>
          Status {sortBy === "updated" ? "↑" : ""}
        </button>
        <button type="button" className={`todo-col-sort-btn${sortBy === "priority" ? " active" : ""}`} onClick={() => setSortBy("priority")}>
          Priorytet {sortBy === "priority" ? "↑" : ""}
        </button>
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
                const isSelected = selectedTaskIds.includes(task.id);
                const nextTaskId = group.tasks[index].id;
                const assigneeSummary = getTaskAssigneeSummary(task);
                const hasMoreAssignees = (task.assignedTo || []).length > 1;
                const slaState = getTaskSlaState(task);

                return (
                  <div key={task.id} className="todo-list-row-shell">
                    <div
                      role="button"
                      tabIndex={0}
                      className={isActive ? "todo-table-row active editable" : "todo-table-row"}
                      data-selected={isSelected}
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
                          <input
                            data-task-title-input={task.id}
                            value={task.title}
                            onFocus={() => setSelectedTaskId(task.id)}
                            onChange={(event) => onUpdateTask(task.id, { title: event.target.value })}
                          />
                        ) : (
                          <>
                            <strong>{task.title}</strong>
                            <small>
                              {assigneeSummary}
                              {hasMoreAssignees ? " | zespolowe" : ""}
                              {task.myDay ? " | My Day" : ""}
                              {task.reminderAt ? " | przypomnienie" : ""}
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
                          <span className={`todo-sla-pill ${slaState.tone}`}>
                            {formatListDueDate(task.dueDate) || "Brak terminu"} {task.dueDate ? `- ${slaState.label}` : ""}
                          </span>
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
                          <div className="todo-inline-actions">
                            <button
                              type="button"
                              className={task.myDay ? "todo-star active" : "todo-star"}
                              onClick={(event) => {
                                event.stopPropagation();
                                onUpdateTask(task.id, { myDay: !task.myDay });
                              }}
                              title="Dodaj do My Day"
                            >
                              {"+"}
                            </button>
                            <button
                              type="button"
                              className={task.important ? "todo-star active" : "todo-star"}
                              onClick={(event) => {
                                event.stopPropagation();
                                onUpdateTask(task.id, { important: !task.important });
                              }}
                              title="Oznacz jako wazne"
                            >
                              {"\u2605"}
                            </button>
                          </div>
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
