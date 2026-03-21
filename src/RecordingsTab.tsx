import './styles/recordings.css';
import React from "react";
import { formatDateTime } from "./lib/storage";
import { EmptyState } from "./components/Skeleton";
import { RecordingPipelineStatus } from "./components/RecordingPipelineStatus";
import './RecordingsTabStyles.css';

import { createMediaService } from "./services/mediaService";

function formatPipelineDiagnostics(item) {
  const details = [];
  const transcriptOutcome = String(item?.transcriptOutcome || "").trim();
  const gitSha = String(item?.pipelineGitSha || "").trim();
  const version = String(item?.pipelineVersion || "").trim();
  const emptyReason = String(item?.emptyReason || "").trim();
  const diagnostics = item?.transcriptionDiagnostics && typeof item.transcriptionDiagnostics === "object"
    ? item.transcriptionDiagnostics
    : null;

  if (transcriptOutcome === "empty") {
    details.push("Pipeline: empty transcript");
  }
  if (emptyReason) {
    details.push(`Reason: ${emptyReason}`);
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksWithText)) &&
    Number.isFinite(Number(diagnostics.chunksAttempted))
  ) {
    details.push(`Chunks with text: ${Number(diagnostics.chunksWithText)}/${Number(diagnostics.chunksAttempted)}`);
  }
  if (gitSha) {
    details.push(`Build: ${gitSha.slice(0, 7)}`);
  } else if (version) {
    details.push(`Version: ${version}`);
  }

  return details.join(" · ");
}

function getSelectedMeetingDiagnostics(selectedMeeting) {
  if (!selectedMeeting) return "";
  const recordings = Array.isArray(selectedMeeting.recordings) ? selectedMeeting.recordings : [];
  const latest =
    recordings.find((recording) => recording.id === selectedMeeting.latestRecordingId) || recordings[0] || null;
  return formatPipelineDiagnostics(latest);
}

function getLatestRecording(selectedMeeting) {
  if (!selectedMeeting) return null;
  const recordings = Array.isArray(selectedMeeting.recordings) ? selectedMeeting.recordings : [];
  return recordings.find((recording) => recording.id === selectedMeeting.latestRecordingId) || recordings[0] || null;
}

function RAGSearchPanel({ currentWorkspace }) {
  const [query, setQuery] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || !currentWorkspace?.id) return;
    setLoading(true);
    setAnswer("");
    try {
      const ms = await createMediaService();
      const res = await ms.askRAG(currentWorkspace.id, query);
      setAnswer(res?.answer || "Brak odpowiedzi");
    } catch(err) {
      setAnswer("Wystąpił błąd podczas przeszukiwania archiwalnych nagrań.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel" style={{ marginBottom: '32px', background: 'linear-gradient(145deg, rgba(117,214,196,0.1) 0%, rgba(0,0,0,0.4) 100%)', border: '1px solid rgba(117,214,196,0.2)' }}>
      <div className="panel-header compact" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <div className="eyebrow" style={{ color: '#75d6c4' }}>AI RAG Memory</div>
          <h2>Zapytaj o Archiwum</h2>
          <p className="soft-copy" style={{ fontSize: '0.85rem', marginTop: '4px' }}>Przeszukuj archiwalne spotkania, by przypomnieć sobie szczegóły lub dawne merytoryczne ustalenia.</p>
        </div>
      </div>
      <div className="panel-body">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj kontekstu z każdego spotkania z twojej bazy danych..."
            style={{ flex: 1, padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.95rem' }}
          />
          <button type="submit" className="primary-button" disabled={loading || !query.trim()} style={{ background: '#75d6c4', color: '#000', fontWeight: 600 }}>
            {loading ? "Szukam w wektorach..." : "Wyciągnij informację"}
          </button>
        </form>
        {answer && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: '3px solid #75d6c4', lineHeight: 1.5, fontSize: '0.95rem' }}>
            {answer}
          </div>
        )}
      </div>
    </section>
  );
}

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
  const meetingDiagnostics = getSelectedMeetingDiagnostics(selectedMeeting);

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
          {meetingDiagnostics ? (
            <div style={{ marginTop: "6px", color: "var(--text-3, #8f97ab)", fontSize: "0.78rem" }}>
              {meetingDiagnostics}
            </div>
          ) : null}
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
      if (Array.isArray(m.tags)) {
        m.tags.forEach(t => {
          if (t && t.trim()) tags.add(t.trim());
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
        if (!Array.isArray(m.tags)) return false;
        const mt = m.tags.map(t=>t.trim());
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
                    {(Array.isArray(m.tags) ? m.tags : []).map((t, idx) => {
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
          <EmptyState icon="🎙️" title="Brak nagrań" message="Brak spotkań spełniających kryteria wyszukiwania." />
        )}
      </div>
    </section>
  );
}

export default function RecordingsTab(props) {
  const {
    currentWorkspace,
    userMeetings,
    selectedMeeting,
    selectMeeting,
    startNewMeetingDraft,
    setActiveTab,
    onCreateMeeting,
    queueRecording,
    recordingQueue = [],
    activeQueueItem = null,
    analysisStatus = "idle",
    recordingMessage = "",
    pipelineProgressPercent = 0,
    pipelineStageLabel = "",
    retryRecordingQueueItem,
    retryStoredRecording,
  } = props;

  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const mainFileInputRef = React.useRef(null);
  const showPipelineStatus =
    Boolean(recordingMessage) ||
    ["queued", "uploading", "processing", "diarization", "review", "failed", "done"].includes(
      String(analysisStatus || "")
    );
  const pendingImports = React.useMemo(
    () =>
      [...(Array.isArray(recordingQueue) ? recordingQueue : [])].sort(
        (left, right) => new Date(right.createdAt || 0).valueOf() - new Date(left.createdAt || 0).valueOf()
      ),
    [recordingQueue]
  );
  const activeDiagnostics = React.useMemo(
    () => formatPipelineDiagnostics(activeQueueItem),
    [activeQueueItem]
  );
  const latestSelectedRecording = React.useMemo(
    () => getLatestRecording(selectedMeeting),
    [selectedMeeting]
  );
  const selectedMeetingHasEmptyTranscript = latestSelectedRecording?.transcriptOutcome === "empty";
  const selectedMeetingEmptyDiagnostics = React.useMemo(() => {
    if (!selectedMeetingHasEmptyTranscript) return "";
    const diagnostics = latestSelectedRecording?.transcriptionDiagnostics || {};
    const parts = [];
    if (latestSelectedRecording?.emptyReason) {
      parts.push(`Powod: ${latestSelectedRecording.emptyReason}`);
    }
    if (
      Number.isFinite(Number(diagnostics.chunksWithText)) &&
      Number.isFinite(Number(diagnostics.chunksAttempted))
    ) {
      parts.push(`Chunki z tekstem: ${Number(diagnostics.chunksWithText)}/${Number(diagnostics.chunksAttempted)}`);
    }
    if (latestSelectedRecording?.pipelineGitSha) {
      parts.push(`Build: ${String(latestSelectedRecording.pipelineGitSha).slice(0, 7)}`);
    }
    return parts.join(" · ");
  }, [latestSelectedRecording, selectedMeetingHasEmptyTranscript]);

  const handleMainFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (onCreateMeeting && queueRecording) {
        setIsUploading(true);
        setUploadProgress(5);
        
        let progress = 5;
        const progressInterval = setInterval(() => {
          progress += Math.floor(Math.random() * 15) + 5;
          if (progress > 90) progress = 90;
          setUploadProgress(progress);
        }, 300);

        const newMeeting = await onCreateMeeting({
          title: `Import: ${file.name.replace(/\.[^/.]+$/, "")}`,
          context: "Zaimportowane nagranie audio z pliku.",
          startsAt: new Date().toISOString()
        });
        
        const queuedId = await queueRecording(newMeeting.id, file);

        clearInterval(progressInterval);
        setUploadProgress(queuedId ? 100 : 0);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
          if (queuedId) {
            selectMeeting(newMeeting);
          }
        }, queuedId ? 350 : 0);
      }
    } catch (_) {
      setIsUploading(false);
      setUploadProgress(0);
      alert("Wystąpił błąd przy wgrywaniu pliku.");
    }
  };

  return (
    <div className="recordings-tab-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <header className="recordings-tab-header" style={{ marginBottom: '32px', display: 'flex', gap: '24px' }}>
        <div className="recordings-tab-upload-box" style={{ flex: '0 0 240px' }}>
          {isUploading ? (
            <div style={{ width: '100%', height: '100%', minHeight: '120px', background: 'rgba(117,214,196,0.1)', border: '1px solid rgba(117,214,196,0.4)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <div style={{ color: '#75d6c4', fontSize: '0.90rem', fontWeight: 600 }}>Wgrywanie ({uploadProgress}%)</div>
              <div style={{ width: '70%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#75d6c4', transition: 'width 0.2s ease-in-out' }} />
              </div>
            </div>
          ) : (
            <button 
              className="hover-pop"
              type="button" 
              onClick={() => mainFileInputRef.current?.click()} 
              style={{ width: '100%', height: '100%', minHeight: '120px', background: 'rgba(117,214,196,0.1)', border: '1px dashed rgba(117,214,196,0.4)', borderRadius: '12px', color: '#75d6c4', fontSize: '1rem', fontWeight: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'inset 0 0 10px rgba(117,214,196,0.05)' }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(117,214,196,0.2)'; e.currentTarget.style.borderColor = '#75d6c4'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(117,214,196,0.1)'; e.currentTarget.style.borderColor = 'rgba(117,214,196,0.4)'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Wgraj własne nagranie
            </button>
          )}
          <input
            data-testid="recordings-file-input"
            type="file"
            ref={mainFileInputRef}
            accept="audio/*,video/*"
            style={{ display: 'none' }}
            onChange={handleMainFileUpload}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MeetingPicker
             selectedMeeting={selectedMeeting}
             userMeetings={userMeetings}
             selectMeeting={selectMeeting}
             startNewMeetingDraft={startNewMeetingDraft}
             setActiveTab={setActiveTab}
          />
        </div>
      </header>

      {showPipelineStatus ? (
        <section
          className="panel"
          style={{ marginBottom: "24px", padding: "18px 20px", border: "1px solid rgba(117,214,196,0.16)" }}
        >
          <div className="panel-header compact" style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div>
              <div className="eyebrow">Pipeline</div>
              <h2 style={{ marginBottom: "6px" }}>Status przetwarzania nagrania</h2>
              <p className="soft-copy" style={{ fontSize: "0.9rem" }}>
                {recordingMessage || "Nagranie jest aktualnie przetwarzane przez pipeline audio."}
              </p>
            </div>
          </div>
          <div className="panel-body" style={{ paddingTop: "12px" }}>
            <RecordingPipelineStatus
              status={analysisStatus}
              progressMessage={recordingMessage}
              progressPercent={pipelineProgressPercent}
              stageLabel={pipelineStageLabel}
              errorMessage={recordingMessage}
            />
            {activeDiagnostics ? (
              <div
                style={{
                  marginTop: "10px",
                  color: "var(--text-3, #8f97ab)",
                  fontSize: "0.78rem",
                }}
              >
                {activeDiagnostics}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {selectedMeetingHasEmptyTranscript ? (
        <section className="panel" style={{ marginBottom: "24px", padding: "18px 20px" }}>
          <div className="panel-header compact" style={{ borderBottom: "none", paddingBottom: 0 }}>
            <div>
              <div className="eyebrow">Diagnostyka</div>
              <h2>Brak wykrytej mowy</h2>
              <p className="soft-copy" style={{ fontSize: "0.9rem" }}>
                Nie wykryto wypowiedzi w nagraniu. Sprawdz audio albo ponow transkrypcje dla wybranego pliku.
              </p>
            </div>
          </div>
          <div className="panel-body" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            {retryStoredRecording ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => retryStoredRecording(selectedMeeting, latestSelectedRecording)}
              >
                Ponow transkrypcje
              </button>
            ) : null}
            {selectedMeetingEmptyDiagnostics ? (
              <div style={{ color: "var(--text-3, #8f97ab)", fontSize: "0.8rem" }}>
                {selectedMeetingEmptyDiagnostics}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {pendingImports.length ? (
        <section className="panel" style={{ marginBottom: "24px" }}>
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Import</div>
              <h2>Pliki wgrywane i przetwarzane</h2>
              <p className="soft-copy" style={{ fontSize: "0.9rem" }}>
                Nowo dodane pliki pojawiaja sie tutaj od razu, zanim trafia do finalnej listy nagran.
              </p>
            </div>
          </div>
          <div className="panel-body" style={{ display: "grid", gap: "12px" }}>
            {pendingImports.map((item) => {
              const isActive = activeQueueItem?.recordingId === item.recordingId;
              const progressPercent = isActive ? pipelineProgressPercent : item.status === "queued" ? 8 : 0;
              const progressMessage = isActive
                ? recordingMessage
                : item.status === "failed"
                  ? item.errorMessage
                  : "Oczekiwanie na rozpoczecie przetwarzania...";
              const stageLabel = isActive ? pipelineStageLabel : "Plik dodany do kolejki";
              const diagnostics = formatPipelineDiagnostics(item);

              return (
                <div
                  key={item.recordingId}
                  className="pending-import-card"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "16px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: "1px solid rgba(117,214,196,0.16)",
                    background: "rgba(117,214,196,0.04)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>{item.meetingTitle || "Nowy import"}</div>
                    <div style={{ color: "var(--text-3, #8f97ab)", fontSize: "0.82rem" }}>
                      Dodano {formatDateTime(item.createdAt)}
                    </div>
                  </div>
                  <RecordingPipelineStatus
                    status={item.status}
                    progressMessage={progressMessage}
                    progressPercent={progressPercent}
                    stageLabel={stageLabel}
                    errorMessage={item.errorMessage}
                    onRetry={
                      item.status === "failed" && retryRecordingQueueItem
                        ? () => retryRecordingQueueItem(item.recordingId)
                        : undefined
                    }
                    className="recordings-tab-pending-status"
                  />
                  {diagnostics ? (
                    <div
                      style={{
                        width: "100%",
                        marginTop: "8px",
                        color: "var(--text-3, #8f97ab)",
                        fontSize: "0.76rem",
                      }}
                    >
                      {diagnostics}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
      
      <main className="recordings-tab-content">
        <RAGSearchPanel currentWorkspace={currentWorkspace} />
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
