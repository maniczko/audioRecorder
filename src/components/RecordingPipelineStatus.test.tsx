import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordingPipelineStatus } from './RecordingPipelineStatus';

describe('RecordingPipelineStatus', () => {
  test('renders status chip for uploading', () => {
    render(<RecordingPipelineStatus status="uploading" />);
    expect(screen.getByText('Wysyłanie...')).toBeInTheDocument();
  });

  test('renders status chip for queued', () => {
    render(<RecordingPipelineStatus status="queued" />);
    expect(screen.getByText('W kolejce')).toBeInTheDocument();
  });

  test('renders status chip for processing', () => {
    render(<RecordingPipelineStatus status="processing" />);
    expect(screen.getByText('Przetwarzanie...')).toBeInTheDocument();
  });

  test('renders status chip for diarization', () => {
    render(<RecordingPipelineStatus status="diarization" />);
    expect(screen.getByText('Rozpoznawanie mówców...')).toBeInTheDocument();
  });

  test('renders status chip for review', () => {
    render(<RecordingPipelineStatus status="review" />);
    expect(screen.getByText('Oczekuje na weryfikację')).toBeInTheDocument();
  });

  test('renders status chip for done', () => {
    render(<RecordingPipelineStatus status="done" />);
    expect(screen.getByText('Transkrypcja gotowa')).toBeInTheDocument();
  });

  test('renders status chip for failed', () => {
    render(<RecordingPipelineStatus status="failed" />);
    expect(screen.getByText('Błąd przetwarzania')).toBeInTheDocument();
  });

  test('renders default label for unknown status', () => {
    render(<RecordingPipelineStatus status="unknown" />);
    expect(screen.getByText('W kolejce')).toBeInTheDocument();
  });

  test('adds processing class for in-progress statuses', () => {
    const { container } = render(<RecordingPipelineStatus status="uploading" />);
    const chip = container.querySelector('.status-chip');
    expect(chip).toHaveClass('processing');
  });

  test('adds done class for done status', () => {
    const { container } = render(<RecordingPipelineStatus status="done" />);
    const chip = container.querySelector('.status-chip');
    expect(chip).toHaveClass('done');
  });

  test('adds done class for review status', () => {
    const { container } = render(<RecordingPipelineStatus status="review" />);
    const chip = container.querySelector('.status-chip');
    expect(chip).toHaveClass('done');
  });

  test('adds failed class for failed status', () => {
    const { container } = render(<RecordingPipelineStatus status="failed" />);
    const chip = container.querySelector('.status-chip');
    expect(chip).toHaveClass('failed');
  });

  test('shows progress block when in progress with progressMessage', () => {
    render(
      <RecordingPipelineStatus
        status="processing"
        progressMessage="Converting audio..."
        progressPercent={42}
      />
    );
    expect(screen.getByText('Converting audio...')).toBeInTheDocument();
  });

  test('shows progress bar meter when in progress with progressMessage', () => {
    const { container } = render(
      <RecordingPipelineStatus
        status="uploading"
        progressMessage="Uploading..."
        progressPercent={60}
      />
    );
    const meter = container.querySelector('.pipeline-progress-meter');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-valuenow', '60');
    expect(meter).toHaveAttribute('role', 'progressbar');
  });

  test('does not show progress block for done status', () => {
    const { container } = render(
      <RecordingPipelineStatus status="done" progressMessage="Should not show" />
    );
    const meter = container.querySelector('.pipeline-progress-meter');
    expect(meter).toBeNull();
  });

  test('does not show progress block for failed status', () => {
    const { container } = render(
      <RecordingPipelineStatus status="failed" progressMessage="Should not show" />
    );
    const meter = container.querySelector('.pipeline-progress-meter');
    expect(meter).toBeNull();
  });

  test('shows stage label with percent when provided', () => {
    render(
      <RecordingPipelineStatus
        status="processing"
        stageLabel="Encoding"
        progressMessage="Encoding"
        progressPercent={75}
      />
    );
    expect(screen.getByText('Encoding (75%)')).toBeInTheDocument();
  });

  test('shows subtext when stageLabel differs from progressMessage', () => {
    render(
      <RecordingPipelineStatus
        status="processing"
        stageLabel="Encoding"
        progressMessage="Almost done..."
        progressPercent={90}
      />
    );
    expect(screen.getByText('Almost done...')).toBeInTheDocument();
  });

  test('shows error box with message for failed status', () => {
    render(<RecordingPipelineStatus status="failed" errorMessage="Connection timeout" />);
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  test('shows default error message when errorMessage is empty', () => {
    render(<RecordingPipelineStatus status="failed" />);
    expect(screen.getByText('Wystąpił nieoczekiwany błąd.')).toBeInTheDocument();
  });

  test('renders retry button when onRetry is provided for failed status', () => {
    const onRetry = vi.fn();
    render(<RecordingPipelineStatus status="failed" errorMessage="Error" onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: /Spróbuj ponownie/ });
    expect(btn).toBeInTheDocument();
  });

  test('does not render retry button when onRetry is not provided', () => {
    render(<RecordingPipelineStatus status="failed" errorMessage="Error" />);
    const btn = screen.queryByRole('button', { name: /Spróbuj ponownie/ });
    expect(btn).toBeNull();
  });

  test('does not render retry button for non-failed status', () => {
    const onRetry = vi.fn();
    render(<RecordingPipelineStatus status="processing" onRetry={onRetry} />);
    const btn = screen.queryByRole('button', { name: /Spróbuj ponownie/ });
    expect(btn).toBeNull();
  });

  test('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<RecordingPipelineStatus status="failed" errorMessage="Error" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /Spróbuj ponownie/ }));
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

  test('applies custom className', () => {
    const { container } = render(<RecordingPipelineStatus status="done" className="my-custom" />);
    expect(container.firstChild).toHaveClass('my-custom');
  });

  test('clamps progressPercent to 0-100 range in aria-valuenow', () => {
    const { container, rerender } = render(
      <RecordingPipelineStatus status="processing" progressMessage="x" progressPercent={-10} />
    );
    let meter = container.querySelector('.pipeline-progress-meter');
    expect(meter).toHaveAttribute('aria-valuenow', '0');

    rerender(
      <RecordingPipelineStatus status="processing" progressMessage="x" progressPercent={150} />
    );
    meter = container.querySelector('.pipeline-progress-meter');
    expect(meter).toHaveAttribute('aria-valuenow', '100');
  });

  test('has correct aria-label on progress meter', () => {
    const { container } = render(
      <RecordingPipelineStatus status="processing" progressMessage="x" />
    );
    const meter = container.querySelector('.pipeline-progress-meter');
    expect(meter).toHaveAttribute('aria-label', 'Postep przetwarzania nagrania');
  });

  test('shows spinner for in-progress statuses', () => {
    const { container } = render(<RecordingPipelineStatus status="processing" />);
    const spinner = container.querySelector('.status-spinner');
    expect(spinner).toBeInTheDocument();
  });

  test('does not show spinner for done status', () => {
    const { container } = render(<RecordingPipelineStatus status="done" />);
    const spinner = container.querySelector('.status-spinner');
    expect(spinner).toBeNull();
  });
});
