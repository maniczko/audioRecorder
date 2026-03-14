import { TASK_PRIORITIES } from "../lib/tasks";

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function toInputDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function formatListDueDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function dueTone(value) {
  if (!value) {
    return "normal";
  }

  const date = new Date(value).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today.getTime()) {
    return "danger";
  }

  return "normal";
}

export function buildSidebarLists(tasks, boardColumns) {
  const baseLists = [
    {
      id: "smart:my_day",
      label: "My Day",
      count: tasks.filter((task) => {
        if (!task.dueDate || task.completed) {
          return false;
        }
        return new Date(task.dueDate).toDateString() === new Date().toDateString();
      }).length,
    },
    { id: "smart:important", label: "Important", count: tasks.filter((task) => task.important).length },
    { id: "smart:planned", label: "Planned", count: tasks.filter((task) => task.dueDate).length },
    { id: "smart:assigned", label: "Assigned to me", count: tasks.filter((task) => task.assignedToMe).length },
    { id: "smart:all", label: "Tasks", count: tasks.length },
  ];

  const workspaceLists = boardColumns.map((column) => ({
    id: `column:${column.id}`,
    label: column.label,
    count: tasks.filter((task) => task.status === column.id).length,
  }));

  return { baseLists, workspaceLists };
}

export function applyMainListFilter(tasks, mainListId, boardColumns) {
  if (!mainListId || mainListId === "smart:all") {
    return tasks;
  }

  if (mainListId === "smart:my_day") {
    const today = new Date().toDateString();
    return tasks.filter((task) => task.dueDate && !task.completed && new Date(task.dueDate).toDateString() === today);
  }

  if (mainListId === "smart:important") {
    return tasks.filter((task) => task.important);
  }

  if (mainListId === "smart:planned") {
    return tasks.filter((task) => Boolean(task.dueDate));
  }

  if (mainListId === "smart:assigned") {
    return tasks.filter((task) => task.assignedToMe);
  }

  if (mainListId.startsWith("column:")) {
    const columnId = mainListId.slice("column:".length);
    if (boardColumns.some((column) => column.id === columnId)) {
      return tasks.filter((task) => task.status === columnId);
    }
  }

  return tasks;
}

function priorityRank(priority) {
  return ["urgent", "high", "medium", "low"].indexOf(priority);
}

export function sortVisibleTasks(tasks, sortBy) {
  return [...tasks].sort((left, right) => {
    if (sortBy === "title") {
      return left.title.localeCompare(right.title);
    }
    if (sortBy === "due") {
      return new Date(left.dueDate || 0).getTime() - new Date(right.dueDate || 0).getTime();
    }
    if (sortBy === "owner") {
      return (left.owner || "").localeCompare(right.owner || "");
    }
    if (sortBy === "priority") {
      return priorityRank(left.priority) - priorityRank(right.priority);
    }
    return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
  });
}

export function groupTasks(tasks, groupBy, boardColumns) {
  if (groupBy === "none") {
    return [{ id: "all", label: "", tasks }];
  }

  const map = new Map();
  tasks.forEach((task) => {
    let key = "other";
    let label = "Other";

    if (groupBy === "status") {
      key = task.status;
      label = boardColumns.find((column) => column.id === task.status)?.label || task.status;
    } else if (groupBy === "owner") {
      key = task.owner || "unassigned";
      label = task.owner || "Nieprzypisane";
    } else if (groupBy === "priority") {
      key = task.priority;
      label = TASK_PRIORITIES.find((priority) => priority.id === task.priority)?.label || task.priority;
    } else if (groupBy === "source") {
      key = task.sourceType;
      label = task.sourceType === "meeting" ? "Spotkania" : task.sourceType === "google" ? "Google Tasks" : "Reczne";
    }

    const bucket = map.get(key) || { id: key, label, tasks: [] };
    bucket.tasks.push(task);
    map.set(key, bucket);
  });

  return [...map.values()];
}

export function createQuickDraft(boardColumns) {
  return {
    title: "",
    owner: "",
    dueDate: "",
    description: "",
    status: boardColumns.find((column) => !column.isDone)?.id || boardColumns[0]?.id || "",
    important: false,
    priority: "medium",
    tags: "",
    notes: "",
  };
}

export function canDrop(event) {
  if (event.dataTransfer) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }
}

export function handleCardKeyDown(event, callback) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
}
