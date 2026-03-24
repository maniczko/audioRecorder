import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const originalConsoleError = console.error;

beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  const defaultProps = {
    children: <div>Test Content</div>,
    label: 'Test Component',
  };

  it('renders children when there is no error', () => {
    render(<ErrorBoundary {...defaultProps} />);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders error message when error is thrown', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary {...defaultProps}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Błąd widoku')).toBeInTheDocument();
    expect(screen.getByText('Test Component')).toBeInTheDocument();
    expect(screen.getByText(/nieoczekiwany błąd/)).toBeInTheDocument();
  });

  it('displays component label in error message', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary {...defaultProps} label="CustomComponent">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('CustomComponent')).toBeInTheDocument();
  });

  it('displays error details in dev mode', () => {
    const ThrowError = () => {
      throw new Error('Specific error message');
    };

    render(
      <ErrorBoundary {...defaultProps}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Specific error message/)).toBeInTheDocument();
  });

  it('resets error state when refresh button is clicked', () => {
    let shouldThrow = true;
    const ConditionalComponent = () => {
      if (shouldThrow) throw new Error('Temporary error');
      return <div>Fixed</div>;
    };

    const { rerender } = render(
      <ErrorBoundary {...defaultProps}>
        <ConditionalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Błąd widoku')).toBeInTheDocument();

    // Reset the error
    shouldThrow = false;
    fireEvent.click(screen.getByText('Odśwież widok'));

    rerender(
      <ErrorBoundary {...defaultProps}>
        <ConditionalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Fixed')).toBeInTheDocument();
  });

  it('handles null children', () => {
    expect(() => {
      render(<ErrorBoundary {...defaultProps} children={null} />);
    }).not.toThrow();
  });

  it('handles undefined children', () => {
    expect(() => {
      render(<ErrorBoundary {...defaultProps} children={undefined} />);
    }).not.toThrow();
  });

  it('preserves error information after re-render', () => {
    const ThrowError = () => {
      throw new Error('Persistent error');
    };

    const { rerender } = render(
      <ErrorBoundary {...defaultProps}>
        <ThrowError />
      </ErrorBoundary>
    );

    rerender(
      <ErrorBoundary {...defaultProps}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Persistent error/)).toBeInTheDocument();
  });

  it('has proper button role for refresh', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary {...defaultProps}>
        <ThrowError />
      </ErrorBoundary>
    );

    const resetButton = screen.getByRole('button', { name: 'Odśwież widok' });
    expect(resetButton).toBeInTheDocument();
  });

  it('renders error header', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary {...defaultProps}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  describe('Edge Cases', () => {
    it('handles error with no message', () => {
      const ThrowError = () => {
        throw new Error('');
      };

      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Błąd widoku')).toBeInTheDocument();
    });

    it('handles non-Error thrown', () => {
      const ThrowString = () => {
        // eslint-disable-next-line no-throw-literal
        throw 'String error';
      };

      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowString />
        </ErrorBoundary>
      );

      expect(screen.getByText('Błąd widoku')).toBeInTheDocument();
    });

    it('handles object thrown', () => {
      const ThrowObject = () => {
        // eslint-disable-next-line no-throw-literal
        throw { message: 'Object error' };
      };

      render(
        <ErrorBoundary {...defaultProps}>
          <ThrowObject />
        </ErrorBoundary>
      );

      expect(screen.getByText('Błąd widoku')).toBeInTheDocument();
    });
  });
});
