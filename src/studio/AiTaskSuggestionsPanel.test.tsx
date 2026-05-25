import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AiTaskSuggestionsPanel from './AiTaskSuggestionsPanel';

const suggestTasksFromTranscriptMock = vi.hoisted(() => vi.fn());
const remoteApiEnabledMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('../lib/aiTaskSuggestions', () => ({
  suggestTasksFromTranscript: (...args: unknown[]) => suggestTasksFromTranscriptMock(...args),
}));

vi.mock('../services/config', () => ({
  remoteApiEnabled: () => remoteApiEnabledMock(),
}));

describe('AiTaskSuggestionsPanel', () => {
  beforeEach(() => {
    suggestTasksFromTranscriptMock.mockReset();
    remoteApiEnabledMock.mockReturnValue(true);
  });

  it('renders Polish copy and priority labels without mojibake', async () => {
    suggestTasksFromTranscriptMock.mockResolvedValue([
      {
        title: 'Dopiąć plan wdrożenia',
        description: 'Ustalić kolejność zadań po spotkaniu.',
        owner: 'Anna',
        dueDate: null,
        priority: 'medium',
        tags: ['follow-up'],
      },
    ]);

    const { container } = render(
      <AiTaskSuggestionsPanel
        selectedRecording={{
          id: 'rec-ai-1',
          meetingId: 'meeting-ai-1',
          meetingTitle: 'Spotkanie AI',
          transcript: [{ speakerId: 'anna', text: 'Anna przygotuje plan wdrożenia.' }],
        }}
        displaySpeakerNames={{ anna: 'Anna' }}
        peopleProfiles={[{ name: 'Anna' }]}
        onCreateTask={vi.fn()}
      />
    );

    await screen.findByText('Dopiąć plan wdrożenia');

    expect(screen.getByText('AI — zadania')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Sugestie zadań ze spotkania' })
    ).toBeInTheDocument();
    expect(screen.getByText('Średni')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /\u0139|\u0102|\u00e2\u20ac\u201d|\u00e2\u20ac|\u00c4\u2122|\u00c4\u2021/
    );
  });

  it('shows clean empty-state copy when the server returns no suggestions', async () => {
    suggestTasksFromTranscriptMock.mockResolvedValue([]);

    render(
      <AiTaskSuggestionsPanel
        selectedRecording={{
          id: 'rec-ai-2',
          transcript: [{ speakerId: 'anna', text: 'Nie ma nowych zadań.' }],
        }}
        displaySpeakerNames={{ anna: 'Anna' }}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Brak nowych sugestii — wszystkie zatwierdzone lub brak zadań w transkrypcji.'
        )
      ).toBeInTheDocument();
    });
  });

  it('does not auto-generate costly suggestions when editing is disabled', async () => {
    suggestTasksFromTranscriptMock.mockResolvedValue([
      {
        title: 'Nie powinno się wygenerować',
        priority: 'medium',
        tags: [],
      },
    ]);

    render(
      <AiTaskSuggestionsPanel
        selectedRecording={{
          id: 'rec-readonly',
          transcript: [{ speakerId: 'anna', text: 'Anna przygotuje plan.' }],
        }}
        displaySpeakerNames={{ anna: 'Anna' }}
        canEdit={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Generuj sugestie AI' })).toBeDisabled();
    await waitFor(() => {
      expect(suggestTasksFromTranscriptMock).not.toHaveBeenCalled();
    });
    expect(screen.queryByText('Nie powinno się wygenerować')).not.toBeInTheDocument();
  });

  it('reenables generation when edit permissions change for the same recording', async () => {
    suggestTasksFromTranscriptMock.mockResolvedValue([]);
    const recording = {
      id: 'rec-permission-toggle',
      transcript: [{ speakerId: 'anna', text: 'Anna przygotuje plan.' }],
    };
    const speakerNames = { anna: 'Anna' };

    const { rerender } = render(
      <AiTaskSuggestionsPanel
        selectedRecording={recording}
        displaySpeakerNames={speakerNames}
        canEdit={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Generuj sugestie AI' })).toBeDisabled();

    rerender(
      <AiTaskSuggestionsPanel
        selectedRecording={recording}
        displaySpeakerNames={speakerNames}
        canEdit
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generuj sugestie AI' })).toBeEnabled();
    });
  });

  it('uses the latest task creation callback after parent rerender', async () => {
    suggestTasksFromTranscriptMock.mockResolvedValue([
      {
        title: 'Przygotować follow-up',
        description: 'Wysłać podsumowanie po spotkaniu.',
        owner: 'Anna',
        dueDate: null,
        priority: 'high',
        tags: ['follow-up'],
      },
    ]);
    const recording = {
      id: 'rec-latest-callback',
      meetingId: 'meeting-latest-callback',
      meetingTitle: 'Spotkanie callback',
      transcript: [{ speakerId: 'anna', text: 'Anna wyśle follow-up.' }],
    };
    const speakerNames = { anna: 'Anna' };
    const oldCreateTask = vi.fn();
    const newCreateTask = vi.fn();

    const { rerender } = render(
      <AiTaskSuggestionsPanel
        selectedRecording={recording}
        displaySpeakerNames={speakerNames}
        onCreateTask={oldCreateTask}
      />
    );

    await screen.findByText('Przygotować follow-up');

    rerender(
      <AiTaskSuggestionsPanel
        selectedRecording={recording}
        displaySpeakerNames={speakerNames}
        onCreateTask={newCreateTask}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Zatwierdź' }));

    expect(oldCreateTask).not.toHaveBeenCalled();
    expect(newCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Przygotować follow-up',
        sourceMeetingId: 'meeting-latest-callback',
        sourceRecordingId: 'rec-latest-callback',
      })
    );
  });
});
