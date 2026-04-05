```typescript
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, Dispatch, SetStateAction } from 'react';
import DOMPurify from 'dompurify';
import { formatDateTime } from './lib/storage';
import { EmptyState } from './components/Skeleton';
import TagInput from './shared/TagInput';
import TagBadge, { getTagColor } from './shared/TagBadge';
import './NotesTabStyles.css';

const ALLOWED_HTML = {
  ALLOWED_TAGS: ['b', 'i', 'u', 'em', 'strong', 'ul', 'ol', 'li', 'p', 'br'],
  ALLOWED_ATTR: [],
};

function sanitizeHtml(html: string | null) {
  return DOMPurify.sanitize(html || '', ALLOWED_HTML);
}

/* ── helpers ─────────────────────────────────────────── */

function dateBucket(dateStr: string | null) {
  if (!dateStr) return 'Brak daty';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (diff < 7) return 'Ten tydzień';
  if (diff < 30) return 'Ten miesiąc';
  if (diff < 90) return 'Ostatnie 3 miesiące';
  return 'Starsze';
}

const BUCKET_ORDER = ['Ten tydzień', 'Ten miesiąc', 'Ostatnie 3 miesiące', 'Starsze', 'Brak daty'];

function buildNote(meeting: any) {
  const recs = Array.isArray(meeting.recordings) ? meeting.recordings : [];
  const latest = [...recs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
  const analysis = meeting.analysis || latest?.analysis || null;
  const markers = recs.flatMap((r) =>
    (Array.isArray(r.markers) ? r.markers : []).filter((m) => m.note || m.label)
  );

  return {
    id: meeting.id,
    title: meeting.title || 'Bez tytułu',
    date: meeting.startsAt || meeting.createdAt || '',
    tags: Array.isArray(meeting.tags) ? meeting.tags : [],
    attendees: Array.isArray(meeting.attendees) ? meeting.attendees : [],
    context: meeting.context || '',
    summary: analysis?.summary || '',
    decisions: Array.isArray(analysis?.decisions) ? analysis.decisions : [],
    actionItems: Array.isArray(analysis?.actionItems) ? analysis.actionItems : [],
    followUps: Array.isArray(analysis?.followUps) ? analysis.followUps : [],
    answersToNeeds: Array.isArray(analysis?.answersToNeeds) ? analysis.answersToNeeds : [],
    hasAnalysis: Boolean(analysis),
    recordingCount: recs.length,
    markers,
    createdAt: meeting.createdAt || '',
  };
}

function groupNotes(notes: any[], by: string) {
  if (by === 'none') return [{ key: '_all', label: 'Wszystkie', items: notes }];

  const map = new Map();
  notes.forEach((note) => {
    const keys =
      by === 'tag'
        ? note.tags.length
          ? note.tags
          : ['Bez tagu']
        : by === 'date'
          ? [dateBucket(note.date)]
          : note.attendees.length
            ? note.attendees.slice(0, 4)
            : ['Bez uczestników'];

    keys.forEach((k) => {
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(note);
    });
  });

  const entries = [...map.entries()].map(([key, items]) => ({ key, label: key, items }));

  if (by === 'date') {
    entries.sort((a, b) => BUCKET_ORDER.indexOf(a.key) - BUCKET_ORDER.indexOf(b.key));
  }
  return entries; // Added return statement
}
```
