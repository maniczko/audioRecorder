import './styles/recordings.css';
import React from "react";
import { formatDateTime } from "./lib/storage";
import './RecordingsTabStyles.css';

function MeetingPicker({ selectedMeeting, userMeetings, selectMeeting, startNewMeetingDraft, setActiveTab }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const sorted = [...userMeetings].sort(
    (a, b) => new Date(b.startsAt || b.createdAt).valueOf() - new Date(a.startsAt || a.createdAt).valueOf()
  );
  const filtered = query.trim()
    ? sorted.filter((m) => m.title.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : sorted.slice(0, 10);

  return (
    <div className="studio-picker-header" ref={ref}>
      <div className="studio-picker-header-top">
        <div className="studio-picker-header-info">
          <div className="eyebrow">Studio</div>
          <h2 className="studio-picker-header-title">
            {selectedMeeting ? selectedMeeting.title : "Wybierz spotkanie"}
          </h2>
          {selectedMeeting && (
            <div className="studio-picker-header-meta">
              <span>{formatDateTime(selectedMeeting.startsAt || selectedMeeting.createdAt)}</span>
              <span>{selectedMeeting.durationMinutes} min</span>
              <span>{(selectedMeeting.recordings || []).length} nagran</span>
            </div>
          )}
        </div>
        <div className="studio-picker-header-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setOpen((v) => !v)}
          >
            Zmień ▾
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              startNewMeetingDraft();
              setActiveTab("studio");
            }}
          >
            + Nowe
          </button>
        </div>
        {open && (
          <div className="studio-picker-dropdown">
            <input
              className="studio-picker-search"
              type="search"
              placeholder="Szukaj spotkania…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="studio-picker-list">
              {filtered.map((meeting) => (
                <button
                  key={meeting.id}
                  type="button"
                  className={`studio-picker-item${selectedMeeting?.id === meeting.id ? " active" : ""}`}
                  onClick={() => {
                    selectMeeting(meeting);
                    setOpen(false);
                    setQuery("");
                    setActiveTab("studio");
                  }}
                >
                  <span className="studio-picker-item-title">{meeting.title}</span>
                  <span className="studio-picker-item-date">
                    {formatDateTime(meeting.startsAt || meeting.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UnifiedLibrary({ userMeetings, selectedMeeting, selectMeeting, setActiveTab }) {
  const [dateFilter, setDateFilter] = React.useState("");
  const [tagFilter, setTagFilter] = React.useState("");

  const allTags = React.useMemo(() => {
    const tags = new Set<string>();
    userMeetings.forEach((m) => {
      if (m.tags) {
        m.tags.split('\n').forEach(t => {
          if (t.trim()) tags.add(t.trim());
        });
      }
    });
    return Array.from(tags).sort();
  }, [userMeetings]);

  const sortedAndFiltered = React.useMemo(() => {
    return [...userMeetings].filter(m => {
      if (dateFilter) {
        const d = m.startsAt || m.createdAt;
        if (!d || !d.startsWith(dateFilter)) return false;
      }
      if (tagFilter) {
        if (!m.tags) return false;
        const mt = m.tags.split('\n').map(t=>t.trim());
        if (!mt.includes(tagFilter)) return false;
      }
      return true;
    }).sort(
      (a, b) => new Date(b.startsAt || b.createdAt).valueOf() - new Date(a.startsAt || a.createdAt).valueOf()
    );
  }, [userMeetings, dateFilter, tagFilter]);

  return (
    <section className="panel meetings-library" style={{ marginBottom: '32px' }}>
      <div className="panel-header compact" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div className="eyebrow">Workspace</div>
          <h2>Baza spotkań i nagrań</h2>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input 
            type="date" 
            className="studio-picker-search" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', borderRadius: '6px' }}
          />
          <select 
            className="studio-picker-search"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', borderRadius: '6px' }}
          >
            <option value="">Wszystkie tagi</option>
            {allTags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="status-chip">{sortedAndFiltered.length}</div>
        </div>
      </div>
      <div className="studio-recordings-table-wrap">
        {sortedAndFiltered.length ? (
        <table className="studio-recordings-table">
          <thead>
            <tr>
              <th>Spotkanie</th>
              <th>Data i godzina</th>
              <th>Czas trwania</th>
              <th>Nagrania</th>
              <th>Tagi</th>
            </tr>
          </thead>
          <tbody>
            {sortedAndFiltered.map((m) => (
              <tr
                key={m.id}
                className={m.id === selectedMeeting?.id ? "active" : ""}
                onClick={() => {
                  selectMeeting(m);
                  setActiveTab("studio");
                }}
                style={{ cursor: "pointer" }}
              >
                <td className="recordings-library-meeting">
                  <strong>{m.title}</strong>
                </td>
                <td>{formatDateTime(m.startsAt || m.createdAt)}</td>
                <td>{m.durationMinutes} min</td>
                <td>
                  <span className="status-chip status-chip-sm">
                    {(m.recordings || []).length}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {(m.tags ? m.tags.split('\n') : []).map((t, idx) => {
                      if (!t.trim()) return null;
                      return <span key={idx} className="status-chip status-chip-sm" style={{ background: 'rgba(116, 208, 191, 0.15)', color: '#74d0bf' }}>{t.trim()}</span>
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        ) : (
          <div className="empty-recordings" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
            <p>Brak spotkań spełniających kryteria.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function RecordingsTab(props) {
  const { userMeetings, selectedMeeting, selectMeeting, startNewMeetingDraft, setActiveTab } = props;

  return (
    <div className="recordings-tab-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="recordings-tab-header" style={{ marginBottom: '32px' }}>
        <MeetingPicker
          selectedMeeting={selectedMeeting}
          userMeetings={userMeetings}
          selectMeeting={selectMeeting}
          startNewMeetingDraft={startNewMeetingDraft}
          setActiveTab={setActiveTab}
        />
      </header>
      
      <main className="recordings-tab-content">
        <UnifiedLibrary
          userMeetings={userMeetings}
          selectedMeeting={selectedMeeting}
          selectMeeting={selectMeeting}
          setActiveTab={setActiveTab}
        />
      </main>
    </div>
  );
}
