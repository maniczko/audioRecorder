import { describe, test, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessingTimer, formatDuration } from './ProcessingTimer';

beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

describe('ProcessingTimer', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-04-06T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  test('renders elapsed time with prefix by default', () => {
    render(<ProcessingTimer startedAt="2026-04-06T11:59:06.000Z" />);
    expect(screen.getByText('Upłynęło 54 sekund')).toBeInTheDocument();
  });

  test('renders elapsed time without prefix when prefix=false', () => {
    render(<ProcessingTimer startedAt="2026-04-06T11:59:06.000Z" prefix={false} />);
    expect(screen.getByText('54 sekund')).toBeInTheDocument();
  });

  test('formats minutes and seconds correctly', () => {
    render(<ProcessingTimer startedAt="2026-04-06T11:57:45.000Z" />);
    expect(screen.getByText('Upłynęło 2 minuty 15 sekund')).toBeInTheDocument();
  });

  test('formats hours and minutes correctly', () => {
    render(<ProcessingTimer startedAt="2026-04-06T10:56:50.000Z" />);
    expect(screen.getByText('Upłynęło 1 godzina 3 minut')).toBeInTheDocument();
  });

  test('handles negative duration (future date) gracefully', () => {
    render(<ProcessingTimer startedAt="2026-04-06T13:00:00.000Z" />);
    expect(screen.getByText('Upłynęło 0 sekund')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const { container } = render(
      <ProcessingTimer startedAt="2026-04-06T12:00:00.000Z" className="my-timer" />
    );
    expect(container.firstChild).toHaveClass('my-timer');
  });
});

describe('formatDuration', () => {
  test('formats 0 ms as "0 sekund"', () => {
    expect(formatDuration(0)).toBe('0 sekund');
  });

  test('formats 54 seconds', () => {
    expect(formatDuration(54_000)).toBe('54 sekund');
  });

  test('formats 1 minute 30 seconds', () => {
    expect(formatDuration(90_000)).toBe('1 minuta 30 sekund');
  });

  test('formats 2 minutes 15 seconds', () => {
    expect(formatDuration(135_000)).toBe('2 minuty 15 sekund');
  });

  test('formats 5 minutes 5 seconds', () => {
    expect(formatDuration(305_000)).toBe('5 minut 5 sekund');
  });

  test('formats 1 hour 3 minutes', () => {
    expect(formatDuration(3_780_000)).toBe('1 godzina 3 minut');
  });

  test('clamps negative values to 0', () => {
    expect(formatDuration(-5000)).toBe('-5 sekund');
  });
});
