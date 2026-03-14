import { useEffect, useMemo, useRef, useState } from "react";
import { buildTaskGroups, taskListStats } from "./lib/tasks";
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
  externalSelectedTaskId,
  onTaskSelectionHandled,
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
  const dragTaskIdRef = useRef("");

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
      return;
    }

    if (!visibleTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(visibleTasks[0].id);
    }
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

  function rememberDraggedTask(taskId) {
    dragTaskIdRef.current = taskId || "";
    setDragTaskId(taskId || "");
  }

  function submitQuickTask(event) {
    event.preventDefault();

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

    if (typeof update === "string") {
      onMoveTaskToColumn(taskId, update);
    } else {
      onUpdateTask(taskId, update);
    }

    rememberDraggedTask("");
    setDropColumnId("");
    setMessage(successMessage);
  }

  function handleDrop(columnId, event) {
    canDrop(event);
    finalizeDrop(readDragTask(event) || dragTaskIdRef.current || dragTaskId, columnId, "Przeniesiono zadanie do nowej kolumny.");
  }

  function handleGroupDrop(groupId, event) {
    canDrop(event);
    const taskId = readDragTask(event) || dragTaskIdRef.current || dragTaskId;
    if (!taskId) {
      return;
    }

    if (groupBy === "status") {
      finalizeDrop(taskId, groupId, "Przeniesiono zadanie do nowej kolumny.");
      return;
    }

    if (groupBy === "group") {
      finalizeDrop(taskId, { group: groupId === "__ungrouped__" ? "" : groupId }, "Zmieniono grupe zadania.");
    }
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
        visibleStats={visibleStats}
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
        selectedListLabel={getSelectedListLabel(sidebarLists, selectedListId)}
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
        taskGroups={taskGroups}
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
        onMoveTaskToColumn={onMoveTaskToColumn}
        kanbanColumns={kanbanColumns}
        dropColumnId={dropColumnId}
        setDropColumnId={setDropColumnId}
        handleDrop={handleDrop}
        handleGroupDrop={handleGroupDrop}
        setDragTaskId={rememberDraggedTask}
        stats={stats}
        visibleStats={visibleStats}
      />

      <TaskDetailsPanel
        selectedTask={selectedTask}
        peopleOptions={peopleOptions}
        taskGroups={taskGroups}
        boardColumns={boardColumns}
        onUpdateTask={onUpdateTask}
        onMoveTaskToColumn={onMoveTaskToColumn}
        onDeleteTask={onDeleteTask}
        onOpenMeeting={onOpenMeeting}
      />
    </div>
  );
}
