import {
  buildTaskChangeHistory,
  buildTaskReorderUpdate,
  createManualTask,
  createRecurringTaskFromTask,
  getNextTaskOrderTop,
  updateTaskColumns,
  createTaskColumn,
  validateTaskDependencies,
  validateTaskCompletion,
} from "../lib/tasks";
import { normalizeTaskUpdatePayload } from "../lib/appState";

export default function useTaskOperations({
  currentUser,
  currentWorkspaceId,
  taskColumns,
  meetingTasks,
  setManualTasks,
  setTaskState,
  setTaskBoards,
}) {
  function prepareTaskMutation(task, updates, taskCollection = meetingTasks) {
    const normalizedUpdates = normalizeTaskUpdatePayload(task, updates, taskColumns);
    if (normalizedUpdates.dependencies !== undefined) {
      validateTaskDependencies(task.id, normalizedUpdates.dependencies, taskCollection);
    }
    validateTaskCompletion(task, normalizedUpdates, taskCollection, taskColumns);

    const updatedAt = new Date().toISOString();
    const actor = currentUser?.name || currentUser?.email || "Ty";
    const nextTask = {
      ...task,
      ...normalizedUpdates,
      ...(task.googleTaskId && updates.googleSyncStatus === undefined
        ? {
            googleSyncStatus: "local_changes",
            googleLocalUpdatedAt: updatedAt,
            googleSyncConflict: null,
          }
        : {}),
      updatedAt,
    };
    const syncPayload =
      task.googleTaskId && updates.googleSyncStatus === undefined
        ? {
            googleSyncStatus: "local_changes",
            googleLocalUpdatedAt: updatedAt,
            googleSyncConflict: null,
          }
        : {};
    const nextHistory = [
      ...(normalizedUpdates.history || task.history || []),
      ...buildTaskChangeHistory(task, nextTask, actor, taskColumns),
    ];
    const nextPayload = {
      ...normalizedUpdates,
      ...syncPayload,
      history: nextHistory,
      updatedAt,
    };
    const shouldCreateRecurringFollowUp =
      !task.completed && nextPayload.completed && currentUser && currentWorkspaceId && nextTask.recurrence;

    return {
      task,
      nextTask,
      nextPayload,
      recurringTask: shouldCreateRecurringFollowUp
        ? createRecurringTaskFromTask(nextTask, currentUser.id, currentWorkspaceId, taskColumns, taskCollection)
        : null,
    };
  }

  function updateTask(taskId, updates) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) return null;

    const { nextPayload, nextTask, recurringTask } = prepareTaskMutation(task, updates);

    if (task.sourceType === "manual" || task.sourceType === "google") {
      setManualTasks((previous) => [
        ...(recurringTask ? [recurringTask] : []),
        ...previous.map((item) =>
          item.id !== taskId
            ? item
            : {
                ...item,
                ...nextPayload,
              }
        ),
      ]);
      return nextTask;
    }

    setTaskState((previous) => ({
      ...previous,
      [taskId]: {
        ...(previous[taskId] || {}),
        ...nextPayload,
      },
    }));

    if (recurringTask) {
      setManualTasks((previous) => [recurringTask, ...previous]);
    }

    return nextTask;
  }

  function createTaskFromComposer(draft) {
    if (!currentUser || !currentWorkspaceId) return null;

    const task = createManualTask(
      currentUser.id,
      {
        ...draft,
        order: getNextTaskOrderTop(meetingTasks),
      },
      taskColumns,
      currentWorkspaceId
    );
    setManualTasks((previous) => [task, ...previous]);
    return task;
  }

  function moveTaskToColumn(taskId, columnId) {
    const columnTasks = meetingTasks.filter((task) => task.id !== taskId && task.status === columnId);
    updateTask(taskId, {
      status: columnId,
      order: getNextTaskOrderTop(columnTasks),
    });
  }

  function rescheduleTask(taskId, dueDate) {
    updateTask(taskId, { dueDate });
  }

  function reorderTask(taskId, placement) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) return;
    updateTask(taskId, buildTaskReorderUpdate(meetingTasks, placement));
  }

  function bulkUpdateTasks(taskIds, updates) {
    const selectedIds = [...new Set((Array.isArray(taskIds) ? taskIds : []).map(String).filter(Boolean))];
    if (!selectedIds.length) return;

    const selectedSet = new Set(selectedIds);
    const futureTaskMap = new Map(
      meetingTasks.map((task) => {
        if (!selectedSet.has(task.id)) return [task.id, task];
        const normalizedUpdates = normalizeTaskUpdatePayload(task, updates, taskColumns);
        return [task.id, { ...task, ...normalizedUpdates }];
      })
    );
    const futureTasks = meetingTasks.map((task) => futureTaskMap.get(task.id) || task);

    const mutations = selectedIds
      .map((taskId) => meetingTasks.find((task) => task.id === taskId))
      .filter(Boolean)
      .map((task) => prepareTaskMutation(task, updates, futureTasks));

    const recurringTasks = mutations.map((mutation) => mutation.recurringTask).filter(Boolean);
    const manualPayloads = new Map(
      mutations
        .filter(({ task }) => task.sourceType === "manual" || task.sourceType === "google")
        .map(({ task, nextPayload }) => [task.id, nextPayload])
    );
    const derivedPayloads = Object.fromEntries(
      mutations
        .filter(({ task }) => task.sourceType !== "manual" && task.sourceType !== "google")
        .map(({ task, nextPayload }) => [task.id, nextPayload])
    );

    if (manualPayloads.size) {
      setManualTasks((previous) => [
        ...recurringTasks,
        ...previous.map((item) =>
          manualPayloads.has(item.id)
            ? {
                ...item,
                ...manualPayloads.get(item.id),
              }
            : item
        ),
      ]);
    } else if (recurringTasks.length) {
      setManualTasks((previous) => [...recurringTasks, ...previous]);
    }

    if (Object.keys(derivedPayloads).length) {
      setTaskState((previous) => {
        const nextState = { ...previous };
        Object.entries(derivedPayloads).forEach(([taskId, nextPayload]) => {
          nextState[taskId] = {
            ...(previous[taskId] || {}),
            ...nextPayload,
          };
        });
        return nextState;
      });
    }
  }

  function addTaskColumn(draft) {
    if (!currentWorkspaceId) return;
    setTaskBoards((previous) => createTaskColumn(previous, currentWorkspaceId, draft));
  }

  function changeTaskColumn(columnId, updates) {
    if (!currentWorkspaceId) return;
    const nextColumns = taskColumns.map((column) => (column.id === columnId ? { ...column, ...updates } : column));
    setTaskBoards((previous) => updateTaskColumns(previous, currentWorkspaceId, nextColumns));
  }

  function removeTaskColumn(columnId) {
    if (!currentWorkspaceId) return;
    const column = taskColumns.find((item) => item.id === columnId);
    if (!column) return;

    const fallbackColumnId =
      taskColumns.find((item) => item.id !== columnId && !item.isDone)?.id ||
      taskColumns.find((item) => item.id !== columnId)?.id ||
      columnId;

    meetingTasks
      .filter((task) => task.status === columnId)
      .forEach((task) => {
        updateTask(task.id, { status: fallbackColumnId });
      });

    const nextColumns = taskColumns.filter((item) => item.id !== columnId);
    setTaskBoards((previous) => updateTaskColumns(previous, currentWorkspaceId, nextColumns));
  }

  function deleteTask(taskId) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) return;

    if (task.sourceType === "manual") {
      setManualTasks((previous) => previous.filter((item) => item.id !== taskId));
      return;
    }

    setTaskState((previous) => ({
      ...previous,
      [taskId]: {
        ...(previous[taskId] || {}),
        archived: true,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function bulkDeleteTasks(taskIds) {
    [...new Set((Array.isArray(taskIds) ? taskIds : []).map(String).filter(Boolean))].forEach((taskId) => {
      deleteTask(taskId);
    });
  }

  return {
    updateTask,
    createTaskFromComposer,
    moveTaskToColumn,
    rescheduleTask,
    reorderTask,
    bulkUpdateTasks,
    addTaskColumn,
    changeTaskColumn,
    removeTaskColumn,
    deleteTask,
    bulkDeleteTasks,
  };
}
