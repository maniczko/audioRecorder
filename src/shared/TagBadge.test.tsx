import { render, screen, fireEvent } from '@testing-library/react';
import TagBadge, { TAG_COLORS, getTagColor } from './TagBadge';

describe('TagBadge', () => {
  it('renders label and badge dot color', () => {
    render(<TagBadge tag="frontend" />);

    const label = screen.getByText('frontend');
    const badge = label.closest('.tag-badge');
    const dot = badge?.querySelector('.tag-badge-dot');

    expect(label).toBeInTheDocument();
    expect(dot).toHaveStyle({ backgroundColor: getTagColor('frontend') });
    expect(badge).toHaveClass('tag-badge');
  });

  it('does not render remove button when onRemove is not provided', () => {
    render(<TagBadge tag="frontend" />);
    expect(document.querySelector('.tag-badge-remove')).toBeNull();
  });

  it('renders remove button and calls onRemove', () => {
    const onRemove = vi.fn();
    render(<TagBadge tag="frontend" onRemove={onRemove} />);

    const removeButton = document.querySelector('.tag-badge-remove') as HTMLButtonElement;
    fireEvent.click(removeButton);

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('getTagColor is deterministic for same value', () => {
    expect(getTagColor('alpha')).toBe(getTagColor('alpha'));
    expect(TAG_COLORS).toContain(getTagColor('alpha'));
  });

  it('returns fallback color for empty tag', () => {
    expect(getTagColor('')).toBe(TAG_COLORS[TAG_COLORS.length - 1]);
  });
});
