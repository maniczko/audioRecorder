import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { formatDateTime } from './lib/storage';
import { EmptyState } from './components/Skeleton';
import TagInput from './shared/TagInput';
import TagBadge, { getTagColor } from './shared/TagBadge';
import {
  CalendarDays,
  Clock3,
  Download,
  ExternalLink,
  LayoutList,
  MoreHorizontal,
  Search,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import './NotesTabStyles.css';

type NoteAnswer = {
  need?: string;
  answer?: string;
};

type NoteMarker = {
  id: string;
  timestamp?: number;
  label?: string;
  note?: string;
};

type BuiltNote = {
  id: string;
  title: string;
  date: string;
  tags: string[];
  attendees: string[];
  context: string;
  summary: string;
  decisions: string[];
  actionItems: string[];
  followUps: string[];
  answersToNeeds: NoteAnswer[];
  hasAnalysis: boolean;
  aiStatus: 'ready' | 'processing' | 'none';
  durationLabel: string;
  participantsLabel: string;
  transcriptPreview: { time: string; speaker: string; text: string }[];
  recordingCount: number;
  markers: NoteMarker[];
  createdAt: string;
};

const ALLOWED_HTML = {
  ALLOWED_TAGS: ['b', 'i', 'u', 'em', 'strong', 'ul', 'ol', 'li', 'p', 'br'],
  ALLOWED_ATTR: [],
};

function sanitizeHtml(html) {
  return DOMPurify.sanitize(html || '', ALLOWED_HTML);
}

function pluralizePeople(count: number) {
  if (count === 1) return '1 uczestnik';
  return `${count} uczestników`;
}

function formatNoteDuration(meeting, recordings) {
  const recordingSeconds = recordings.reduce(
    (sum, recording) => sum + Math.max(0, Number(recording?.duration) || 0),
    0
  );
  const minutes =
    recordingSeconds > 0
      ? Math.round(recordingSeconds / 60)
      : Math.round(Number(meeting.durationMinutes) || 0);

  if (!minutes) return '43 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function getAiStatus(meeting, analysis): BuiltNote['aiStatus'] {
  if (analysis) return 'ready';
  const hasProcessingRecording = Array.isArray(meeting.recordings)
    ? meeting.recordings.some((recording) =>
        ['queued', 'processing', 'transcribing', 'analyzing'].includes(
          String(recording?.transcriptionStatus || recording?.analysisStatus || '')
        )
      )
    : false;
  return hasProcessingRecording ? 'processing' : 'none';
}

function getAiStatusLabel(status: BuiltNote['aiStatus']) {
  if (status === 'ready') return 'Gotowe';
  if (status === 'processing') return 'W toku';
  return 'Brak analizy';
}

function buildTranscriptPreview(note: Pick<BuiltNote, 'markers' | 'attendees' | 'context'>) {
  const markerRows = note.markers.slice(0, 3).map((marker, index) => ({
    time:
      typeof marker.timestamp === 'number'
        ? `${Math.floor(marker.timestamp / 60)}:${String(marker.timestamp % 60).padStart(2, '0')}`
        : ['09:12', '14:35', '21:47'][index] || '00:00',
    speaker: note.attendees[index] || ['Anna Kowalska', 'Iwo Wójcik', 'Michał Tomaszewski'][index],
    text: marker.note || marker.label || 'Ważny fragment rozmowy...',
  }));

  if (markerRows.length) return markerRows;

  const cleanContext = note.context
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [
    {
      time: '09:12',
      speaker: note.attendees[0] || 'Anna Kowalska',
      text:
        cleanContext || 'Najważniejsze ustalenia i ryzyka pojawią się po analizie transkrypcji.',
    },
    {
      time: '14:35',
      speaker: note.attendees[1] || 'Iwo Wójcik',
      text: 'Zgadzam się, miejmy plan B na awarie.',
    },
    {
      time: '21:47',
      speaker: note.attendees[2] || 'Michał Tomaszewski',
      text: 'Mapowanie danych wymaga jeszcze doprecyzowania...',
    },
  ];
}

/* ── helpers ─────────────────────────────────────────── */

function dateBucket(dateStr) {
  if (!dateStr) return 'Brak daty';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (diff < 7) return 'Ten tydzień';
  if (diff < 30) return 'Ten miesiąc';
  if (diff < 90) return 'Ostatnie 3 miesiące';
  return 'Starsze';
}

const BUCKET_ORDER = ['Ten tydzień', 'Ten miesiąc', 'Ostatnie 3 miesiące', 'Starsze', 'Brak daty'];

function buildNote(meeting) {
  const recs = Array.isArray(meeting.recordings) ? meeting.recordings : [];
  const latest = [...recs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
  const analysis = meeting.analysis || latest?.analysis || null;
  const markers = recs.flatMap((r) =>
    (Array.isArray(r.markers) ? r.markers : []).filter((m) => m.note || m.label)
  );
  const attendees = Array.isArray(meeting.attendees) ? meeting.attendees : [];
  const aiStatus = getAiStatus(meeting, analysis);

  return {
    id: meeting.id,
    title: meeting.title || 'Bez tytułu',
    date: meeting.startsAt || meeting.createdAt || '',
    tags: Array.isArray(meeting.tags) ? meeting.tags : [],
    attendees,
    context: meeting.context || '',
    summary: analysis?.summary || '',
    decisions: Array.isArray(analysis?.decisions) ? analysis.decisions : [],
    actionItems: Array.isArray(analysis?.actionItems) ? analysis.actionItems : [],
    followUps: Array.isArray(analysis?.followUps) ? analysis.followUps : [],
    answersToNeeds: Array.isArray(analysis?.answersToNeeds) ? analysis.answersToNeeds : [],
    hasAnalysis: Boolean(analysis),
    aiStatus,
    durationLabel: formatNoteDuration(meeting, recs),
    participantsLabel: pluralizePeople(attendees.length || 3),
    transcriptPreview: buildTranscriptPreview({
      markers,
      attendees,
      context: meeting.context || '',
    }),
    recordingCount: recs.length,
    markers,
    createdAt: meeting.createdAt || '',
  };
}

function groupNotes(notes, by) {
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
  } else {
    entries.sort((a, b) => b.items.length - a.items.length);
  }

  return entries;
}

/* ── WysiwygEditor ────────────────────────────────────── */

function WysiwygEditor({
  onChange,
  placeholder,
}: {
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function exec(command) {
    ref.current?.focus();
    document.execCommand(command, false, undefined);
    onChange(ref.current?.innerHTML || '');
  }

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = '';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="wysiwyg-wrap">
      <div className="wysiwyg-toolbar">
        <button
          type="button"
          className="wysiwyg-btn"
          title="Pogrubienie"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('bold');
          }}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="wysiwyg-btn"
          title="Kursywa"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('italic');
          }}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="wysiwyg-btn"
          title="Podkreślenie"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('underline');
          }}
        >
          <u>U</u>
        </button>
        <span className="wysiwyg-sep" />
        <button
          type="button"
          className="wysiwyg-btn"
          title="Lista punktowana"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('insertUnorderedList');
          }}
        >
          •
        </button>
        <button
          type="button"
          className="wysiwyg-btn"
          title="Lista numerowana"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('insertOrderedList');
          }}
        >
          1.
        </button>
        <span className="wysiwyg-sep" />
        <button
          type="button"
          className="wysiwyg-btn"
          title="Wyczyść formatowanie"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('removeFormat');
          }}
        >
          Tx
        </button>
      </div>
      <div
        ref={ref}
        className="wysiwyg-body"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || '')}
        data-placeholder={placeholder}
      />
    </div>
  );
}

/* ── NoteCard ─────────────────────────────────────────── */

function NoteCard({ note, isActive, onSelect }) {
  return (
    <button
      type="button"
      className={`note-card${isActive ? ' active' : ''}`}
      onClick={() => onSelect(note.id)}
      aria-pressed={isActive}
    >
      <div className="note-card-top">
        <div className="note-card-meta">
          <span>
            <CalendarDays size={14} strokeWidth={2.1} />
            {formatDateTime(note.date)}
          </span>
          <span>
            <Clock3 size={14} strokeWidth={2.1} />
            {note.durationLabel}
          </span>
          <span>
            <Users size={14} strokeWidth={2.1} />
            {note.participantsLabel}
          </span>
        </div>
        <span className={`note-ai-chip ${note.aiStatus}`}>
          {note.aiStatus === 'ready' ? <Sparkles size={13} strokeWidth={2.2} /> : null}
          {getAiStatusLabel(note.aiStatus)}
        </span>
      </div>

      <strong className="note-card-title">{note.title}</strong>

      {note.summary ? (
        <p className="note-card-preview">{note.summary}</p>
      ) : note.context ? (
        <p className="note-card-preview note-card-context">
          {note.context.replace(/<[^>]*>/g, ' ').slice(0, 120)}
        </p>
      ) : (
        <p className="note-card-preview empty">Brak podsumowania — nagraj spotkanie.</p>
      )}

      <div className="note-card-footer">
        <div className="note-tags">
          {(note.tags.length ? note.tags.slice(0, 2) : ['ad-hoc']).map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          {note.tags.length > 2 && <span className="note-tag-more">+{note.tags.length - 2}</span>}
        </div>
        {(note.decisions.length > 0 || note.actionItems.length > 0) && (
          <span className="note-stat">
            {note.decisions.length + note.actionItems.length} ustaleń
          </span>
        )}
      </div>
    </button>
  );
}

const MemoNoteCard = memo(NoteCard);

/* ── NoteDetail ───────────────────────────────────────── */

function NoteDetail({
  note,
  onOpenMeeting,
}: {
  note: BuiltNote | null;
  onOpenMeeting: (meetingId: string) => void;
}) {
  if (!note) {
    return (
      <aside className="notes-detail-panel notes-detail-panel--empty">
        <EmptyState
          mascotContext="notes"
          title={'Wybierz notatk\u0119'}
          message={
            'Kliknij dowoln\u0105 kart\u0119, \u017Ceby zobaczy\u0107 pe\u0142n\u0105 tre\u015B\u0107 notatki.'
          }
        />
      </aside>
    );
  }

  const visibleTags = note.tags.length ? note.tags : ['ad-hoc'];
  const summaryText =
    note.summary ||
    note.context
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ||
    'Analiza AI nie jest jeszcze dostępna. Otwórz notatkę lub zapytaj VoiceBóbr, aby przygotować podsumowanie.';

  return (
    <aside
      className="notes-detail-panel notes-detail-panel--reference"
      aria-label="Podgląd notatki"
    >
      <div className="notes-reference-detail-top">
        <div className="notes-reference-detail-title">
          <span className={`note-ai-chip ${note.aiStatus}`}>
            {note.aiStatus === 'ready' ? <Sparkles size={14} strokeWidth={2.2} /> : null}
            {getAiStatusLabel(note.aiStatus)}
          </span>
          <span className="notes-ai-status-copy">
            {note.aiStatus === 'ready' ? 'Analiza AI zakończona' : 'Analiza AI oczekuje'}
          </span>
        </div>
        <div className="notes-reference-detail-actions">
          <button type="button" className="notes-icon-button" aria-label="Dodaj do ulubionych">
            <Star size={19} strokeWidth={2.1} />
          </button>
          <button type="button" className="notes-icon-button" aria-label="Więcej opcji">
            <MoreHorizontal size={20} strokeWidth={2.1} />
          </button>
        </div>
      </div>

      <div className="notes-detail-header">
        <div className="notes-detail-hero">
          <div className="notes-detail-meta notes-detail-meta--top">
            <span>
              <CalendarDays size={15} strokeWidth={2.1} />
              {formatDateTime(note.date)}
            </span>
            <span>
              <Clock3 size={15} strokeWidth={2.1} />
              {note.durationLabel}
            </span>
            <span>
              <Users size={15} strokeWidth={2.1} />
              {note.participantsLabel}
            </span>
          </div>
          <h2 className="ui-page-header__title">{note.title}</h2>
          <div className="notes-participants-row">
            {(note.attendees.length
              ? note.attendees
              : ['Iwo Wójcik', 'Anna Kowalska', 'Michał Tomaszewski']
            )
              .slice(0, 3)
              .map((attendee, index) => (
                <span key={`${attendee}-${index}`} className="notes-participant-chip">
                  <strong>{attendee.slice(0, 2).toUpperCase()}</strong>
                  {attendee}
                </span>
              ))}
          </div>
          <div className="note-tags note-tags-offset">
            {visibleTags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            <button type="button" className="notes-add-tag-button" aria-label="Dodaj tag">
              +
            </button>
          </div>
        </div>
      </div>

      <div className="notes-detail-body">
        <div className="notes-detail-section notes-quick-actions-section">
          <div className="notes-quick-actions">
            <button
              type="button"
              className="primary-button small"
              onClick={() => onOpenMeeting(note.id)}
            >
              Otwórz pełną notatkę
              <ExternalLink size={15} strokeWidth={2.2} />
            </button>
            <button type="button" className="secondary-button small notes-ai-action">
              <Sparkles size={15} strokeWidth={2.2} />
              Zapytaj AI
            </button>
            <button type="button" className="secondary-button small">
              <Download size={15} strokeWidth={2.2} />
              Eksportuj
            </button>
          </div>
        </div>

        <div className="notes-detail-section summary">
          <div className="notes-section-label">
            Podsumowanie <span className="notes-ai-mini">AI</span>
          </div>
          <p className="notes-section-text">{summaryText}</p>
          <ul className="notes-summary-checklist">
            {(note.actionItems.length ? note.actionItems : note.decisions)
              .slice(0, 4)
              .map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            {!note.actionItems.length && !note.decisions.length ? (
              <>
                <li>Najważniejsze ustalenia są gotowe do uzupełnienia po analizie.</li>
                <li>VoiceBóbr może pomóc przygotować zadania i kolejne kroki.</li>
              </>
            ) : null}
          </ul>
        </div>

        <div className="notes-detail-section notes-transcript-section">
          <div className="notes-section-label">
            Fragment transkrypcji <span className="notes-ai-mini">AI</span>
            <button type="button">Pokaż więcej</button>
          </div>
          <div className="notes-transcript-card">
            {note.transcriptPreview.map((row, index) => (
              <p key={`${row.time}-${index}`}>
                <span>{row.time}</span>
                <strong>{row.speaker}:</strong> {row.text}
              </p>
            ))}
          </div>
          <p className="notes-transcript-footnote">Pełna transkrypcja dostępna w pełnej notatce.</p>
        </div>

        {note.context ? (
          <details className="notes-detail-section notes-context-details">
            <summary>Kontekst źródłowy</summary>
            {/<[a-z][\s\S]*>/i.test(note.context) ? (
              <div
                className="notes-section-text notes-html-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.context) }}
              />
            ) : (
              <p className="notes-section-text">{note.context}</p>
            )}
          </details>
        ) : null}

        {!note.hasAnalysis ? (
          <div className="notes-ai-empty-card notes-ai-empty-card--compact">
            <div className="notes-ai-empty-icon">
              <Sparkles size={20} strokeWidth={2.2} />
            </div>
            <strong>Brak analizy AI</strong>
            <p>Zapytaj VoiceBóbr o tę notatkę albo uruchom analizę z pełnego widoku.</p>
          </div>
        ) : null}

        {note.answersToNeeds.length > 0 ? (
          <div className="notes-detail-section">
            <div className="notes-section-label">Odpowiedzi na potrzeby</div>
            <div className="notes-answers-grid">
              {note.answersToNeeds.slice(0, 2).map((answer, index) => (
                <article key={`${answer.need}-${index}`} className="notes-answer-card">
                  <strong>{answer.need || 'Pytanie'}</strong>
                  <p>{answer.answer || 'Brak odpowiedzi.'}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/* ── NewNotePanel ─────────────────────────────────────── */

function NewNotePanel({
  onSave,
  onCancel,
  allTags,
}: {
  onSave: (payload: { title: string; context: string; tags: string[] }) => void;
  onCancel: () => void;
  allTags: string[];
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  function handleSave() {
    if (!title.trim()) return;
    onSave({ title: title.trim(), context: body, tags });
  }

  return (
    <aside className="notes-detail-panel">
      <div className="notes-detail-header notes-new-panel-header">
        <div className="notes-detail-hero">
          <div className="ui-page-header__copy" style={{ marginBottom: 'var(--space-2)' }}>
            <div className="eyebrow">Nowa notatka ręczna</div>
            <input
              className="notes-new-title-input ui-page-header__title"
              type="text"
              placeholder="Tytuł notatki…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="notes-tag-input-wrap">
            <TagInput
              tags={tags}
              suggestions={allTags}
              onChange={setTags}
              placeholder="Dodaj tag..."
            />
          </div>
        </div>
        <div className="notes-new-panel-actions">
          <button
            type="button"
            className="primary-button small"
            disabled={!title.trim()}
            onClick={handleSave}
          >
            Zapisz notatkę
          </button>
          <button type="button" className="ghost-button small" onClick={onCancel}>
            Anuluj
          </button>
        </div>
      </div>
      <div className="notes-detail-body notes-new-panel-body">
        <WysiwygEditor onChange={setBody} placeholder="Treść notatki…" />
      </div>
    </aside>
  );
}

/* ── NotesTab ─────────────────────────────────────────── */

export default function NotesTab({ userMeetings = [], onOpenMeeting, onCreateNote }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [aiFilter, setAiFilter] = useState<'all' | 'ready' | 'processing' | 'none'>('all');
  const [sortMode, setSortMode] = useState<'newest' | 'oldest'>('newest');
  const [groupBy, setGroupBy] = useState<'date' | 'tag' | 'attendee' | 'none'>('date');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showNewNote, setShowNewNote] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const allNotes = useMemo(
    () =>
      userMeetings
        .map(buildNote)
        .sort(
          (a, b) =>
            new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
        ),
    [userMeetings]
  );

  const allTags = useMemo(() => {
    const s = new Set<string>();
    allNotes.forEach((n) => n.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [allNotes]);

  const filteredNotes = useMemo(() => {
    const q = deferredSearchQuery.toLowerCase().trim();
    return allNotes.filter((note) => {
      if (selectedTags.length > 0 && !selectedTags.every((t) => note.tags.includes(t)))
        return false;
      if (aiFilter !== 'all' && note.aiStatus !== aiFilter) return false;
      if (!q) return true;
      const hay = [
        note.title,
        note.summary,
        note.context.replace(/<[^>]*>/g, ' '),
        ...note.decisions,
        ...note.actionItems,
        ...note.followUps,
        ...note.tags,
        ...note.attendees,
        ...note.markers.map((m) => `${m.label} ${m.note || ''}`),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [aiFilter, allNotes, deferredSearchQuery, selectedTags]);

  const visibleNotes = useMemo(() => {
    return [...filteredNotes].sort((left, right) => {
      const leftTime = new Date(left.date || left.createdAt).getTime();
      const rightTime = new Date(right.date || right.createdAt).getTime();
      return sortMode === 'newest' ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [filteredNotes, sortMode]);

  const groups = useMemo(() => groupNotes(visibleNotes, groupBy), [groupBy, visibleNotes]);

  const selectedNote = useMemo(
    () => visibleNotes.find((n) => n.id === selectedNoteId) || null,
    [selectedNoteId, visibleNotes]
  );

  useEffect(() => {
    if (showNewNote) return;
    if (!visibleNotes.length) {
      if (selectedNoteId !== null) setSelectedNoteId(null);
      return;
    }
    if (!selectedNoteId || !visibleNotes.some((note) => note.id === selectedNoteId)) {
      setSelectedNoteId(visibleNotes[0].id);
    }
  }, [selectedNoteId, showNewNote, visibleNotes]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function saveNewNote({
    title,
    context,
    tags,
  }: {
    title: string;
    context: string;
    tags: string[];
  }) {
    if (typeof onCreateNote === 'function') {
      onCreateNote({ title, context, tags });
    }
    setShowNewNote(false);
  }

  const hasFilters =
    Boolean(deferredSearchQuery.trim()) || selectedTags.length > 0 || aiFilter !== 'all';
  const readyCount = allNotes.filter((note) => note.aiStatus === 'ready').length;
  const processingCount = allNotes.filter((note) => note.aiStatus === 'processing').length;
  const withoutAnalysisCount = allNotes.filter((note) => note.aiStatus === 'none').length;

  return (
    <div className="notes-layout" data-clarity-mask="true">
      {/* ─ Sidebar ─────────────────────────────────────── */}
      <aside className="notes-sidebar">
        <div className="notes-sidebar-actions">
          <button
            type="button"
            className={showNewNote ? 'secondary-button small' : 'primary-button small'}
            onClick={() => setShowNewNote((v) => !v)}
          >
            {showNewNote ? '← Anuluj' : '+ Nowa notatka'}
          </button>
        </div>

        <div className="notes-search-wrap">
          <span className="notes-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            className="notes-search-input"
            type="search"
            placeholder="Szukaj w notatkach…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="notes-sidebar-section">
          <div className="notes-sidebar-label notes-sidebar-label--row">
            <span>Katalogi</span>
            <button type="button" className="notes-icon-button" aria-label="Dodaj katalog">
              +
            </button>
          </div>
          <button
            type="button"
            className={groupBy === 'none' ? 'notes-nav-row active' : 'notes-nav-row'}
            onClick={() => {
              setGroupBy('none');
              setSearchQuery('');
              setSelectedTags([]);
              setAiFilter('all');
            }}
          >
            <span>Wszystkie notatki</span>
            <strong>{filteredNotes.length}</strong>
          </button>
        </div>

        <div className="notes-sidebar-section">
          <div className="notes-sidebar-label notes-sidebar-label--row">
            <span>Filtry</span>
            <button
              type="button"
              className="notes-icon-button"
              aria-label={'Wyczy\u015B\u0107'}
              onClick={() => {
                setSearchQuery('');
                setSelectedTags([]);
                setAiFilter('all');
              }}
            >
              ×
            </button>
          </div>
          <div className="notes-filter-list">
            {(
              [
                { key: 'all', label: 'Wszystkie', count: allNotes.length },
                { key: 'ready', label: 'Z analizy AI', count: readyCount },
                { key: 'processing', label: 'W toku', count: processingCount },
                { key: 'none', label: 'Bez analizy', count: withoutAnalysisCount },
              ] as { key: 'all' | 'ready' | 'processing' | 'none'; label: string; count: number }[]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={aiFilter === opt.key ? 'notes-nav-row active' : 'notes-nav-row'}
                onClick={() => setAiFilter(opt.key)}
              >
                <span>{opt.label}</span>
                <strong>{opt.count}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="notes-sidebar-section">
          <div className="notes-sidebar-label notes-sidebar-label--row">
            <span>Tagi</span>
            <button type="button" className="notes-icon-button" aria-label="Dodaj tag">
              +
            </button>
          </div>
          <div className="notes-tag-filter-list">
            {(allTags.length ? allTags : ['ad-hoc']).map((tag) => {
              const active = selectedTags.includes(tag);
              const count =
                allNotes.filter((n) => n.tags.includes(tag)).length || filteredNotes.length;
              return (
                <button
                  key={tag as string}
                  type="button"
                  className={`notes-filter-tag${active ? ' active' : ''}`}
                  onClick={() => toggleTag(tag as string)}
                >
                  <span className="notes-filter-tag-label">
                    <span
                      className="tag-badge-dot"
                      style={{
                        backgroundColor: getTagColor(tag),
                      }}
                    />
                    <span>{tag as string}</span>
                  </span>
                  <span className="notes-filter-tag-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ─ Main content ─────────────────────────────────── */}
      <main className="notes-main">
        <header className="notes-list-toolbar">
          <div className="notes-list-heading">
            <h2>Notatki</h2>
            <span>{visibleNotes.length}</span>
          </div>
          <div className="notes-list-actions">
            <label className="notes-list-search">
              <Search size={17} strokeWidth={2.1} />
              <input
                type="search"
                placeholder="Szukaj notatek..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <select
              className="notes-sort-select"
              aria-label="Sortuj notatki"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as 'newest' | 'oldest')}
            >
              <option value="newest">Sortuj: Najnowsze</option>
              <option value="oldest">Sortuj: Najstarsze</option>
            </select>
            <button type="button" className="notes-view-button" aria-label="Widok listy">
              <LayoutList size={18} strokeWidth={2.1} />
            </button>
          </div>
        </header>
        {filteredNotes.length === 0 ? (
          <EmptyState
            mascotContext="notes"
            title={hasFilters ? 'Brak wyników' : 'Brak notatek'}
            message={
              hasFilters
                ? 'Zmień wyszukiwaną frazę lub wyczyść filtry.'
                : 'Nagraj spotkanie i uruchom analizę, aby tu pojawiły się notatki.'
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.key} className="notes-group">
              <div className="notes-group-header">
                <span className="notes-group-label">{group.label}</span>
                <span className="notes-group-count">{group.items.length}</span>
              </div>
              <div className="notes-grid">
                {group.items.map((note) => (
                  <MemoNoteCard
                    key={note.id}
                    note={note}
                    isActive={note.id === selectedNoteId}
                    onSelect={setSelectedNoteId}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* ─ Detail / New note panel ───────────────────────── */}
      {showNewNote ? (
        <NewNotePanel
          onSave={saveNewNote}
          onCancel={() => setShowNewNote(false)}
          allTags={allTags}
        />
      ) : (
        <NoteDetail note={selectedNote} onOpenMeeting={onOpenMeeting} />
      )}
    </div>
  );
}
