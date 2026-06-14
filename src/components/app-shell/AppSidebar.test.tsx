import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import AppSidebar from './AppSidebar';

vi.mock('../../shared/AskAIPopover', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="ask-ai-popover">
      <button type="button" onClick={onClose}>
        close ai
      </button>
    </div>
  ),
}));

function renderSidebar(overrides = {}) {
  const props = {
    activeTab: 'studio',
    showAskAI: false,
    currentWorkspace: { id: 'ws-1', name: 'Main workspace' },
    currentWorkspaceId: 'ws-1',
    availableWorkspaces: [{ id: 'ws-1', name: 'Main workspace' }],
    closeSidebar: vi.fn(),
    openStudio: vi.fn(),
    setActiveTab: vi.fn(),
    setShowAskAI: vi.fn(),
    switchWorkspace: vi.fn(),
    ...overrides,
  };

  render(<AppSidebar {...props} />);
  return props;
}

describe('AppSidebar', () => {
  test('renders the VoiceBóbr brand lockup in the sidebar', () => {
    renderSidebar();

    expect(screen.getAllByRole('img', { name: 'VoiceBóbr' }).length).toBeGreaterThan(0);
    expect(screen.getByText('VoiceBóbr')).toBeInTheDocument();
  });

  test('opens studio from the Studio navigation item', async () => {
    const props = renderSidebar({ activeTab: 'recordings' });

    await userEvent.click(screen.getByRole('button', { name: /studio/i }));

    expect(props.openStudio).toHaveBeenCalledTimes(1);
    expect(props.closeSidebar).toHaveBeenCalledWith({ returnFocus: true });
    expect(props.setActiveTab).not.toHaveBeenCalled();
  });

  test('switches tabs from secondary navigation items', async () => {
    const props = renderSidebar();

    await userEvent.click(screen.getByRole('button', { name: /zadania/i }));

    expect(props.setActiveTab).toHaveBeenCalledWith('tasks');
    expect(props.closeSidebar).toHaveBeenCalledWith({ returnFocus: true });
  });

  test('marks navigation landmarks and the active item for mobile drawers', () => {
    renderSidebar({ activeTab: 'calendar' });

    expect(screen.getByRole('complementary', { name: /główna nawigacja/i })).toHaveAttribute(
      'id',
      'voicebobr-sidebar'
    );
    expect(screen.getByRole('navigation', { name: /widoki aplikacji/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kalendarz' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  test('renders the Ask AI popover when requested', () => {
    renderSidebar({ showAskAI: true });

    expect(screen.getByTestId('ask-ai-popover')).toBeInTheDocument();
  });

  test('switches workspace from the selector', async () => {
    const props = renderSidebar({
      availableWorkspaces: [
        { id: 'ws-1', name: 'Main workspace' },
        { id: 'ws-2', name: 'Client workspace' },
      ],
    });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: /workspace/i }), 'ws-2');

    expect(props.switchWorkspace).toHaveBeenCalledWith('ws-2');
  });
});
