import { useMemo } from 'react';

interface VercelDeploymentsChartProps {
  stats: { daily: { date: string; deployments: number }[] };
}

export function VercelDeploymentsChart({ stats }: VercelDeploymentsChartProps) {
  const maxDeployments = useMemo(
    () => Math.max(1, ...stats.daily.map((d) => d.deployments)),
    [stats.daily]
  );

  return (
    <section className="vercel-deployments-chart">
      <h3 className="chart-title">Vercel deployments per day</h3>
      <div className="chart-bar-list">
        {stats.daily.length ? (
          stats.daily.map((d) => (
            <div key={d.date} className="chart-bar-row">
              <span className="chart-bar-label">{d.date}</span>
              <div className="chart-bar-track">
                <div
                  className="chart-bar-fill"
                  style={{
                    width: `${maxDeployments > 0 ? (d.deployments / maxDeployments) * 100 : 0}%`,
                    backgroundColor: '#00C58E',
                  }}
                />
              </div>
              <strong className="chart-bar-val">{d.deployments}</strong>
            </div>
          ))
        ) : (
          <p className="chart-empty">No deployment data.</p>
        )}
      </div>
    </section>
  );
}
