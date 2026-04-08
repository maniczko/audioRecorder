import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { formatDateTime } from './lib/storage';
import { EmptyState } from './components/Skeleton';
import TagInput from './shared/TagInput';
import TagBadge, { getTagColor } from './shared/TagBadge';
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
      onClick={() => onSelect(isActive ? null : note.id)}
    >
      <div className="note-card-top">
        <div className="note-card-meta">
          <span className="note-date">{formatDateTime(note.date)}</span>
          {note.recordingCount > 0 && (
            <span className="note-badge">
              {note.recordingCount} {note.recordingCount === 1 ? 'nagranie' : 'nagrań'}
            </span>
          )}
        </div>
        {note.tags.length > 0 && (
          <div className="note-tags" style={{ display: 'flex', gap: '4px' }}>
            {note.tags.slice(0, 3).map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {note.tags.length > 3 && <span className="note-tag-more">+{note.tags.length - 3}</span>}
          </div>
        )}
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
        {note.decisions.length > 0 && (
          <span className="note-stat">
            <span className="note-stat-dot decision" />
            {note.decisions.length} decyzji
          </span>
        )}
        {note.actionItems.length > 0 && (
          <span className="note-stat">
            <span className="note-stat-dot action" />
            {note.actionItems.length} działań
          </span>
        )}
        {note.markers.length > 0 && (
          <span className="note-stat">
            <span className="note-stat-dot marker" />
            {note.markers.length} markerów
          </span>
        )}
        {!note.hasAnalysis && <span className="note-stat dim">Brak analizy AI</span>}
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
      <aside className="notes-detail-panel">
        <EmptyState
          title="Wybierz notatkę"
          message="Kliknij dowolną kartę, żeby zobaczyć pełną treść notatki."
        />
      </aside>
    );
  }

  const contextIsHtml = /<[a-z][\s\S]*>/i.test(note.context);

  return (
    <aside className="notes-detail-panel">
      <div className="notes-detail-header">
        <div className="notes-detail-hero">
          <div className="ui-page-header__copy" style={{ marginBottom: 'var(--space-2)' }}>
            <div className="eyebrow">Notatka ze spotkania</div>
            <h2 className="ui-page-header__title">{note.title}</h2>
          </div>
          <div className="notes-detail-meta">
            <span className="note-date">{formatDateTime(note.date)}</span>
            {note.attendees.length > 0 && (
              <span className="note-date">{note.attendees.length} uczestników</span>
            )}
            {note.recordingCount > 0 && (
              <span className="note-badge">{note.recordingCount} nagrań</span>
            )}
          </div>
          {note.tags.length > 0 && (
            <div
              className="note-tags note-tags-offset"
              style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}
            >
              {note.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="secondary-button small"
          onClick={() => onOpenMeeting(note.id)}
        >
          Otwórz w Studio →
        </button>
      </div>

      <div className="notes-detail-body">
        {note.context && (
          <div className="notes-detail-section">
            <div className="notes-section-label">
              <span className="notes-section-dot context" />
              Kontekst spotkania
            </div>
            {contextIsHtml ? (
              <div
                className="notes-section-text notes-html-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.context) }}
              />
            ) : (
              <p className="notes-section-text">{note.context}</p>
            )}
          </div>
        )}

        {note.summary && (
          <div className="notes-detail-section summary">
            <div className="notes-section-label">
              <span className="notes-section-dot summary" />
              Podsumowanie AI
            </div>
            <p className="notes-section-text">{note.summary}</p>
          </div>
        )}

        {note.decisions.length > 0 && (
          <div className="notes-detail-section">
            <div className="notes-section-label">
              <span className="notes-section-dot decision" />
              Decyzje ({note.decisions.length})
            </div>
            <ul className="notes-section-list">
              {note.decisions.map((d, i) => (
                <li key={d + String(i)}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {note.actionItems.length > 0 && (
          <div className="notes-detail-section">
            <div className="notes-section-label">
              <span className="notes-section-dot action" />
              Działania do podjęcia ({note.actionItems.length})
            </div>
            <ul className="notes-section-list">
              {note.actionItems.map((a, i) => (
                <li key={a + String(i)}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {note.followUps.length > 0 && (
          <div className="notes-detail-section">
            <div className="notes-section-label">
              <span className="notes-section-dot followup" />
              Follow-ups ({note.followUps.length})
            </div>
            <ul className="notes-section-list">
              {note.followUps.map((f, i) => (
                <li key={f + String(i)}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {note.answersToNeeds.length > 0 && (
          <div className="notes-detail-section">
            <div className="notes-section-label">
              <span className="notes-section-dot context" />
              Odpowiedzi na potrzeby
            </div>
            <div className="notes-answers-grid">
              {note.answersToNeeds.map((item, i) => (
                <div
                  key={(item.need || '') + (item.answer || '') + String(i)}
                  className="notes-answer-card"
                >
                  {item.need && <strong>{item.need}</strong>}
                  {item.answer && <p>{item.answer}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {note.markers.length > 0 && (
          <div className="notes-detail-section">
            <div className="notes-section-label">
              <span className="notes-section-dot marker" />
              Markery audio ({note.markers.length})
            </div>
            <div className="notes-markers-list">
              {note.markers.map((m, i) => (
                <div key={m.id || m.label + String(i)} className="notes-marker-item">
                  <span className="notes-marker-time">
                    {String(Math.floor(Number(m.timestamp || 0) / 60)).padStart(2, '0')}:
                    {String(Math.floor(Number(m.timestamp || 0) % 60)).padStart(2, '0')}
                  </span>
                  <div className="notes-marker-body">
                    <span className="notes-marker-label">{m.label}</span>
                    {m.note ? <span className="notes-marker-note">{m.note}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {note.attendees.length > 0 && (
          <div className="notes-detail-section">
            <div className="notes-section-label">
              <span className="notes-section-dot action" />
              Uczestnicy ({note.attendees.length})
            </div>
            <div className="notes-attendees">
              {note.attendees.map((a, i) => (
                <span key={a + String(i)} className="notes-attendee-chip">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
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
  }, [allNotes, deferredSearchQuery, selectedTags]);

  const groups = useMemo(() => groupNotes(filteredNotes, groupBy), [filteredNotes, groupBy]);

  const selectedNote = useMemo(
    () => allNotes.find((n) => n.id === selectedNoteId) || null,
    [allNotes, selectedNoteId]
  );

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

  const hasFilters = deferredSearchQuery.trim() || selectedTags.length > 0;

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

        <div className="notes-sidebar-stats">
          <div className="notes-count-badge">
            <strong>{filteredNotes.length}</strong>
            <span>{filteredNotes.length === 1 ? 'notatka' : 'notatek'}</span>
          </div>
          {hasFilters && (
            <button
              type="button"
              className="ghost-button small"
              onClick={() => {
                setSearchQuery('');
                setSelectedTags([]);
              }}
            >
              Wyczyść
            </button>
          )}
        </div>

        <div className="notes-sidebar-section">
          <div className="notes-sidebar-label">Grupuj według</div>
          <div className="notes-group-pills">
            {(
              [
                { key: 'date', label: 'Daty' },
                { key: 'tag', label: 'Tagu' },
                { key: 'attendee', label: 'Osoby' },
                { key: 'none', label: 'Brak' },
              ] as { key: 'date' | 'tag' | 'attendee' | 'none'; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={groupBy === opt.key ? 'pill active' : 'pill'}
                onClick={() => setGroupBy(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="notes-sidebar-section">
            <div className="notes-sidebar-label">Filtry tagów</div>
            <div className="notes-tag-filter-list">
              {allTags.map((tag) => {
                const active = selectedTags.includes(tag);
                const count = allNotes.filter((n) => n.tags.includes(tag)).length;
                return (
                  <button
                    key={tag as string}
                    type="button"
                    className={`notes-filter-tag${active ? ' active' : ''}`}
                    onClick={() => toggleTag(tag as string)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        className="tag-badge-dot"
                        style={{
                          backgroundColor: getTagColor(tag),
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
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
        )}
      </aside>

      {/* ─ Main content ─────────────────────────────────── */}
      <main className="notes-main">
        {filteredNotes.length === 0 ? (
          <EmptyState
            icon="📝"
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
