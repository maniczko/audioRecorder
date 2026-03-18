import React from "react";
import { formatDateTime, formatDuration } from "./lib/storage";

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
    (a, b) => new Date(b.startsAt || b.createdAt) - new Date(a.startsAt || a.createdAt)
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

function MeetingsTable({ userMeetings, selectedMeeting, selectMeeting, setActiveTab }) {
  const sorted = [...userMeetings].sort(
    (a, b) => new Date(b.startsAt || b.createdAt) - new Date(a.startsAt || a.createdAt)
  );

  if (!sorted.length) {
    return (
      <div className="empty-recordings">
        <p>Brak zaplanowanych lub archiwalnych spotkań.</p>
      </div>
    );
  }

  return (
    <section className="panel meetings-library" style={{ marginBottom: '32px' }}>
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Workspace</div>
          <h2>Lista spotkań</h2>
        </div>
        <div className="status-chip">{sorted.length}</div>
      </div>
      <div className="studio-recordings-table-wrap">
        <table className="studio-recordings-table">
          <thead>
            <tr>
              <th>Spotkanie</th>
              <th>Data i godzina</th>
              <th>Czas trwania</th>
              <th>Nagrania</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecordingsLibrary({ userMeetings, selectedRecordingId, setSelectedRecordingId, selectMeeting, setActiveTab }) {
  const allRecordings = userMeetings.flatMap((m) =>
    (m.recordings || []).map((r) => ({ ...r, meetingId: m.id, meetingTitle: m.title }))
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!allRecordings.length) {
    return (
      <div className="empty-recordings">
        <p>Brak dostępnych nagrań audio.</p>
      </div>
    );
  }

  return (
    <section className="panel recordings-library">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Library</div>
          <h2>Archiwum nagrań</h2>
        </div>
        <div className="status-chip">{allRecordings.length}</div>
      </div>
      <div className="studio-recordings-table-wrap">
        <table className="studio-recordings-table">
          <thead>
            <tr>
              <th>Spotkanie</th>
              <th>Data nagrania</th>
              <th>Długość</th>
              <th>Speakerzy</th>
              <th>Segmenty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {allRecordings.map((rec) => (
              <tr
                key={rec.id}
                className={rec.id === selectedRecordingId ? "active" : ""}
                onClick={() => {
                  const meeting = userMeetings.find((m) => m.id === rec.meetingId);
                  if (meeting) selectMeeting(meeting);
                  setSelectedRecordingId(rec.id);
                  setActiveTab("studio");
                }}
                style={{ cursor: "pointer" }}
              >
                <td className="recordings-library-meeting">{rec.meetingTitle}</td>
                <td>{formatDateTime(rec.createdAt)}</td>
                <td>{formatDuration(rec.duration)}</td>
                <td>{rec.speakerCount || 0}</td>
                <td>{rec.transcript?.length || 0}</td>
                <td>
                  <span className={`status-chip status-chip-sm ${rec.pipelineStatus || "done"}`}>
                    {rec.pipelineStatus || "done"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function RecordingsTab(props) {
  const { userMeetings, selectedMeeting, selectMeeting, startNewMeetingDraft, selectedRecordingId, setSelectedRecordingId, setActiveTab } = props;

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
        <MeetingsTable
          userMeetings={userMeetings}
          selectedMeeting={selectedMeeting}
          selectMeeting={selectMeeting}
          setActiveTab={setActiveTab}
        />

        <RecordingsLibrary
          userMeetings={userMeetings}
          selectedRecordingId={selectedRecordingId}
          setSelectedRecordingId={setSelectedRecordingId}
          selectMeeting={selectMeeting}
          setActiveTab={setActiveTab}
        />
      </main>
    </div>
  );
}
