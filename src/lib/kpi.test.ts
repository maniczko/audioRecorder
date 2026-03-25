import { buildWorkspaceKpiDashboard } from './kpi';

describe('workspace KPI dashboard', () => {
  test('builds KPI totals and trend points for meetings and tasks', () => {
    const meetings = [
      {
        id: 'meeting_1',
        startsAt: '2026-03-14T10:00:00.000Z',
        analysis: {
          decisions: ['A', 'B'],
        },
      },
      {
        id: 'meeting_2',
        startsAt: '2026-03-10T10:00:00.000Z',
        analysis: {
          decisions: ['C'],
        },
      },
    ];
    const tasks = [
      {
        id: 'task_1',
        dueDate: '2026-03-14T12:00:00.000Z',
        completed: false,
        sourceType: 'meeting',
        sourceMeetingId: 'meeting_1',
      },
      {
        id: 'task_2',
        dueDate: '2026-03-13T12:00:00.000Z',
        completed: true,
        sourceType: 'manual',
      },
    ];

    const result = buildWorkspaceKpiDashboard(meetings, tasks, {
      rangeDays: 'all',
      trend: 'weekly',
    });

    expect(result.kpis).toMatchObject({
      decisions: 3,
      openTasks: 1,
      tasksAfterMeetings: 1,
    });
    expect(result.trendPoints.length).toBeGreaterThan(0);
  });
});
