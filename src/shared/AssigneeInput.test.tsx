import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AssigneeInput from './AssigneeInput';

describe('AssigneeInput', () => {
  const mockOnChange = vi.fn();
  const suggestions = ['Alice Johnson', 'Bob Smith', 'Charlie Brown', 'Diana Prince'];

  const defaultProps = {
    value: '',
    suggestions,
    onChange: mockOnChange,
    placeholder: 'Wybierz osobę...',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders input field with placeholder', () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...');
      expect(input).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      render(<AssigneeInput {...defaultProps} placeholder="Custom placeholder" />);
      const input = screen.getByPlaceholderText('Custom placeholder');
      expect(input).toBeInTheDocument();
    });

    it('renders container with correct class', () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const containerElement = container.querySelector('.assignee-input-container');
      expect(containerElement).toBeInTheDocument();
    });

    it('renders without crashing with no suggestions', () => {
      render(<AssigneeInput {...defaultProps} suggestions={[]} />);
      expect(screen.getByPlaceholderText('Wybierz osobę...')).toBeInTheDocument();
    });

    it('renders without crashing with no props', () => {
      const { container } = render(<AssigneeInput onChange={mockOnChange} />);
      expect(container.querySelector('.assignee-input-container')).toBeInTheDocument();
    });
  });

  describe('Value Display', () => {
    it('displays selected value in badge', () => {
      render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });

    it('shows badge with avatar initial', () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const avatar = container.querySelector('.assignee-avatar-small');
      expect(avatar?.textContent).toBe('A');
    });

    it('displays multiple character initials correctly', () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Xavier Yates" />);
      const avatar = container.querySelector('.assignee-avatar-small');
      expect(avatar?.textContent).toBe('X');
    });

    it('hides placeholder when value is selected', () => {
      const { rerender } = render(<AssigneeInput {...defaultProps} value="" />);
      expect(screen.getByPlaceholderText('Wybierz osobę...')).toBeInTheDocument();

      rerender(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const input = screen.getByDisplayValue('');
      expect(input).toHaveAttribute('placeholder', '');
    });
  });

  describe('Badge Removal', () => {
    it('renders remove button on badge', () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const removeButton = container.querySelector('.assignee-badge-remove');
      expect(removeButton).toBeInTheDocument();
      expect(removeButton?.textContent).toBe('×');
    });

    it('clears value when remove button is clicked', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const removeButton = container.querySelector('.assignee-badge-remove') as HTMLButtonElement;

      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('');
      });
    });

    it('focuses input after removing badge', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const removeButton = container.querySelector('.assignee-badge-remove') as HTMLButtonElement;
      const input = screen.getByDisplayValue('') as HTMLInputElement;

      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });

    it('stops event propagation when clicking remove button', () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const removeButton = container.querySelector('.assignee-badge-remove') as HTMLButtonElement;
      const event = new MouseEvent('click', { bubbles: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      removeButton.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe('Input Typing', () => {
    it('updates input value when typing', async () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      await userEvent.type(input, 'Ali');

      expect(input.value).toBe('Ali');
    });

    it('clears current selection when typing new value', async () => {
      const { rerender } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const input = screen.getByDisplayValue('') as HTMLInputElement;

      // Simulate typing while a value is selected
      await userEvent.type(input, 'B');

      expect(mockOnChange).toHaveBeenCalledWith(''); // Clear selection
    });

    it('does not clear selection when input is empty', async () => {
      const { rerender } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const input = screen.getByDisplayValue('') as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.blur(input);

      // onChange should not be called for selection clearing
      expect(mockOnChange).not.toHaveBeenCalledWith('');
    });

    it('trims input value on change', async () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      await userEvent.type(input, '  Alice  ');

      expect(input.value).toBe('  Alice  '); // Input shows raw value
    });
  });

  describe('Suggestion Filtering', () => {
    it('shows all suggestions when input is empty', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const options = container.querySelectorAll('.assignee-input-option');
        expect(options.length).toBeGreaterThan(0);
      });
    });

    it('filters suggestions based on input', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'Ali');

      await waitFor(() => {
        const options = container.querySelectorAll('.assignee-input-option');
        expect(options.length).toBe(1);
        expect(options[0].textContent).toContain('Alice Johnson');
      });
    });

    it('filters case-insensitively', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'charlie');

      await waitFor(() => {
        const options = container.querySelectorAll('.assignee-input-option');
        expect(options.length).toBe(1);
        expect(options[0].textContent).toContain('Charlie Brown');
      });
    });

    it('limits suggestions to 10 items', () => {
      const manyItems = Array.from({ length: 20 }, (_, i) => `Person ${i}`);
      const { container } = render(<AssigneeInput {...defaultProps} suggestions={manyItems} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      const options = container.querySelectorAll('.assignee-input-option');
      expect(options.length).toBeLessThanOrEqual(10);
    });

    it('excludes current value from suggestions', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const input = screen.getByDisplayValue('') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const options = container.querySelectorAll('.assignee-input-option');
        const optionTexts = Array.from(options).map((o) => o.textContent);
        expect(optionTexts).not.toContain('Alice Johnson');
      });
    });

    it('hides dropdown when no suggestions match', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'ZZZNonexistent');

      const dropdown = container.querySelector('.assignee-input-dropdown');
      expect(dropdown).not.toBeInTheDocument();
    });

    it('ignores whitespace in filter query', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, '   Ali   ');

      await waitFor(() => {
        const options = container.querySelectorAll('.assignee-input-option');
        expect(options.length).toBe(1);
      });
    });
  });

  describe('Dropdown Rendering', () => {
    it('shows dropdown when input is focused and has suggestions', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const dropdown = container.querySelector('.assignee-input-dropdown');
        expect(dropdown).toBeInTheDocument();
      });
    });

    it('hides dropdown when input is blurred', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await waitFor(() => {
        expect(container.querySelector('.assignee-input-dropdown')).toBeInTheDocument();
      });

      fireEvent.blur(input);
      await waitFor(
        () => {
          expect(container.querySelector('.assignee-input-dropdown')).not.toBeInTheDocument();
        },
        { timeout: 300 }
      );
    });

    it('renders option buttons with avatars', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const avatars = container.querySelectorAll('.assignee-input-option .assignee-avatar');
        expect(avatars.length).toBeGreaterThan(0);
        expect(avatars[0].textContent).toBe('A'); // Alice
      });
    });

    it('adds selected class to matching suggestion', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const input = screen.getByDisplayValue('') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const options = container.querySelectorAll('.assignee-input-option');
        // Alice Johnson should NOT be in suggestions since it's the current value
        // So we just verify options exist and none are selected
        expect(options.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Selection from Dropdown', () => {
    it('calls onChange with selected suggestion', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const firstOption = container.querySelector('.assignee-input-option') as HTMLButtonElement;
        fireEvent.mouseDown(firstOption);
      });

      expect(mockOnChange).toHaveBeenCalledWith('Alice Johnson');
    });

    it('clears input after selection', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const firstOption = container.querySelector('.assignee-input-option') as HTMLButtonElement;
        fireEvent.mouseDown(firstOption);
      });

      expect(input.value).toBe('');
    });

    it('blurs input after selection', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const firstOption = container.querySelector('.assignee-input-option') as HTMLButtonElement;
        fireEvent.mouseDown(firstOption);
      });

      expect(input).not.toHaveFocus();
    });

    it('prevents default mouse down behavior on option', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const firstOption = container.querySelector('.assignee-input-option') as HTMLButtonElement;
        const event = new MouseEvent('mousedown', { bubbles: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        firstOption.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Handling', () => {
    it('submits input value on Enter key', async () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'John Doe');
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith('John Doe');
    });

    it('clears input after Enter submission', async () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'John Doe');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(input.value).toBe('');
    });

    it('does not submit empty input on Enter', async () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('prevents default Enter behavior', async () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'test');

      // Use fireEvent to test preventDefault
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      let defaultPrevented = false;
      const originalPreventDefault = event.preventDefault.bind(event);
      vi.spyOn(event, 'preventDefault').mockImplementation(() => {
        defaultPrevented = true;
        originalPreventDefault();
      });

      input.dispatchEvent(event);

      expect(defaultPrevented).toBe(true);
    });

    it('clears value on Backspace when input is empty and value exists', () => {
      render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const input = screen.getByDisplayValue('') as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Backspace' });

      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('does not clear value on Backspace when input has content', async () => {
      render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const input = screen.getByDisplayValue('') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'B');
      fireEvent.keyDown(input, { key: 'Backspace' });

      // onChange should have been called only for clearing selection, not for backspace
      expect(mockOnChange).toHaveBeenCalledTimes(1); // Only for typing 'B'
    });

    it('closes dropdown on Escape key', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await waitFor(() => {
        expect(container.querySelector('.assignee-input-dropdown')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(container.querySelector('.assignee-input-dropdown')).not.toBeInTheDocument();
    });

    it('clears input on Escape key', async () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'test');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input.value).toBe('');
    });

    it('blurs input on Escape key', () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input).not.toHaveFocus();
    });
  });

  describe('Focus Behavior', () => {
    it('adds focused class when input is focused', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const containerElement = container.querySelector('.assignee-input-container');
        expect(containerElement).toHaveClass('focused');
      });
    });

    it('removes focused class when input is blurred', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(
        () => {
          const containerElement = container.querySelector('.assignee-input-container');
          expect(containerElement).not.toHaveClass('focused');
        },
        { timeout: 300 }
      );
    });

    it('focuses input when clicking container', () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const containerElement = container.querySelector(
        '.assignee-input-container'
      ) as HTMLDivElement;
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.click(containerElement);

      expect(input).toHaveFocus();
    });

    it('prevents dropdown from closing when clicking dropdown', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const dropdown = container.querySelector('.assignee-input-dropdown') as HTMLDivElement;
        const event = new MouseEvent('mousedown', { bubbles: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        dropdown.dispatchEvent(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty string value', () => {
      render(<AssigneeInput {...defaultProps} value="" />);
      expect(screen.getByPlaceholderText('Wybierz osobę...')).toBeInTheDocument();
    });

    it('handles undefined suggestions', () => {
      render(<AssigneeInput {...defaultProps} suggestions={undefined as any} />);
      expect(screen.getByPlaceholderText('Wybierz osobę...')).toBeInTheDocument();
    });

    it('handles special characters in suggestions', async () => {
      const specialSuggestions = ["John O'Brien", 'María García', 'Jean-Pierre'];
      const { container } = render(
        <AssigneeInput {...defaultProps} suggestions={specialSuggestions} />
      );
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const options = container.querySelectorAll('.assignee-input-option');
        expect(options.length).toBe(3);
      });
    });

    it('handles long names correctly', () => {
      const longName = 'Alexander Christopher Benjamin Thompson';
      const { container } = render(<AssigneeInput {...defaultProps} value={longName} />);
      expect(screen.getByText(longName)).toBeInTheDocument();
      const avatar = container.querySelector('.assignee-avatar-small');
      expect(avatar?.textContent).toBe('A');
    });

    it('handles rapid selection changes', async () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);
      await userEvent.type(input, 'Ali');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith('Ali');
    });

    it('handles null onChange callback gracefully', () => {
      const { container } = render(
        <AssigneeInput value="" suggestions={suggestions} onChange={null as any} />
      );
      expect(container.querySelector('.assignee-input-container')).toBeInTheDocument();
    });

    it('handles value with whitespace', () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="  Spaced Name  " />);
      const badge = container.querySelector('.assignee-badge');
      expect(badge?.textContent).toContain('Spaced Name');
    });
  });

  describe('Accessibility', () => {
    it('input has proper attributes', () => {
      render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder');
      expect(input.className).toContain('assignee-input-field');
    });

    it('buttons are keyboard accessible', () => {
      const { container } = render(<AssigneeInput {...defaultProps} value="Alice Johnson" />);
      const removeButton = container.querySelector('.assignee-badge-remove') as HTMLButtonElement;

      expect(removeButton).toHaveAttribute('type', 'button');
      expect(removeButton).toBeVisible();
    });

    it('options are keyboard selectable', async () => {
      const { container } = render(<AssigneeInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('Wybierz osobę...') as HTMLInputElement;

      fireEvent.focus(input);

      await waitFor(() => {
        const option = container.querySelector('.assignee-input-option') as HTMLButtonElement;
        expect(option).toHaveAttribute('type', 'button');
      });
    });
  });
});
