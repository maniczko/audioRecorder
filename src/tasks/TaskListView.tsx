import PropTypes from 'prop-types';
import { memo, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Mic2,
  MoreVertical,
  NotebookText,
  PencilLine,
  UsersRound,
} from 'lucide-react';
import { canDrop, formatListDueDate, handleCardKeyDown, writeDragTask } from './taskViewUtils';
import { getTaskAssigneeSummary } from '../lib/tasks';

const DEFAULT_SORT = 'due:asc';

function statusLabel(task, boardColumns) {
  const status = String(task.status || '').toLowerCase();
  if (status === 'todo') return 'Do zrobienia';
  if (status === 'in_progress') return 'W toku';
  if (status === 'waiting') return 'Do potwierdzenia';
  if (status === 'done' || status === 'completed') return 'Zakończone';
  return boardColumns.find((column) => column.id === task.status)?.label || task.status;
}

function statusTone(task) {
  const status = String(task.status || '').toLowerCase();
  if (status === 'in_progress') return 'in-progress';
  if (status === 'waiting') return 'review';
  if (status === 'done' || status === 'completed' || task.completed) return 'completed';
  return 'todo';
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

function displayDescription(task) {
  const value = String(task.description || task.notes || task.group || '')
    .replace(/\s+/g, ' ')
    .trim();
  return value || 'Bez opisu';
}

function isRawSpeakerName(value = '') {
  return /^(speaker|mowca|mówca)\s*\d+$/i.test(String(value || '').trim());
}

function displayAssignee(task) {
  const summary = getTaskAssigneeSummary(task);
  if (!summary || isRawSpeakerName(summary)) {
    return 'Nieprzypisane';
  }
  return summary;
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
        aria-label={`Sortuj po kolumnie ${label}`}
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

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel = 'Zaznacz wszystkie widoczne zadania',
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate && !checked);
    }
  }, [checked, indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="todo-select-checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
    />
  );
}

function normalizeSourceType(task) {
  if (task.sourceType === 'meeting' || task.sourceMeetingId) return 'meeting';
  if (task.sourceType === 'recording' || task.sourceRecordingId) return 'recording';
  if (task.sourceType === 'note') return 'note';
  if (task.sourceType === 'google') return 'google';
  return 'manual';
}

function sourceMeta(task) {
  const sourceType = normalizeSourceType(task);
  if (sourceType === 'meeting') return { label: 'Spotkanie', tone: 'meeting', Icon: UsersRound };
  if (sourceType === 'recording') return { label: 'Nagranie', tone: 'recording', Icon: Mic2 };
  if (sourceType === 'note') return { label: 'Notatka', tone: 'note', Icon: NotebookText };
  if (sourceType === 'google') return { label: 'Google Tasks', tone: 'google', Icon: CheckCircle2 };
  return { label: 'Ręczne', tone: 'manual', Icon: PencilLine };
}

function aiMeta(task) {
  const confidence =
    Number(task.aiConfidence ?? task.confidence ?? task.extractionConfidence ?? task.aiScore) || 0;
  if (task.status === 'waiting') {
    return { label: 'AI wymaga weryfikacji', tone: 'review' };
  }
  if (confidence > 0) {
    return {
      label: `AI ${Math.round(confidence > 1 ? confidence : confidence * 100)}%`,
      tone: 'ai',
    };
  }
  if (normalizeSourceType(task) === 'manual' || normalizeSourceType(task) === 'google') {
    return { label: 'Manualne', tone: 'manual' };
  }
  return { label: 'AI', tone: 'ai' };
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
  onDeleteTask,
  onMoveTaskToColumn,
  peopleOptions,
  taskGroups,
  boardColumns,
  handleGroupDrop,
  handleTaskDrop,
  setDragTaskId,
  dragTaskId,
  allVisibleSelected = false,
  someVisibleSelected = false,
  onToggleAllVisibleTasks = (_checked) => undefined,
  onBulkStatusChange = (_status) => undefined,
  onBulkAssignToMe = () => undefined,
  onBulkDelete = () => undefined,
  onOpenMeeting = undefined,
}) {
  void onMoveTaskToColumn;
  void peopleOptions;
  void taskGroups;
  const [openActionTaskId, setOpenActionTaskId] = useState('');
  const openMeetingHandler =
    typeof onOpenMeeting === 'function' ? (onOpenMeeting as (meetingId: string) => void) : null;

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
  const selectedCount = selectedTaskIds.length;

  return (
    <div className="todo-table-wrap">
      {selectedCount > 0 ? (
        <div className="todo-bulk-toolbar" aria-label="Akcje zaznaczonych zadań">
          <div className="todo-bulk-selection">
            <span>{selectedCount} wybranych</span>
          </div>
          <select
            className="todo-bulk-select"
            aria-label="Zmień status zaznaczonych zadań"
            value=""
            onChange={(event) => {
              if (event.target.value) {
                onBulkStatusChange(event.target.value);
                event.target.value = '';
              }
            }}
          >
            <option value="">Zmień status</option>
            {boardColumns.map((column) => (
              <option key={column.id} value={column.id}>
                {statusLabel({ status: column.id }, boardColumns)}
              </option>
            ))}
          </select>
          <button type="button" className="todo-bulk-button" onClick={onBulkAssignToMe}>
            Przypisz
          </button>
          <button
            type="button"
            className="todo-bulk-button danger"
            onClick={onBulkDelete}
            aria-label="Usuń zaznaczone zadania"
          >
            Usuń
          </button>
        </div>
      ) : null}
      <div className="todo-table-head">
        <span role="columnheader" aria-label="Zaznacz">
          <SelectAllCheckbox
            checked={Boolean(allVisibleSelected && visibleTaskCount)}
            indeterminate={someVisibleSelected}
            onChange={onToggleAllVisibleTasks}
          />
        </span>
        <SortHeader field="title" label="Zadanie" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="status" label="Status" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="priority" label="Priorytet" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="due" label="Termin" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="owner" label="Osoba" sortBy={sortBy} setSortBy={setSortBy} />
        <SortHeader field="source" label="Źródło" sortBy={sortBy} setSortBy={setSortBy} />
        <span role="columnheader">AI</span>
        <span role="columnheader">Akcje</span>
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
                const assigneeSummary = displayAssignee(task);
                const source = sourceMeta(task);
                const ai = aiMeta(task);
                const SourceIcon = source.Icon;
                const canOpenSource = Boolean(task.sourceMeetingId && openMeetingHandler);

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
                        <input
                          type="checkbox"
                          className="todo-select-checkbox todo-row-checkbox"
                          aria-label={`Zaznacz zadanie: ${task.title}`}
                          checked={isSelected}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleTaskSelection(task.id)}
                        />
                      </div>

                      <span className="todo-title-cell">
                        <strong>{task.title}</strong>
                        <small className="todo-row-description">{displayDescription(task)}</small>
                      </span>

                      <span className="todo-status-cell">
                        <span className={`todo-status-badge ${statusTone(task)}`}>
                          {statusLabel(task, boardColumns)}
                        </span>
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
                        {assigneeSummary === 'Nieprzypisane' ? (
                          <span className="todo-assignee-avatar neutral" aria-hidden="true">
                            <CircleUserRound size={16} strokeWidth={2.1} />
                          </span>
                        ) : (
                          <span className="todo-assignee-avatar" aria-hidden="true">
                            {assigneeInitials(assigneeSummary) || '?'}
                          </span>
                        )}
                        <span>{assigneeSummary}</span>
                      </span>

                      <span className="todo-source-cell">
                        <button
                          type="button"
                          className={`todo-source-button ${source.tone}`}
                          disabled={!canOpenSource}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (canOpenSource && openMeetingHandler) {
                              openMeetingHandler(task.sourceMeetingId);
                            }
                          }}
                          aria-label={
                            canOpenSource
                              ? `Otwórz źródło zadania: ${source.label}`
                              : `Źródło zadania: ${source.label}`
                          }
                        >
                          <SourceIcon size={16} aria-hidden="true" />
                          {source.label}
                        </button>
                      </span>

                      <span className="todo-ai-cell">
                        <span className={`todo-ai-badge ${ai.tone}`}>{ai.label}</span>
                      </span>

                      <span className="todo-actions-cell">
                        <button
                          type="button"
                          className="todo-kebab-button"
                          aria-label={`Więcej akcji dla zadania ${task.title}`}
                          aria-expanded={openActionTaskId === task.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenActionTaskId(openActionTaskId === task.id ? '' : task.id);
                          }}
                        >
                          <MoreVertical size={18} aria-hidden="true" />
                        </button>
                        {openActionTaskId === task.id ? (
                          <div className="todo-row-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedTaskId(task.id);
                                setOpenActionTaskId('');
                              }}
                            >
                              Otwórz szczegóły
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedTaskId(task.id);
                                setOpenActionTaskId('');
                              }}
                            >
                              Edytuj
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(event) => {
                                event.stopPropagation();
                                onUpdateTask(task.id, { completed: !task.completed });
                                setOpenActionTaskId('');
                              }}
                            >
                              {task.completed ? 'Otwórz ponownie' : 'Oznacz jako gotowe'}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (
                                  typeof onDeleteTask === 'function' &&
                                  window.confirm('Usunąć to zadanie?')
                                ) {
                                  onDeleteTask(task.id);
                                }
                                setOpenActionTaskId('');
                              }}
                            >
                              Usuń
                            </button>
                          </div>
                        ) : null}
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
        </div>
        <div className="todo-table-pagination">
          <span>Pokaż na stronie</span>
          <button type="button" className="todo-page-size" aria-label="Pokaż 25 zadań na stronie">
            {pageSize}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <button type="button" className="todo-page-icon" aria-label="Poprzednia strona" disabled>
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
  onDeleteTask: PropTypes.func,
  onMoveTaskToColumn: PropTypes.func,
  peopleOptions: PropTypes.array,
  taskGroups: PropTypes.array,
  boardColumns: PropTypes.array,
  handleGroupDrop: PropTypes.func,
  handleTaskDrop: PropTypes.func,
  setDragTaskId: PropTypes.func,
  dragTaskId: PropTypes.string,
  allVisibleSelected: PropTypes.bool,
  someVisibleSelected: PropTypes.bool,
  onToggleAllVisibleTasks: PropTypes.func,
  onBulkStatusChange: PropTypes.func,
  onBulkAssignToMe: PropTypes.func,
  onBulkDelete: PropTypes.func,
  onOpenMeeting: PropTypes.func,
};

export default memo(TaskListView, (prevProps, nextProps) => {
  return (
    prevProps.groupedTasks === nextProps.groupedTasks &&
    prevProps.allTasks === nextProps.allTasks &&
    prevProps.groupBy === nextProps.groupBy &&
    prevProps.sortBy === nextProps.sortBy &&
    prevProps.dragTaskId === nextProps.dragTaskId &&
    prevProps.selectedTaskIds === nextProps.selectedTaskIds &&
    prevProps.selectedTask === nextProps.selectedTask &&
    prevProps.allVisibleSelected === nextProps.allVisibleSelected &&
    prevProps.someVisibleSelected === nextProps.someVisibleSelected
  );
});
