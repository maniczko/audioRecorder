import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MeetingsSyncManager from './MeetingsSyncManager';

vi.mock('../hooks/useWorkspaceData', () => ({
  default: vi.fn(),
}));

describe('MeetingsSyncManager', () => {
  test('renders children when provided', () => {
    render(
      <MeetingsSyncManager>
        <div data-testid="child">Hello</div>
      </MeetingsSyncManager>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  test('renders nothing when children are not provided', () => {
    const { container } = render(<MeetingsSyncManager />);
    expect(container.firstChild).toBeNull();
  });

  test('renders multiple children', () => {
    render(
      <MeetingsSyncManager>
        <span>A</span>
        <span>B</span>
        <span>C</span>
      </MeetingsSyncManager>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  test('re-renders children when they change', () => {
    const { rerender } = render(
      <MeetingsSyncManager>
        <span data-testid="dynamic">initial</span>
      </MeetingsSyncManager>
    );
    expect(screen.getByTestId('dynamic')).toHaveTextContent('initial');

    rerender(
      <MeetingsSyncManager>
        <span data-testid="dynamic">updated</span>
      </MeetingsSyncManager>
    );
    expect(screen.getByTestId('dynamic')).toHaveTextContent('updated');
  });

  test('renders nested React elements', () => {
    render(
      <MeetingsSyncManager>
        <ul>
          <li key="1">one</li>
          <li key="2">two</li>
        </ul>
      </MeetingsSyncManager>
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
  });
});
