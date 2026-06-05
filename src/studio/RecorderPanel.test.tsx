import { render, screen, fireEvent } from '@testing-library/react';
import RecorderPanel from './RecorderPanel';

function createBaseProps(overrides: Record<string, any> = {}) {
  return {
    isRecording: false,
    analysisStatus: 'idle',
    activeQueueItem: null,
    selectedMeetingQueue: [],
    elapsed: 62,
    visualBars: [2, 5, 12, 4, 7],
    stopRecording: vi.fn(),
    startRecording: vi.fn(),
    retryRecordingQueueItem: vi.fn(),
    recordPermission: 'granted',
    speechRecognitionSupported: false,
    liveText: '',
    recordingMessage: '',
    canRecord: true,
    noiseReductionEnabled: true,
    onToggleNoiseReduction: vi.fn(),
    ...overrides,
  };
}

describe('RecorderPanel', () => {
  it('renders idle state and formatted duration', () => {
    render(<RecorderPanel {...createBaseProps()} />);

    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('01:02')).toBeInTheDocument();
    expect(screen.getByText('Gotowy do nagrania')).toBeInTheDocument();
  });

  it('starts recording and ad-hoc recording', () => {
    const startRecording = vi.fn();
    render(<RecorderPanel {...createBaseProps({ startRecording })} />);

    fireEvent.click(screen.getByRole('button', { name: /Start recording/i }));
    expect(startRecording).toHaveBeenCalledWith();

    fireEvent.click(screen.getByRole('button', { name: /Nagranie ad hoc/i }));
    expect(startRecording).toHaveBeenCalledWith({ adHoc: true });
  });

  it('stops recording and hides quick controls while recording', () => {
    render(<RecorderPanel {...createBaseProps({ isRecording: true })} />);

    expect(screen.getByText('REC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stop recording/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nagranie ad hoc/i })).not.toBeInTheDocument();
  });

  it('retries failed queue item', () => {
    const retryRecordingQueueItem = vi.fn();
    render(
      <RecorderPanel
        {...createBaseProps({
          activeQueueItem: {
            meetingTitle: 'Demo',
            status: 'failed',
            errorMessage: 'Upload error',
            recordingId: 'rec-1',
          },
          retryRecordingQueueItem,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ponow/i }));
    expect(retryRecordingQueueItem).toHaveBeenCalledWith('rec-1');
  });

  it('shows queued recordings count for selected meeting', () => {
    render(<RecorderPanel {...createBaseProps({ selectedMeetingQueue: ['a', 'b', 'c'] })} />);
    expect(screen.getByText('W kolejce dla tego spotkania: 3')).toBeInTheDocument();
  });

  it('toggles noise reduction status button', () => {
    const onToggleNoiseReduction = vi.fn();
    render(<RecorderPanel {...createBaseProps({ onToggleNoiseReduction })} />);
    const noiseButton = screen.getByRole('button', { name: /Szumy: ON/i });

    fireEvent.click(noiseButton);
    expect(onToggleNoiseReduction).toHaveBeenCalledTimes(1);
  });

  it('displays stop state with microcopy for denied permissions', () => {
    const props = createBaseProps({
      recordPermission: 'denied',
      isRecording: false,
    });
    render(<RecorderPanel {...props} />);

    expect(screen.getByText(/Kliknij "Nagraj"/i)).toBeInTheDocument();
  });
});
