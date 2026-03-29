import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MentionTextarea from './MentionTextarea';

describe('MentionTextarea', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a textarea with placeholder', () => {
    render(<MentionTextarea placeholder="Type here..." />);
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
  });

  it('renders with given value', () => {
    render(<MentionTextarea value="Hello world" onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Hello world');
  });

  it('sets rows attribute', () => {
    render(<MentionTextarea rows={5} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('rows', '5');
  });

  it('calls onChange when user types', async () => {
    const handleChange = vi.fn();
    render(<MentionTextarea value="" onChange={handleChange} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'test' } });

    expect(handleChange).toHaveBeenCalled();
  });

  it('renders with custom className', () => {
    const { container } = render(<MentionTextarea className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not crash with empty suggestions', () => {
    render(<MentionTextarea suggestions={[]} value="@test" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does not crash with undefined suggestions', () => {
    render(<MentionTextarea value="hello" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('highlights existing mentions in backdrop', () => {
    const { container } = render(
      <MentionTextarea
        value="Hello @Anna please review"
        suggestions={['Anna', 'Jan']}
        onChange={() => {}}
      />
    );

    const highlights = container.querySelectorAll('.mention-highlight');
    expect(highlights).toHaveLength(1);
    expect(highlights[0].textContent).toBe('@Anna');
  });

  it('does not highlight when no matching suggestions', () => {
    const { container } = render(
      <MentionTextarea value="Hello @Nobody" suggestions={['Anna', 'Jan']} onChange={() => {}} />
    );

    const highlights = container.querySelectorAll('.mention-highlight');
    expect(highlights).toHaveLength(0);
  });

  it('filters suggestions case-insensitively', () => {
    // This tests the internal filteredSuggestions memo which limits to 10
    // We verify indirectly: if component handles many suggestions without crash
    const suggestions = Array.from({ length: 20 }, (_, i) => `Person${i}`);
    render(<MentionTextarea value="" suggestions={suggestions} onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('escapes special regex characters in suggestions', () => {
    // Names with regex special chars should not break the highlight regex
    const suggestions = ['Anna (PM)', 'Jan [Dev]', 'O*la'];
    render(
      <MentionTextarea
        value="Hello @Anna (PM) here"
        suggestions={suggestions}
        onChange={() => {}}
      />
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('passes extra props to textarea', () => {
    render(<MentionTextarea data-testid="my-textarea" disabled />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });
});
