import { Suspense, lazy, memo, useState } from 'react';
import { Search, Plus, Settings } from 'lucide-react';
import { TASK_PRIORITIES } from '../lib/tasks';
import TaskScheduleView from './TaskScheduleView';
import TagInput from '../shared/TagInput';
import './TasksWorkspaceViewStyles.css';

const TaskKanbanView = lazy(() => import('./TaskKanbanView'));
const TaskListView = lazy(() => import('./TaskListView'));
const TaskChartsView = lazy(() => import('./TaskChartsView'));

function statCards(stats, visibleStats) {
  return [
    { id: 'open', label: 'Otwarte', value: visibleStats.open, tone: 'neutral' },
    { id: 'today', label: 'Na dzisiaj', value: visibleStats.dueToday, tone: 'info' },
    { id: 'week', label: 'Ten tydzien', value: visibleStats.dueThisWeek, tone: 'info' },
    { id: 'overdue', label: 'Po terminie', value: visibleStats.overdue, tone: 'danger' },
    { id: 'blocked', label: 'Zalezne', value: visibleStats.blocked, tone: 'warning' },
    { id: 'progress', label: 'Ukonczone', value: `${stats.progress}%`, tone: 'success' },
  ];
}

function SettingsDropdown({
  onExportCsv,
  shareWorkspace,
  showColumnManager,
  setShowColumnManager,
  children = null,
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="todo-settings-dropdown-wrap" style={{ position: 'relative' }}>
      <button
        type="button"
        className="flex items-center justify-center w-9 h-9 border-none bg-transparent hover:bg-white/10 text-slate-400 hover:text-slate-200 rounded-full cursor-pointer transition-colors"
        onClick={() => setOpen((v) => !v)}
        title="Ustawienia"
        aria-label="Ustawienia widoku"
      >
        <Settings className="w-5 h-5" />
      </button>
      {open && (
        <div className="todo-settings-dropdown" onBlur={() => setOpen(false)}>
          {typeof onExportCsv === 'function' && (
            <button
              type="button"
              className="todo-settings-item"
              onClick={() => {
                onExportCsv();
                setOpen(false);
              }}
            >
              Eksport CSV
            </button>
          )}
          <button
            type="button"
            className="todo-settings-item"
            onClick={() => {
              shareWorkspace();
              setOpen(false);
            }}
          >
            Udostepnij workspace
          </button>
          <button
            type="button"
            className="todo-settings-item"
            onClick={() => {
              setShowColumnManager((p) => !p);
              setOpen(false);
            }}
          >
            {showColumnManager ? 'Ukryj konfigurację kolumn' : 'Konfiguracja kolumn'}
          </button>
          {children}
        </div>
      )}
    </div>
  );
}

function TasksWorkspaceView({
  selectedListLabel,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  groupBy,
  setGroupBy,
  shareWorkspace,
  onExportCsv,
  submitQuickTask,
  quickDraft,
  setQuickDraft,
  showAdvancedCreate,
  setShowAdvancedCreate,
  peopleOptions,
  taskGroups,
  boardColumns,
  query,
  setQuery,
  ownerFilter,
  setOwnerFilter,
  tagFilter,
  setTagFilter,
  tagOptions,
  quickAddInputRef,
  searchInputRef,
  message,
  groupedTasks,
  allVisibleTasks,
  selectedTask,
  setSelectedTaskId,
  onUpdateTask,
  onMoveTaskToColumn,
  kanbanColumns,
  dropColumnId,
  setDropColumnId,
  handleDrop,
  handleGroupDrop,
  handleTaskDrop,
  setDragTaskId,
  dragTaskId,
  onQuickAddToColumn,
  onReorderColumns,
  stats,
  visibleStats,
  selectedTaskIds,
  toggleTaskSelection,
  taskNotifications,
  showColumnManager,
  setShowColumnManager,
}) {
  const isCharts = viewMode === 'charts';
  const isSchedule = viewMode === 'schedule';
  const isKanban = viewMode === 'kanban';
  const isSummary = viewMode === 'summary';

  return (
    <section className="todo-main">
      <div className="todo-shell">
        <section className={isSummary ? 'todo-toolbar-panel summary' : 'todo-toolbar-panel'}>
          <div className="todo-commandbar">
            <div className="todo-commandbar-left">
              <div className="todo-view-switch" role="tablist" aria-label="Widok zadan">
                <button
                  type="button"
                  className={isKanban ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('kanban')}
                >
                  Kanban
                </button>
                <button
                  type="button"
                  className={viewMode === 'list' ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('list')}
                >
                  Lista
                </button>
                <button
                  type="button"
                  className={isCharts ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('charts')}
                >
                  Wykresy
                </button>
                <button
                  type="button"
                  className={isSchedule ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('schedule')}
                >
                  Harmonogram
                </button>
                <button
                  type="button"
                  className={isSummary ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('summary')}
                >
                  Podsumowanie
                </button>
              </div>
            </div>

            <div className="todo-commandbar-right flex-wrap">
              {!isCharts && !isSchedule && !isSummary ? (
                <div className="relative flex-1 min-w-[200px] max-w-[320px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Szukaj w zadaniach..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/50 rounded-full text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                  />
                </div>
              ) : null}

              <div className="relative flex-1 min-w-[220px] max-w-[320px]">
                <input
                  ref={quickAddInputRef}
                  value={quickDraft.title}
                  onChange={(event) =>
                    setQuickDraft((previous) => ({ ...previous, title: event.target.value }))
                  }
                  placeholder="Dodaj zadanie (N)..."
                  className="w-full pl-4 pr-10 py-2 bg-slate-800 border border-slate-700/80 rounded-full text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitQuickTask(e);
                    }
                  }}
                />
                <button
                  type="button"
                  className="absolute right-1 top-1 bottom-1 aspect-square flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer"
                  onClick={submitQuickTask}
                  disabled={!quickDraft.title.trim()}
                  title="Dodaj zadanie (Enter)"
                >
                  <Plus className="w-[18px] h-[18px]" />
                </button>
              </div>

              <SettingsDropdown
                onExportCsv={onExportCsv}
                shareWorkspace={shareWorkspace}
                showColumnManager={showColumnManager}
                setShowColumnManager={setShowColumnManager}
              />
            </div>
          </div>
        </section>

        {/* Advanced create options - shown below toolbar when expanded */}
        {showAdvancedCreate && !isCharts && !isSchedule && !isSummary ? (
          <section className="todo-create-card todo-create-advanced">
            <div className="todo-add-advanced">
              <label style={{ overflow: 'visible' }}>
                <span>Osoba</span>
                <TagInput
                  tags={quickDraft.owner ? [quickDraft.owner] : []}
                  suggestions={peopleOptions}
                  onChange={(arr) =>
                    setQuickDraft((previous) => ({ ...previous, owner: arr[0] || '' }))
                  }
                  placeholder="Wpisz lub wybierz osobę..."
                />
              </label>
              <label>
                <span>Grupa</span>
                <input
                  list="task-groups"
                  value={quickDraft.group}
                  onChange={(event) =>
                    setQuickDraft((previous) => ({ ...previous, group: event.target.value }))
                  }
                  placeholder="np. Sprint 14"
                />
              </label>
              <label>
                <span>Termin</span>
                <input
                  type="datetime-local"
                  value={quickDraft.dueDate}
                  onChange={(event) =>
                    setQuickDraft((previous) => ({ ...previous, dueDate: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Przypomnienie</span>
                <input
                  type="datetime-local"
                  value={quickDraft.reminderAt}
                  onChange={(event) =>
                    setQuickDraft((previous) => ({ ...previous, reminderAt: event.target.value }))
                  }
                />
              </label>
              <label>
                <span>Priorytet</span>
                <select
                  value={quickDraft.priority}
                  onChange={(event) =>
                    setQuickDraft((previous) => ({ ...previous, priority: event.target.value }))
                  }
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority.id} value={priority.id}>
                      {priority.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  value={quickDraft.status}
                  onChange={(event) =>
                    setQuickDraft((previous) => ({ ...previous, status: event.target.value }))
                  }
                >
                  {boardColumns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tagi</span>
                <div style={{ flex: 1 }}>
                  <TagInput
                    tags={(quickDraft.tags || '')
                      .split(',')
                      .map((t: string) => t.trim())
                      .filter(Boolean)}
                    suggestions={tagOptions}
                    onChange={(newTags: string[]) =>
                      setQuickDraft((p: any) => ({ ...p, tags: newTags.join(', ') }))
                    }
                    placeholder="Dodaj tag..."
                  />
                </div>
              </label>
              <label className="todo-inline-check">
                <input
                  type="checkbox"
                  checked={quickDraft.important}
                  onChange={(event) =>
                    setQuickDraft((previous) => ({ ...previous, important: event.target.checked }))
                  }
                />
                <span>Wazne</span>
              </label>
            </div>
          </section>
        ) : null}

        <datalist id="task-groups">
          {taskGroups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>

        <section className="todo-view-panel">
          {isSummary ? (
            <div className="todo-summary-view">
              <div className="todo-stats-strip">
                {statCards(stats, visibleStats).map((item) => (
                  <article key={item.id} className={`todo-stat-card ${item.tone}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>
          ) : isCharts ? (
            <Suspense fallback={<div className="todo-loading">Ładowanie wykresów...</div>}>
              <TaskChartsView tasks={allVisibleTasks} boardColumns={boardColumns} />
            </Suspense>
          ) : isSchedule ? (
            <TaskScheduleView
              tasks={allVisibleTasks}
              selectedTask={selectedTask}
              onSelectTask={setSelectedTaskId}
              onUpdateTask={onUpdateTask}
            />
          ) : viewMode === 'list' ? (
            <Suspense fallback={<div className="todo-loading">Ladowanie listy zadan...</div>}>
              <TaskListView
                groupedTasks={groupedTasks}
                allTasks={allVisibleTasks}
                groupBy={groupBy}
                sortBy={sortBy}
                setSortBy={setSortBy}
                selectedTask={selectedTask}
                selectedTaskIds={selectedTaskIds}
                toggleTaskSelection={toggleTaskSelection}
                setSelectedTaskId={setSelectedTaskId}
                onUpdateTask={onUpdateTask}
                onMoveTaskToColumn={onMoveTaskToColumn}
                peopleOptions={peopleOptions}
                taskGroups={taskGroups}
                boardColumns={boardColumns}
                handleGroupDrop={handleGroupDrop}
                handleTaskDrop={handleTaskDrop}
                setDragTaskId={setDragTaskId}
                dragTaskId={dragTaskId}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<div className="todo-loading">Ladowanie kanbanu zadan...</div>}>
              <TaskKanbanView
                kanbanColumns={kanbanColumns}
                allTasks={allVisibleTasks}
                dropColumnId={dropColumnId}
                setDropColumnId={setDropColumnId}
                handleDrop={handleDrop}
                handleTaskDrop={handleTaskDrop}
                selectedTask={selectedTask}
                selectedTaskIds={selectedTaskIds}
                toggleTaskSelection={toggleTaskSelection}
                setSelectedTaskId={setSelectedTaskId}
                setDragTaskId={setDragTaskId}
                dragTaskId={dragTaskId}
                onUpdateTask={onUpdateTask}
                onMoveTaskToColumn={onMoveTaskToColumn}
                onQuickAddToColumn={onQuickAddToColumn}
                onReorderColumns={onReorderColumns}
                sortBy={sortBy}
                setSortBy={setSortBy}
              />
            </Suspense>
          )}
        </section>
      </div>
    </section>
  );
}

export default memo(TasksWorkspaceView);
