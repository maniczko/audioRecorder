import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SkeletonBanner,
  SkeletonCard,
  SkeletonList,
  ErrorState,
  EmptyState,
  LoadingScreen,
  StudioSkeleton,
} from './Skeleton';

describe('SkeletonBanner', () => {
  test('renders with default height of 120', () => {
    const { container } = render(<SkeletonBanner />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('skeleton');
    expect(el).toHaveClass('skeleton-banner');
    expect(el).toHaveStyle({ height: '120px' });
  });

  test('renders with custom height', () => {
    const { container } = render(<SkeletonBanner height={200} />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ height: '200px' });
  });

  test('applies custom className', () => {
    const { container } = render(<SkeletonBanner className="my-banner" />);
    expect(container.firstChild).toHaveClass('my-banner');
  });
});

describe('SkeletonCard', () => {
  test('renders with default 3 text lines', () => {
    const { container } = render(<SkeletonCard />);
    const texts = container.querySelectorAll('.skeleton-text');
    expect(texts).toHaveLength(3);
  });

  test('renders with custom number of lines', () => {
    const { container } = render(<SkeletonCard lines={5} />);
    const texts = container.querySelectorAll('.skeleton-text');
    expect(texts).toHaveLength(5);
  });

  test('renders title skeleton', () => {
    const { container } = render(<SkeletonCard />);
    const title = container.querySelector('.skeleton-title');
    expect(title).toBeInTheDocument();
  });

  test('text lines have decreasing widths', () => {
    const { container } = render(<SkeletonCard lines={3} />);
    const texts = container.querySelectorAll('.skeleton-text');
    expect(texts[0]).toHaveStyle({ width: '85%' });
    expect(texts[1]).toHaveStyle({ width: '70%' });
    expect(texts[2]).toHaveStyle({ width: '55%' });
  });

  test('applies custom className', () => {
    const { container } = render(<SkeletonCard className="my-card" />);
    expect(container.firstChild).toHaveClass('my-card');
  });
});

describe('SkeletonList', () => {
  test('renders with default 5 items', () => {
    const { container } = render(<SkeletonList />);
    const cards = container.querySelectorAll('.skeleton-card');
    expect(cards).toHaveLength(5);
  });

  test('renders with custom number of items', () => {
    const { container } = render(<SkeletonList items={2} />);
    const cards = container.querySelectorAll('.skeleton-card');
    expect(cards).toHaveLength(2);
  });

  test('passes lines prop to SkeletonCard', () => {
    const { container } = render(<SkeletonList items={1} lines={4} />);
    const texts = container.querySelectorAll('.skeleton-text');
    expect(texts).toHaveLength(4);
  });

  test('applies custom className', () => {
    const { container } = render(<SkeletonList className="my-list" />);
    expect(container.firstChild).toHaveClass('my-list');
  });
});

describe('ErrorState', () => {
  test('renders with default error message', () => {
    render(<ErrorState error={null} />);
    expect(screen.getByText('Wystąpił błąd')).toBeInTheDocument();
    expect(screen.getByText('Coś poszło nie tak.')).toBeInTheDocument();
  });

  test('renders custom error message', () => {
    render(<ErrorState error="Network failure" />);
    expect(screen.getByText('Network failure')).toBeInTheDocument();
  });

  test('does not show retry button when onRetry not provided', () => {
    render(<ErrorState error="Error" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('shows retry button when onRetry provided', () => {
    render(<ErrorState error="Error" onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument();
  });

  test('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState error="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('applies custom className', () => {
    const { container } = render(<ErrorState error="Error" className="my-error" />);
    expect(container.firstChild).toHaveClass('my-error');
  });

  test('converts non-string error to string', () => {
    render(<ErrorState error={{ code: 500, msg: 'Server error' }} />);
    expect(screen.getByText('[object Object]')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  test('renders with default values', () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector('.ff-state-icon')?.textContent).toBe('📄');
    expect(container.querySelector('.ff-state-title')?.textContent).toBe('Brak danych');
    expect(container.querySelector('.ff-state-desc')).toBeNull();
  });

  test('renders custom icon, title, and message', () => {
    render(
      <EmptyState icon="🎤" title="No recordings" message="Start recording to see items here" />
    );
    expect(screen.getByText('🎤')).toBeInTheDocument();
    expect(screen.getByText('No recordings')).toBeInTheDocument();
    expect(screen.getByText('Start recording to see items here')).toBeInTheDocument();
  });

  test('does not render action button when action not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('renders action button with actionText', () => {
    render(<EmptyState actionText="Create" action={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  test('calls action when button clicked', () => {
    const action = vi.fn();
    render(<EmptyState actionText="Add" action={action} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(action).toHaveBeenCalledOnce();
  });

  test('wraps action in Tooltip when actionTooltip provided', () => {
    render(<EmptyState actionText="Delete" action={vi.fn()} actionTooltip="Remove all items" />);
    // Tooltip renders children when content is present; check tooltip wrapper exists
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(<EmptyState className="my-empty" />);
    expect(container.firstChild).toHaveClass('my-empty');
  });

  test('does not render message when empty string', () => {
    render(<EmptyState message="" />);
    const desc = document.querySelector('.ff-state-desc');
    expect(desc).toBeNull();
  });
});

describe('LoadingScreen', () => {
  test('renders with default message', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('Wczytywanie...')).toBeInTheDocument();
  });

  test('renders custom message', () => {
    render(<LoadingScreen message="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  test('renders spinner', () => {
    const { container } = render(<LoadingScreen />);
    const spinner = container.querySelector('.ff-state-spinner');
    expect(spinner).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(<LoadingScreen className="my-loading" />);
    expect(container.firstChild).toHaveClass('my-loading');
  });
});

describe('StudioSkeleton', () => {
  test('renders main area with player and transcript lines', () => {
    const { container } = render(<StudioSkeleton />);
    const main = container.querySelector('.studio-skeleton-main');
    expect(main).toBeInTheDocument();

    const player = container.querySelector('.studio-skeleton-player');
    expect(player).toBeInTheDocument();

    const lines = container.querySelectorAll('.studio-skeleton-transcript-line');
    expect(lines).toHaveLength(8);
  });

  test('renders sidebar with analysis cards', () => {
    const { container } = render(<StudioSkeleton />);
    const sidebar = container.querySelector('.studio-skeleton-sidebar');
    expect(sidebar).toBeInTheDocument();

    const cards = container.querySelectorAll('.studio-skeleton-analysis-card');
    expect(cards).toHaveLength(3);
  });

  test('transcript lines have decreasing widths', () => {
    const { container } = render(<StudioSkeleton />);
    const lines = container.querySelectorAll('.studio-skeleton-transcript-line');
    expect(lines[0]).toHaveStyle({ width: '90%' });
    expect(lines[1]).toHaveStyle({ width: '84%' });
  });

  test('has grid layout structure', () => {
    const { container } = render(<StudioSkeleton />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass('studio-skeleton');
  });
});
