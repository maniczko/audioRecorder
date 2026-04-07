import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VercelDeploymentsChart } from './VercelDeploymentsChart';

const stats = {
  daily: [
    { date: '2026-04-01', deployments: 0 },
    { date: '2026-04-02', deployments: 2 },
    { date: '2026-04-03', deployments: 5 },
    { date: '2026-04-04', deployments: 3 },
  ],
};

describe('VercelDeploymentsChart', () => {
  it('renders chart bars for each day', () => {
    render(<VercelDeploymentsChart stats={stats} />);
    expect(screen.getByText('2026-04-01')).toBeInTheDocument();
    expect(screen.getByText('2026-04-02')).toBeInTheDocument();
    expect(screen.getByText('2026-04-03')).toBeInTheDocument();
    expect(screen.getByText('2026-04-04')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows empty message if no data', () => {
    render(<VercelDeploymentsChart stats={{ daily: [] }} />);
    expect(screen.getByText(/No deployment data/i)).toBeInTheDocument();
  });
});
