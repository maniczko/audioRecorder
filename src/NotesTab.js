import { useMemo, useState } from "react";
import { formatDateTime } from "./lib/storage";

/* ── helpers ─────────────────────────────────────────── */

function hashToHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function tagStyle(tag) {
  const h = hashToHue(tag);
  return {
    color: `hsl(${h},62%,62%)`,
    background: `hsla(${h},62%,45%,0.13)`,
    border: `1px solid hsla(${h},62%,55%,0.28)`,
  };
}

function dateBucket(dateStr) {
  if (!dateStr) return "Brak daty";
  const diff = (Date.now() - new Date(dateStr)) / 86400000;
  if (diff < 7) return "Ten tydzień";
  if (diff < 30) return "Ten miesiąc";
  if (diff < 90) return "Ostatnie 3 miesiące";
  return "Starsze";
}

const BUCKET_ORDER = ["Ten tydzień", "Ten miesiąc", "Ostatnie 3 miesiące", "Starsze", "Brak daty"];

function buildNote(meeting) {
  const recs = Array.isArray(meeting.recordings) ? meeting.recordings : [];
  const latest = [...recs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const analysis = meeting.analysis || latest?.analysis || null;
  const markers = recs.flatMap((r) =>
    (Array.isArray(r.markers) ? r.markers : []).filter((m) => m.note || m.label)
  );

  return {
    id: meeting.id,
    title: meeting.title || "Bez tytułu",
    date: meeting.startsAt || meeting.createdAt || "",
    tags: Array.isArray(meeting.tags) ? meeting.tags : [],
    attendees: Array.isArray(meeting.attendees) ? meeting.attendees : [],
    context: meeting.context || "",
    summary: analysis?.summary || "",
    decisions: Array.isArray(analysis?.decisions) ? analysis.decisions : [],
    actionItems: Array.isArray(analysis?.actionItems) ? analysis.actionItems : [],
    followUps: Array.isArray(analysis?.followUps) ? analysis.followUps : [],
    answersToNeeds: Array.isArray(analysis?.answersToNeeds) ? analysis.answersToNeeds : [],
    hasAnalysis: Boolean(analysis),
    recordingCount: recs.length,
    markers,
    createdAt: meeting.createdAt || "",
  };
}

function groupNotes(notes, by) {
  if (by === "none") return [{ key: "_all", label: "Wszystkie", items: notes }];

  const map = new Map();
  notes.forEach((note) => {
    const keys =
      by === "tag"
        ? note.tags.length ? note.tags : ["Bez tagu"]
        : by === "date"
          ? [dateBucket(note.date)]
          : note.attendees.length
            ? note.attendees.slice(0, 4)
            : ["Bez uczestników"];

    keys.forEach((k) => {
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(note);
    });
  });

  const entries = [...map.entries()].map(([key, items]) => ({ key, label: key, items }));

  if (by === "date") {
    entries.sort((a, b) => BUCKET_ORDER.indexOf(a.key) - BUCKET_ORDER.indexOf(b.key));
  } else {
    entries.sort((a, b) => b.items.length - a.items.length);
  }

  return entries;
}

/* ── NoteCard ─────────────────────────────────────────── */

function NoteCard({ note, isActive, onSelect }) {
  return (
    <button
      type="button"
      className={`note-card${isActive ? " active" : ""}`}
      onClick={() => onSelect(isActive ? null : note.id)}
    >
      <div className="note-card-top">
        <div className="note-card-meta">
          <span className="note-date">{formatDateTime(note.date)}</span>
          {note.recordingCount > 0 && (
            <span className="note-badge">
              {note.recordingCount} {note.recordingCount === 1 ? "nagranie" : "nagrań"}
            </span>
          )}
        </div>
        {note.tags.length > 0 && (
          <div className="note-tags">
            {note.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="note-tag-chip" style={tagStyle(tag)}>
                #{tag}
              </span>
            ))}
            {note.tags.length > 3 && (
              <span className="note-tag-more">+{note.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <strong className="note-card-title">{note.title}</strong>

      {note.summary ? (
        <p className="note-card-preview">{note.summary}</p>
      ) : note.context ? (
        <p className="note-card-preview note-card-context">{note.context}</p>
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
        {!note.hasAnalysis && (
          <span className="note-stat dim">Brak analizy AI</span>
        )}
      </div>
    </button>
  );
}

/* ── NoteDetail ───────────────────────────────────────── */

function NoteDetail({ note, onOpenMeeting }) {
  if (!note) {
    return (
      <aside className="notes-detail-panel">
        <div className="notes-empty-detail">
          <div className="notes-empty-icon">📄</div>
          <strong>Wybierz notatkę</strong>
          <span>Kliknij dowolną kartę, żeby zobaczyć pełną treść notatki.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="notes-detail-panel">
      <div className="notes-detail-header">
        <div className="notes-detail-hero">
          <div className="eyebrow">Notatka ze spotkania</div>
          <h2>{note.title}</h2>
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
            <div className="note-tags" style={{ marginTop: 8 }}>
              {note.tags.map((tag) => (
                <span key={tag} className="note-tag-chip" style={tagStyle(tag)}>
                  #{tag}
                </span>
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
            <p className="notes-section-text">{note.context}</p>
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
                <li key={i}>{d}</li>
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
                <li key={i}>{a}</li>
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
                <li key={i}>{f}</li>
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
                <div key={i} className="notes-answer-card">
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
              {note.markers.map((m) => (
                <div key={m.id} className="notes-marker-item">
                  <span className="notes-marker-time">
                    {String(Math.floor(Number(m.timestamp || 0) / 60)).padStart(2, "0")}:
                    {String(Math.floor(Number(m.timestamp || 0) % 60)).padStart(2, "0")}
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
                <span key={i} className="notes-attendee-chip">
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

/* ── NotesTab ─────────────────────────────────────────── */

export default function NotesTab({ userMeetings = [], onOpenMeeting }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [groupBy, setGroupBy] = useState("date");
  const [selectedNoteId, setSelectedNoteId] = useState(null);

  const allNotes = useMemo(
    () =>
      userMeetings
        .map(buildNote)
        .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)),
    [userMeetings]
  );

  const allTags = useMemo(() => {
    const s = new Set();
    allNotes.forEach((n) => n.tags.forEach((t) => s.add(t)));
    return [...s].sort();
  }, [allNotes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allNotes.filter((note) => {
      if (selectedTags.length > 0 && !selectedTags.every((t) => note.tags.includes(t))) return false;
      if (!q) return true;
      const hay = [
        note.title,
        note.summary,
        note.context,
        ...note.decisions,
        ...note.actionItems,
        ...note.followUps,
        ...note.tags,
        ...note.attendees,
        ...note.markers.map((m) => `${m.label} ${m.note || ""}`),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allNotes, searchQuery, selectedTags]);

  const groups = useMemo(() => groupNotes(filteredNotes, groupBy), [filteredNotes, groupBy]);

  const selectedNote = useMemo(
    () => allNotes.find((n) => n.id === selectedNoteId) || null,
    [allNotes, selectedNoteId]
  );

  function toggleTag(tag) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  const hasFilters = searchQuery.trim() || selectedTags.length > 0;

  return (
    <div className="notes-layout">
      {/* ─ Sidebar ─────────────────────────────────────── */}
      <aside className="notes-sidebar">
        <div className="notes-search-wrap">
          <span className="notes-search-icon" aria-hidden="true">⌕</span>
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
            <span>{filteredNotes.length === 1 ? "notatka" : "notatek"}</span>
          </div>
          {hasFilters && (
            <button
              type="button"
              className="ghost-button small"
              onClick={() => {
                setSearchQuery("");
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
            {[
              { key: "date", label: "Daty" },
              { key: "tag", label: "Tagu" },
              { key: "attendee", label: "Osoby" },
              { key: "none", label: "Brak" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={groupBy === opt.key ? "pill active" : "pill"}
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
                    key={tag}
                    type="button"
                    className={`notes-filter-tag${active ? " active" : ""}`}
                    style={active ? tagStyle(tag) : {}}
                    onClick={() => toggleTag(tag)}
                  >
                    <span>#{tag}</span>
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
          <div className="notes-empty-state">
            <div className="notes-empty-icon">📝</div>
            <strong>
              {hasFilters ? "Brak wyników" : "Brak notatek"}
            </strong>
            <span>
              {hasFilters
                ? "Zmień wyszukiwaną frazę lub wyczyść filtry."
                : "Nagraj spotkanie i uruchom analizę, aby tu pojawiły się notatki."}
            </span>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="notes-group">
              <div className="notes-group-header">
                <span className="notes-group-label">{group.label}</span>
                <span className="notes-group-count">{group.items.length}</span>
              </div>
              <div className="notes-grid">
                {group.items.map((note) => (
                  <NoteCard
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

      {/* ─ Detail panel ─────────────────────────────────── */}
      <NoteDetail note={selectedNote} onOpenMeeting={onOpenMeeting} />
    </div>
  );
}
