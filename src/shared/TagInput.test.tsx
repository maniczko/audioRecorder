import { render, screen, fireEvent } from '@testing-library/react';
import TagInput from './TagInput';
import { addCustomTaskTag, addCustomTaskPerson } from '../lib/tasks';

vi.mock('../lib/tasks', () => ({
  addCustomTaskTag: vi.fn(),
  addCustomTaskPerson: vi.fn(),
}));

function createProps(overrides: Record<string, any> = {}) {
  return {
    tags: [],
    suggestions: ['frontend', 'design', 'testing'],
    onChange: vi.fn(),
    placeholder: 'Dodaj tag...',
    type: 'tag',
    ...overrides,
  };
}

describe('TagInput', () => {
  it('shows suggestions when focused', () => {
    const props = createProps();
    render(<TagInput {...props} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('design')).toBeInTheDocument();
  });

  it('adds an existing suggestion with Enter', () => {
    const onChange = vi.fn();
    const props = createProps({ suggestions: ['frontend', 'design'], tags: ['backend'], onChange });
    render(<TagInput {...props} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'des' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['backend', 'design']);
    expect(addCustomTaskTag).toHaveBeenCalledWith('design');
    expect(addCustomTaskPerson).not.toHaveBeenCalled();
  });

  it('adds an existing suggestion when clicked in the dropdown', () => {
    const onChange = vi.fn();
    const props = createProps({ suggestions: ['frontend', 'design'], tags: ['backend'], onChange });
    render(<TagInput {...props} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByRole('button', { name: /design/i }));

    expect(onChange).toHaveBeenCalledWith(['backend', 'design']);
    expect(addCustomTaskTag).toHaveBeenCalledWith('design');
    expect(addCustomTaskPerson).not.toHaveBeenCalled();
  });

  it('creates a new value when no matching suggestion exists', () => {
    const onChange = vi.fn();
    const props = createProps({ onChange, suggestions: ['frontend'], tags: [] });
    render(<TagInput {...props} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'new-tag' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['new-tag']);
    expect(addCustomTaskTag).toHaveBeenCalledWith('new-tag');
  });

  it('removes the last tag on Backspace when empty', () => {
    const onChange = vi.fn();
    const props = createProps({ tags: ['backend', 'design'], onChange });
    render(<TagInput {...props} />);

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(onChange).toHaveBeenCalledWith(['backend']);
  });

  it('removes a selected chip without clearing the remaining values', () => {
    const onChange = vi.fn();
    const props = createProps({ tags: ['Iwo', 'Anna', 'Marta'], onChange, type: 'person' });
    render(<TagInput {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Usun Anna/i }));

    expect(onChange).toHaveBeenCalledWith(['Iwo', 'Marta']);
  });

  it('supports keyboard multi-select for people suggestions', () => {
    const onChangeFirst = vi.fn();
    const { rerender } = render(
      <TagInput
        {...createProps({
          type: 'person',
          suggestions: ['Iwo', 'Anna', 'Marta'],
          tags: [],
          onChange: onChangeFirst,
          placeholder: 'Wybierz osoby...',
        })}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'iw' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChangeFirst).toHaveBeenCalledWith(['Iwo']);

    const onChangeSecond = vi.fn();
    rerender(
      <TagInput
        {...createProps({
          type: 'person',
          suggestions: ['Iwo', 'Anna', 'Marta'],
          tags: ['Iwo'],
          onChange: onChangeSecond,
          placeholder: 'Wybierz osoby...',
        })}
      />
    );

    const nextInput = screen.getByRole('textbox');
    fireEvent.focus(nextInput);
    fireEvent.change(nextInput, { target: { value: 'an' } });
    fireEvent.keyDown(nextInput, { key: 'Enter' });

    expect(onChangeSecond).toHaveBeenCalledWith(['Iwo', 'Anna']);
  });

  it('uses addCustomTaskPerson for person mode', () => {
    const onChange = vi.fn();
    const props = createProps({
      type: 'person',
      suggestions: ['Jan', 'Marta'],
      onChange,
      tags: [],
    });
    render(<TagInput {...props} />);

    const input = screen.getByPlaceholderText('Dodaj tag...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Alex' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(addCustomTaskPerson).toHaveBeenCalledWith('Alex');
    expect(onChange).toHaveBeenCalledWith(['Alex']);
    expect(addCustomTaskTag).not.toHaveBeenCalled();
  });

  it('hides placeholder once at least one tag exists', () => {
    const props = createProps({ tags: ['one'] });
    render(<TagInput {...props} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', '');
  });
});
