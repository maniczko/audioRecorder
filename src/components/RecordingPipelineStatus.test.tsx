import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordingPipelineStatus } from './RecordingPipelineStatus';

describe('RecordingPipelineStatus', () => {
  test.each([
    ['uploading', 'Wysyłanie...', 'processing'],
    ['queued', 'W kolejce', 'processing'],
    ['processing', 'Przetwarzanie...', 'processing'],
    ['diarization', 'Rozpoznawanie mówców...', 'processing'],
    ['review', 'Oczekuje na weryfikację', 'done'],
    ['done', 'Transkrypcja gotowa', 'done'],
    ['empty', 'Brak mowy', 'empty'],
    ['no_audio', 'Brak audio', 'empty'],
    ['failed', 'Błąd przetwarzania', 'failed'],
    ['auth_required', 'Wymagane ponowne logowanie', 'failed'],
    ['failed_permanent', 'Wymaga ponownego importu', 'failed'],
  ])('renders status chip for %s', (status, label, className) => {
    const { container } = render(<RecordingPipelineStatus status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelector('.status-chip')).toHaveClass(className);
  });

  test('renders default label for unknown status', () => {
    render(<RecordingPipelineStatus status="unknown" />);
    expect(screen.getByText('W kolejce')).toBeInTheDocument();
  });

  test('marks in-progress states as polite busy live regions', () => {
    render(<RecordingPipelineStatus status="processing" progressMessage="Processing..." />);

    const region = screen.getByRole('status', {
      name: /Przetwarzanie.*Transkrypcja w toku/i,
    });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-busy', 'true');
  });

  test('marks failed states as assertive alerts', () => {
    render(<RecordingPipelineStatus status="failed" errorMessage="Connection timeout" />);

    const alert = screen.getByRole('alert', { name: /Błąd przetwarzania/i });
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  test('renders permanent missing recording state without retry action', () => {
    const onRetry = vi.fn();
    render(
      <RecordingPipelineStatus
        status="failed_permanent"
        errorMessage="Nagranie nie jest juz dostepne na serwerze."
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Wymaga ponownego importu')).toBeInTheDocument();
    expect(screen.getByText('Nagranie nie jest juz dostepne na serwerze.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Spróbuj ponownie/ })).not.toBeInTheDocument();
  });

  test('shows default recovery guidance when failed state has no error message', () => {
    render(<RecordingPipelineStatus status="failed" />);

    expect(screen.getByText(/Możesz ponowić przetwarzanie/i)).toBeInTheDocument();
  });

  test('shows progress block and clamps progressPercent to 0-100 range', () => {
    const { container, rerender } = render(
      <RecordingPipelineStatus
        status="processing"
        stageLabel="Encoding"
        progressMessage="Almost done..."
        progressPercent={150}
      />
    );

    expect(screen.getByText('Encoding (100%)')).toBeInTheDocument();
    expect(screen.getByText('Almost done...')).toBeInTheDocument();
    let meter = container.querySelector('.pipeline-progress-meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
    expect(meter).toHaveAttribute('role', 'progressbar');
    expect(meter).toHaveAttribute('aria-label', 'Postęp przetwarzania nagrania');

    rerender(
      <RecordingPipelineStatus
        status="processing"
        progressMessage="Processing..."
        progressPercent={-10}
      />
    );
    meter = container.querySelector('.pipeline-progress-meter');
    expect(meter).toHaveAttribute('aria-valuenow', '0');
  });

  test('does not show progress meter for done or failed states', () => {
    const { container, rerender } = render(
      <RecordingPipelineStatus status="done" progressMessage="Should not show" />
    );
    expect(container.querySelector('.pipeline-progress-meter')).toBeNull();

    rerender(<RecordingPipelineStatus status="failed" progressMessage="Should not show" />);
    expect(container.querySelector('.pipeline-progress-meter')).toBeNull();
  });

  test('renders and calls retry for failed status only when retryable', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <RecordingPipelineStatus status="failed" errorMessage="Error" onRetry={onRetry} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Spróbuj ponownie/ }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(
      <RecordingPipelineStatus
        status="failed"
        errorMessage="Quota"
        errorCode="stt_quota_exceeded"
        onRetry={onRetry}
      />
    );
    expect(screen.queryByRole('button', { name: /Spróbuj ponownie/ })).not.toBeInTheDocument();
  });

  test('shows an explicit login-and-retry action for expired upload sessions', () => {
    const onRetry = vi.fn();
    render(
      <RecordingPipelineStatus
        status="auth_required"
        errorMessage="Brak autoryzacji do backendu. Zaloguj sie ponownie."
        onRetry={onRetry}
      />
    );

    const alert = screen.getByRole('alert', { name: /Wymagane ponowne logowanie/i });
    expect(alert).toHaveAttribute('aria-live', 'assertive');

    fireEvent.click(screen.getByRole('button', { name: 'Zaloguj ponownie i ponów upload' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('renders custom retry action for in-progress status when explicitly allowed', () => {
    const onRetry = vi.fn();
    render(
      <RecordingPipelineStatus
        status="processing"
        onRetry={onRetry}
        retryLabel="Odswiez status"
        allowInProgressRetry
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Odswiez status/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('retry button click does not propagate', () => {
    const onRetry = vi.fn();
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <RecordingPipelineStatus status="failed" errorMessage="Error" onRetry={onRetry} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /Spróbuj ponownie/ }));

    expect(onParentClick).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  test('shows processing timer when processingStartedAt is provided', () => {
    const { container } = render(
      <RecordingPipelineStatus
        status="processing"
        progressMessage="Processing..."
        processingStartedAt="2026-04-06T12:00:00.000Z"
      />
    );

    expect(container.querySelector('.pipeline-processing-timer')).toBeInTheDocument();
  });
});
