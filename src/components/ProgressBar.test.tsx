import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  test('renders with default props', () => {
    const { container } = render(<ProgressBar />);
    const bar = container.firstChild as HTMLElement;
    expect(bar).toHaveClass('progress-bar');
    expect(bar).toHaveAttribute('data-variant', 'default');
  });

  test('calculates percentage from value=50, min=0, max=100', () => {
    const { container } = render(<ProgressBar value={50} min={0} max={100} />);
    const fill = container.querySelector('.progress-bar-fill') as HTMLElement;
    expect(fill.style.getPropertyValue('--progress-value')).toBe('50%');
  });

  test('calculates percentage from custom min/max', () => {
    const { container } = render(<ProgressBar value={75} min={50} max={150} />);
    const fill = container.querySelector('.progress-bar-fill') as HTMLElement;
    // (75-50)/(150-50) = 25%, then Math.min(150, Math.max(50, 25)) = 50
    expect(fill.style.getPropertyValue('--progress-value')).toBe('50%');
  });

  test('clamps value when exceeding max', () => {
    const { container } = render(<ProgressBar value={150} min={0} max={100} />);
    const fill = container.querySelector('.progress-bar-fill') as HTMLElement;
    expect(fill.style.getPropertyValue('--progress-value')).toBe('100%');
  });

  test('clamps value when below min', () => {
    const { container } = render(<ProgressBar value={-10} min={0} max={100} />);
    const fill = container.querySelector('.progress-bar-fill') as HTMLElement;
    expect(fill.style.getPropertyValue('--progress-value')).toBe('0%');
  });

  test('shows label when showLabel is true', () => {
    render(<ProgressBar value={75} showLabel />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  test('does not show label when showLabel is false', () => {
    const { container } = render(<ProgressBar value={75} showLabel={false} />);
    const label = container.querySelector('.progress-bar-label');
    expect(label).toBeNull();
  });

  test('applies variant attribute', () => {
    const { container } = render(<ProgressBar variant="success" />);
    expect(container.firstChild).toHaveAttribute('data-variant', 'success');
  });

  test('applies custom className', () => {
    const { container } = render(<ProgressBar className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });

  test('animation enabled by default', () => {
    const { container } = render(<ProgressBar value={30} />);
    const fill = container.querySelector('.progress-bar-fill') as HTMLElement;
    expect(fill.style.getPropertyValue('--progress-animation')).toBe('1');
  });

  test('animation disabled when animated=false', () => {
    const { container } = render(<ProgressBar value={30} animated={false} />);
    const fill = container.querySelector('.progress-bar-fill') as HTMLElement;
    expect(fill.style.getPropertyValue('--progress-animation')).toBe('0');
  });

  test('supports all variant values', () => {
    const variants = ['default', 'success', 'warning', 'danger', 'upload'] as const;
    variants.forEach((variant) => {
      const { container, unmount } = render(<ProgressBar variant={variant} />);
      expect(container.firstChild).toHaveAttribute('data-variant', variant);
      unmount();
    });
  });

  test('label shows 0% for zero value', () => {
    render(<ProgressBar value={0} showLabel />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  test('label rounds to integer', () => {
    render(<ProgressBar value={33.7} min={0} max={100} showLabel />);
    expect(screen.getByText('34%')).toBeInTheDocument();
  });
});
