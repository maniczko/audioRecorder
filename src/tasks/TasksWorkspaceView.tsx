import { lazy, memo, Suspense, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Columns3,
  Filter,
  KanbanSquare,
  LayoutList,
  Mic2,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { VoiceBobrEmptyState } from '../components/brand/VoiceBobrBrand';
import TaskCreateModal from './TaskCreateModal';
import TaskScheduleView from './TaskScheduleView';
import './TasksWorkspaceViewStyles.css';

const TaskKanbanView = lazy(() => import('./TaskKanbanView'));
const TaskListView = lazy(() => import('./TaskListView'));
const TaskChartsView = lazy(() => import('./TaskChartsView'));

function statCards(stats, visibleStats) {
  return [
    { id: 'open', label: 'Otwarte', value: visibleStats.open, tone: 'neutral' },
    { id: 'today', label: 'Na dzisiaj', value: visibleStats.dueToday, tone: 'info' },
    { id: 'week', label: 'Ten tydzień', value: visibleStats.dueThisWeek, tone: 'info' },
    { id: 'overdue', label: 'Po terminie', value: visibleStats.overdue, tone: 'danger' },
    { id: 'blocked', label: 'Zależne', value: visibleStats.blocked, tone: 'warning' },
    { id: 'progress', label: 'Ukończone', value: `${stats.progress}%`, tone: 'success' },
  ];
}

function TasksWorkspaceView(props: any) {
  const {
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    groupBy,
    setGroupBy,
    submitQuickTask,
    quickDraft,
    showAdvancedCreate,
    setShowAdvancedCreate,
    peopleOptions,
    taskGroups,
    boardColumns,
    query,
    setQuery,
    tagOptions,
    searchInputRef,
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
    onCreateFromRecording,
  } = props;
  const isCharts = viewMode === 'charts';
  const isSchedule = viewMode === 'schedule';
  const isKanban = viewMode === 'kanban';
  const isSummary = viewMode === 'summary';
  const [localCreateOpen, setLocalCreateOpen] = useState(false);
  const isCreateOpen = Boolean(showAdvancedCreate || localCreateOpen);

  const openCreateModal = () => {
    setSelectedTaskId?.('');
    setLocalCreateOpen(true);
    setShowAdvancedCreate(true);
  };

  const closeCreateModal = () => {
    setLocalCreateOpen(false);
    setShowAdvancedCreate(false);
  };

  const renderEmptyTasks = () => (
    <div className="todo-empty-workbench todo-empty-workbench--microsoft">
      <VoiceBobrEmptyState
        context="tasks"
        title="Brak zadań na dziś"
        message="Dodaj pierwsze zadanie ręcznie albo utwórz je z nagrania, notatki lub transkrypcji."
        action={
          <div className="todo-empty-actions" aria-label="Szybkie akcje pustej listy">
            <button type="button" className="todo-empty-primary" onClick={openCreateModal}>
              + Dodaj zadanie
            </button>
            <button type="button" className="todo-empty-secondary" onClick={onCreateFromRecording}>
              <Mic2 size={16} aria-hidden="true" />
              Utwórz z nagrania
            </button>
          </div>
        }
      />
    </div>
  );

  const showTaskToolbar = !isCharts && !isSchedule && !isSummary;

  return (
    <section className="todo-main">
      <div className="todo-shell" data-clarity-mask="true">
        <section className={isSummary ? 'todo-toolbar-panel summary' : 'todo-toolbar-panel'}>
          <div className="todo-workspace-topline">
            <div className="todo-page-title">
              <h1>Zadania</h1>
              <p>Zarządzaj zadaniami z nagrań, notatek i spotkań.</p>
            </div>
          </div>

          <div className="todo-primary-toolbar">
            {showTaskToolbar ? (
              <button
                type="button"
                className="todo-add-inline-trigger"
                onClick={openCreateModal}
                aria-expanded={isCreateOpen}
              >
                <Plus size={18} aria-hidden="true" />
                <span>Dodaj zadanie</span>
                <kbd>N</kbd>
              </button>
            ) : null}
            {showTaskToolbar ? (
              <div className="todo-toolbar-search">
                <Search className="todo-toolbar-search-icon" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Szukaj zadań..."
                  className="todo-toolbar-input"
                />
              </div>
            ) : null}
            <div className="todo-workspace-actions" aria-label="Akcje widoku zadań">
              <button type="button" className="todo-command-button">
                <Filter size={17} aria-hidden="true" />
                Filtry
              </button>
              <button
                type="button"
                className="todo-command-button"
                onClick={() => setGroupBy?.(groupBy === 'none' ? 'status' : 'none')}
              >
                <Columns3 size={17} aria-hidden="true" />
                Kolumny
              </button>
            </div>
          </div>

          <div className="todo-commandbar">
            <div className="todo-commandbar-left">
              <div className="todo-view-switch" role="tablist" aria-label="Widok zadań">
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'list'}
                  className={viewMode === 'list' ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('list')}
                >
                  <LayoutList size={17} aria-hidden="true" />
                  Lista
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isKanban}
                  className={isKanban ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('kanban')}
                >
                  <KanbanSquare size={17} aria-hidden="true" />
                  Kanban
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSchedule}
                  className={isSchedule ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('schedule')}
                >
                  <CalendarDays size={17} aria-hidden="true" />
                  Harmonogram
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isCharts}
                  className={isCharts ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('charts')}
                >
                  <BarChart3 size={17} aria-hidden="true" />
                  Wykresy
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isSummary}
                  className={isSummary ? 'todo-view-button active' : 'todo-view-button'}
                  onClick={() => setViewMode('summary')}
                >
                  <Sparkles size={17} aria-hidden="true" />
                  Podsumowanie
                </button>
              </div>
            </div>
          </div>
        </section>

        {showTaskToolbar ? (
          <TaskCreateModal
            isOpen={isCreateOpen}
            initialDraft={quickDraft}
            boardColumns={boardColumns}
            peopleOptions={peopleOptions}
            tagOptions={tagOptions}
            onClose={closeCreateModal}
            onSubmit={(draft) => {
              submitQuickTask(null, draft);
            }}
          />
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
            <Suspense fallback={<div className="todo-loading">Ładowanie listy zadań...</div>}>
              {allVisibleTasks.length === 0 ? (
                renderEmptyTasks()
              ) : (
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
              )}
            </Suspense>
          ) : (
            <Suspense fallback={<div className="todo-loading">Ładowanie kanbanu zadań...</div>}>
              {allVisibleTasks.length === 0 ? (
                renderEmptyTasks()
              ) : (
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
              )}
            </Suspense>
          )}
        </section>
      </div>
    </section>
  );
}

export default memo(TasksWorkspaceView);
