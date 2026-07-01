import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ProductionReadinessBanner from './ProductionReadinessBanner';
import { fetchProductionCapabilities } from '../../services/capabilitiesService';

vi.mock('../../services/capabilitiesService', () => ({
  fetchProductionCapabilities: vi.fn(),
}));

describe('ProductionReadinessBanner', () => {
  afterEach(() => {
    vi.mocked(fetchProductionCapabilities).mockReset();
  });

  test('shows degraded production mode with user-facing reasons', async () => {
    vi.mocked(fetchProductionCapabilities).mockResolvedValueOnce({
      ok: false,
      status: 'degraded',
      generatedAt: '2026-06-28T00:00:00.000Z',
      degradedCapabilities: [
        {
          id: 'meetingAnalysis',
          label: 'Analiza spotkan',
          enabled: false,
          status: 'degraded',
          provider: 'local-fallback',
          reason: 'Brak klucza ANTHROPIC_API_KEY; uzywany jest lokalny fallback.',
          fallbackMode: true,
        },
        {
          id: 'supabaseStorage',
          label: 'Magazyn audio',
          enabled: false,
          status: 'unavailable',
          provider: 'local-filesystem',
          reason: 'Supabase Storage nie jest skonfigurowany.',
          fallbackMode: true,
        },
      ],
      capabilities: {},
      telemetry: {
        fallbackModeUsed: true,
        fallbackModeCapabilities: ['meetingAnalysis', 'supabaseStorage'],
      },
    } as any);

    render(<ProductionReadinessBanner />);

    expect(await screen.findByRole('status')).toHaveTextContent('Tryb ograniczony');
    expect(screen.getByText(/Analiza spotkan/i)).toBeInTheDocument();
    expect(screen.getByText(/Magazyn audio/i)).toBeInTheDocument();
    expect(screen.getByText(/lokalny fallback/i)).toBeInTheDocument();
  });

  test('stays hidden when all production capabilities are ready', async () => {
    vi.mocked(fetchProductionCapabilities).mockResolvedValueOnce({
      ok: true,
      status: 'ready',
      generatedAt: '2026-06-28T00:00:00.000Z',
      degradedCapabilities: [],
      capabilities: {},
      telemetry: {
        fallbackModeUsed: false,
        fallbackModeCapabilities: [],
      },
    } as any);

    render(<ProductionReadinessBanner />);

    await waitFor(() => expect(fetchProductionCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('does not block the app shell when capability fetch fails', async () => {
    vi.mocked(fetchProductionCapabilities).mockRejectedValueOnce(new Error('Backend unavailable'));

    render(<ProductionReadinessBanner />);

    await waitFor(() => expect(fetchProductionCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
