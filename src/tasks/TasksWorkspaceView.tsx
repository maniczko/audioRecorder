import { lazy, memo, Suspense, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  CircleDashed,
  Columns3,
  Filter,
  KanbanSquare,
  LayoutList,
  Mic2,
  Plus,
  Search,
  Sparkles,
  UserRound,
  X,
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
    {
      id: 'all',
      label: 'Wszystkie',
      value: stats.all ?? visibleStats.all ?? 0,
      tone: 'mint',
      Icon: CalendarCheck2,
    },
    {
      id: 'todo',
      label: 'Do zrobienia',
      value:
        stats.byStatus?.todo ?? visibleStats.byStatus?.todo ?? stats.open ?? visibleStats.open ?? 0,
      tone: 'blue',
      Icon: CircleDashed,
    },
    {
      id: 'overdue',
      label: 'Po terminie',
      value: stats.overdue ?? visibleStats.overdue ?? 0,
      tone: 'danger',
      Icon: AlertCircle,
    },
    {
      id: 'ai',
      label: 'AI do potwierdzenia',
      value: stats.waiting ?? visibleStats.waiting ?? 0,
      tone: 'purple',
      Icon: Sparkles,
    },
    {
      id: 'unassigned',
      label: 'Nieprzypisane',
      value: stats.unassigned ?? visibleStats.unassigned ?? 0,
      tone: 'neutral',
      Icon: UserRound,
    },
  ];
}

function aiReviewCount(stats, visibleStats) {
  return Number(stats.waiting ?? visibleStats.waiting ?? 0);
}

function taskPlural(count: number) {
  if (count === 1) return 'zadanie';
  if (count >= 2 && count <= 4) return 'zadania';
  return 'zadań';
}

function taskVerb(count: number) {
  return count === 1 ? 'wymaga' : 'wymagają';
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
    activeFilterCount = 0,
    allVisibleSelected = false,
    someVisibleSelected = false,
    onToggleAllVisibleTasks,
    onBulkStatusChange,
    onBulkAssignToMe,
    onBulkDelete,
    onDeleteTask,
    onOpenMeeting,
    onCreateFromRecording,
    ownerFilter = 'all',
    setOwnerFilter = () => undefined,
    currentUserName = '',
  } = props;
  const isCharts = viewMode === 'charts';
  const isSchedule = viewMode === 'schedule';
  const isKanban = viewMode === 'kanban';
  const isSummary = viewMode === 'summary';
  const [localCreateOpen, setLocalCreateOpen] = useState(false);
  const [showAiReviewBanner, setShowAiReviewBanner] = useState(true);
  const isCreateOpen = Boolean(showAdvancedCreate || localCreateOpen);
  const pendingAiCount = aiReviewCount(stats, visibleStats);
  const hasPendingAiTasks = pendingAiCount > 0;
  const onlyMineActive = ownerFilter === 'me';

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

          <div
            className="todo-stats-strip todo-stats-strip--overview"
            aria-label="Podsumowanie zadań"
          >
            {statCards(stats, visibleStats).map((item) => {
              const Icon = item.Icon;
              return (
                <article key={item.id} className={`todo-stat-card ${item.tone}`}>
                  <span className="todo-stat-icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={2.1} />
                  </span>
                  <span className="todo-stat-copy">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </span>
                </article>
              );
            })}
          </div>

          {showTaskToolbar && showAiReviewBanner && hasPendingAiTasks ? (
            <div className="todo-ai-review-banner" role="status">
              <div className="todo-ai-review-icon" aria-hidden="true">
                <Sparkles size={25} />
              </div>
              <div className="todo-ai-review-copy">
                <strong>
                  {pendingAiCount} {taskPlural(pendingAiCount)} z AI {taskVerb(pendingAiCount)}{' '}
                  potwierdzenia
                </strong>
                <span>
                  Sprawdź trafność, przypisz właścicieli i zatwierdź przed dodaniem do listy.
                </span>
              </div>
              <div className="todo-ai-review-actions">
                <button
                  type="button"
                  className="todo-ai-review-primary"
                  onClick={() => setViewMode('list')}
                >
                  Przejrzyj {pendingAiCount} {taskPlural(pendingAiCount)} AI
                </button>
                <button
                  type="button"
                  className="todo-ai-review-close"
                  onClick={() => setShowAiReviewBanner(false)}
                  aria-label="Zamknij komunikat"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

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
                <ChevronDown size={16} aria-hidden="true" />
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
              <button
                type="button"
                className="todo-command-button"
                aria-label={activeFilterCount > 0 ? `Filtry ${activeFilterCount}` : 'Filtry'}
              >
                <Filter size={17} aria-hidden="true" />
                Filtry
                {activeFilterCount > 0 ? (
                  <span className="todo-filter-badge">{activeFilterCount}</span>
                ) : null}
              </button>
              <button
                type="button"
                className="todo-command-button"
                onClick={() => setGroupBy?.(groupBy === 'none' ? 'status' : 'none')}
              >
                <Columns3 size={17} aria-hidden="true" />
                Kolumny
              </button>
              <button
                type="button"
                className={
                  onlyMineActive ? 'todo-owner-filter-btn active' : 'todo-owner-filter-btn'
                }
                aria-pressed={onlyMineActive}
                onClick={() => setOwnerFilter(onlyMineActive ? 'all' : 'me')}
                title={currentUserName ? `Pokaż zadania użytkownika ${currentUserName}` : undefined}
              >
                <UserRound size={17} aria-hidden="true" />
                Tylko moje
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
                  allVisibleSelected={allVisibleSelected}
                  someVisibleSelected={someVisibleSelected}
                  onToggleAllVisibleTasks={onToggleAllVisibleTasks}
                  onBulkStatusChange={onBulkStatusChange}
                  onBulkAssignToMe={onBulkAssignToMe}
                  onBulkDelete={onBulkDelete}
                  onDeleteTask={onDeleteTask}
                  onOpenMeeting={onOpenMeeting}
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
