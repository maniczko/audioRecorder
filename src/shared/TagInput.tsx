```typescript
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
    const normalized = tag.trim();
    if (canCreate) {
      onChange([...normalizedTags, normalized]);
      setInputValue('');
    }
  }

  return (
    <div ref={containerRef} className={`tag-input ${isFocused ? 'focused' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            addTag(inputValue);
          }
        }}
      />
      {isFocused && filteredSuggestions.length > 0 && (
        <div className="suggestions-dropdown" style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width, maxHeight: dropdownPosition.maxHeight }}>
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              className={`suggestion-item ${index === activeIndex ? 'active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => addTag(suggestion)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```
