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
    expect(screen.getByRole('dialog', { name: /szybkie przejście/i })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Zakładka, spotkanie, zadanie, osoba...')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zamknij/i })).toBeInTheDocument();
    expect(screen.getByText(/otwiera paletę/i)).toBeInTheDocument();
  });

  it('renders filtered results and supports keyboard navigation', async () => {
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    const firstItem = await screen.findByRole('button', { name: /spotkanie q1/i });
    expect(firstItem.className).toContain('command-result');
    expect(firstItem.className).not.toContain('active');

    await userEvent.keyboard('{ArrowDown}');
    const secondItem = await screen.findByRole('button', { name: /notatka q1/i });
    expect(secondItem.className).toContain('command-result');
    expect(firstItem.className).toContain('active');

    await userEvent.keyboard('{ArrowDown}');
    expect(secondItem.className).toContain('active');

    await userEvent.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'note_1' }));
  });

  it('closes on Escape key', async () => {
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps keyboard focus order aligned with result highlighting', async () => {
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    const searchInput = screen.getByPlaceholderText('Zakładka, spotkanie, zadanie, osoba...');
    const firstItem = await screen.findByRole('button', { name: /spotkanie q1/i });
    const secondItem = await screen.findByRole('button', { name: /notatka q1/i });

    expect(document.activeElement).toBe(searchInput);
    await userEvent.tab();
    expect(document.activeElement).toBe(secondItem);
    expect(secondItem.className).toContain('active');

    await userEvent.tab();
    expect(document.activeElement).toBe(firstItem);
    expect(firstItem.className).toContain('active');
  });

  it('closes on backdrop click and shows empty panel when no matches', async () => {
    const emptyItems = [];
    const { container } = render(
      <CommandPalette open={true} items={emptyItems} onClose={onClose} onSelect={onSelect} />
    );

    const backdrop = container.querySelector('.command-palette-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(screen.getByText(/brak wynik/i)).toBeInTheDocument();

    await userEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalled();
  });

  it('supports text search filtering', async () => {
    render(<CommandPalette open={true} items={items} onClose={onClose} onSelect={onSelect} />);

    await userEvent.type(
      screen.getByPlaceholderText('Zakładka, spotkanie, zadanie, osoba...'),
      'Notatka'
    );
    expect(screen.getByRole('button', { name: /notatka q1/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /spotkanie q1/i })).toBeNull();
  });
});
