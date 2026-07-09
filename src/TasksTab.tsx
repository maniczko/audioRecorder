import './styles/tasks.css';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RotateCcw, Trash2, X } from 'lucide-react';
import { useToast } from './shared/Toast';
import { PageShell, SplitPane } from './ui/LayoutPrimitives';
import {
  buildTaskGroups,
  getTaskLifecycleStatus,
  TASK_LIFECYCLE_STATUSES,
  taskListStats,
} from './lib/tasks';
import TaskDetailsPanel from './tasks/TaskDetailsPanel';
import TasksSidebar from './tasks/TasksSidebar';
import TasksWorkspaceView from './tasks/TasksWorkspaceView';
import {
  applyMainListFilter,
  buildContextualDraft,
  buildSidebarLists,
  canDrop,
  createQuickDraft,
  getSelectedListLabel,
  groupTasks,
  readDragTask,
  sortVisibleTasks,
  safeArray,
  taskMatchesVisibleContext,
} from './tasks/taskViewUtils';

export default function TasksTab({
  tasks,
  peopleOptions,
  tagOptions,
  boardColumns,
  onCreateTask,
  onUpdateTask,
  onBulkUpdateTasks,
  onDeleteTask,
  onBulkDeleteTasks,
  onMoveTaskToColumn,
  onReorderTask,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onOpenMeeting,
  defaultView,
  googleTasksEnabled,
  googleTasksStatus,
  googleTasksMessage,
  googleTasksLastSyncedAt,
  googleTaskLists,
  selectedGoogleTaskListId,
  onSelectGoogleTaskList,
  onConnectGoogleTasks,
  onImportGoogleTasks,
  onExportGoogleTasks,
  onRefreshGoogleTasks,
  onResolveGoogleTaskConflict,
  workspaceName,
  workspaceInviteCode,
  currentWorkspace,
  externalSelectedTaskId,
  onTaskSelectionHandled,
  onCreateFromRecording,
  currentUserName,
  workspaceMembers = [],
  taskNotifications = [],
}) {
  const [viewMode, setViewMode] = useState(defaultView === 'kanban' ? 'kanban' : 'list');
  const [selectedListId, setSelectedListId] = useState('smart:all');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('due:asc');
  const [groupBy, setGroupBy] = useState('none');
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const [dragTaskId, setDragTaskId] = useState('');
  const [dropColumnId, setDropColumnId] = useState('');
  const toast = useToast();
  const [quickDraft, setQuickDraft] = useState(() => createQuickDraft(boardColumns));
  const [columnDraft, setColumnDraft] = useState({ label: '', color: '#5a92ff', isDone: false });
  const [taskPreviewSaveState, setTaskPreviewSaveState] = useState('saved');
  const dragTaskIdRef = useRef('');
  const taskPreviewSaveTimerRef = useRef<number | null>(null);
  const quickAddInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setViewMode(defaultView === 'kanban' ? 'kanban' : 'list');
  }, [defaultView]);

  useEffect(() => {
    // Only sync status field when boardColumns change, preserve all other fields
    if (!boardColumns.some((column) => column.id === quickDraft.status)) {
      setQuickDraft((previous) => ({
        ...previous,
        status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || '',
      }));
    }
  }, [boardColumns, quickDraft.status]);

  useEffect(() => {
    if (selectedListId.startsWith('column:')) {
      const columnId = selectedListId.slice('column:'.length);
      // Only update status if it differs, preserve title and other fields
      if (columnId !== quickDraft.status && boardColumns.some((column) => column.id === columnId)) {
        setQuickDraft((previous) => ({ ...previous, status: columnId }));
      }
      return;
    }

    if (selectedListId.startsWith('group:')) {
      const groupName = selectedListId.slice('group:'.length);
      // Only update group if it differs, preserve title and other fields
      if (groupName !== quickDraft.group) {
        setQuickDraft((previous) => ({ ...previous, group: groupName }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only sync on selectedListId change, not on quickDraft changes to avoid overwrite loop
  }, [selectedListId]);

  const taskGroups = useMemo(() => buildTaskGroups(tasks), [tasks]);
  const stats = useMemo(() => taskListStats(tasks, boardColumns), [boardColumns, tasks]);
  const sidebarLists = useMemo(() => buildSidebarLists(tasks, boardColumns), [tasks, boardColumns]);

  const visibleTasks = useMemo(() => {
    const filtered = applyMainListFilter(tasks, selectedListId, boardColumns).filter((task) => {
      const lifecycle = getTaskLifecycleStatus(task, boardColumns, tasks);
      if (
        lifecycle === TASK_LIFECYCLE_STATUSES.DELETE_PENDING ||
        lifecycle === TASK_LIFECYCLE_STATUSES.ARCHIVED
      ) {
        return false;
      }
      if (
        ownerFilter === 'me' &&
        !(
          task.assignedToMe ||
          task.owner === currentUserName ||
          safeArray(task.assignedTo).includes(currentUserName)
        )
      ) {
        return false;
      }
      if (ownerFilter !== 'all' && ownerFilter !== 'me' && task.owner !== ownerFilter) {
        return false;
      }
      if (tagFilter !== 'all' && !(task.tags || []).includes(tagFilter)) {
        return false;
      }
      if (deferredQuery.trim()) {
        const haystack = [
          task.title,
          task.owner,
          task.group,
          task.description,
          task.notes,
          boardColumns.find((column) => column.id === task.status)?.label,
          task.status,
          task.priority,
          task.priority === 'high' ? 'wysoki' : '',
          task.priority === 'medium' ? 'sredni' : '',
          task.priority === 'low' ? 'niski' : '',
          safeArray(task.tags).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(deferredQuery.trim().toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    return sortVisibleTasks(filtered, sortBy);
  }, [
    boardColumns,
    currentUserName,
    deferredQuery,
    ownerFilter,
    selectedListId,
    sortBy,
    tagFilter,
    tasks,
  ]);

  const visibleStats = useMemo(
    () => taskListStats(visibleTasks, boardColumns),
    [boardColumns, visibleTasks]
  );

  useEffect(() => {
    if (!visibleTasks.length) {
      if (viewMode !== 'kanban') setSelectedTaskId('');
      setSelectedTaskIds([]);
      return;
    }

    setSelectedTaskIds((previous) =>
      previous.filter((taskId) => visibleTasks.some((task) => task.id === taskId))
    );
  }, [visibleTasks, viewMode]);

  useEffect(() => {
    if (!externalSelectedTaskId) {
      return;
    }

    const matchingTask = tasks.find((task) => task.id === externalSelectedTaskId);
    if (!matchingTask) {
      onTaskSelectionHandled?.();
      return;
    }

    setViewMode('list');
    setSelectedTaskId(matchingTask.id);
    setSelectedTaskIds([matchingTask.id]);
    setSelectedListId(
      matchingTask.group
        ? `group:${matchingTask.group}`
        : matchingTask.dueDate
          ? 'smart:planned'
          : 'smart:all'
    );
    setGroupBy('none');
    setQuery('');
    setOwnerFilter('all');
    setTagFilter('all');
    toast.info(`Otwarto zadanie: ${matchingTask.title}`);
    onTaskSelectionHandled?.();
  }, [externalSelectedTaskId, onTaskSelectionHandled, tasks, toast]);

  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId) || null;

  useEffect(() => {
    if (!selectedTask) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedTask]);

  useEffect(() => {
    setTaskPreviewSaveState('saved');
  }, [selectedTask?.id]);

  useEffect(
    () => () => {
      if (taskPreviewSaveTimerRef.current) {
        window.clearTimeout(taskPreviewSaveTimerRef.current);
      }
    },
    []
  );

  const groupedTasks = useMemo(
    () => groupTasks(visibleTasks, groupBy, boardColumns),
    [boardColumns, groupBy, visibleTasks]
  );
  const kanbanColumns = useMemo(
    () =>
      boardColumns.map((column) => ({
        ...column,
        tasks: visibleTasks.filter((task) => {
          const lifecycle = getTaskLifecycleStatus(task, boardColumns, visibleTasks);
          if (column.isDone) {
            return lifecycle === TASK_LIFECYCLE_STATUSES.DONE;
          }
          return task.status === column.id && lifecycle !== TASK_LIFECYCLE_STATUSES.DONE;
        }),
      })),
    [boardColumns, visibleTasks]
  );
  const visibleTaskIds = useMemo(() => visibleTasks.map((task) => task.id), [visibleTasks]);
  const selectedVisibleTaskIds = useMemo(
    () => selectedTaskIds.filter((taskId) => visibleTaskIds.includes(taskId)),
    [selectedTaskIds, visibleTaskIds]
  );
  const allVisibleSelected =
    visibleTaskIds.length > 0 && selectedVisibleTaskIds.length === visibleTaskIds.length;
  const someVisibleSelected = selectedVisibleTaskIds.length > 0 && !allVisibleSelected;
  const activeFilterCount =
    (selectedListId !== 'smart:all' ? 1 : 0) +
    (ownerFilter !== 'all' ? 1 : 0) +
    (tagFilter !== 'all' ? 1 : 0);

  const runSafely = useCallback(
    (action, successMessage = '') => {
      try {
        const result = action();
        if (successMessage) {
          toast.success(successMessage);
        }
        return result;
      } catch (err) {
        toast.error(err.message || 'Wystąpił błąd');
        return null;
      }
    },
    [toast]
  );

  const safeUpdateTask = useCallback(
    (taskId, updates, successMessage = '') =>
      runSafely(() => onUpdateTask(taskId, updates), successMessage),
    [onUpdateTask, runSafely]
  );

  const handlePreviewTaskUpdate = useCallback(
    (taskId, updates) => {
      setTaskPreviewSaveState('saving');
      try {
        onUpdateTask(taskId, updates);
      } catch (err) {
        setTaskPreviewSaveState('error');
        toast.error(err.message || 'Nie udało się zapisać zadania.');
        return;
      }

      if (taskPreviewSaveTimerRef.current) {
        window.clearTimeout(taskPreviewSaveTimerRef.current);
      }

      taskPreviewSaveTimerRef.current = window.setTimeout(() => {
        setTaskPreviewSaveState('saved');
        taskPreviewSaveTimerRef.current = null;
      }, 450);
    },
    [onUpdateTask, toast]
  );

  const safeMoveTaskToColumn = useCallback(
    (taskId, columnId, successMessage = '') =>
      runSafely(() => onMoveTaskToColumn(taskId, columnId), successMessage),
    [onMoveTaskToColumn, runSafely]
  );

  const pendingDeleteRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(
    null
  );

  const safeDeleteTask = useCallback(
    (taskId: string) => {
      // Cancel any previous pending delete
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timer);
        onDeleteTask(pendingDeleteRef.current.id);
        pendingDeleteRef.current = null;
      }

      const task = tasks.find((t: any) => t.id === taskId);
      const taskTitle = task?.title || 'Zadanie';

      // Hide task immediately via update (soft delete)
      onUpdateTask(taskId, { _softDeleted: true });

      const timer = setTimeout(() => {
        onDeleteTask(taskId);
        pendingDeleteRef.current = null;
      }, 5000);

      pendingDeleteRef.current = { id: taskId, timer };

      const label = taskTitle.length > 30 ? taskTitle.slice(0, 30) + '…' : taskTitle;
      toast.info(`Usunięto "${label}"`, {
        actionLabel: 'Cofnij',
        action: () => {
          if (pendingDeleteRef.current?.id === taskId) {
            clearTimeout(pendingDeleteRef.current.timer);
            pendingDeleteRef.current = null;
            onUpdateTask(taskId, { _softDeleted: false });
            toast.success('Przywrócono zadanie.');
          }
        },
        duration: 5000,
      });
    },
    [onDeleteTask, onUpdateTask, tasks, toast]
  );

  function toggleTaskSelection(taskId, forceValue) {
    const normalizedTaskId = String(taskId || '');
    if (!normalizedTaskId) {
      return;
    }

    setSelectedTaskIds((previous) => {
      const alreadySelected = previous.includes(normalizedTaskId);
      const shouldSelect = forceValue === undefined ? !alreadySelected : Boolean(forceValue);
      if (shouldSelect) {
        return [...new Set([...previous, normalizedTaskId])];
      }
      return previous.filter((candidate) => candidate !== normalizedTaskId);
    });
  }

  const clearTaskSelection = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const toggleAllVisibleTasks = useCallback(
    (forceValue) => {
      setSelectedTaskIds((previous) => {
        const visibleSet = new Set(visibleTaskIds);
        const shouldSelect =
          forceValue === undefined
            ? !visibleTaskIds.every((taskId) => previous.includes(taskId))
            : Boolean(forceValue);
        if (shouldSelect) {
          return [...new Set([...previous, ...visibleTaskIds])];
        }
        return previous.filter((taskId) => !visibleSet.has(taskId));
      });
    },
    [visibleTaskIds]
  );

  const handleBulkUpdate = useCallback(
    (updates, successMessage) => {
      if (!selectedTaskIds.length) {
        return;
      }

      runSafely(() => {
        if (typeof onBulkUpdateTasks === 'function') {
          onBulkUpdateTasks(selectedTaskIds, updates);
        } else {
          selectedTaskIds.forEach((taskId) => onUpdateTask(taskId, updates));
        }
        setSelectedTaskIds([]);
      }, successMessage);
    },
    [onBulkUpdateTasks, onUpdateTask, runSafely, selectedTaskIds]
  );

  const handleBulkAssignToMe = useCallback(() => {
    const assignee = currentUserName || 'Nieprzypisane';
    handleBulkUpdate(
      { owner: assignee, assignedTo: assignee === 'Nieprzypisane' ? [] : [assignee] },
      'Przypisano zaznaczone zadania.'
    );
  }, [currentUserName, handleBulkUpdate]);

  const handleBulkDelete = useCallback(() => {
    if (!selectedTaskIds.length) {
      return;
    }

    runSafely(() => {
      if (typeof onBulkDeleteTasks === 'function') {
        onBulkDeleteTasks(selectedTaskIds);
      } else {
        selectedTaskIds.forEach((taskId) => onDeleteTask(taskId));
      }
      setSelectedTaskIds([]);
    }, 'Usunięto zaznaczone zadania.');
  }, [onBulkDeleteTasks, onDeleteTask, runSafely, selectedTaskIds]);

  function rememberDraggedTask(taskId) {
    dragTaskIdRef.current = taskId || '';
    setDragTaskId(taskId || '');
  }

  function submitQuickTask(event, draftOverride) {
    event?.preventDefault?.();

    const draft = draftOverride || quickDraft;
    if (!draft.title.trim()) {
      toast.warning('Dodaj tytul zadania.');
      return;
    }

    try {
      const contextualDraft = buildContextualDraft(
        {
          ...draft,
          title: draft.title.trim(),
          group: String(draft.group || '').trim(),
          tags: String(draft.tags || '').trim(),
        },
        selectedListId,
        boardColumns
      );
      const createdTask = onCreateTask(contextualDraft);
      if (!createdTask) {
        throw new Error('Nie udalo sie dodac zadania.');
      }
      const createdTaskId = createdTask?.id || createdTask;

      setQuickDraft(createQuickDraft(boardColumns));
      setShowAdvancedCreate(false);
      toast.success('Dodano zadanie do listy.');

      if (createdTaskId) {
        const createdTaskData =
          typeof createdTask === 'object' && createdTask
            ? createdTask
            : tasks.find((task) => task.id === createdTaskId) || { id: createdTaskId };

        if (
          !taskMatchesVisibleContext(createdTaskData, {
            selectedListId,
            ownerFilter,
            tagFilter,
            query,
            boardColumns,
          })
        ) {
          setSelectedListId(
            createdTaskData.group
              ? `group:${createdTaskData.group}`
              : `column:${createdTaskData.status || quickDraft.status}`
          );
          setOwnerFilter('all');
          setTagFilter('all');
          setQuery('');
        }

        setSelectedTaskId(createdTaskId);
        setSelectedTaskIds([createdTaskId]);
      }
    } catch (err) {
      toast.error(err.message || 'Nie udalo sie zapisac zadania');
    }
  }

  function submitColumn(event) {
    event.preventDefault();
    try {
      onCreateColumn(columnDraft);
      setColumnDraft({ label: '', color: '#5a92ff', isDone: false });
      toast.success('Dodano kolumne.');
    } catch (err) {
      toast.error(err.message || 'Błąd dodawania kolumny');
    }
  }

  function finalizeDrop(taskId, update, successMessage) {
    if (!taskId) {
      toast.error('Nie udalo sie odczytac przeciaganego zadania. Sprobuj przeciagnac jeszcze raz.');
      return;
    }

    if (update?.type === 'move') {
      safeMoveTaskToColumn(taskId, update.columnId);
    } else if (update?.type === 'reorder') {
      if (typeof onReorderTask === 'function') {
        runSafely(() => onReorderTask(taskId, update.placement));
      } else if (update.placement?.status && Object.keys(update.placement).length === 1) {
        safeMoveTaskToColumn(taskId, update.placement.status);
      } else {
        safeUpdateTask(taskId, update.placement);
      }
      setSortBy('manual');
    } else if (typeof update === 'string') {
      safeMoveTaskToColumn(taskId, update);
    } else {
      safeUpdateTask(taskId, update);
    }

    rememberDraggedTask('');
    setDropColumnId('');
    if (successMessage) {
      toast.success(successMessage);
    }
  }

  function handleColumnDrop(columnId, event) {
    canDrop(event);
    finalizeDrop(
      readDragTask(event) || dragTaskIdRef.current || dragTaskId,
      {
        type: 'reorder',
        placement: {
          status: columnId,
        },
      },
      ''
    );
  }

  function handleGroupDrop(groupId, event) {
    canDrop(event);
    const taskId = readDragTask(event) || dragTaskIdRef.current || dragTaskId;
    if (!taskId) {
      return;
    }

    if (groupBy === 'status') {
      finalizeDrop(taskId, { type: 'reorder', placement: { status: groupId } }, '');
      return;
    }

    if (groupBy === 'group') {
      finalizeDrop(
        taskId,
        {
          type: 'reorder',
          placement: {
            group: groupId === '__ungrouped__' ? '' : groupId,
          },
        },
        'Zmieniono grupe zadania.'
      );
    }
  }

  function handleTaskDrop(placement, event, successMessage = 'Zmieniono kolejnosc zadania.') {
    canDrop(event);
    finalizeDrop(
      readDragTask(event) || dragTaskIdRef.current || dragTaskId,
      {
        type: 'reorder',
        placement,
      },
      successMessage
    );
  }

  function handleQuickAddToColumn(columnId, title) {
    try {
      const draft = {
        title: title.trim(),
        status: columnId,
        owner: '',
        group: '',
        dueDate: '',
        reminderAt: '',
        priority: 'medium',
        tags: '',
        important: false,
        myDay: false,
      };
      const created = onCreateTask(draft);
      const createdId = created?.id || created;
      if (createdId) {
        setSelectedTaskId(createdId);
        setSelectedTaskIds([createdId]);
      }
      toast.success('Dodano zadanie do kolumny.');
    } catch (err) {
      toast.error(err.message || 'Błąd dodawania zadania');
    }
  }

  function handleColumnReorder(fromId, toId) {
    if (typeof onUpdateColumn !== 'function') {
      return;
    }
    const fromIndex = boardColumns.findIndex((c) => c.id === fromId);
    const toIndex = boardColumns.findIndex((c) => c.id === toId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const reordered = [...boardColumns];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    reordered.forEach((col, index) => {
      if (boardColumns[index]?.id !== col.id) {
        onUpdateColumn(col.id, { order: index });
      }
    });
  }

  function handleExportCsv() {
    const header = [
      'id',
      'title',
      'status',
      'priority',
      'owner',
      'assignedTo',
      'dueDate',
      'group',
      'tags',
      'completed',
      'createdAt',
    ].join(',');
    const rows = visibleTasks.map((task) => {
      const escape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      return [
        escape(task.id),
        escape(task.title),
        escape(task.status),
        escape(task.priority),
        escape(task.owner),
        escape((task.assignedTo || []).join(';')),
        escape(task.dueDate || ''),
        escape(task.group || ''),
        escape((task.tags || []).join(';')),
        task.completed ? 'true' : 'false',
        escape(task.createdAt || ''),
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Wyeksportowano zadania do CSV.');
  }

  async function shareWorkspace() {
    if (!workspaceInviteCode) {
      toast.warning('Brak kodu workspace.');
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(workspaceInviteCode);
        toast.success(`Skopiowano kod workspace: ${workspaceInviteCode}`);
        return;
      }
    } catch (error) {
      console.error('Clipboard write failed.', error);
      toast.error('Kopiowanie do schowka nie powiodło się.');
    }

    toast.info(`Udostepnij workspace kodem: ${workspaceInviteCode}`);
  }

  useEffect(() => {
    function handleKeyboardShortcuts(event) {
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase?.() || '';
      const typingContext =
        ['input', 'textarea', 'select'].includes(tagName) || target?.isContentEditable;
      const lowerKey = String(event.key || '').toLowerCase();

      if (typingContext && lowerKey !== 'escape') {
        return;
      }

      if (lowerKey === 'n') {
        event.preventDefault();
        setSelectedTaskId('');
        setShowAdvancedCreate(true);
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (lowerKey === 'escape') {
        clearTaskSelection();
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedTaskIds.length) {
        event.preventDefault();
        handleBulkDelete();
        return;
      }

      const activeTaskId = selectedTaskIds[0] || selectedTask?.id;
      if (!activeTaskId) {
        return;
      }

      if (lowerKey === 'e') {
        event.preventDefault();
        setViewMode('list');
        setSelectedTaskId(activeTaskId);
        window.setTimeout(() => {
          const inputEl = document.querySelector(
            `[data-task-title-input="${activeTaskId}"]`
          ) as HTMLInputElement | null;
          inputEl?.focus();
        }, 0);
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        const activeTask = tasks.find((task) => task.id === activeTaskId);
        if (activeTask) {
          safeUpdateTask(activeTask.id, { completed: !activeTask.completed });
        }
        return;
      }

      if (['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        const priorityMap = {
          1: 'low',
          2: 'medium',
          3: 'high',
          4: 'urgent',
        };
        const nextPriority = priorityMap[event.key];
        if (selectedTaskIds.length > 1) {
          handleBulkUpdate({ priority: nextPriority }, 'Zmieniono priorytet zaznaczonych zadan.');
        } else {
          safeUpdateTask(activeTaskId, { priority: nextPriority }, 'Zmieniono priorytet zadania.');
        }
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [
    clearTaskSelection,
    handleBulkDelete,
    handleBulkUpdate,
    quickAddInputRef,
    searchInputRef,
    safeUpdateTask,
    selectedTask,
    selectedTaskIds,
    tasks,
  ]);

  return (
    <PageShell className="tasks-page-shell">
      <SplitPane
        className="tasks-layout ms-todo tasks-layout--reference-list"
        sidebarWidth="default"
        sidebar={
          <TasksSidebar
            sidebarLists={sidebarLists}
            selectedListId={selectedListId}
            setSelectedListId={setSelectedListId}
            visibleStats={visibleStats}
            showColumnManager={showColumnManager}
            setShowColumnManager={setShowColumnManager}
            boardColumns={boardColumns}
            onUpdateColumn={onUpdateColumn}
            onDeleteColumn={onDeleteColumn}
            columnDraft={columnDraft}
            setColumnDraft={setColumnDraft}
            submitColumn={submitColumn}
            quickAddInputRef={quickAddInputRef}
            searchInputRef={searchInputRef}
            selectedTasks={selectedTaskIds}
            selectedTaskCount={selectedTaskIds.length}
            clearTaskSelection={clearTaskSelection}
            taskNotifications={taskNotifications}
            workspaceMembers={workspaceMembers}
            currentUserName={currentUserName}
            ownerFilter={ownerFilter}
            setOwnerFilter={setOwnerFilter}
            allTasks={tasks}
            currentWorkspace={currentWorkspace}
            onFocusConflictTask={(taskId) => {
              setSelectedTaskId(taskId);
              setSelectedTaskIds([taskId]);
              setViewMode('list');
            }}
          />
        }
        main={
          <TasksWorkspaceView
            selectedListLabel={getSelectedListLabel(sidebarLists, selectedListId)}
            viewMode={viewMode}
            setViewMode={setViewMode}
            sortBy={sortBy}
            setSortBy={setSortBy}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            shareWorkspace={shareWorkspace}
            onExportCsv={handleExportCsv}
            submitQuickTask={submitQuickTask}
            quickDraft={quickDraft}
            setQuickDraft={setQuickDraft}
            showAdvancedCreate={showAdvancedCreate}
            setShowAdvancedCreate={setShowAdvancedCreate}
            peopleOptions={peopleOptions}
            taskGroups={taskGroups}
            boardColumns={boardColumns}
            query={query}
            setQuery={setQuery}
            ownerFilter={ownerFilter}
            setOwnerFilter={setOwnerFilter}
            tagFilter={tagFilter}
            setTagFilter={setTagFilter}
            tagOptions={tagOptions}
            quickAddInputRef={quickAddInputRef}
            searchInputRef={searchInputRef}
            groupedTasks={groupedTasks}
            allVisibleTasks={visibleTasks}
            selectedTask={selectedTask}
            setSelectedTaskId={setSelectedTaskId}
            onUpdateTask={safeUpdateTask}
            onDeleteTask={safeDeleteTask}
            onMoveTaskToColumn={safeMoveTaskToColumn}
            onOpenMeeting={onOpenMeeting}
            kanbanColumns={kanbanColumns}
            dropColumnId={dropColumnId}
            setDropColumnId={setDropColumnId}
            handleDrop={handleColumnDrop}
            handleGroupDrop={handleGroupDrop}
            handleTaskDrop={handleTaskDrop}
            setDragTaskId={rememberDraggedTask}
            dragTaskId={dragTaskId}
            onQuickAddToColumn={handleQuickAddToColumn}
            onReorderColumns={handleColumnReorder}
            stats={stats}
            visibleStats={visibleStats}
            selectedTaskIds={selectedTaskIds}
            toggleTaskSelection={toggleTaskSelection}
            activeFilterCount={activeFilterCount}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            onToggleAllVisibleTasks={toggleAllVisibleTasks}
            onBulkStatusChange={(status) =>
              handleBulkUpdate({ status }, 'Zmieniono status zaznaczonych zadan.')
            }
            onBulkAssignToMe={handleBulkAssignToMe}
            onBulkDelete={handleBulkDelete}
            taskNotifications={taskNotifications}
            showColumnManager={showColumnManager}
            setShowColumnManager={setShowColumnManager}
            currentUserName={currentUserName}
            onCreateFromRecording={onCreateFromRecording}
            createPlacement="aside"
          />
        }
        aside={null}
      />
      {selectedTask && (
        <div
          className="task-create-modal-overlay task-detail-form-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTaskId('');
          }}
        >
          <div
            className="task-create-modal task-detail-form-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Podgląd zadania"
          >
            <header className="task-create-modal-header task-detail-form-modal-header">
              <h2>Podgląd zadania</h2>
              <button
                className="task-create-modal-close"
                type="button"
                onClick={() => setSelectedTaskId('')}
                aria-label="Zamknij podgląd zadania"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="task-create-modal-body task-detail-form-modal-body">
              <TaskDetailsPanel
                presentation="modal"
                selectedTask={selectedTask}
                tasks={tasks}
                peopleOptions={peopleOptions}
                tagOptions={tagOptions}
                taskGroups={taskGroups}
                boardColumns={boardColumns}
                onUpdateTask={handlePreviewTaskUpdate}
                onMoveTaskToColumn={safeMoveTaskToColumn}
                onDeleteTask={safeDeleteTask}
                onOpenMeeting={onOpenMeeting}
                onOpenTask={setSelectedTaskId}
                currentUserName={currentUserName}
                onResolveGoogleTaskConflict={onResolveGoogleTaskConflict}
              />
            </div>
            <footer className="task-create-modal-footer task-detail-form-modal-footer">
              <span
                className="task-create-modal-shortcut task-detail-save-status"
                data-state={taskPreviewSaveState}
                aria-live="polite"
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span className="task-detail-save-status-copy">
                  <strong>
                    {taskPreviewSaveState === 'error'
                      ? 'Błąd zapisu'
                      : taskPreviewSaveState === 'saving'
                        ? 'Zapisywanie...'
                        : 'Zapisano automatycznie'}
                  </strong>
                  <small>
                    {taskPreviewSaveState === 'error'
                      ? 'Spróbuj ponownie za chwilę'
                      : taskPreviewSaveState === 'saving'
                        ? 'Aktualizujemy podgląd zadania'
                        : 'Zmiany zapisują się na bieżąco'}
                  </small>
                </span>
              </span>
              <div className="task-detail-form-modal-actions">
                <button
                  type="button"
                  className="task-create-modal-secondary task-detail-complete-action"
                  onClick={() =>
                    safeUpdateTask(selectedTask.id, { completed: !selectedTask.completed })
                  }
                >
                  {selectedTask.completed ? (
                    <RotateCcw size={16} aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  )}
                  {selectedTask.completed ? 'Otwórz ponownie' : 'Oznacz jako gotowe'}
                </button>
                <button
                  type="button"
                  className="task-create-modal-secondary todo-detail-delete-action"
                  aria-label="Usuń zadanie"
                  onClick={() => {
                    if (window.confirm('Usunąć to zadanie?')) {
                      safeDeleteTask(selectedTask.id);
                      setSelectedTaskId('');
                    }
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Usuń zadanie
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </PageShell>
  );
}
