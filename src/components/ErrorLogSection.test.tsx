import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useErrorLogStore } from '../store/errorLogStore';
import { ErrorLogSection } from './ErrorLogSection';

describe('ErrorLogSection', () => {
  beforeEach(() => {
    useErrorLogStore.setState({ errors: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders empty state when no errors', () => {
    render(<ErrorLogSection />);
    expect(screen.getByText(/Brak zarejestrowanych/)).toBeInTheDocument();
    expect(screen.getByText(/Dziennik błędów \(0\)/)).toBeInTheDocument();
  });

  test('renders error entries', () => {
    useErrorLogStore.setState({
      errors: [
        {
          id: 'err-1',
          timestamp: '2026-04-03T10:00:00.000Z',
          type: 'runtime',
          message: 'Something broke',
        },
      ],
    });

    render(<ErrorLogSection />);
    expect(screen.getByText(/Dziennik błędów \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
    expect(screen.getByText(/Runtime/)).toBeInTheDocument();
  });

  test('expands error details on click', () => {
    useErrorLogStore.setState({
      errors: [
        {
          id: 'err-1',
          timestamp: '2026-04-03T10:00:00.000Z',
          type: 'runtime',
          message: 'Click me',
          stack: 'Error: Click me\n  at foo.ts:10',
          source: 'foo.ts:10:1',
        },
      ],
    });

    render(<ErrorLogSection />);
    fireEvent.click(screen.getByText('Click me'));

    expect(screen.getByText(/Error: Click me/)).toBeInTheDocument();
    expect(screen.getByText(/Source: foo.ts:10:1/)).toBeInTheDocument();
  });

  test('clears errors when clear button clicked', () => {
    useErrorLogStore.setState({
      errors: [
        {
          id: 'err-1',
          timestamp: '2026-04-03T10:00:00.000Z',
          type: 'runtime',
          message: 'Will be cleared',
        },
      ],
    });

    render(<ErrorLogSection />);
    fireEvent.click(screen.getByText(/Wyczyść/));

    expect(useErrorLogStore.getState().errors).toEqual([]);
  });

  test('exports errors as JSON download', () => {
    const createObjectURLSpy = vi.fn(() => 'blob:test');
    const revokeObjectURLSpy = vi.fn();
    global.URL.createObjectURL = createObjectURLSpy;
    global.URL.revokeObjectURL = revokeObjectURLSpy;

    useErrorLogStore.setState({
      errors: [
        {
          id: 'err-1',
          timestamp: '2026-04-03T10:00:00.000Z',
          type: 'runtime',
          message: 'Export me',
        },
      ],
    });

    render(<ErrorLogSection />);
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValueOnce({
      click: clickSpy,
      set href(_: string) {},
      set download(_: string) {},
    } as unknown as HTMLAnchorElement);

    fireEvent.click(screen.getByText(/Eksportuj JSON/));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
  });

  test('adds manual error on report button click', () => {
    render(<ErrorLogSection />);

    fireEvent.click(screen.getByText(/Zgłoś/));

    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('manual');
  });
});
