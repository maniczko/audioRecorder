import { render, screen, waitFor } from '@testing-library/react';
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
