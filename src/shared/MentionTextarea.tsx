import { useState, useRef, useMemo, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { getTagColor } from './TagBadge';
import './MentionTextareaStyles.css';

interface MentionTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string;
  onChange?: (e: any) => void;
  suggestions?: string[];
}

export default function MentionTextarea({
  value = '',
  onChange,
  suggestions = [],
  placeholder = '',
  rows = 3,
  className = '',
  style,
  ...props
}: MentionTextareaProps) {
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number;
    end: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 240, maxHeight: 220 });
  const [isFocused, setIsFocused] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = useMemo(() => {
    if (!mentionState) return [];
    const query = mentionState.query.toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(query)).slice(0, 10);
  }, [mentionState, suggestions]);

  const highlightRegex = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return null;
    const escapedSuggestions = suggestions.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp(`@(${escapedSuggestions.join('|')})`, 'gi');
  }, [suggestions]);

  function updateDropdownPosition() {
    if (!textareaRef.current || typeof window === 'undefined') return;
    const rect = textareaRef.current.getBoundingClientRect();
    const viewportMargin = 8;
    const gap = 4;
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - viewportMargin * 2);

    const left = rect.left;
    const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
    const spaceAbove = rect.top - viewportMargin;
    const openUp = spaceBelow < 170 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(260, openUp ? spaceAbove - gap : spaceBelow - gap));
    const top = openUp ? Math.max(viewportMargin, rect.top - maxHeight - gap) : rect.bottom + gap;

    setDropdownPos({ top, left, width, maxHeight });
  }

  useEffect(() => {
    if (mentionState) {
      updateDropdownPosition();
      setActiveIndex(0);
    }
  }, [mentionState, filteredSuggestions.length]);

  useEffect(() => {
    if (!mentionState) return;
    function handleScroll() {
      updateDropdownPosition();
    }
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [mentionState]);

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    onChange?.(e);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@([\wąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]*)$/);

    if (match) {
      const query = match[1];
      setMentionState({
        query,
        start: match.index as number,
        end: cursor,
      });
    } else {
      setMentionState(null);
    }
  }

  function insertMention(suggestion: string) {
    if (!mentionState) return;

    const before = value.slice(0, mentionState.start);
    const after = value.slice(mentionState.end);
    const newValue = `${before}@${suggestion} ${after}`;

    onChange?.({ target: { value: newValue } } as any);
    setMentionState(null);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = mentionState.start + suggestion.length + 2;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionState || filteredSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(filteredSuggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMentionState(null);
    }
  }

  function renderHighlights(text: string) {
    if (!highlightRegex || !text) return text;
    // ensure trailing space to scroll appropriately
    const textToRender = text.endsWith('\n') ? text + ' ' : text;
    const parts = textToRender.split(highlightRegex);
    return parts.map((part, i) => {
      if (i % 2 !== 0) {
        return (
          <mark key={i} className="mention-highlight">
            @{part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <div className={`mention-textarea-wrapper ${className}`} style={style}>
      <div className="mention-backdrop" ref={backdropRef} aria-hidden="true">
        {renderHighlights(value)}
      </div>
      <textarea
        ref={textareaRef}
        className="mention-textarea-field"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsFocused(false);
            setMentionState(null);
          }, 150);
        }}
        placeholder={placeholder}
        rows={rows}
        onSelect={(e) => {
          if (mentionState) handleChange(e as any);
        }}
        {...props}
      />
      {isFocused &&
        mentionState &&
        filteredSuggestions.length > 0 &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="todo-mention-dropdown"
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxHeight,
              zIndex: 999999,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filteredSuggestions.map((s, idx) => (
              <button
                key={s}
                type="button"
                className="todo-mention-option"
                style={{
                  backgroundColor: idx === activeIndex ? 'rgba(117, 214, 196, 0.1)' : undefined,
                  color: idx === activeIndex ? 'var(--accent)' : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s);
                }}
              >
                <span
                  className="tag-badge-dot"
                  style={{
                    backgroundColor: getTagColor(s),
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontWeight: 600 }}>{s}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
