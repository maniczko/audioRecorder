import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { filterCommandPaletteItems } from './lib/commandPalette';
import { semanticSearch } from './lib/aiSearch';
import './CommandPaletteStyles.css';

function groupedItems(items) {
  return items.reduce((groups, item) => {
    const key = item.group || 'Wyniki';
    const bucket = groups.get(key) || [];
    bucket.push(item);
    groups.set(key, bucket);
    return groups;
  }, new Map());
}

export default function CommandPalette({ open, items, onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [aiSearchUnavailable, setAiSearchUnavailable] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef(null);
  const resultButtonsRef = useRef([]);

  const filteredItems = useMemo(
    () => filterCommandPaletteItems(items, deferredQuery),
    [items, deferredQuery]
  );
  const displayItems = useMemo(() => {
    if (!aiResults.length) {
      return filteredItems;
    }

    const localIds = new Set(filteredItems.map((item) => item.id));
    const semanticItems = aiResults
      .filter((item) => !localIds.has(item.id))
      .map((item) => ({
        ...item,
        group: 'AI Match',
        matchSource: 'ai',
        type: item.type || 'AI Match',
      }));

    return [...semanticItems, ...filteredItems];
  }, [aiResults, filteredItems]);
  const grouped = useMemo(() => groupedItems(displayItems), [displayItems]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      setAiResults([]);
      setAiSearchUnavailable(false);
      resultButtonsRef.current = [];
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open || aiSearchUnavailable) {
      return undefined;
    }

    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setAiResults([]);
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await semanticSearch(normalizedQuery, items);
        if (cancelled) {
          return;
        }

        if (response.mode === 'no-key') {
          setAiResults([]);
          setAiSearchUnavailable(true);
          return;
        }

        setAiResults(Array.isArray(response.matches) ? response.matches : []);
      } catch (error) {
        if (!cancelled) {
          setAiResults([]);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [aiSearchUnavailable, items, open, query]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((previous) =>
          displayItems.length ? (previous + 1) % displayItems.length : 0
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((previous) =>
          displayItems.length ? (previous - 1 + displayItems.length) % displayItems.length : 0
        );
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const activeItem = displayItems[activeIndex];
        if (activeItem) {
          onSelect(activeItem);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeIndex, displayItems, onClose, onSelect, open]);

  useEffect(() => {
    if (resultButtonsRef.current[activeIndex]) {
      resultButtonsRef.current[activeIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  if (!open) {
    return null;
  }

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <section className="command-palette" onClick={(event) => event.stopPropagation()}>
        <div className="command-palette-header">
          <div>
            <div className="eyebrow">Command palette</div>
            <h2>Szybkie przejscie</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Zamknij
          </button>
        </div>

        <label className="command-palette-search">
          <span>Szukaj</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zakladka, spotkanie, zadanie, osoba..."
          />
        </label>

        <div className="command-palette-hints">
          <span>`Ctrl/Cmd + K` otwiera palette</span>
          <span>`Enter` wybiera wynik</span>
          <span>`Esc` zamyka</span>
        </div>

        <div className="command-palette-results">
          {filteredItems.length ? (
            Array.from(grouped.entries()).map(([group, groupItems]) => (
              <div key={group} className="command-palette-group">
                <div className="command-palette-group-label">{group}</div>
                <div className="command-palette-group-items">
                  {groupItems.map((item) => {
                    const itemIndex = displayItems.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        ref={(node) => {
                          resultButtonsRef.current[itemIndex] = node;
                        }}
                        type="button"
                        className={
                          itemIndex === activeIndex ? 'command-result active' : 'command-result'
                        }
                        onMouseEnter={() => setActiveIndex(itemIndex)}
                        onClick={() => onSelect(item)}
                      >
                        <div>
                          <strong>{item.title}</strong>
                          <span>{item.subtitle}</span>
                        </div>
                        <small>{item.matchSource === 'ai' ? 'AI Match' : item.type}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-panel">
              <strong>Brak wynikow</strong>
              <span>Sprobuj innego hasla, np. nazwy spotkania albo osoby.</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
