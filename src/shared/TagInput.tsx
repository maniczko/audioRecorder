import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './TagInput.css';
import TagBadge, { getTagColor } from './TagBadge';
import { addCustomTaskTag, addCustomTaskPerson } from '../lib/tasks';

export default function TagInput({
  tags = [],
  suggestions = [],
  onChange,
  placeholder = 'Dodaj tag...',
  type = 'tag', // 'tag' | 'person'
}) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 220,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  function updateDropdownPosition() {
    if (!containerRef.current || typeof window === 'undefined') {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const viewportMargin = 8;
    const gap = 4;
    const maxAllowedWidth = Math.max(220, window.innerWidth - viewportMargin * 2);
    const width = Math.min(rect.width, maxAllowedWidth);
    const left = Math.min(
      Math.max(rect.left, viewportMargin),
      Math.max(viewportMargin, window.innerWidth - width - viewportMargin)
    );

    const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
    const spaceAbove = rect.top - viewportMargin;
    const openUp = spaceBelow < 170 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(260, openUp ? spaceAbove - gap : spaceBelow - gap));
    const top = openUp ? Math.max(viewportMargin, rect.top - maxHeight - gap) : rect.bottom + gap;

    setDropdownPosition({ top, left, width, maxHeight });
  }

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    updateDropdownPosition();
    setActiveIndex(0);
  }, [isFocused, inputValue]);

  // Update position on scroll/resize
  useEffect(() => {
    if (!isFocused) return;

    function handleScroll() {
      updateDropdownPosition();
    }

    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isFocused]);

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
      // Persist custom tags/people to localStorage
      if (type === 'person') {
        addCustomTaskPerson(normalized);
      } else {
        addCustomTaskTag(normalized);
      }
    }
    setInputValue('');
    inputRef.current?.focus();
  }

  function removeTag(tagToRemove) {
    onChange(normalizedTags.filter((t) => t !== tagToRemove));
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredSuggestions.length > 0 || canCreate) {
        setActiveIndex((prev) => (prev + 1) % (filteredSuggestions.length + (canCreate ? 1 : 0)));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const total = filteredSuggestions.length + (canCreate ? 1 : 0);
      if (total > 0) {
        setActiveIndex((prev) => (prev - 1 + total) % total);
      }
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (isFocused && (filteredSuggestions.length > 0 || canCreate)) {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
          addTag(filteredSuggestions[activeIndex]);
        } else if (canCreate && activeIndex === filteredSuggestions.length) {
          addTag(inputValue);
        }
      } else if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        if (inputValue.trim()) addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && normalizedTags.length > 0) {
      removeTag(normalizedTags[normalizedTags.length - 1]);
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div
      ref={containerRef}
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
          onBlur={() => {
            // Delay blur to let click on dropdown option fire first
            setTimeout(() => {
              setIsFocused(false);
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          placeholder={normalizedTags.length === 0 ? placeholder : ''}
        />
      </div>

      {isFocused &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="tag-input-dropdown"
            style={{
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: dropdownPosition.maxHeight,
              zIndex: 999999,
              marginTop: 0,
            }}
          >
            {filteredSuggestions.length === 0 && !canCreate && (
              <div style={{ padding: '8px 12px', color: 'var(--text-3)', fontSize: '0.85rem' }}>
                Wpisz nazwę i naciśnij Enter, aby dodać nową wartość.
              </div>
            )}
            {filteredSuggestions.map((s, idx) => (
              <button
                key={s}
                type="button"
                className="tag-input-option"
                style={{
                  backgroundColor: idx === activeIndex ? 'rgba(117, 214, 196, 0.1)' : undefined,
                  color: idx === activeIndex ? 'var(--accent)' : undefined,
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s);
                }}
                onClick={(e) => {
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
                  style={{
                    backgroundColor:
                      activeIndex === filteredSuggestions.length
                        ? 'rgba(117, 214, 196, 0.1)'
                        : undefined,
                  }}
                  onMouseEnter={() => setActiveIndex(filteredSuggestions.length)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(inputValue);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    addTag(inputValue);
                  }}
                >
                  <span
                    className="tag-badge-dot"
                    style={{ backgroundColor: getTagColor(inputValue.trim()) }}
                  />
                  <span style={{ marginLeft: '8px' }}>
                    Utwórz: <strong>{inputValue.trim()}</strong>
                  </span>
                </button>
              )}
          </div>,
          document.body
        )}
    </div>
  );
}
