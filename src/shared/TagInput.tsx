import { useState, useRef, useMemo } from 'react';
import './TagInput.css';
import TagBadge, { getTagColor } from './TagBadge';

export default function TagInput({
  tags = [],
  suggestions = [],
  onChange,
  placeholder = 'Dodaj tag...',
}) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const normalizedTags = useMemo(() => (Array.isArray(tags) ? tags : []), [tags]);

  const filteredSuggestions = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    return suggestions
      .filter(
        (s) =>
          !normalizedTags.some((t) => t.toLowerCase() === s.toLowerCase()) &&
          (query ? s.toLowerCase().includes(query) : true)
      )
      .slice(0, 10);
  }, [inputValue, suggestions, normalizedTags]);

  const canCreate =
    inputValue.trim().length > 0 &&
    !normalizedTags.some((t) => t.toLowerCase() === inputValue.trim().toLowerCase());

  function addTag(tag) {
    const normalized = String(tag || '')
      .trim()
      .replace(/,$/, '');
    if (!normalized) return;
    if (!normalizedTags.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
      onChange([...normalizedTags, normalized]);
    }
    setInputValue('');
    inputRef.current?.focus();
  }

  function removeTag(tagToRemove) {
    onChange(normalizedTags.filter((t) => t !== tagToRemove));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && normalizedTags.length > 0) {
      removeTag(normalizedTags[normalizedTags.length - 1]);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      className={`tag-input-container ${isFocused ? 'focused' : ''}`}
      onClick={() => inputRef.current?.focus()}
      style={{ position: 'relative' }}
    >
      <div className="tag-input-tokens">
        {normalizedTags.map((tag) => (
          <TagBadge key={tag} tag={tag} onRemove={() => removeTag(tag)} />
        ))}
        <input
          ref={inputRef}
          className="tag-input-field"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={normalizedTags.length === 0 ? placeholder : ''}
        />
      </div>

      {isFocused && (
        <div 
          className="tag-input-dropdown" 
          onMouseDown={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            marginTop: '4px',
          }}
        >
          {filteredSuggestions.length === 0 && !canCreate && (
            <div style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: '0.85rem' }}>
              Brak sugestii. Wpisz nazwę i naciśnij Enter aby dodać.
            </div>
          )}
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="tag-input-option"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
            >
              <span className="tag-badge-dot" style={{ backgroundColor: getTagColor(s) }} />
              <span style={{ marginLeft: '8px' }}>{s}</span>
            </button>
          ))}
          {canCreate &&
            !filteredSuggestions.some(
              (s) => s.toLowerCase() === inputValue.trim().toLowerCase()
            ) && (
              <button
                type="button"
                className="tag-input-option create"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(inputValue);
                }}
              >
                <span className="tag-badge-dot" style={{ backgroundColor: getTagColor(inputValue.trim()) }} />
                <span style={{ marginLeft: '8px' }}>Utwórz: <strong>{inputValue.trim()}</strong></span>
              </button>
            )}
        </div>
      )}
    </div>
  );
}
