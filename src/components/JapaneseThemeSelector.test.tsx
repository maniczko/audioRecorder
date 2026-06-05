import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JapaneseThemeSelector from './JapaneseThemeSelector';
import { japaneseThemes } from '../styles/japaneseThemes';

describe('JapaneseThemeSelector', () => {
  const themeKeys = Object.keys(japaneseThemes);

  it('renders all theme cards and action controls', () => {
    const onThemeChange = vi.fn();
    render(<JapaneseThemeSelector currentTheme="sakura" onThemeChange={onThemeChange} />);

    const themeCards = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('jp-theme-card'));

    expect(themeCards).toHaveLength(themeKeys.length);
    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resetuj Podgląd' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapisz Motyw' })).toBeInTheDocument();
  });

  it('calls onThemeChange when a theme card is selected', () => {
    const onThemeChange = vi.fn();
    render(<JapaneseThemeSelector currentTheme="sakura" onThemeChange={onThemeChange} />);

    const themeCards = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('jp-theme-card'));
    fireEvent.click(themeCards[1]);

    expect(onThemeChange).toHaveBeenCalledWith(themeKeys[1]);
  });

  it('invokes handler on Enter key from theme card and keeps preview controls usable', async () => {
    const onThemeChange = vi.fn();
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    render(<JapaneseThemeSelector currentTheme="sakura" onThemeChange={onThemeChange} />);

    const firstThemeCard = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('jp-theme-card'))[0];
    firstThemeCard.focus();
    await user.keyboard('{Enter}');
    expect(onThemeChange).toHaveBeenCalledWith(themeKeys[0]);

    await user.click(screen.getByRole('button', { name: 'Zapisz Motyw' }));
    expect(saveSpy).toHaveBeenCalledWith('Theme saved:', 'sakura');

    await user.click(screen.getByRole('button', { name: 'Resetuj Podgląd' }));
    expect(saveSpy).toHaveBeenCalledTimes(1);

    saveSpy.mockRestore();
  });
});
