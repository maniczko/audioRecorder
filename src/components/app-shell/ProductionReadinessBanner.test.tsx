import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import ProductionReadinessBanner from './ProductionReadinessBanner';
import {
  fetchProductionCapabilities,
  fetchWorkspaceCapabilities,
} from '../../services/capabilitiesService';

vi.mock('../../services/capabilitiesService', () => ({
  fetchProductionCapabilities: vi.fn(),
  fetchWorkspaceCapabilities: vi.fn(),
}));

const workspaceSelectorsMock = vi.hoisted(() => ({
  currentWorkspaceId: null as string | null,
}));

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceSelectors: () => workspaceSelectorsMock,
}));

describe('ProductionReadinessBanner', () => {
  afterEach(() => {
    vi.mocked(fetchProductionCapabilities).mockReset();
    vi.mocked(fetchWorkspaceCapabilities).mockReset();
    workspaceSelectorsMock.currentWorkspaceId = null;
  });

  test('shows degraded production mode with compact user-facing details', async () => {
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

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('Tryb ograniczony');
    expect(banner).toHaveTextContent('Mozesz dalej pracowac');
    expect(screen.getByText(/Analiza spotkan/i)).toBeInTheDocument();
    expect(screen.getByText(/Magazyn audio/i)).toBeInTheDocument();
    expect(screen.queryByText(/ANTHROPIC_API_KEY/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/lokalny fallback/i)).not.toBeInTheDocument();

    const detailsButton = screen.getByRole('button', { name: /szczegoly/i });
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(detailsButton);

    expect(detailsButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Analiza AI wymaga konfiguracji/i)).toBeInTheDocument();
    expect(screen.getByText(/Magazyn audio wymaga konfiguracji/i)).toBeInTheDocument();
    expect(screen.queryByText(/ANTHROPIC_API_KEY/i)).not.toBeInTheDocument();
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

  test('loads workspace capabilities when a workspace is selected', async () => {
    workspaceSelectorsMock.currentWorkspaceId = 'workspace_1';
    vi.mocked(fetchWorkspaceCapabilities).mockResolvedValueOnce({
      ok: false,
      status: 'degraded',
      generatedAt: '2026-06-28T00:00:00.000Z',
      degradedCapabilities: [
        {
          id: 'liveTranscription',
          label: 'Transkrypcja live',
          enabled: false,
          status: 'unavailable',
          provider: 'none',
          reason: 'Disabled by workspace feature flags.',
        },
      ],
      capabilities: {},
      telemetry: {
        fallbackModeUsed: false,
        fallbackModeCapabilities: [],
      },
    } as any);

    render(<ProductionReadinessBanner />);

    expect(await screen.findByRole('status')).toHaveTextContent('Transkrypcja live');
    expect(fetchWorkspaceCapabilities).toHaveBeenCalledWith('workspace_1');
    expect(fetchProductionCapabilities).not.toHaveBeenCalled();
  });

  test('does not block the app shell when capability fetch fails', async () => {
    vi.mocked(fetchProductionCapabilities).mockRejectedValueOnce(new Error('Backend unavailable'));

    render(<ProductionReadinessBanner />);

    await waitFor(() => expect(fetchProductionCapabilities).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
