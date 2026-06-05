import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

vi.mock('./Toast', async () => {
  const actual = await vi.importActual('./Toast');
  return actual;
});

function RenderShowToast({
  message,
  options = {},
}: {
  message: string;
  options?: Record<string, unknown>;
}) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(message, options)} aria-label="show-toast">
      Show toast
    </button>
  );
}

describe('Toast provider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders toast message using show()', () => {
    render(
      <ToastProvider>
        <RenderShowToast message="Saved" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'show-toast' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('auto dismisses toasts after configured duration', () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <RenderShowToast message="Short toast" options={{ duration: 100 }} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'show-toast' }));
    expect(screen.getByText('Short toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.queryByText('Short toast')).not.toBeInTheDocument();
  });

  it('executes action callback and closes toast', () => {
    const action = vi.fn();
    function ToastWithAction() {
      const { show } = useToast();
      return (
        <button
          type="button"
          onClick={() =>
            show('Has action', {
              actionLabel: 'Action',
              action,
              type: 'info',
            })
          }
          aria-label="open-action-toast"
        >
          Open action toast
        </button>
      );
    }

    render(
      <ToastProvider>
        <ToastWithAction />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-action-toast' }));
    fireEvent.click(screen.getByRole('button', { name: 'Action' }));

    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Has action')).not.toBeInTheDocument();
  });

  it('closes toast when close button clicked', () => {
    render(
      <ToastProvider>
        <RenderShowToast message="Close me" />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'show-toast' }));
    expect(screen.getByText('Close me')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Zamknij'));
    expect(screen.queryByText('Close me')).not.toBeInTheDocument();
  });

  it('does not throw when useToast is used without provider', () => {
    function Test() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast.success('outside')}>
          Outside
        </button>
      );
    }

    render(<Test />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Outside' }))).not.toThrow();
  });
});
