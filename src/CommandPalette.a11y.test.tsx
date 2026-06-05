/**
 * @vitest-environment jsdom
 * CommandPalette Accessibility & interaction smoke
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CommandPalette from './CommandPalette';

const items = [
  {
    id: 'meeting_1',
    title: 'Spotkanie Q1',
    subtitle: 'Plan kwartalny',
    type: 'meeting',
    group: 'Spotkania',
    sourceType: 'manual',
    sourceId: 'm1',
    metadata: {},
  },
  {
    id: 'note_1',
    title: 'Notatka Q1',
    subtitle: 'Priorytet wysoki',
    type: 'note',
    group: 'Notatki',
    sourceType: 'manual',
    sourceId: 'n1',
    metadata: {},
  },
];

describe('CommandPalette - Accessibility', () => {
  const onClose = vi.fn();
  const onSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is hidden when closed', () => {
    const { container } = render(
      <CommandPalette open={false} items={items} onClose={onClose} onSelect={onSelect} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders header, shortcut hint and search field', () => {
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    expect(screen.getByRole('heading', { name: /szybkie/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Zakladka, spotkanie, zadanie, osoba...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zamknij/i })).toBeInTheDocument();
    expect(screen.getByText(/ctrl\/cmd \+ k/i)).toBeInTheDocument();
  });

  it('renders filtered results and supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    const firstItem = await screen.findByRole('button', { name: /spotkanie q1/i });
    expect(firstItem.className).toContain('command-result');
    expect(firstItem.className).not.toContain('active');

    await user.keyboard('{ArrowDown}');
    const secondItem = await screen.findByRole('button', { name: /notatka q1/i });
    expect(secondItem.className).toContain('command-result');
    expect(secondItem.className).toContain('active');

    await user.keyboard('{ArrowUp}');
    expect(firstItem.className).toContain('active');

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps keyboard focus order aligned with result highlighting', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    const searchInput = screen.getByPlaceholderText('Zakladka, spotkanie, zadanie, osoba...');
    const firstItem = await screen.findByRole('button', { name: /spotkanie q1/i });
    const secondItem = await screen.findByRole('button', { name: /notatka q1/i });

    expect(document.activeElement).toBe(searchInput);
    await user.tab();
    expect(document.activeElement).toBe(firstItem);
    expect(firstItem.className).toContain('active');

    await user.tab();
    expect(document.activeElement).toBe(secondItem);
    expect(secondItem.className).toContain('active');
  });

  it('closes on backdrop click and shows empty panel when no matches', async () => {
    const user = userEvent.setup();
    const emptyItems = [];
    const { container } = render(
      <CommandPalette open={true} items={emptyItems} onClose={onClose} onSelect={onSelect} />
    );

    const backdrop = container.querySelector('.command-palette-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(screen.getByText(/brak wynik/i)).toBeInTheDocument();

    await user.click(backdrop as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it('supports text search filtering', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    await user.type(screen.getByPlaceholderText('Zakladka, spotkanie, zadanie, osoba...'), 'note');
    expect(screen.getByRole('button', { name: /notatka q1/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /spotkanie q1/i })).toBeNull();
  });
});
