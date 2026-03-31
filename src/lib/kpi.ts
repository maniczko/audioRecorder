function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function normalizeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function withinRange(value, rangeDays) {
  const date = normalizeDate(value);
  if (!date) {
    return false;
  }

  if (!rangeDays || rangeDays === 'all') {
    return true;
  }

  const today = startOfDay(new Date());
  const floor = startOfDay(today);
  floor.setDate(floor.getDate() - Number(rangeDays) + 1);
  return date.getTime() >= floor.getTime();
}

function meetingDecisionCount(meeting) {
  return Array.isArray(meeting?.analysis?.decisions) ? meeting.analysis.decisions.length : 0;
}

function taskAfterMeeting(task) {
  return task?.sourceType === 'meeting' || Boolean(task?.sourceMeetingId);
}

function bucketKey(date, trend) {
  const safeDate = normalizeDate(date);
  if (!safeDate) {
    return '';
  }

  if (trend === 'monthly') {
    return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, '0')}`;
  }

  const weekStart = new Date(safeDate);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  return `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + new Date(weekStart.getFullYear(), weekStart.getMonth(), 1).getDay()) / 7)).padStart(2, '0')}`;
}

function bucketLabel(key, trend) {
  if (!key) {
    return '';
  }

  if (trend === 'monthly') {
    const [year, month] = key.split('-');
    return `${month}.${year}`;
  }

  return key.replace('-W', ' / W');
}

export function buildWorkspaceKpiDashboard(
  meetings: any[] = [],
  tasks: any[] = [],
  options: { rangeDays?: number; trend?: 'weekly' | 'monthly' } = {}
) {
  const rangeDays = options.rangeDays || 30;
  const trend = options.trend === 'monthly' ? 'monthly' : 'weekly';
  const filteredMeetings = (Array.isArray(meetings) ? meetings : []).filter((meeting) =>
    withinRange(meeting.startsAt || meeting.updatedAt || meeting.createdAt, rangeDays)
  );
  const filteredTasks = (Array.isArray(tasks) ? tasks : []).filter((task) =>
    withinRange(
      task.dueDate || task.sourceMeetingDate || task.updatedAt || task.createdAt,
      rangeDays
    )
  );

  const kpis = {
    decisions: filteredMeetings.reduce((sum, meeting) => sum + meetingDecisionCount(meeting), 0),
    openTasks: filteredTasks.filter((task) => !task.completed).length,
    overdue: filteredTasks.filter(
      (task) => !task.completed && normalizeDate(task.dueDate)?.getTime() < Date.now()
    ).length,
    tasksAfterMeetings: filteredTasks.filter((task) => taskAfterMeeting(task)).length,
  };

  const trendMap = new Map();
  filteredMeetings.forEach((meeting) => {
    const key = bucketKey(meeting.startsAt || meeting.updatedAt || meeting.createdAt, trend);
    if (!key) {
      return;
    }

    const current = trendMap.get(key) || {
      key,
      label: bucketLabel(key, trend),
      meetings: 0,
      decisions: 0,
      tasks: 0,
    };

    current.meetings += 1;
    current.decisions += meetingDecisionCount(meeting);
    trendMap.set(key, current);
  });

  filteredTasks.forEach((task) => {
    const key = bucketKey(
      task.dueDate || task.sourceMeetingDate || task.updatedAt || task.createdAt,
      trend
    );
    if (!key) {
      return;
    }

    const current = trendMap.get(key) || {
      key,
      label: bucketLabel(key, trend),
      meetings: 0,
      decisions: 0,
      tasks: 0,
    };

    current.tasks += 1;
    trendMap.set(key, current);
  });

  const trendPoints = [...trendMap.values()].sort((left, right) =>
    left.key.localeCompare(right.key)
  );

  return {
    rangeDays,
    trend,
    meetings: filteredMeetings.length,
    tasks: filteredTasks.length,
    kpis,
    trendPoints,
  };
}
