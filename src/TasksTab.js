import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildTaskGroups, getTaskSlaState, taskListStats } from "./lib/tasks";
import TaskDetailsPanel from "./tasks/TaskDetailsPanel";
import TasksSidebar from "./tasks/TasksSidebar";
import TasksWorkspaceView from "./tasks/TasksWorkspaceView";
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
} from "./tasks/taskViewUtils";

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
  externalSelectedTaskId,
  onTaskSelectionHandled,
  currentUserName,
  taskNotifications = [],
  workspaceActivity = [],
}) {
  const [viewMode, setViewMode] = useState(defaultView === "kanban" ? "kanban" : "list");
  const [selectedListId, setSelectedListId] = useState("smart:all");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [sortBy, setSortBy] = useState("manual");
  const [groupBy, setGroupBy] = useState("none");
  const [swimlaneGroupBy, setSwimlaneGroupBy] = useState("none");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [dragTaskId, setDragTaskId] = useState("");
  const [dropColumnId, setDropColumnId] = useState("");
  const [message, setMessage] = useState("");
  const [shellStatus, setShellStatus] = useState(() => ({
    isOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    isStandalone:
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone),
    serviceWorkerSupported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    serviceWorkerReady: typeof navigator !== "undefined" && Boolean(navigator.serviceWorker?.controller),
  }));
  const [quickDraft, setQuickDraft] = useState(() => createQuickDraft(boardColumns));
  const [columnDraft, setColumnDraft] = useState({ label: "", color: "#5a92ff", isDone: false });
  const dragTaskIdRef = useRef("");
  const quickAddInputRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setViewMode(defaultView === "kanban" ? "kanban" : "list");
  }, [defaultView]);

  useEffect(() => {
    if (!boardColumns.some((column) => column.id === quickDraft.status)) {
      setQuickDraft((previous) => ({
        ...previous,
        status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || "",
      }));
    }
  }, [boardColumns, quickDraft.status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function updateConnectionStatus() {
      setShellStatus((previous) => ({
        ...previous,
        isOnline: navigator.onLine,
      }));
    }

    function updateDisplayMode() {
      setShellStatus((previous) => ({
        ...previous,
        isStandalone: Boolean(
          window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator?.standalone
        ),
      }));
    }

    updateConnectionStatus();
    updateDisplayMode();

    const mediaQuery = window.matchMedia ? window.matchMedia("(display-mode: standalone)") : null;
    const handleDisplayModeChange = () => updateDisplayMode();
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", handleDisplayModeChange);
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(handleDisplayModeChange);
    }

    let active = true;
    if ("serviceWorker" in navigator) {
      setShellStatus((previous) => ({
        ...previous,
        serviceWorkerSupported: true,
        serviceWorkerReady: previous.serviceWorkerReady || Boolean(navigator.serviceWorker.controller),
      }));

      navigator.serviceWorker.ready
        .then(() => {
          if (active) {
            setShellStatus((previous) => ({
              ...previous,
              serviceWorkerReady: true,
            }));
          }
        })
        .catch(() => {});
    } else {
      setShellStatus((previous) => ({
        ...previous,
        serviceWorkerSupported: false,
        serviceWorkerReady: false,
      }));
    }

    return () => {
      active = false;
      window.removeEventListener("online", updateConnectionStatus);
      window.removeEventListener("offline", updateConnectionStatus);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", handleDisplayModeChange);
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedListId.startsWith("column:")) {
      const columnId = selectedListId.slice("column:".length);
      if (columnId !== quickDraft.status && boardColumns.some((column) => column.id === columnId)) {
        setQuickDraft((previous) => ({ ...previous, status: columnId }));
      }
      return;
    }

    if (selectedListId.startsWith("group:")) {
      const groupName = selectedListId.slice("group:".length);
      if (groupName !== quickDraft.group) {
        setQuickDraft((previous) => ({ ...previous, group: groupName }));
      }
    }
  }, [boardColumns, quickDraft.group, quickDraft.status, selectedListId]);

  const taskGroups = useMemo(() => buildTaskGroups(tasks), [tasks]);
  const stats = useMemo(() => taskListStats(tasks), [tasks]);
  const sidebarLists = useMemo(() => buildSidebarLists(tasks, boardColumns), [tasks, boardColumns]);

  const visibleTasks = useMemo(() => {
    const filtered = applyMainListFilter(tasks, selectedListId, boardColumns).filter((task) => {
      if (ownerFilter !== "all" && task.owner !== ownerFilter) {
        return false;
      }
      if (tagFilter !== "all" && !(task.tags || []).includes(tagFilter)) {
        return false;
      }
      if (query.trim()) {
        const haystack = [task.title, task.owner, task.group, task.description, task.notes, safeArray(task.tags).join(" ")]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    return sortVisibleTasks(filtered, sortBy);
  }, [boardColumns, ownerFilter, query, selectedListId, sortBy, tagFilter, tasks]);

  const visibleStats = useMemo(() => taskListStats(visibleTasks), [visibleTasks]);

  useEffect(() => {
    if (!visibleTasks.length) {
      setSelectedTaskId("");
      setSelectedTaskIds([]);
      return;
    }

    if (!visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].id);
    }

    setSelectedTaskIds((previous) => previous.filter((taskId) => visibleTasks.some((task) => task.id === taskId)));
  }, [visibleTasks, selectedTaskId]);

  useEffect(() => {
    if (!externalSelectedTaskId) {
      return;
    }

    const matchingTask = tasks.find((task) => task.id === externalSelectedTaskId);
    if (!matchingTask) {
      onTaskSelectionHandled?.();
      return;
    }

    setViewMode("list");
    setSelectedTaskId(matchingTask.id);
    setSelectedTaskIds([matchingTask.id]);
    setSelectedListId(matchingTask.group ? `group:${matchingTask.group}` : matchingTask.dueDate ? "smart:planned" : "smart:all");
    setGroupBy("none");
    setQuery("");
    setOwnerFilter("all");
    setTagFilter("all");
    setMessage(`Otwarto zadanie: ${matchingTask.title}`);
    onTaskSelectionHandled?.();
  }, [externalSelectedTaskId, onTaskSelectionHandled, tasks]);

  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId) || visibleTasks[0] || null;
  const groupedTasks = useMemo(() => groupTasks(visibleTasks, groupBy, boardColumns), [boardColumns, groupBy, visibleTasks]);
  const kanbanColumns = useMemo(
    () =>
      boardColumns.map((column) => ({
        ...column,
        tasks: visibleTasks.filter((task) => task.status === column.id),
      })),
    [boardColumns, visibleTasks]
  );
  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskIds.includes(task.id)),
    [selectedTaskIds, tasks]
  );
  const selectedTaskSla = selectedTask ? getTaskSlaState(selectedTask) : null;
  const conflictTasks = useMemo(
    () => tasks.filter((task) => task.googleSyncStatus === "conflict" && task.googleSyncConflict),
    [tasks]
  );

  const runSafely = useCallback((action, successMessage = "") => {
    try {
      const result = action();
      if (successMessage) {
        setMessage(successMessage);
      }
      return result;
    } catch (error) {
      setMessage(error.message);
      return null;
    }
  }, []);

  const safeUpdateTask = useCallback(
    (taskId, updates, successMessage = "") => runSafely(() => onUpdateTask(taskId, updates), successMessage),
    [onUpdateTask, runSafely]
  );

  const safeMoveTaskToColumn = useCallback(
    (taskId, columnId, successMessage = "") =>
      runSafely(() => onMoveTaskToColumn(taskId, columnId), successMessage),
    [onMoveTaskToColumn, runSafely]
  );

  const safeDeleteTask = useCallback(
    (taskId, successMessage = "") => runSafely(() => onDeleteTask(taskId), successMessage),
    [onDeleteTask, runSafely]
  );

  function toggleTaskSelection(taskId, forceValue) {
    const normalizedTaskId = String(taskId || "");
    if (!normalizedTaskId) {
      return;
    }

    setSelectedTaskId(normalizedTaskId);
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

  const handleBulkUpdate = useCallback((updates, successMessage) => {
    if (!selectedTaskIds.length || typeof onBulkUpdateTasks !== "function") {
      return;
    }

    runSafely(() => onBulkUpdateTasks(selectedTaskIds, updates), successMessage);
  }, [onBulkUpdateTasks, runSafely, selectedTaskIds]);

  const handleBulkDelete = useCallback(() => {
    if (!selectedTaskIds.length) {
      return;
    }

    runSafely(() => {
      if (typeof onBulkDeleteTasks === "function") {
        onBulkDeleteTasks(selectedTaskIds);
      } else {
        selectedTaskIds.forEach((taskId) => onDeleteTask(taskId));
      }
      setSelectedTaskIds([]);
    }, "Usunieto zaznaczone zadania.");
  }, [onBulkDeleteTasks, onDeleteTask, runSafely, selectedTaskIds]);

  function rememberDraggedTask(taskId) {
    dragTaskIdRef.current = taskId || "";
    setDragTaskId(taskId || "");
  }

  function submitQuickTask(event) {
    event?.preventDefault?.();

    if (!quickDraft.title.trim()) {
      setMessage("Dodaj tytul zadania.");
      return;
    }

    try {
      const contextualDraft = buildContextualDraft(
        {
          ...quickDraft,
          title: quickDraft.title.trim(),
          group: String(quickDraft.group || "").trim(),
          tags: String(quickDraft.tags || "").trim(),
        },
        selectedListId,
        boardColumns
      );
      const createdTask = onCreateTask(contextualDraft);
      if (!createdTask) {
        throw new Error("Nie udalo sie dodac zadania.");
      }
      const createdTaskId = createdTask?.id || createdTask;

      setQuickDraft(createQuickDraft(boardColumns));
      setShowAdvancedCreate(false);
      setMessage("Dodano zadanie do listy.");

      if (createdTaskId) {
        const createdTaskData =
          typeof createdTask === "object" && createdTask
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
            createdTaskData.group ? `group:${createdTaskData.group}` : `column:${createdTaskData.status || quickDraft.status}`
          );
          setOwnerFilter("all");
          setTagFilter("all");
          setQuery("");
        }

        setSelectedTaskId(createdTaskId);
        setSelectedTaskIds([createdTaskId]);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  function submitColumn(event) {
    event.preventDefault();
    try {
      onCreateColumn(columnDraft);
      setColumnDraft({ label: "", color: "#5a92ff", isDone: false });
      setMessage("Dodano kolumne.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function finalizeDrop(taskId, update, successMessage) {
    if (!taskId) {
      setMessage("Nie udalo sie odczytac przeciaganego zadania. Sprobuj przeciagnac jeszcze raz.");
      return;
    }

    if (update?.type === "move") {
      safeMoveTaskToColumn(taskId, update.columnId);
    } else if (update?.type === "reorder") {
      if (typeof onReorderTask === "function") {
        runSafely(() => onReorderTask(taskId, update.placement));
      } else if (update.placement?.status && Object.keys(update.placement).length === 1) {
        safeMoveTaskToColumn(taskId, update.placement.status);
      } else {
        safeUpdateTask(taskId, update.placement);
      }
      setSortBy("manual");
    } else if (typeof update === "string") {
      safeMoveTaskToColumn(taskId, update);
    } else {
      safeUpdateTask(taskId, update);
    }

    rememberDraggedTask("");
    setDropColumnId("");
    setMessage(successMessage);
  }

  function handleColumnDrop(columnId, event) {
    canDrop(event);
    finalizeDrop(
      readDragTask(event) || dragTaskIdRef.current || dragTaskId,
      {
        type: "reorder",
        placement: {
          status: columnId,
        },
      },
      "Przeniesiono zadanie do nowej kolumny."
    );
  }

  function handleGroupDrop(groupId, event) {
    canDrop(event);
    const taskId = readDragTask(event) || dragTaskIdRef.current || dragTaskId;
    if (!taskId) {
      return;
    }

    if (groupBy === "status") {
      finalizeDrop(taskId, { type: "reorder", placement: { status: groupId } }, "Przeniesiono zadanie do nowej kolumny.");
      return;
    }

    if (groupBy === "group") {
      finalizeDrop(
        taskId,
        {
          type: "reorder",
          placement: {
            group: groupId === "__ungrouped__" ? "" : groupId,
          },
        },
        "Zmieniono grupe zadania."
      );
    }
  }

  function handleTaskDrop(placement, event, successMessage = "Zmieniono kolejnosc zadania.") {
    canDrop(event);
    finalizeDrop(
      readDragTask(event) || dragTaskIdRef.current || dragTaskId,
      {
        type: "reorder",
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
        owner: "",
        group: "",
        dueDate: "",
        reminderAt: "",
        priority: "medium",
        tags: "",
        important: false,
        myDay: false,
      };
      const created = onCreateTask(draft);
      const createdId = created?.id || created;
      if (createdId) {
        setSelectedTaskId(createdId);
        setSelectedTaskIds([createdId]);
      }
      setMessage("Dodano zadanie do kolumny.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleColumnReorder(fromId, toId) {
    if (typeof onUpdateColumn !== "function") {
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
    const header = ["id", "title", "status", "priority", "owner", "assignedTo", "dueDate", "group", "tags", "completed", "createdAt"].join(",");
    const rows = visibleTasks.map((task) => {
      const escape = (v) => `"${String(v || "").replace(/"/g, '""')}"`;
      return [
        escape(task.id),
        escape(task.title),
        escape(task.status),
        escape(task.priority),
        escape(task.owner),
        escape((task.assignedTo || []).join(";")),
        escape(task.dueDate || ""),
        escape(task.group || ""),
        escape((task.tags || []).join(";")),
        task.completed ? "true" : "false",
        escape(task.createdAt || ""),
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Wyeksportowano zadania do CSV.");
  }

  async function shareWorkspace() {
    if (!workspaceInviteCode) {
      setMessage("Brak kodu workspace.");
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(workspaceInviteCode);
        setMessage(`Skopiowano kod workspace: ${workspaceInviteCode}`);
        return;
      }
    } catch (error) {
      console.error("Clipboard write failed.", error);
    }

    setMessage(`Udostepnij workspace kodem: ${workspaceInviteCode}`);
  }

  useEffect(() => {
    function handleKeyboardShortcuts(event) {
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase?.() || "";
      const typingContext = ["input", "textarea", "select"].includes(tagName) || target?.isContentEditable;
      const lowerKey = String(event.key || "").toLowerCase();

      if (typingContext && lowerKey !== "escape") {
        return;
      }

      if (lowerKey === "n") {
        event.preventDefault();
        quickAddInputRef.current?.focus();
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (lowerKey === "escape") {
        clearTaskSelection();
        setMessage("");
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedTaskIds.length) {
        event.preventDefault();
        handleBulkDelete();
        return;
      }

      const activeTaskId = selectedTaskIds[0] || selectedTask?.id;
      if (!activeTaskId) {
        return;
      }

      if (lowerKey === "e") {
        event.preventDefault();
        setViewMode("list");
        setSelectedTaskId(activeTaskId);
        window.setTimeout(() => {
          document.querySelector(`[data-task-title-input="${activeTaskId}"]`)?.focus();
        }, 0);
        return;
      }

      if (event.key === " ") {
        event.preventDefault();
        const activeTask = tasks.find((task) => task.id === activeTaskId);
        if (activeTask) {
          safeUpdateTask(activeTask.id, { completed: !activeTask.completed });
        }
        return;
      }

      if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const priorityMap = {
          1: "low",
          2: "medium",
          3: "high",
          4: "urgent",
        };
        const nextPriority = priorityMap[event.key];
        if (selectedTaskIds.length > 1) {
          handleBulkUpdate({ priority: nextPriority }, "Zmieniono priorytet zaznaczonych zadan.");
        } else {
          safeUpdateTask(activeTaskId, { priority: nextPriority }, "Zmieniono priorytet zadania.");
        }
      }
    }

    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
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
    <div className="tasks-layout ms-todo">
      <TasksSidebar
        sidebarLists={sidebarLists}
        selectedListId={selectedListId}
        setSelectedListId={setSelectedListId}
        workspaceName={workspaceName}
        workspaceInviteCode={workspaceInviteCode}
        stats={stats}
        visibleStats={visibleStats}
        googleTasksEnabled={googleTasksEnabled}
        googleTasksStatus={googleTasksStatus}
        googleTasksMessage={googleTasksMessage}
        googleTasksLastSyncedAt={googleTasksLastSyncedAt}
        selectedGoogleTaskListId={selectedGoogleTaskListId}
        onSelectGoogleTaskList={onSelectGoogleTaskList}
        googleTaskLists={googleTaskLists}
        onConnectGoogleTasks={onConnectGoogleTasks}
        onImportGoogleTasks={onImportGoogleTasks}
        onExportGoogleTasks={onExportGoogleTasks}
        onRefreshGoogleTasks={onRefreshGoogleTasks}
        showColumnManager={showColumnManager}
        setShowColumnManager={setShowColumnManager}
        boardColumns={boardColumns}
        onUpdateColumn={onUpdateColumn}
        onDeleteColumn={onDeleteColumn}
        columnDraft={columnDraft}
        setColumnDraft={setColumnDraft}
        submitColumn={submitColumn}
        currentUserName={currentUserName}
        quickAddInputRef={quickAddInputRef}
        searchInputRef={searchInputRef}
        selectedTaskIds={selectedTaskIds}
        selectedTaskCount={selectedTaskIds.length}
        clearTaskSelection={clearTaskSelection}
        handleBulkUpdate={handleBulkUpdate}
        handleBulkDelete={handleBulkDelete}
        taskNotifications={taskNotifications}
        selectedTasks={selectedTasks}
        selectedTaskSla={selectedTaskSla}
        shellStatus={shellStatus}
        conflictTasks={conflictTasks}
        onFocusConflictTask={(taskId) => {
          setSelectedTaskId(taskId);
          setSelectedTaskIds([taskId]);
          setViewMode("list");
        }}
      />

      <TasksWorkspaceView
        selectedListLabel={getSelectedListLabel(sidebarLists, selectedListId)}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        swimlaneGroupBy={swimlaneGroupBy}
        setSwimlaneGroupBy={setSwimlaneGroupBy}
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
        message={message}
        groupedTasks={groupedTasks}
        allVisibleTasks={visibleTasks}
        selectedTask={selectedTask}
        setSelectedTaskId={setSelectedTaskId}
        onUpdateTask={safeUpdateTask}
        onMoveTaskToColumn={safeMoveTaskToColumn}
        kanbanColumns={kanbanColumns}
        dropColumnId={dropColumnId}
        setDropColumnId={setDropColumnId}
        handleDrop={handleColumnDrop}
        handleGroupDrop={handleGroupDrop}
        handleTaskDrop={handleTaskDrop}
        setDragTaskId={rememberDraggedTask}
        onQuickAddToColumn={handleQuickAddToColumn}
        onReorderColumns={handleColumnReorder}
        stats={stats}
        visibleStats={visibleStats}
        selectedTaskIds={selectedTaskIds}
        toggleTaskSelection={toggleTaskSelection}
        clearTaskSelection={clearTaskSelection}
        handleBulkUpdate={handleBulkUpdate}
        handleBulkDelete={handleBulkDelete}
        taskNotifications={taskNotifications}
        workspaceActivity={workspaceActivity}
        visibleTaskCount={visibleTasks.length}
      />

      <TaskDetailsPanel
        selectedTask={selectedTask}
        tasks={tasks}
        peopleOptions={peopleOptions}
        taskGroups={taskGroups}
        boardColumns={boardColumns}
        onUpdateTask={safeUpdateTask}
        onMoveTaskToColumn={safeMoveTaskToColumn}
        onDeleteTask={safeDeleteTask}
        onOpenMeeting={onOpenMeeting}
        currentUserName={currentUserName}
        onResolveGoogleTaskConflict={onResolveGoogleTaskConflict}
      />
    </div>
  );
}
