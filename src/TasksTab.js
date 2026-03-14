import { useEffect, useMemo, useState } from "react";
import { taskListStats } from "./lib/tasks";
import TaskDetailsPanel from "./tasks/TaskDetailsPanel";
import TasksSidebar from "./tasks/TasksSidebar";
import TasksWorkspaceView from "./tasks/TasksWorkspaceView";
import {
  applyMainListFilter,
  buildSidebarLists,
  canDrop,
  createQuickDraft,
  groupTasks,
  sortVisibleTasks,
  safeArray,
} from "./tasks/taskViewUtils";

export default function TasksTab({
  tasks,
  peopleOptions,
  tagOptions,
  boardColumns,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onMoveTaskToColumn,
  onCreateColumn,
  onUpdateColumn,
  onDeleteColumn,
  onOpenMeeting,
  defaultView,
  googleTasksEnabled,
  googleTasksStatus,
  googleTasksMessage,
  googleTaskLists,
  selectedGoogleTaskListId,
  onSelectGoogleTaskList,
  onConnectGoogleTasks,
  onImportGoogleTasks,
  onExportGoogleTasks,
  workspaceName,
  workspaceInviteCode,
}) {
  const [viewMode, setViewMode] = useState(defaultView === "kanban" ? "kanban" : "list");
  const [selectedListId, setSelectedListId] = useState("smart:all");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [groupBy, setGroupBy] = useState("none");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [dragTaskId, setDragTaskId] = useState("");
  const [dropColumnId, setDropColumnId] = useState("");
  const [message, setMessage] = useState("");
  const [quickDraft, setQuickDraft] = useState(() => createQuickDraft(boardColumns));
  const [columnDraft, setColumnDraft] = useState({ label: "", color: "#5a92ff", isDone: false });

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
        const haystack = [
          task.title,
          task.owner,
          task.description,
          task.notes,
          safeArray(task.tags).join(" "),
        ]
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

  useEffect(() => {
    if (!visibleTasks.length) {
      setSelectedTaskId("");
      return;
    }

    if (!visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].id);
    }
  }, [visibleTasks, selectedTaskId]);

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

  function submitQuickTask(event) {
    event.preventDefault();
    try {
      const taskId = onCreateTask(quickDraft);
      setQuickDraft(createQuickDraft(boardColumns));
      setMessage("Dodano zadanie.");
      if (taskId) {
        setSelectedTaskId(taskId);
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

  function handleDrop(columnId, event) {
    canDrop(event);
    const taskId = event.dataTransfer?.getData("text/plain") || dragTaskId;
    if (!taskId) {
      return;
    }

    onMoveTaskToColumn(taskId, columnId);
    setDragTaskId("");
    setDropColumnId("");
    setMessage("Przeniesiono zadanie.");
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

  return (
    <div className="tasks-layout ms-todo">
      <TasksSidebar
        sidebarLists={sidebarLists}
        selectedListId={selectedListId}
        setSelectedListId={setSelectedListId}
        workspaceName={workspaceName}
        workspaceInviteCode={workspaceInviteCode}
        stats={stats}
        googleTasksEnabled={googleTasksEnabled}
        googleTasksStatus={googleTasksStatus}
        googleTasksMessage={googleTasksMessage}
        selectedGoogleTaskListId={selectedGoogleTaskListId}
        onSelectGoogleTaskList={onSelectGoogleTaskList}
        googleTaskLists={googleTaskLists}
        onConnectGoogleTasks={onConnectGoogleTasks}
        onImportGoogleTasks={onImportGoogleTasks}
        onExportGoogleTasks={onExportGoogleTasks}
        showColumnManager={showColumnManager}
        setShowColumnManager={setShowColumnManager}
        boardColumns={boardColumns}
        onUpdateColumn={onUpdateColumn}
        onDeleteColumn={onDeleteColumn}
        columnDraft={columnDraft}
        setColumnDraft={setColumnDraft}
        submitColumn={submitColumn}
      />

      <TasksWorkspaceView
        sidebarLists={sidebarLists}
        selectedListId={selectedListId}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        shareWorkspace={shareWorkspace}
        submitQuickTask={submitQuickTask}
        quickDraft={quickDraft}
        setQuickDraft={setQuickDraft}
        showAdvancedCreate={showAdvancedCreate}
        setShowAdvancedCreate={setShowAdvancedCreate}
        peopleOptions={peopleOptions}
        boardColumns={boardColumns}
        query={query}
        setQuery={setQuery}
        ownerFilter={ownerFilter}
        setOwnerFilter={setOwnerFilter}
        tagFilter={tagFilter}
        setTagFilter={setTagFilter}
        tagOptions={tagOptions}
        message={message}
        groupedTasks={groupedTasks}
        selectedTask={selectedTask}
        setSelectedTaskId={setSelectedTaskId}
        onUpdateTask={onUpdateTask}
        kanbanColumns={kanbanColumns}
        dropColumnId={dropColumnId}
        setDropColumnId={setDropColumnId}
        handleDrop={handleDrop}
        setDragTaskId={setDragTaskId}
      />

      <TaskDetailsPanel
        selectedTask={selectedTask}
        peopleOptions={peopleOptions}
        boardColumns={boardColumns}
        onUpdateTask={onUpdateTask}
        onMoveTaskToColumn={onMoveTaskToColumn}
        onDeleteTask={onDeleteTask}
        onOpenMeeting={onOpenMeeting}
      />
    </div>
  );
}
