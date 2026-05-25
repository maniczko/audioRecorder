import { render, screen, waitFor } from '@testing-library/react';
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
});
