import { render, screen } from '@testing-library/react';
import AppShellSkeleton from './AppShellSkeleton';

vi.mock('../Skeleton', () => ({
  SkeletonBanner: ({ height, className }: { height: number; className?: string }) => (
    <div data-testid={`banner-${height}-${className || 'default'}`}>banner</div>
  ),
  SkeletonList: ({ items, lines }: { items: number; lines: number }) => (
    <div data-testid={`list-${items}-${lines}`}>list</div>
  ),
}));

describe('AppShellSkeleton', () => {
  it('renders expected placeholder layout blocks', () => {
    render(<AppShellSkeleton />);

    expect(screen.getByTestId('banner-64-mb-5')).toBeInTheDocument();
    expect(screen.getByTestId('list-5-1')).toBeInTheDocument();
    expect(screen.getByTestId('banner-32-w-30')).toBeInTheDocument();
    expect(screen.getByTestId('banner-32-w-50')).toBeInTheDocument();
    expect(screen.getByTestId('list-3-3')).toBeInTheDocument();
  });
});
