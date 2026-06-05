import { render, screen } from '@testing-library/react';
import TaskChartsView from './TaskChartsView';

function createBaseProps(overrides: Record<string, any> = {}) {
  return {
    boardColumns: [
      { id: 'todo', label: 'Todo', color: '#75d6c4', isDone: false, system: true },
      { id: 'done', label: 'Done', color: '#8db4ff', isDone: true, system: true },
    ],
    tasks: [
      {
        id: 'task-1',
        title: 'Task one',
        status: 'todo',
        priority: 'high',
        owner: 'Alice',
        assignedTo: ['Alice'],
        completed: false,
        dueDate: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    ...overrides,
  };
}

describe('TaskChartsView', () => {
  it('renders all chart cards for task summaries', () => {
    const { container } = render(<TaskChartsView {...createBaseProps()} />);

    expect(screen.getByText(/Status/)).toBeInTheDocument();
    expect(screen.getByText('Priorytet')).toBeInTheDocument();
    expect(screen.getByText('Otwarte zadania per osoba')).toBeInTheDocument();
    expect(screen.getByText('Terminy realizacji')).toBeInTheDocument();
    expect(container.querySelectorAll('.chart-card')).toHaveLength(4);
  });

  it('shows empty state for people chart when there are no open tasks', () => {
    render(<TaskChartsView tasks={[]} boardColumns={createBaseProps().boardColumns} />);
    expect(screen.getByText('Brak danych do wyswietlenia.')).toBeInTheDocument();
  });
});
