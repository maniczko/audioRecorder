import { useState, useRef, useEffect, useMemo } from 'react';
import './AssigneeInput.css';

export default function AssigneeInput({
  value = '',
  suggestions = [],
  onChange,
  placeholder = 'Wybierz osobę...',
}) {
  const [inputValue, setInputValue] = useState(value ? '' : '');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isFocused && !value) {
      setInputValue('');
    }
  }, [value, isFocused]);

  const filteredSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    // Pokaż wszystkie gdy brak tekstu, w przeciwnym razie filtruj
    return suggestions
      .filter((s: string) => s !== value && s.toLowerCase().includes(query))
      .slice(0, 10);
  }, [inputValue, suggestions, value]);

  function handleSelect(person: string) {
    onChange(person);
    setInputValue('');
    setIsFocused(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
         onChange(inputValue.trim());
         setInputValue('');
      }
      setIsFocused(false);
      inputRef.current?.blur();
    } else if (e.key === 'Backspace' && !inputValue && value) {
      // Usun osobe jesli input jest pusty a wciskamy backspace
      onChange('');
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setInputValue('');
      inputRef.current?.blur();
    }
  }

  return (
    <div
      className={`assignee-input-container ${isFocused ? 'focused' : ''}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="assignee-input-tokens">
        {value && (
          <div className="assignee-badge">
            <div className="assignee-avatar-small">
              {value.charAt(0).toUpperCase()}
            </div>
            {value}
            <button
              type="button"
              className="assignee-badge-remove"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setInputValue('');
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            >
              ×
            </button>
          </div>
        )}
        <input
          ref={inputRef}
          className="assignee-input-field"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (value && e.target.value) {
              onChange(''); // clear selection if user starts typing a new one
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={!value ? placeholder : ''}
        />
      </div>

      {isFocused && filteredSuggestions.length > 0 && (
        <div className="assignee-input-dropdown" onMouseDown={(e) => e.preventDefault()}>
          {filteredSuggestions.map((s: string) => (
            <button
              key={s}
              type="button"
              className={`assignee-input-option ${s === value ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s);
              }}
            >
              <div className="assignee-avatar">
                {s.charAt(0).toUpperCase()}
              </div>
              <span>{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
