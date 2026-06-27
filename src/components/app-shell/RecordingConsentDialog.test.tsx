import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { createRecordingConsentDisclosure } from '../../lib/recordingConsent';
import RecordingConsentDialog from './RecordingConsentDialog';

describe('RecordingConsentDialog', () => {
  test('blocks acceptance until the disclosure checkbox is confirmed', async () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();

    render(
      <RecordingConsentDialog
        open
        disclosure={createRecordingConsentDisclosure({ remoteMode: true })}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );

    const acceptButton = screen.getByRole('button', {
      name: /Akceptuje i zaczynam nagrywanie/i,
    });

    expect(screen.getByRole('dialog', { name: /Zgoda na nagrywanie/i })).toBeInTheDocument();
    expect(screen.getByText(/zewnetrznych dostawcow AI\/audio/i)).toBeInTheDocument();
    expect(acceptButton).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(acceptButton);

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
  });

  test('does not render when closed', () => {
    render(
      <RecordingConsentDialog
        open={false}
        disclosure={createRecordingConsentDisclosure({ remoteMode: true })}
        onAccept={vi.fn()}
        onDecline={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
