import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

import StudioBriefModal from './StudioBriefModal';

// Mocujemy zewnętrzne zależności
vi.mock('../lib/tasks', () => ({
  addCustomTaskPerson: vi.fn(),
  addCustomTaskTag: vi.fn(),
}));

// Mocujemy TagInput zeby nie komplikowac domowych testow skomplikowanym komponentem
vi.mock('../shared/TagInput', () => ({
  default: function MockTagInput({ tags, placeholder, onChange }) {
    return (
      <div data-testid="mock-tag-input">
        <span data-testid="mock-tags-list">{(tags || []).join(',')}</span>
        <input
          placeholder={placeholder}
          data-testid="mock-tag-input-field"
          onChange={(e) => onChange([...tags, e.target.value])}
        />
      </div>
    );
  },
}));

describe('StudioBriefModal', () => {
  const defaultProps = {
    currentWorkspacePermissions: { canEditWorkspace: true },
    isDetachedMeetingDraft: false,
    meetingDraft: {
      title: 'Spotkanie projektowe',
      context: 'Omówienie nowej architektury',
      startsAt: '2023-10-10T10:00',
      durationMinutes: 45,
      attendees: 'Jan Kowalski\nAnna Nowak',
      tags: 'projekt, architektura',
      needs: '',
      desiredOutputs: '',
      location: '',
    },
    setMeetingDraft: vi.fn(),
    activeStoredMeetingDraft: null,
    clearMeetingDraft: vi.fn(),
    saveMeeting: vi.fn(),
    startNewMeetingDraft: vi.fn(),
    workspaceMessage: '',
    selectedMeeting: null,
    peopleOptions: ['Jan Kowalski', 'Anna Nowak', 'Michał Wiśniewski'],
    tagOptions: ['projekt', 'architektura', 'pilne'],
    userMeetings: [],
    selectMeeting: vi.fn(),
    selectedRecordingId: null,
    setSelectedRecordingId: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    render(<StudioBriefModal {...defaultProps} />);

    // Header
    expect(screen.getByText('Meeting brief')).toBeInTheDocument();
    expect(screen.getByText('Nowe spotkanie')).toBeInTheDocument();

    // Inputs
    expect(screen.getByDisplayValue('Spotkanie projektowe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Omówienie nowej architektury')).toBeInTheDocument();
  });

  it('renders "Edytuj spotkanie" if selectedMeeting is provided', () => {
    render(<StudioBriefModal {...defaultProps} selectedMeeting={{ id: '123' }} />);
    expect(screen.getByText('Edytuj spotkanie')).toBeInTheDocument();
  });

  it('calls clearMeetingDraft and onClose when Cancelling', () => {
    render(<StudioBriefModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /Anuluj/i });
    fireEvent.click(cancelButton);

    expect(defaultProps.clearMeetingDraft).toHaveBeenCalledOnce();
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it('calls saveMeeting and onClose when form is valid and Saved', () => {
    render(<StudioBriefModal {...defaultProps} />);

    const saveButton = screen.getByRole('button', { name: /Zapisz zmiany/i });
    fireEvent.click(saveButton);

    expect(defaultProps.saveMeeting).toHaveBeenCalledOnce();
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  it('disables save button if title is empty', () => {
    const emptyDraftProps = {
      ...defaultProps,
      meetingDraft: { ...defaultProps.meetingDraft, title: '   ' },
    };
    render(<StudioBriefModal {...emptyDraftProps} />);

    const saveButton = screen.getByRole('button', { name: /Zapisz zmiany/i });
    expect(saveButton).toBeDisabled();
  });

  it('toggles advanced options when clicking the toggle button', () => {
    render(<StudioBriefModal {...defaultProps} />);

    // Potrzeby and Lokalizacja shouldn't be visible initially
    expect(screen.queryByPlaceholderText('np. Sala konferencyjna A')).not.toBeInTheDocument();

    const toggleButton = screen.getByRole('button', { name: /Dodatkowe opcje/i });
    fireEvent.click(toggleButton);

    // Advanced fields should now be visible
    expect(screen.getByPlaceholderText('np. Sala konferencyjna A')).toBeInTheDocument();
  });
});
