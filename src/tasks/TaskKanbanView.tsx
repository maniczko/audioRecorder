import { memo, useState, useEffect } from 'react';
import { getTaskDependencyDetails } from '../lib/tasks';
import { canDrop, formatListDueDate, handleCardKeyDown, writeDragTask } from './taskViewUtils';
import './TaskKanbanViewStyles.css';
import TagBadge from '../shared/TagBadge';

const COVER_COLORS = [
  { id: 'none', label: 'Brak', value: '' },
  { id: 'red', label: 'Czerwony', value: '#f17d72' },
  { id: 'pink', label: 'Rozowy', value: '#e879a0' },
  { id: 'orange', label: 'Pomaranczowy', value: '#f3a46e' },
  { id: 'yellow', label: 'Zolty', value: '#f3ca72' },
  { id: 'green', label: 'Zielony', value: '#67d59f' },
  { id: 'teal', label: 'Morski', value: '#34c5b5' },
  { id: 'blue', label: 'Niebieski', value: '#5a92ff' },
  { id: 'purple', label: 'Fioletowy', value: '#8a6bff' },
];

export { COVER_COLORS };

const TAG_PALETTE = [
  '#c11574',
  '#8b5cf6',
  '#0284c7',
  '#0891b2',
  '#059669',
  '#65a30d',
  '#d97706',
  '#dc2626',
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) & 0xffffffff;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

function avatarBg(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function SubtaskProgress({ subtasks }) {
  if (!subtasks?.length) {
    return null;
  }
  const done = subtasks.filter((s) => s.completed).length;
  const pct = Math.round((done / subtasks.length) * 100);
  return (
    <div className="kanban-subtask-progress">
      <div className="kanban-subtask-bar">
        <div className="kanban-subtask-fill" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {done}/{subtasks.length}
      </span>
    </div>
  );
}

function DropSlot({ placement, onDropTask, onDragEnter, label = 'Upusc tutaj zadanie' }) {
  const [isOver, setIsOver] = useState(false);
  return (
    <div
      className={`todo-kanban-drop-slot${isOver ? ' active' : ''}`}
      aria-label={label}
      onDragOver={(e) => {
        canDrop(e);
        if (!isOver) setIsOver(true);
      }}
      onDragEnter={(e) => {
        onDragEnter?.(e);
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        setIsOver(false);
        onDropTask(placement, event, 'Zmieniono kolejnosc zadania w kolumnie.');
      }}
    />
  );
}

function QuickAddInput({ columnId, onAdd, onCancel }) {
  const [value, setValue] = useState('');

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (value.trim()) {
        onAdd(columnId, value.trim());
      }
    }
    if (event.key === 'Escape') {
      onCancel();
    }
  }

  return (
    <div className="kanban-quick-add-input">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tytul zadania, Enter aby dodac..."
      />
      <div className="kanban-quick-add-actions">
        <button
          type="button"
          className="todo-command-button primary"
          onClick={() => value.trim() && onAdd(columnId, value.trim())}
        >
          Dodaj
        </button>
        <button type="button" className="todo-command-button" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

function KanbanCard({
  task,
  index,
  columnTasks,
  columnId,
  isActive,
  isSelected,
  toggleTaskSelection,
  setSelectedTaskId,
  setDragTaskId,
  dragTaskId,
  onUpdateTask,
  onMoveTaskToColumn,
  onDropTask,
  onDragEnter,
  boardColumns,
  allTasks,
}) {
  const dependencyState = getTaskDependencyDetails(task, allTasks);
  const subtasks = task.subtasks || [];
  const assignees = task.assignedTo?.length ? task.assignedTo : task.owner ? [task.owner] : [];
  const tags = task.tags || [];

  return (
    <div className="todo-kanban-card-shell">
      <article
        role="button"
        tabIndex={0}
        draggable
        className={`todo-kanban-card${isActive ? ' active' : ''}${task.completed ? ' completed' : ''}${dragTaskId === task.id ? ' dragging' : ''}`}
        data-selected={isSelected}
        title="Kliknij aby otworzyc szczegoly. Zlap i przeciagnij, aby zmienic kolumne."
        onDragStart={(event) => {
          setDragTaskId(task.id);
          writeDragTask(event, task.id);
        }}
        onDragEnd={() => {
          setDragTaskId('');
        }}
        onClick={(event) => {
          // Zapobiegamy otwarciu jesli to byl koniec drag'n'drop (klikanie jest przechwytywane inaczej na dnd, ale upewniamy sie)
          event.stopPropagation();
          setSelectedTaskId(task.id);
        }}
        onKeyDown={(event) => handleCardKeyDown(event, () => setSelectedTaskId(task.id))}
      >
        {task.coverColor ? (
          <div className="kanban-cover-bar" style={{ backgroundColor: task.coverColor }} />
        ) : null}

        <div className="todo-kanban-card-top">
          <div className="kanban-drag-handle" title="Przeciagnij aby przeniesc">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8" cy="6" r="2" />
              <circle cx="12" cy="6" r="2" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="8" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="16" cy="12" r="2" />
              <circle cx="8" cy="18" r="2" />
              <circle cx="12" cy="18" r="2" />
              <circle cx="16" cy="18" r="2" />
            </svg>
          </div>
          <div className="todo-kanban-title">
            <button
              type="button"
              className={`todo-task-circle${task.completed ? ' completed' : ''}`}
              aria-label={task.completed ? 'Otworz ponownie' : 'Zakoncz zadanie'}
              onClick={(event) => {
                event.stopPropagation();
                onUpdateTask(task.id, { completed: !task.completed });
              }}
            />
            <strong className="kanban-card-title">{task.title}</strong>
          </div>
          <button
            type="button"
            className={`todo-star inline${task.important ? ' active' : ''}`}
            aria-label={task.important ? 'Usun waznosc' : 'Oznacz jako wazne'}
            onClick={(event) => {
              event.stopPropagation();
              onUpdateTask(task.id, { important: !task.important });
            }}
          >
            ★
          </button>
        </div>

        {task.description ? (
          <p className="kanban-card-description">
            {task.description.length > 80 ? task.description.slice(0, 80) + '…' : task.description}
          </p>
        ) : null}

        {tags.length > 0 ? (
          <div className="kanban-label-chips">
            {tags.slice(0, 4).map((tag) => (
              <TagBadge key={`${task.id}-${tag}`} tag={tag} />
            ))}
            {tags.length > 4 ? (
              <span className="kanban-label-chip overflow">+{tags.length - 4}</span>
            ) : null}
          </div>
        ) : null}

        <SubtaskProgress subtasks={subtasks} />

        <div className="kanban-card-meta">
          {assignees.length > 0 ? (
            <div className="kanban-avatar-row">
              {assignees.slice(0, 3).map((name) => (
                <span
                  key={name}
                  className="kanban-avatar"
                  style={{ backgroundColor: avatarBg(name) }}
                  title={name}
                >
                  {initials(name)}
                </span>
              ))}
              {assignees.length > 3 ? (
                <span className="kanban-avatar overflow">+{assignees.length - 3}</span>
              ) : null}
            </div>
          ) : null}

          <div className="kanban-card-flags">
            {task.dueDate ? (
              <span className="kanban-due-date">{formatListDueDate(task.dueDate)}</span>
            ) : null}
            {task.recurrence ? (
              <span className="kanban-flag-icon" title="Cykliczne">
                ↻
              </span>
            ) : null}
            {task.reminderAt ? (
              <span className="kanban-flag-icon" title="Przypomnienie">
                ⏰
              </span>
            ) : null}
            {(task.comments?.length || 0) > 0 ? (
              <span className="kanban-flag-icon" title={`${task.comments.length} komentarzy`}>
                💬
              </span>
            ) : null}
            {dependencyState.blocking ? (
              <span className="kanban-flag-icon tone-warning" title="Blokowane">
                ⛔
              </span>
            ) : null}
          </div>
        </div>
      </article>

      <DropSlot
        placement={{
          status: columnId,
          previousTaskId: task.id,
          nextTaskId: columnTasks[index + 1]?.id || '',
        }}
        onDropTask={onDropTask}
        onDragEnter={onDragEnter}
        label={`Upusc po zadaniu ${task.title}`}
      />
    </div>
  );
}

function buildSwimlanes(tasks, kanbanColumns, swimlaneGroupBy) {
  const laneMap = new Map<string, { id: string; label: string; tasks: any[] }>();

  tasks.forEach((task) => {
    let keys: string[] = [];

    if (swimlaneGroupBy === 'person') {
      const people = task.assignedTo?.length
        ? task.assignedTo
        : task.owner
          ? [task.owner]
          : ['Nieprzypisane'];
      keys = people;
    } else if (swimlaneGroupBy === 'priority') {
      const labelMap = { urgent: 'Krytyczny', high: 'Wysoki', medium: 'Sredni', low: 'Niski' };
      keys = [labelMap[task.priority] || 'Sredni'];
    } else if (swimlaneGroupBy === 'label') {
      keys = task.tags?.length ? task.tags : ['Bez etykiety'];
    } else if (swimlaneGroupBy === 'due') {
      const now = Date.now();
      const day = 86400000;
      if (!task.dueDate) {
        keys = ['Bez terminu'];
      } else {
        const t = new Date(task.dueDate).getTime();
        if (t < now) {
          keys = ['Po terminie'];
        } else if (t < now + 7 * day) {
          keys = ['Ten tydzien'];
        } else if (t < now + 14 * day) {
          keys = ['Przyszly tydzien'];
        } else {
          keys = ['Pozniej'];
        }
      }
    }

    keys.forEach((key) => {
      if (!laneMap.has(key)) {
        laneMap.set(key, { id: key, label: key, tasks: [] });
      }
      laneMap.get(key)!.tasks.push(task);
    });
  });

  return [...laneMap.values()].map((lane) => ({
    ...lane,
    columns: kanbanColumns.map((col) => ({
      ...col,
      tasks: lane.tasks.filter((t) => t.status === col.id),
    })),
  }));
}

function ColumnBody({
  column,
  tasks,
  dropColumnId,
  setDropColumnId,
  handleDrop,
  handleTaskDrop,
  selectedTask,
  selectedTaskIds,
  toggleTaskSelection,
  setSelectedTaskId,
  setDragTaskId,
  dragTaskId,
  onUpdateTask,
  onMoveTaskToColumn,
  boardColumns,
  allTasks,
  quickAddColumnId,
  setQuickAddColumnId,
  onQuickAddToColumn,
}) {
  return (
    <div
      className="todo-kanban-body"
      onDragOver={canDrop}
      onDragEnter={() => setDropColumnId(column.id)}
      onDrop={(event) => handleDrop(column.id, event)}
    >
      {tasks.length ? (
        <>
          <DropSlot
            placement={{ status: column.id, nextTaskId: tasks[0]?.id || '' }}
            onDropTask={handleTaskDrop}
            onDragEnter={() => setDropColumnId(column.id)}
            label={`Upusc na poczatku kolumny ${column.label}`}
          />
          {tasks.map((task, index) => (
            <KanbanCard
              key={task.id}
              task={task}
              index={index}
              columnTasks={tasks}
              columnId={column.id}
              isActive={selectedTask?.id === task.id}
              isSelected={selectedTaskIds.includes(task.id)}
              toggleTaskSelection={toggleTaskSelection}
              setSelectedTaskId={setSelectedTaskId}
              setDragTaskId={(id) => {
                setDragTaskId(id);
                if (!id) {
                  setDropColumnId('');
                }
              }}
              dragTaskId={dragTaskId}
              onUpdateTask={onUpdateTask}
              onMoveTaskToColumn={onMoveTaskToColumn}
              onDropTask={handleTaskDrop}
              onDragEnter={() => setDropColumnId(column.id)}
              boardColumns={boardColumns}
              allTasks={allTasks}
            />
          ))}
        </>
      ) : (
        <div className="todo-empty">Przeciagnij tu zadanie.</div>
      )}

      {quickAddColumnId === column.id ? (
        <QuickAddInput
          columnId={column.id}
          onAdd={(colId, title) => {
            onQuickAddToColumn?.(colId, title);
            setQuickAddColumnId('');
          }}
          onCancel={() => setQuickAddColumnId('')}
        />
      ) : (
        <button
          type="button"
          className="kanban-col-add-btn"
          onClick={() => setQuickAddColumnId(column.id)}
        >
          + Dodaj zadanie
        </button>
      )}
    </div>
  );
}

function TaskKanbanView({
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
  dragTaskId,
  onUpdateTask,
  onMoveTaskToColumn,
  swimlaneGroupBy = 'none',
  onQuickAddToColumn,
  onReorderColumns,
  sortBy = 'manual',
  setSortBy = (value: string) => {},
}) {
  const [quickAddColumnId, setQuickAddColumnId] = useState('');
  const [dragHeaderId, setDragHeaderId] = useState('');

  // UX Fix #5: Escape key cancels drag
  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape' && dragTaskId) {
        setDragTaskId('');
        setDropColumnId('');
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [dragTaskId, setDragTaskId, setDropColumnId]);

  const swimlanes =
    swimlaneGroupBy && swimlaneGroupBy !== 'none'
      ? buildSwimlanes(allTasks, kanbanColumns, swimlaneGroupBy)
      : null;

  function handleHeaderDragStart(event, columnId) {
    event.dataTransfer.setData('text/plain', `header:${columnId}`);
    setDragHeaderId(columnId);
  }

  function handleHeaderDrop(event, targetColumnId) {
    event.preventDefault();
    const data = event.dataTransfer.getData('text/plain');
    if (data.startsWith('header:') && typeof onReorderColumns === 'function') {
      const fromId = data.slice('header:'.length);
      if (fromId !== targetColumnId) {
        onReorderColumns(fromId, targetColumnId);
      }
    }
    setDragHeaderId('');
  }

  const sharedBodyProps = {
    dropColumnId,
    setDropColumnId,
    handleDrop,
    handleTaskDrop,
    selectedTask,
    selectedTaskIds,
    toggleTaskSelection,
    setSelectedTaskId,
    setDragTaskId,
    dragTaskId,
    onUpdateTask,
    onMoveTaskToColumn,
    boardColumns: kanbanColumns,
    allTasks,
    quickAddColumnId,
    setQuickAddColumnId,
    onQuickAddToColumn,
  };

  if (swimlanes?.length) {
    return (
      <div className="todo-kanban todo-kanban-swimlane">
        <div className="swimlane-header-row">
          <div className="swimlane-lane-cell swimlane-lane-header-spacer" />
          {kanbanColumns.map((col, index) => {
            const wipExceeded =
              col.wipLimit && allTasks.filter((t) => t.status === col.id).length >= col.wipLimit;
            const count = allTasks.filter((t) => t.status === col.id).length;
            return (
              <div
                key={col.id}
                className={`swimlane-col-header${dragHeaderId === col.id ? ' dragging' : ''}${wipExceeded ? ' wip-exceeded' : ''}`}
                style={{ '--column-color': col.color } as React.CSSProperties}
                draggable={typeof onReorderColumns === 'function'}
                onDragStart={(e) => handleHeaderDragStart(e, col.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleHeaderDrop(e, col.id)}
                title={
                  typeof onReorderColumns === 'function'
                    ? 'Przeciagnij aby zmienic kolejnosc'
                    : undefined
                }
              >
                <strong>{col.label}</strong>
                <span className={`wip-count${wipExceeded ? ' exceeded' : ''}`}>
                  {count}
                  {col.wipLimit ? `/${col.wipLimit}` : ''}
                </span>
                {index === 0 && (
                  <select
                    className="kanban-col-sort"
                    value={sortBy}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSortBy((e.target as HTMLSelectElement).value);
                    }}
                    title="Sortuj karty"
                  >
                    <option value="manual">Ręcznie</option>
                    <option value="updated">Ostatnio zmienione</option>
                    <option value="due">Termin</option>
                    <option value="priority">Priorytet</option>
                    <option value="title">Tytuł</option>
                    <option value="owner">Osoba</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>

        {swimlanes.map((lane) => (
          <div key={lane.id} className="swimlane-row">
            <div className="swimlane-lane-cell">
              <strong>{lane.label}</strong>
              <small>{lane.tasks.length}</small>
            </div>
            <div className="swimlane-cols">
              {lane.columns.map((col) => (
                <div
                  key={col.id}
                  className={`swimlane-col${dropColumnId === col.id ? ' drop' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragTaskId && dropColumnId !== col.id) {
                      setDropColumnId(col.id);
                    }
                  }}
                >
                  <ColumnBody column={col} tasks={col.tasks} {...sharedBodyProps} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="todo-kanban">
      {kanbanColumns.map((column, index) => {
        const wipExceeded = column.wipLimit && column.tasks.length >= column.wipLimit;
        return (
          <section
            key={column.id}
            data-testid={`column-${column.id}`}
            className={`todo-kanban-column${dropColumnId === column.id ? ' drop' : ''}${wipExceeded ? ' wip-exceeded' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragTaskId && dropColumnId !== column.id) {
                setDropColumnId(column.id);
              }
            }}
          >
            <header
              className="todo-kanban-header"
              style={{ '--column-color': column.color } as React.CSSProperties}
              draggable={typeof onReorderColumns === 'function'}
              onDragStart={(e) => handleHeaderDragStart(e, column.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleHeaderDrop(e, column.id)}
              title={
                typeof onReorderColumns === 'function'
                  ? 'Przeciagnij aby zmienic kolejnosc'
                  : undefined
              }
            >
              <strong>{column.label}</strong>
              <span className={`wip-count${wipExceeded ? ' exceeded' : ''}`}>
                {column.tasks.length}
                {column.wipLimit ? `/${column.wipLimit}` : ''}
              </span>
              {index === 0 && (
                <select
                  className="kanban-col-sort"
                  value={sortBy}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSortBy((e.target as HTMLSelectElement).value);
                  }}
                  title="Sortuj karty"
                >
                  <option value="manual">Ręcznie</option>
                  <option value="updated">Ostatnio zmienione</option>
                  <option value="due">Termin</option>
                  <option value="priority">Priorytet</option>
                  <option value="title">Tytuł</option>
                  <option value="owner">Osoba</option>
                </select>
              )}
            </header>
            <ColumnBody column={column} tasks={column.tasks} {...sharedBodyProps} />
          </section>
        );
      })}
    </div>
  );
}

export default memo(TaskKanbanView, (prevProps, nextProps) => {
  // Only re-render if core props, selections, drag-and-drop state, or sorting configurations change
  return (
    prevProps.kanbanColumns === nextProps.kanbanColumns &&
    prevProps.selectedTaskIds === nextProps.selectedTaskIds &&
    prevProps.selectedTask === nextProps.selectedTask &&
    prevProps.dropColumnId === nextProps.dropColumnId &&
    prevProps.dragTaskId === nextProps.dragTaskId &&
    prevProps.swimlaneGroupBy === nextProps.swimlaneGroupBy &&
    prevProps.sortBy === nextProps.sortBy
  );
});
