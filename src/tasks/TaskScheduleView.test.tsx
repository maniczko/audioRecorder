import { render, screen, fireEvent } from '@testing-library/react';
import TaskScheduleView from './TaskScheduleView';

function createBaseProps(overrides: Record<string, any> = {}) {
  const now = new Date();
  const todayIso = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    12,
    0,
    0
  ).toISOString();
  const task = {
    id: 'task-1',
    title: 'Planowane',
    status: 'todo',
    completed: false,
    dueDate: todayIso,
    owner: 'Anna',
    important: false,
  };

  return {
    tasks: [task],
    selectedTask: null,
    onSelectTask: vi.fn(),
    onUpdateTask: vi.fn(),
    ...overrides,
  };
}

describe('TaskScheduleView', () => {
  it('renders 14-day view by default and shows scheduled tasks', () => {
    const { container } = render(<TaskScheduleView {...createBaseProps()} />);

    const days = container.querySelectorAll('.schedule-day');
    expect(days).toHaveLength(14);
    expect(screen.getByText('Planowane')).toBeInTheDocument();
  });

  it('switches to 5-week view', () => {
    const { container } = render(<TaskScheduleView {...createBaseProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /5 tygodni/i }));

    const days = container.querySelectorAll('.schedule-day');
    expect(days).toHaveLength(35);
  });

  it('updates due date on drop', () => {
    const onUpdateTask = vi.fn();
    const { container } = render(
      <TaskScheduleView {...createBaseProps({ onUpdateTask, onSelectTask: vi.fn() })} />
    );

    const day = container.querySelector('.schedule-day');

    fireEvent.drop(day as Element, {
      dataTransfer: {
        getData: () => 'task-1',
      },
    });

    expect(onUpdateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        dueDate: expect.any(String),
      })
    );
  });

  it('renders unscheduled tasks and overflow counter', () => {
    const unscheduled = Array.from({ length: 16 }, (_, index) => ({
      id: `unscheduled-${index}`,
      title: `Unscheduled ${index}`,
      status: 'todo',
      completed: false,
      dueDate: '',
      owner: 'Anna',
      important: false,
    }));

    render(<TaskScheduleView {...createBaseProps({ tasks: unscheduled })} />);

    expect(screen.getByText('Bez terminu')).toBeInTheDocument();
    expect(screen.getByText(/\+1/)).toBeInTheDocument();
  });
});
