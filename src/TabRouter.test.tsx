import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { createLazyComponent } from './TabRouter';

describe('createLazyComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully load component when import succeeds', async () => {
    const mockComponent = function MockComponent() {
      return <div data-testid="mock-component">Loaded Successfully</div>;
    };

    const importFn = vi.fn().mockResolvedValue({ default: mockComponent });
    const LazyComponent = createLazyComponent(importFn);

    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </React.Suspense>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('mock-component')).toBeInTheDocument();
    });

    expect(screen.getByText('Loaded Successfully')).toBeInTheDocument();
  });

  it('should show fallback UI when import fails', async () => {
    const importFn = vi.fn().mockRejectedValue(new Error('Failed to fetch module'));
    const LazyComponent = createLazyComponent(importFn);

    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </React.Suspense>
    );

    await waitFor(() => {
      expect(screen.getByText('⚠️ Problem z załadowaniem widoku')).toBeInTheDocument();
    });

    expect(screen.getByText(/Nie udało się załadować tego komponentu/)).toBeInTheDocument();
    expect(screen.getByText(/Problemem z cache przeglądarki/)).toBeInTheDocument();
    expect(screen.getByText(/Brakiem połączenia z internetem/)).toBeInTheDocument();
    expect(screen.getByText(/Uszkodzonymi plikami buildu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🔄 Odśwież stronę/ })).toBeInTheDocument();
  });

  it('should reload page when retry button is clicked', async () => {
    const importFn = vi.fn().mockRejectedValue(new Error('Failed to fetch module'));
    const LazyComponent = createLazyComponent(importFn);

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </React.Suspense>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /🔄 Odśwież stronę/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /🔄 Odśwież stronę/ }));

    await waitFor(() => {
      expect(reloadMock).toHaveBeenCalled();
    });
  });

  it('should show retry count when multiple failures occur', async () => {
    const importFn = vi.fn().mockRejectedValue(new Error('Failed to fetch module'));
    const LazyComponent = createLazyComponent(importFn);

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </React.Suspense>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /🔄 Odśwież stronę/ })).toBeInTheDocument();
    });

    // First click - button becomes disabled
    fireEvent.click(screen.getByRole('button', { name: /🔄 Odśwież stronę/ }));

    // Wait for button to be disabled and show retry count
    await waitFor(() => {
      expect(screen.getByText(/Próba 1 z 3/)).toBeInTheDocument();
    });
  });

  it('should disable button while retrying', async () => {
    const importFn = vi.fn().mockRejectedValue(new Error('Failed to fetch module'));
    const LazyComponent = createLazyComponent(importFn);

    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </React.Suspense>
    );

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /🔄 Odśwież stronę/ });
      expect(button).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /🔄 Odśwież stronę/ }));

    // Button should be disabled while retrying
    const button = screen.getByRole('button', { name: /Ładowanie/ });
    expect(button).toBeDisabled();
  });

  it('should have proper styling for error UI', async () => {
    const importFn = vi.fn().mockRejectedValue(new Error('Failed to fetch module'));
    const LazyComponent = createLazyComponent(importFn);

    const { container } = render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </React.Suspense>
    );

    await waitFor(() => {
      const errorDiv = container.firstChild as HTMLElement;
      expect(errorDiv).toHaveStyle('padding: 2rem');
      expect(errorDiv).toHaveStyle('text-align: center');
      expect(errorDiv).toHaveStyle('border-radius: 16px');
    });
  });

  it('should log error to console when import fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const importFn = vi.fn().mockRejectedValue(new Error('Test error'));
    const LazyComponent = createLazyComponent(importFn);

    render(
      <React.Suspense fallback={<div>Loading...</div>}>
        <LazyComponent />
      </React.Suspense>
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[LazyComponent] Failed to load component:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });
});

describe('TabRouter lazy components', () => {
  it('should export createLazyComponent helper', async () => {
    const TabRouter = await import('./TabRouter');

    // Check that createLazyComponent is exported
    expect(TabRouter.createLazyComponent).toBeDefined();
    expect(typeof TabRouter.createLazyComponent).toBe('function');
  });

  it('should have error boundary for lazy loaded components', async () => {
    const ErrorBoundary = await import('./lib/ErrorBoundary');

    expect(ErrorBoundary.default).toBeDefined();
  });
});
