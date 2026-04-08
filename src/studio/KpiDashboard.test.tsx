/**
 * @vitest-environment jsdom
 * KpiDashboard component tests
 *
 * Basic tests for KPI dashboard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock VercelDeploymentsChart
vi.mock('./VercelDeploymentsChart', () => ({
  VercelDeploymentsChart: () => <div data-testid="vercel-chart">Vercel Chart</div>,
}));

// Mock kpi lib — use vi.hoisted to make the mock available before vi.mock hoisting
const { mockBuildDashboard } = vi.hoisted(() => ({
  mockBuildDashboard: vi.fn(() => ({
    meetings: 5,
    kpis: {
      decisions: 3,
      openTasks: 10,
      overdue: 2,
      tasksAfterMeetings: 7,
    },
    trendPoints: [],
  })),
}));

vi.mock('../lib/kpi', () => ({
  buildWorkspaceKpiDashboard: mockBuildDashboard,
}));

import KpiDashboard from './KpiDashboard';

describe('KpiDashboard component', () => {
  const mockProps = {
    workspaceName: 'Test Workspace',
    meetings: [],
    tasks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildDashboard.mockReturnValue({
      meetings: 5,
      kpis: {
        decisions: 3,
        openTasks: 10,
        overdue: 2,
        tasksAfterMeetings: 7,
      },
      trendPoints: [],
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<KpiDashboard {...mockProps} />)).not.toThrow();
  });

  it('displays workspace name', () => {
    render(<KpiDashboard {...mockProps} />);
    expect(screen.getByText('Test Workspace')).toBeInTheDocument();
  });

  it('shows default workspace when name is missing', () => {
    render(<KpiDashboard workspaceName={null} meetings={[]} tasks={[]} />);
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });

  it('renders KPI values from dashboard', () => {
    render(<KpiDashboard {...mockProps} />);
    expect(screen.getByText('Decyzje')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders empty state when no trend points', () => {
    mockBuildDashboard.mockReturnValue({
      meetings: 0,
      kpis: {
        decisions: 0,
        openTasks: 0,
        overdue: 0,
        tasksAfterMeetings: 0,
      },
      trendPoints: [],
    });

    render(<KpiDashboard {...mockProps} />);
    expect(screen.getByText('Brak danych w zakresie')).toBeInTheDocument();
  });
});
