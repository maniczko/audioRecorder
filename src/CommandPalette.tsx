```typescript
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { filterCommandPaletteItems } from './lib/commandPalette';
import { semanticSearch } from './lib/aiSearch';
import './CommandPaletteStyles.css';

function groupedItems(items: any[]) {
  return items.reduce((groups, item) => {
    const key = item.group || 'Wyniki';
    const bucket = groups.get(key) || [];
    bucket.push(item);
    groups.set(key, bucket);
    return groups;
  }, new Map());
}

export default function CommandPalette({ open, items, onClose, onSelect }: { open: boolean; items: any[]; onClose: () => void; onSelect: (item: any) => void; }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [aiSearchUnavailable, setAiSearchUnavailable] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultButtonsRef = useRef<HTMLButtonElement[]>([]);

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      // Additional key handling logic can be added here
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <div>
      {/* Render your command palette UI here */}
    </div>
  );
}
```