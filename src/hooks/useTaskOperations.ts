import {
  buildTaskChangeHistory,
  buildTaskReorderUpdate,
  createManualTask,
  createRecurringTaskFromTask,
  getNextTaskOrderTop,
  getTaskOrder,
  rebalanceTaskOrders,
  shouldRebalanceTaskOrders,
  updateTaskColumns,
  createTaskColumn,
  validateTaskDependencies,
  validateTaskCompletion,
} from '../lib/tasks';
import { normalizeTaskUpdatePayload } from '../lib/appState';
import { normalizeGoogleTaskSyncState } from '../lib/googleSync';

function normalizedText(value) {
  return String(value || '').trim();
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function isSameRecurringOccurrence(candidate, generatedTask) {
  if (!candidate || !generatedTask) {
    return false;
  }

  const occurrenceDate = normalizedText(generatedTask.recurrenceOccurrenceDate);
  if (!occurrenceDate) {
    return false;
  }

  const candidateOccurrenceDate =
    normalizedText(candidate.recurrenceOccurrenceDate) || normalizedText(candidate.dueDate);
  if (candidateOccurrenceDate !== occurrenceDate) {
    return false;
  }

  const generatedFromTaskId = normalizedText(generatedTask.recurrenceGeneratedFromTaskId);
  const parentId = normalizedText(generatedTask.recurrenceParentId);
  const candidateGeneratedFromTaskId = normalizedText(candidate.recurrenceGeneratedFromTaskId);
  const candidateParentId = normalizedText(candidate.recurrenceParentId);

  if (generatedFromTaskId && candidateGeneratedFromTaskId === generatedFromTaskId) {
    return true;
  }
  if (parentId && candidateParentId === parentId) {
    return true;
  }

  return (
    !candidateGeneratedFromTaskId &&
    !candidateParentId &&
    normalizedText(candidate.title) === normalizedText(generatedTask.title) &&
    sameJson(candidate.recurrence, generatedTask.recurrence)
  );
}

function prependUniqueRecurringTasks(previous, recurringTasks) {
  const uniqueRecurringTasks: any[] = [];
  (Array.isArray(recurringTasks) ? recurringTasks : []).filter(Boolean).forEach((recurringTask) => {
    const exists =
      previous.some((candidate) => isSameRecurringOccurrence(candidate, recurringTask)) ||
      uniqueRecurringTasks.some((candidate) => isSameRecurringOccurrence(candidate, recurringTask));
    if (!exists) {
      uniqueRecurringTasks.push(recurringTask);
    }
  });

  return uniqueRecurringTasks.length ? [...uniqueRecurringTasks, ...previous] : previous;
}

function taskScopeValue(value) {
  return String(value || '');
}

function isTaskInOrderScope(task, status, group) {
  return (
    taskScopeValue(task?.status) === taskScopeValue(status) &&
    taskScopeValue(task?.group) === taskScopeValue(group)
  );
}

function getGoogleTaskSyncIdentity(task) {
  const sync = normalizeGoogleTaskSyncState(task);
  return sync?.taskId || task?.googleTaskId || '';
}

function insertTaskByPlacement(sortedTasks, movingTask, placement) {
  const nextTasks = sortedTasks.filter((task) => task.id !== movingTask.id);
  const previousIndex = nextTasks.findIndex((task) => task.id === placement.previousTaskId);
  const nextIndex = nextTasks.findIndex((task) => task.id === placement.nextTaskId);

  if (previousIndex >= 0) {
    nextTasks.splice(previousIndex + 1, 0, movingTask);
    return nextTasks;
  }

  if (nextIndex >= 0) {
    nextTasks.splice(nextIndex, 0, movingTask);
    return nextTasks;
  }

  return [movingTask, ...nextTasks];
}

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
    const actor = currentUser?.name || currentUser?.email || 'Ty';
    const shouldMarkGoogleLocalChanges =
      Boolean(getGoogleTaskSyncIdentity(task)) &&
      updates.googleSyncStatus === undefined &&
      updates.googleSync === undefined;
    const googleSyncPatch = shouldMarkGoogleLocalChanges
      ? {
          googleSyncStatus: 'local_changes',
          googleLocalUpdatedAt: updatedAt,
          googleSyncConflict: null,
          googleSync: normalizeGoogleTaskSyncState(task, {
            status: 'local_changes',
            localUpdatedAt: updatedAt,
            conflict: null,
          }),
        }
      : {};
    const nextTask = {
      ...task,
      ...normalizedUpdates,
      ...googleSyncPatch,
      updatedAt,
    };
    const nextHistory = [
      ...(normalizedUpdates.history || task.history || []),
      ...buildTaskChangeHistory(task, nextTask, actor, taskColumns),
    ];
    const nextPayload = {
      ...normalizedUpdates,
      ...googleSyncPatch,
      history: nextHistory,
      updatedAt,
    };
    const shouldCreateRecurringFollowUp =
      !task.completed &&
      nextPayload.completed &&
      currentUser &&
      currentWorkspaceId &&
      nextTask.recurrence;

    return {
      task,
      nextTask,
      nextPayload,
      recurringTask: shouldCreateRecurringFollowUp
        ? createRecurringTaskFromTask(
            nextTask,
            currentUser.id,
            currentWorkspaceId,
            taskColumns,
            taskCollection
          )
        : null,
    };
  }

  function updateTask(taskId, updates) {
    const task = meetingTasks.find((item) => item.id === taskId);
    if (!task) return null;

    const { nextPayload, nextTask, recurringTask } = prepareTaskMutation(task, updates);

    if (task.sourceType === 'manual' || task.sourceType === 'google') {
      setManualTasks((previous) =>
        prependUniqueRecurringTasks(
          previous.map((item) =>
            item.id !== taskId
              ? item
              : {
                  ...item,
                  ...nextPayload,
                }
          ),
          recurringTask ? [recurringTask] : []
        )
      );
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
      setManualTasks((previous) => prependUniqueRecurringTasks(previous, [recurringTask]));
    }

    return nextTask;
  }

  function applyTaskOrderPayloads(payloadsByTaskId) {
    if (!payloadsByTaskId?.size) {
      return;
    }

    const updatedAt = new Date().toISOString();
    const manualPayloads = new Map();
    const derivedPayloads = {};

    payloadsByTaskId.forEach((payload, taskId) => {
      const task = meetingTasks.find((item) => item.id === taskId);
      if (!task) {
        return;
      }

      const nextPayload = {
        ...payload,
        updatedAt,
      };

      if (task.sourceType === 'manual' || task.sourceType === 'google') {
        manualPayloads.set(taskId, nextPayload);
        return;
      }

      derivedPayloads[taskId] = nextPayload;
    });

    if (manualPayloads.size) {
      setManualTasks((previous) =>
        previous.map((item) =>
          manualPayloads.has(item.id)
            ? {
                ...item,
                ...manualPayloads.get(item.id),
              }
            : item
        )
      );
    }

    if (Object.keys(derivedPayloads).length) {
      setTaskState((previous) => {
        const nextState = { ...previous };
        Object.entries(derivedPayloads).forEach(([taskId, nextPayload]) => {
          nextState[taskId] = {
            ...(previous[taskId] || {}),
            ...(nextPayload && typeof nextPayload === 'object' ? nextPayload : {}),
          };
        });
        return nextState;
      });
    }
  }

  function buildRebalancedReorderPayloads(task, placement) {
    const nextStatus = placement.status !== undefined ? placement.status : task.status;
    const nextGroup = placement.group !== undefined ? placement.group : task.group;
    const destinationTasks = meetingTasks
      .filter((item) => item.id !== task.id && isTaskInOrderScope(item, nextStatus, nextGroup))
      .sort((left, right) => getTaskOrder(left) - getTaskOrder(right));

    if (!shouldRebalanceTaskOrders(destinationTasks)) {
      return null;
    }

    const movingTask = {
      ...task,
      ...(placement.status !== undefined ? { status: placement.status } : {}),
      ...(placement.group !== undefined ? { group: placement.group } : {}),
    };
    const orderedTasks = insertTaskByPlacement(destinationTasks, movingTask, placement);
    const payloadsByTaskId = new Map();

    rebalanceTaskOrders(orderedTasks).forEach((nextTask) => {
      const payload: Record<string, any> = {
        order: nextTask.order,
      };

      if (nextTask.id === task.id) {
        if (placement.status !== undefined) {
          payload.status = placement.status;
        }
        if (placement.group !== undefined) {
          payload.group = placement.group;
        }
      }

      payloadsByTaskId.set(nextTask.id, payload);
    });

    return payloadsByTaskId;
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
    const columnTasks = meetingTasks.filter(
      (task) => task.id !== taskId && task.status === columnId
    );
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
    const rebalancedPayloads = buildRebalancedReorderPayloads(task, placement);
    if (rebalancedPayloads) {
      applyTaskOrderPayloads(rebalancedPayloads);
      return;
    }

    updateTask(taskId, buildTaskReorderUpdate(meetingTasks, placement));
  }

  function bulkUpdateTasks(taskIds, updates) {
    const selectedIds = [
      ...new Set((Array.isArray(taskIds) ? taskIds : []).map(String).filter(Boolean)),
    ];
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
        .filter(({ task }) => task.sourceType === 'manual' || task.sourceType === 'google')
        .map(({ task, nextPayload }) => [task.id, nextPayload])
    );
    const derivedPayloads = Object.fromEntries(
      mutations
        .filter(({ task }) => task.sourceType !== 'manual' && task.sourceType !== 'google')
        .map(({ task, nextPayload }) => [task.id, nextPayload])
    );

    if (manualPayloads.size) {
      setManualTasks((previous) =>
        prependUniqueRecurringTasks(
          previous.map((item) =>
            manualPayloads.has(item.id)
              ? {
                  ...item,
                  ...manualPayloads.get(item.id),
                }
              : item
          ),
          recurringTasks
        )
      );
    } else if (recurringTasks.length) {
      setManualTasks((previous) => prependUniqueRecurringTasks(previous, recurringTasks));
    }

    if (Object.keys(derivedPayloads).length) {
      setTaskState((previous) => {
        const nextState = { ...previous };
        Object.entries(derivedPayloads).forEach(([taskId, nextPayload]) => {
          nextState[taskId] = {
            ...(previous[taskId] || {}),
            ...(nextPayload && typeof nextPayload === 'object' ? nextPayload : {}),
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
    const nextColumns = taskColumns.map((column) =>
      column.id === columnId ? { ...column, ...updates } : column
    );
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

    if (task.sourceType === 'manual') {
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
    [...new Set((Array.isArray(taskIds) ? taskIds : []).map(String).filter(Boolean))].forEach(
      (taskId) => {
        deleteTask(taskId);
      }
    );
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
