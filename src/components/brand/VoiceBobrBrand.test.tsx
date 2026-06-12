import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import {
  MascotAvatar,
  VoiceBobrAssistant,
  VoiceBobrEmptyState,
  VoiceBobrLogo,
} from './VoiceBobrBrand';

describe('VoiceBobrBrand', () => {
  test('renders full logo with mascot and wordmark', () => {
    render(<VoiceBobrLogo />);

    expect(screen.getByRole('img', { name: 'VoiceBóbr' })).toBeInTheDocument();
    expect(screen.getByText('VoiceBóbr')).toHaveClass('voicebobr-wordmark');
  });

  test('renders compact logo without visible wordmark', () => {
    const { container } = render(<VoiceBobrLogo variant="compact" />);

    expect(container.querySelector('.voicebobr-logo--compact')).toBeInTheDocument();
    expect(container.querySelector('.voicebobr-wordmark')).toBeNull();
  });

  test('renders avatar with requested size class', () => {
    const { container } = render(<MascotAvatar size="xs" label="VoiceBóbr notification" />);

    expect(screen.getByRole('img', { name: 'VoiceBóbr notification' })).toBeInTheDocument();
    expect(container.querySelector('.voicebobr-avatar--xs')).toBeInTheDocument();
  });

  test('renders contextual empty state copy and action', () => {
    render(
      <VoiceBobrEmptyState context="tasks" action={<button type="button">Dodaj zadanie</button>} />
    );

    expect(screen.getByText('Brak zadań na dziś')).toBeInTheDocument();
    expect(screen.getByText(/pozwól VoiceBóbr/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj zadanie' })).toBeInTheDocument();
  });

  test('renders assistant identity with optional body', () => {
    render(
      <VoiceBobrAssistant title="Action items">
        Three action items were identified.
      </VoiceBobrAssistant>
    );

    expect(screen.getByRole('img', { name: 'VoiceBóbr assistant' })).toBeInTheDocument();
    expect(screen.getByText('VoiceBóbr suggests')).toBeInTheDocument();
    expect(screen.getByText('Action items')).toBeInTheDocument();
    expect(screen.getByText('Three action items were identified.')).toBeInTheDocument();
  });
});
