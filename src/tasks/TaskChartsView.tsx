import { memo } from 'react';
import { TASK_PRIORITIES } from '../lib/tasks';
import './TaskChartsViewStyles.css';

const PRIORITY_COLORS = { urgent: '#f17d72', high: '#f3ca72', medium: '#75d6c4', low: '#8db4ff' };

function DonutChart({ title, segments, total }) {
  const R = 52;
  const cx = 70;
  const cy = 70;
  const strokeWidth = 22;
  const circ = 2 * Math.PI * R;

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0;
    const dash = pct * circ;
    const arc = { ...seg, dashOffset: circ - cumulative, dash, gap: circ - dash };
    cumulative += dash;
    return arc;
  });

  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-donut-body">
        <svg viewBox="0 0 140 140" width="140" height="140" aria-label={`Wykres kołowy: ${title}`}>
          <circle
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke="var(--surface-2, #2a2a3a)"
            strokeWidth={strokeWidth}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={cx}
              cy={cy}
              r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dash} ${arc.gap}`}
              strokeDashoffset={arc.dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" className="chart-center-value">
            {total}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" className="chart-center-label">
            zadań
          </text>
        </svg>
        <div className="chart-legend">
          {segments.map((seg) => (
            <div key={seg.label} className="chart-legend-item">
              <span className="chart-legend-dot" style={{ backgroundColor: seg.color }} />
              <span className="chart-legend-text">{seg.label}</span>
              <strong className="chart-legend-val">{seg.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart({ title, bars, maxValue }) {
  return (
    <div className="chart-card">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-bar-list">
        {bars.length ? (
          bars.map((bar) => (
            <div key={bar.label} className="chart-bar-row">
              <span className="chart-bar-label" title={bar.label}>
                {bar.label}
              </span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar-fill"
                  style={{
                    width: `${maxValue > 0 ? (bar.value / maxValue) * 100 : 0}%`,
                    backgroundColor: bar.color,
                  }}
                />
              </div>
              <strong className="chart-bar-val">{bar.value}</strong>
            </div>
          ))
        ) : (
          <p className="chart-empty">Brak danych do wyswietlenia.</p>
        )}
      </div>
    </div>
  );
}

function TaskChartsView({ tasks, boardColumns }) {
  const now = Date.now();
  const day = 86400000;

  const statusSegments = boardColumns
    .map((col) => ({
      label: col.label,
      value: tasks.filter((t) => t.status === col.id).length,
      color: col.color,
    }))
    .filter((s) => s.value > 0);

  const prioritySegments = TASK_PRIORITIES.map((p) => ({
    label: p.label,
    value: tasks.filter((t) => t.priority === p.id).length,
    color: PRIORITY_COLORS[p.id] || '#8db4ff',
  })).filter((s) => s.value > 0);

  const personMap = new Map();
  tasks
    .filter((t) => !t.completed)
    .forEach((t) => {
      const people = t.assignedTo?.length ? t.assignedTo : t.owner ? [t.owner] : ['Nieprzypisane'];
      people.forEach((p) => personMap.set(p, (personMap.get(p) || 0) + 1));
    });
  const personBars = [...personMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], i) => ({
      label,
      value,
      color: [
        '#5a92ff',
        '#8a6bff',
        '#67d59f',
        '#34c5b5',
        '#f3ca72',
        '#f3a46e',
        '#f17d72',
        '#e879a0',
      ][i % 8],
    }));

  const dueBars = [
    {
      label: 'Po terminie',
      color: '#f17d72',
      value: tasks.filter((t) => !t.completed && t.dueDate && new Date(t.dueDate).getTime() < now)
        .length,
    },
    {
      label: 'Dzisiaj',
      color: '#f3ca72',
      value: tasks.filter(
        (t) =>
          !t.completed &&
          t.dueDate &&
          new Date(t.dueDate).getTime() >= now &&
          new Date(t.dueDate).getTime() < now + day
      ).length,
    },
    {
      label: 'Ten tydzien',
      color: '#75d6c4',
      value: tasks.filter(
        (t) =>
          !t.completed &&
          t.dueDate &&
          new Date(t.dueDate).getTime() >= now + day &&
          new Date(t.dueDate).getTime() < now + 7 * day
      ).length,
    },
    {
      label: 'Pozniej',
      color: '#67d59f',
      value: tasks.filter(
        (t) => !t.completed && t.dueDate && new Date(t.dueDate).getTime() >= now + 7 * day
      ).length,
    },
    {
      label: 'Bez terminu',
      color: '#8db4ff',
      value: tasks.filter((t) => !t.dueDate).length,
    },
  ];

  const maxPerson = Math.max(...personBars.map((b) => b.value), 1);
  const maxDue = Math.max(...dueBars.map((b) => b.value), 1);
  const totalTasks = tasks.length;

  return (
    <div className="task-charts-view">
      <div className="charts-grid">
        <DonutChart title="Status zadań" segments={statusSegments} total={totalTasks} />
        <DonutChart title="Priorytet" segments={prioritySegments} total={totalTasks} />
        <BarChart title="Otwarte zadania per osoba" bars={personBars} maxValue={maxPerson} />
        <BarChart title="Terminy realizacji" bars={dueBars} maxValue={maxDue} />
      </div>
    </div>
  );
}

// Memoize chart view to prevent re-renders when tasks haven't changed
export default memo(TaskChartsView, (prevProps, nextProps) => {
  return prevProps.tasks === nextProps.tasks && prevProps.boardColumns === nextProps.boardColumns;
});
