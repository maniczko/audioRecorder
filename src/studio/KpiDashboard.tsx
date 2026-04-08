import { useMemo, useState } from 'react';
import { VercelDeploymentsChart } from './VercelDeploymentsChart';
import { buildWorkspaceKpiDashboard } from '../lib/kpi';
import './KpiDashboardStyles.css';

function KpiCard({ label, value, tone = 'info' }) {
  return (
    <article className={`workspace-kpi-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function KpiDashboard({ workspaceName, meetings, tasks }: any) {
  const [rangeDays, setRangeDays] = useState<number | 'all'>(30);
  const [trend, setTrend] = useState<'weekly' | 'monthly'>('weekly');

  const dashboard = useMemo(
    () =>
      buildWorkspaceKpiDashboard(meetings, tasks, {
        rangeDays: rangeDays === 'all' ? undefined : rangeDays,
        trend,
      }),
    [meetings, rangeDays, tasks, trend]
  );
  const maxBarValue = Math.max(
    1,
    ...dashboard.trendPoints.map((point) => Math.max(point.meetings, point.decisions, point.tasks))
  );

  return (
    <section className="panel workspace-kpi-panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">KPI dashboard</div>
          <h2>Spotkania i follow-upy</h2>
        </div>
        <div className="status-cluster">
          <span className="status-chip">{workspaceName || 'Workspace'}</span>
          <span className="status-chip">{dashboard.meetings} spotkan w zakresie</span>
        </div>
      </div>

      <div className="workspace-kpi-toolbar">
        <label>
          <span>Zakres dat</span>
          <select
            value={String(rangeDays)}
            onChange={(event) => {
              const value = event.target.value;
              setRangeDays(value === 'all' ? 'all' : Number(value));
            }}
          >
            <option value="7">7 dni</option>
            <option value="30">30 dni</option>
            <option value="90">90 dni</option>
            <option value="all">Caly workspace</option>
          </select>
        </label>
        <div className="review-filter-group">
          <button
            type="button"
            className={trend === 'weekly' ? 'pill active' : 'pill'}
            onClick={() => setTrend('weekly')}
          >
            Tygodniowo
          </button>
          <button
            type="button"
            className={trend === 'monthly' ? 'pill active' : 'pill'}
            onClick={() => setTrend('monthly')}
          >
            Miesiecznie
          </button>
        </div>
      </div>

      <div className="workspace-kpi-grid">
        <KpiCard label="Decyzje" value={dashboard.kpis.decisions} />
        <KpiCard label="Otwarte taski" value={dashboard.kpis.openTasks} />
        <KpiCard label="Po terminie" value={dashboard.kpis.overdue} tone="danger" />
        <KpiCard
          label="Taski po spotkaniach"
          value={dashboard.kpis.tasksAfterMeetings}
          tone="warning"
        />
      </div>

      <div className="workspace-kpi-trend">
        {dashboard.trendPoints.length ? (
          dashboard.trendPoints.map((point) => (
            <article key={point.key} className="workspace-kpi-bar-card">
              <strong>{point.label}</strong>
              <div className="workspace-kpi-bars">
                <span
                  className="workspace-kpi-bar meetings"
                  style={{
                    height: `${Math.max((point.meetings / maxBarValue) * 100, point.meetings ? 12 : 0)}%`,
                  }}
                  title={`Spotkania: ${point.meetings}`}
                />
                <span
                  className="workspace-kpi-bar decisions"
                  style={{
                    height: `${Math.max((point.decisions / maxBarValue) * 100, point.decisions ? 12 : 0)}%`,
                  }}
                  title={`Decyzje: ${point.decisions}`}
                />
                <span
                  className="workspace-kpi-bar tasks"
                  style={{
                    height: `${Math.max((point.tasks / maxBarValue) * 100, point.tasks ? 12 : 0)}%`,
                  }}
                  title={`Taski: ${point.tasks}`}
                />
              </div>
              <small>
                {point.meetings} spotk. | {point.decisions} dec. | {point.tasks} task.
              </small>
            </article>
          ))
        ) : (
          <div className="empty-panel">
            <strong>Brak danych w zakresie</strong>
            <span>Zmien zakres dat albo przelacz workspace, aby zobaczyc KPI.</span>
          </div>
        )}
      </div>

      {/* Vercel Deployments Chart (from window.EXTERNAL_SERVICES_DATA) */}
      {typeof window !== 'undefined' && window.EXTERNAL_SERVICES_DATA?.vercel?.stats?.daily && (
        <VercelDeploymentsChart
          stats={{ daily: window.EXTERNAL_SERVICES_DATA.vercel.stats.daily }}
        />
      )}
    </section>
  );
}
