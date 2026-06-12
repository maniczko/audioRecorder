import PropTypes from 'prop-types';
import { memo, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { canDrop, formatListDueDate, handleCardKeyDown, writeDragTask } from './taskViewUtils';
import { getTaskAssigneeSummary } from '../lib/tasks';

const DEFAULT_SORT = 'due:asc';

function statusLabel(task, boardColumns) {
  return boardColumns.find((column) => column.id === task.status)?.label || task.status;
}

function priorityLabel(priority = 'medium') {
  const labels = {
    high: 'Wysoki',
    medium: 'Średni',
    low: 'Niski',
  };
  return labels[priority] || priority || 'Średni';
}

function assigneeInitials(value = '') {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function taskCountLabel(count: number) {
  if (count === 1) {
    return '1 zadanie';
  }

  return `${count} zadań`;
}

function parseSort(sortBy = DEFAULT_SORT) {
  const [field, rawDirection] = String(sortBy || DEFAULT_SORT).split(':');
  const direction = rawDirection === 'desc' ? 'desc' : 'asc';
  return { field: field || 'due', direction };
}

function nextSortValue(sortBy, field) {
  const current = parseSort(sortBy);
  if (current.field !== field) {
    return `${field}:asc`;
  }
  if (current.direction === 'asc') {
    return `${field}:desc`;
  }
  return DEFAULT_SORT;
}

function sortIcon(sortBy, field) {
  const current = parseSort(sortBy);
  if (current.field !== field) {
    return '↕';
  }
  return current.direction === 'desc' ? '↓' : '↑';
}

function ariaSort(sortBy, field) {
  const current = parseSort(sortBy);
  if (current.field !== field) {
    return 'none';
  }
  return current.direction === 'desc' ? 'descending' : 'ascending';
}

function SortHeader({ field, label, sortBy, setSortBy }) {
  const active = parseSort(sortBy).field === field;
  return (
    <span role="columnheader" aria-sort={ariaSort(sortBy, field)}>
      <button
        type="button"
        className={active ? 'todo-col-sort-btn active' : 'todo-col-sort-btn'}
        onClick={() => setSortBy(nextSortValue(sortBy, field))}
      >
        <span>{label}</span>
        <span className="todo-col-sort-icon" aria-hidden="true">
          {sortIcon(sortBy, field)}
        </span>
      </button>
    </span>
  );
}

function buildPlacement(groupBy, groupId, previousTaskId = '', nextTaskId = '') {
  return {
    ...(groupBy === 'status' ? { status: groupId } : {}),
    ...(groupBy === 'group' ? { group: groupId === '__ungrouped__' ? '' : groupId } : {}),
    previousTaskId,
    nextTaskId,
  };
}

function DropLine({ placement, onDropTask, label = 'Upuść tutaj zadanie' }) {
  const [isOver, setIsOver] = useState(false);
  return (
    <div
      className={`todo-row-dropzone${isOver ? ' active' : ''}`}
      aria-label={label}
      onDragOver={(e) => {
        canDrop(e);
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        setIsOver(false);
        onDropTask(placement, event);
      }}
    />
  );
}

function TaskListView({
  groupedTasks,
  allTasks,
  groupBy,
  sortBy = DEFAULT_SORT,
  setSortBy = () => undefined,
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
  dragTaskId,
}) {
  void toggleTaskSelection;
  void onMoveTaskToColumn;
  void peopleOptions;
  void taskGroups;

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && dragTaskId) {
        setDragTaskId('');
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dragTaskId, setDragTaskId]);

  const visibleTaskCount = allTasks.length;
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(visibleTaskCount / pageSize));

  return (
    <div className="todo-table-wrap">
      <div className="todo-table-head">
        <span role="columnheader" aria-label="Zaznacz" />
        <SortHeader field="title" label="Tytuł zadania" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="status" label="Status" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="priority" label="Priorytet" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="due" label="Termin" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="owner" label="Osoba" sortBy={sortBy} setSortBy={setSortBy} />
        <span role="columnheader" aria-label="Ważne" />
      </div>

      {groupedTasks.map((group) => (
        <section
          key={group.id}
          className={
            groupBy === 'status' || groupBy === 'group'
              ? 'todo-table-group dropzone'
              : 'todo-table-group'
          }
          onDragOver={groupBy === 'status' || groupBy === 'group' ? canDrop : undefined}
          onDrop={
            groupBy === 'status' || groupBy === 'group'
              ? (event) => handleGroupDrop(group.id, event)
              : undefined
          }
        >
          {groupBy !== 'none' ? (
            <div className="todo-group-label">
              <strong>{group.label}</strong>
              <span>{group.tasks.length}</span>
            </div>
          ) : null}

          {group.tasks.length ? (
            <>
              <DropLine
                placement={buildPlacement(groupBy, group.id, '', group.tasks[0]?.id || '')}
                onDropTask={handleTaskDrop}
                label={`Upuść na początku sekcji ${group.label || 'zadań'}`}
              />

              {group.tasks.map((task, index) => {
                const isActive = selectedTask?.id === task.id;
                const isSelected = selectedTaskIds.includes(task.id);
                const nextTaskId = group.tasks[index].id;
                const assigneeSummary = getTaskAssigneeSummary(task);
                const hasMoreAssignees = (task.assignedTo || []).length > 1;
                const tags = Array.isArray(task.tags) ? task.tags.filter(Boolean) : [];

                return (
                  <div key={task.id} className="todo-list-row-shell">
                    <div
                      role="button"
                      tabIndex={0}
                      className={`todo-table-row${isActive ? ' active' : ''}${dragTaskId === task.id ? ' dragging' : ''}`}
                      data-selected={isSelected}
                      draggable
                      onDragStart={(event) => {
                        setSelectedTaskId(task.id);
                        setDragTaskId(task.id);
                        writeDragTask(event, task.id);
                      }}
                      onDragEnd={() => setDragTaskId('')}
                      onClick={() => setSelectedTaskId(task.id)}
                      onKeyDown={(event) =>
                        handleCardKeyDown(event, () => setSelectedTaskId(task.id))
                      }
                    >
                      <div className="todo-row-tools">
                        <span
                          className="todo-drag-handle"
                          title="Przeciągnij zadanie"
                          draggable
                          onDragStart={(event) => {
                            setSelectedTaskId(task.id);
                            setDragTaskId(task.id);
                            writeDragTask(event, task.id);
                          }}
                        >
                          {'\u22EE'}
                        </span>
                        <button
                          type="button"
                          className={
                            task.completed ? 'todo-task-circle completed' : 'todo-task-circle'
                          }
                          aria-label={
                            task.completed
                              ? `Otwórz ponownie zadanie ${task.title}`
                              : `Zakończ zadanie ${task.title}`
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            onUpdateTask(task.id, { completed: !task.completed });
                          }}
                        />
                      </div>

                      <span className="todo-title-cell">
                        <strong>{task.title}</strong>
                        <small className="todo-title-meta">
                          <span>{task.group || task.notes || 'Bez kategorii'}</span>
                          {tags.length ? <span>{tags.slice(0, 2).join(', ')}</span> : null}
                          {hasMoreAssignees ? <span>zespołowe</span> : null}
                          {task.reminderAt ? <span>przypomnienie</span> : null}
                        </small>
                      </span>

                      <span className="todo-status-cell">
                        <span className="todo-status-badge">{statusLabel(task, boardColumns)}</span>
                      </span>

                      <span className="todo-priority-cell">
                        <span className={`todo-priority-badge ${task.priority || 'medium'}`}>
                          {priorityLabel(task.priority)}
                        </span>
                      </span>

                      <span className="todo-date">
                        {formatListDueDate(task.dueDate) || 'Brak terminu'}
                      </span>

                      <span className="todo-assignee-cell">
                        <span className="todo-assignee-avatar" aria-hidden="true">
                          {assigneeInitials(assigneeSummary) || '?'}
                        </span>
                        <span>{assigneeSummary}</span>
                      </span>

                      <span className="todo-star-cell">
                        <button
                          type="button"
                          className={task.important ? 'todo-star active' : 'todo-star'}
                          onClick={(event) => {
                            event.stopPropagation();
                            onUpdateTask(task.id, { important: !task.important });
                          }}
                          title="Oznacz jako ważne"
                        >
                          {'\u2605'}
                        </button>
                      </span>
                    </div>

                    <DropLine
                      placement={buildPlacement(
                        groupBy,
                        group.id,
                        nextTaskId,
                        group.tasks[index + 1]?.id || ''
                      )}
                      onDropTask={handleTaskDrop}
                      label={`Upuść po zadaniu ${task.title}`}
                    />
                  </div>
                );
              })}

              <DropLine
                placement={buildPlacement(
                  groupBy,
                  group.id,
                  group.tasks[group.tasks.length - 1]?.id || '',
                  ''
                )}
                onDropTask={handleTaskDrop}
                label={`Upuść na końcu sekcji ${group.label || 'zadań'}`}
              />
            </>
          ) : (
            <div className="todo-empty">Brak zadań w tej sekcji.</div>
          )}
        </section>
      ))}

      <div className="todo-table-footer" aria-label="Nawigacja listy zadań">
        <div className="todo-table-footer-left">
          <span>{taskCountLabel(visibleTaskCount)}</span>
          <button type="button" className="todo-table-footer-action">
            <RefreshCw size={15} aria-hidden="true" />
            Odśwież
          </button>
        </div>
        <div className="todo-table-pagination">
          <span>Pokaż na stronie:</span>
          <button type="button" className="todo-page-size">
            {pageSize}
          </button>
          <button type="button" className="todo-page-icon" aria-label="Poprzednia strona">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button type="button" className="todo-page-number active" aria-current="page">
            1
          </button>
          {totalPages > 1 ? (
            <button type="button" className="todo-page-number">
              2
            </button>
          ) : null}
          <button type="button" className="todo-page-icon" aria-label="Następna strona">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

TaskListView.propTypes = {
  groupedTasks: PropTypes.array,
  allTasks: PropTypes.array,
  groupBy: PropTypes.string,
  sortBy: PropTypes.string,
  setSortBy: PropTypes.func,
  selectedTask: PropTypes.object,
  selectedTaskIds: PropTypes.array,
  toggleTaskSelection: PropTypes.func,
  setSelectedTaskId: PropTypes.func,
  onUpdateTask: PropTypes.func,
  onMoveTaskToColumn: PropTypes.func,
  peopleOptions: PropTypes.array,
  taskGroups: PropTypes.array,
  boardColumns: PropTypes.array,
  handleGroupDrop: PropTypes.func,
  handleTaskDrop: PropTypes.func,
  setDragTaskId: PropTypes.func,
  dragTaskId: PropTypes.string,
};

export default memo(TaskListView, (prevProps, nextProps) => {
  return (
    prevProps.groupedTasks === nextProps.groupedTasks &&
    prevProps.allTasks === nextProps.allTasks &&
    prevProps.groupBy === nextProps.groupBy &&
    prevProps.sortBy === nextProps.sortBy &&
    prevProps.dragTaskId === nextProps.dragTaskId &&
    prevProps.selectedTaskIds === nextProps.selectedTaskIds &&
    prevProps.selectedTask === nextProps.selectedTask
  );
});
