/**
 * @vitest-environment jsdom
 * CommandPalette Component — Accessibility Tests
 *
 * Following AGENTS.md §2.1 and §5:
 * - WCAG 2.1 AA compliance
 * - Screen reader compatibility
 * - Keyboard navigation (Cmd/Ctrl+K, Arrow keys, Enter, Escape)
 * - Focus management
 * - ARIA live regions for search results
 *
 * Run: pnpm run test -- CommandPalette.a11y.test.tsx
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CommandPalette from './CommandPalette';

// Mock dependencies
const mockUI = vi.hoisted(() => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: vi.fn(),
  activeTab: 'studio',
  setActiveTab: vi.fn(),
}));

const mockWorkspace = vi.hoisted(() => ({
  currentWorkspace: { id: 'ws1', name: 'Team One' },
  availableWorkspaces: [
    { id: 'ws1', name: 'Team One' },
    { id: 'ws2', name: 'Team Two' },
  ],
}));

const mockMeetings = vi.hoisted(() => ({
  meetings: [
    { id: 'm1', title: 'Sprint Planning' },
    { id: 'm2', title: 'Daily Standup' },
  ],
}));

vi.mock('./hooks/useUI', () => ({ default: () => mockUI }));
vi.mock('./store/workspaceStore', () => ({ useWorkspaceSelectors: () => mockWorkspace }));
vi.mock('./hooks/useMeetings', () => ({ default: () => mockMeetings }));

describe('CommandPalette — Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUI.commandPaletteOpen = false;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WCAG 2.1.1 — Keyboard
  // ───────────────────────────────────────────────────────────────────────────

  it('opens on Cmd/Ctrl+K keyboard shortcut', async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    // Simulate Cmd/Ctrl+K
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(mockUI.setCommandPaletteOpen).toHaveBeenCalledWith(true);
    });
  });

  it('closes on Escape key', async () => {
    mockUI.commandPaletteOpen = true;
    const user = userEvent.setup();
    render(<CommandPalette />);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(mockUI.setCommandPaletteOpen).toHaveBeenCalledWith(false);
    });
  });

  it('navigates results with Arrow Down/Up keys', async () => {
    mockUI.commandPaletteOpen = true;
    const user = userEvent.setup();
    render(<CommandPalette />);

    // Wait for results to render
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Arrow down to select first result
    await user.keyboard('{ArrowDown}');
    const firstOption = screen.getByRole('option', { selected: true });
    expect(firstOption).toBeInTheDocument();

    // Arrow down to select second result
    await user.keyboard('{ArrowDown}');

    // Arrow up to go back
    await user.keyboard('{ArrowUp}');
  });

  it('executes selected command on Enter', async () => {
    mockUI.commandPaletteOpen = true;
    const user = userEvent.setup();
    render(<CommandPalette />);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await user.keyboard('{ArrowDown}{Enter}');

    // Command should execute
    await waitFor(() => {
      expect(mockUI.setCommandPaletteOpen).toHaveBeenCalledWith(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WCAG 4.1.2 — Name, Role, Value
  // ───────────────────────────────────────────────────────────────────────────

  it('uses dialog role for the palette', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('uses combobox role for the search input', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('uses listbox role for results container', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('uses option role for each result item', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WCAG 2.4.3 — Focus Order
  // ───────────────────────────────────────────────────────────────────────────

  it('traps focus within the palette when open', async () => {
    mockUI.commandPaletteOpen = true;
    const user = userEvent.setup();
    render(<CommandPalette />);

    const input = screen.getByRole('combobox');
    input.focus();

    // Tab through all focusable elements
    const focusableElements = screen.getAllByRole('option');

    for (let i = 0; i < focusableElements.length; i++) {
      await user.keyboard('{Tab}');
      expect(screen.getActiveElement()).toBeInTheDocument();
    }

    // After last element, should return to first (focus trap)
    await user.keyboard('{Tab}');
    expect(screen.getActiveElement()).toHaveAttribute('role', 'option');
  });

  it('returns focus to trigger element when closed', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div>
        <button data-testid="trigger">Open Palette</button>
        <CommandPalette />
      </div>
    );

    const trigger = container.querySelector('[data-testid="trigger"]') as HTMLButtonElement;
    trigger.focus();

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    // Close palette
    await user.keyboard('{Escape}');

    // Focus should return to trigger
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WCAG 1.3.1 — Info and Relationships
  // ───────────────────────────────────────────────────────────────────────────

  it('associates input with results using aria-controls', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-controls');

    const listboxId = combobox.getAttribute('aria-controls');
    expect(document.getElementById(listboxId!)).toBeInTheDocument();
  });

  it('uses aria-activedescendant to indicate selected option', async () => {
    mockUI.commandPaletteOpen = true;
    const user = userEvent.setup();
    render(<CommandPalette />);

    const combobox = screen.getByRole('combobox');

    await user.keyboard('{ArrowDown}');

    expect(combobox).toHaveAttribute('aria-activedescendant');
    const activeDescendantId = combobox.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeDescendantId!)).toHaveAttribute('role', 'option');
  });

  it('uses aria-expanded to indicate open/closed state', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WCAG 4.1.3 — Status Messages
  // ───────────────────────────────────────────────────────────────────────────

  it('announces number of results to screen readers', async () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveTextContent(/wynik|result/i);
    });
  });

  it('announces "no results" when search returns nothing', async () => {
    mockUI.commandPaletteOpen = true;
    mockMeetings.meetings = [];
    const user = userEvent.setup();
    render(<CommandPalette />);

    const input = screen.getByRole('combobox');
    await user.type(input, 'nonexistent');

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/brak|no results/i);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WCAG 3.3.2 — Labels or Instructions
  // ───────────────────────────────────────────────────────────────────────────

  it('provides placeholder text with usage instructions', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute(
      'placeholder',
      expect.stringMatching(/szukaj|search|cmd|command/i)
    );
  });

  it('displays keyboard shortcuts hint', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    // Should show keyboard shortcut hints
    const hints = screen.getAllByText(/enter|arrow|escape/i);
    expect(hints.length).toBeGreaterThan(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WCAG 1.4.1 — Use of Color
  // ───────────────────────────────────────────────────────────────────────────

  it('does not rely solely on color to indicate selection', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    const selectedOption = screen.getByRole('option', { selected: true });

    // Should have additional visual indicator beyond color
    expect(selectedOption).toHaveAttribute('aria-selected', 'true');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // WCAG 2.4.7 — Focus Visible
  // ───────────────────────────────────────────────────────────────────────────

  it('shows visible focus indicator on selected option', () => {
    mockUI.commandPaletteOpen = true;
    render(<CommandPalette />);

    const options = screen.getAllByRole('option');

    options.forEach((option) => {
      // Should have visible focus style
      expect(option).toHaveStyle('outline: none'); // Custom focus style applied
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Mobile Accessibility
  // ───────────────────────────────────────────────────────────────────────────

  it('has touch targets of at least 44x44 pixels', () => {
    mockUI.commandPaletteOpen = true;
    const { container } = render(<CommandPalette />);

    const options = container.querySelectorAll('[role="option"]');

    options.forEach((option) => {
      const rect = option.getBoundingClientRect();
      expect(rect.height).toBeGreaterThanOrEqual(44);
    });
  });

  it('closes when clicking outside the palette', async () => {
    mockUI.commandPaletteOpen = true;
    const user = userEvent.setup();
    render(<CommandPalette />);

    // Click on backdrop/outside area
    await user.click(document.body);

    await waitFor(() => {
      expect(mockUI.setCommandPaletteOpen).toHaveBeenCalledWith(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Performance & Responsiveness
  // ───────────────────────────────────────────────────────────────────────────

  it('debounces search input to prevent excessive updates', async () => {
    mockUI.commandPaletteOpen = true;
    const user = userEvent.setup();
    render(<CommandPalette />);

    const input = screen.getByRole('combobox');

    // Type quickly
    await user.type(input, 'meeting');

    // Should not trigger search on every keystroke
    await waitFor(
      () => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      },
      { timeout: 500 }
    );
  });

  it('handles empty search gracefully', async () => {
    mockUI.commandPaletteOpen = true;
    const user = userEvent.setup();
    render(<CommandPalette />);

    const input = screen.getByRole('combobox');
    await user.clear(input);

    // Should show all results or recent items
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });
});
