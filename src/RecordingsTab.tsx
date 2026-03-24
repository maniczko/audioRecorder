import './styles/recordings.css';
import React from "react";
import { formatDateTime } from "./lib/storage";
import { EmptyState } from "./components/Skeleton";
import { RecordingPipelineStatus } from "./components/RecordingPipelineStatus";
import './RecordingsTabStyles.css';

import { createMediaService } from "./services/mediaService";
import { Input } from "./ui/Input";
import TagInput from "./shared/TagInput";

function formatPipelineDiagnostics(item) {
  const details = [];
  const transcriptOutcome = String(item?.transcriptOutcome || "").trim();
  const gitSha = String(item?.pipelineGitSha || "").trim();
  const version = String(item?.pipelineVersion || "").trim();
  const emptyReason = String(item?.emptyReason || "").trim();
  const diagnostics = item?.transcriptionDiagnostics && typeof item.transcriptionDiagnostics === "object"
    ? item.transcriptionDiagnostics
    : null;
  const audioQuality = item?.audioQuality && typeof item.audioQuality === "object"
    ? item.audioQuality
    : null;

  if (transcriptOutcome === "empty") {
    details.push("Pipeline: empty transcript");
  }
  if (emptyReason) {
    details.push(`Reason: ${emptyReason}`);
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksSentToStt)) &&
    Number.isFinite(Number(diagnostics.chunksAttempted))
  ) {
    details.push(`Chunks sent to STT: ${Number(diagnostics.chunksSentToStt)}/${Number(diagnostics.chunksAttempted)}`);
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksFailedAtStt)) &&
    Number(diagnostics.chunksFailedAtStt) > 0
  ) {
    details.push(`Chunks failed at STT: ${Number(diagnostics.chunksFailedAtStt)}`);
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
  if (audioQuality?.qualityLabel) {
    details.push(`Jakosc audio: ${audioQuality.qualityLabel}`);
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
    <section className="panel recordings-rag-panel">
      <div className="panel-header compact recordings-panel-header-flat">
        <div>
          <div className="eyebrow recordings-rag-eyebrow">AI RAG Memory</div>
          <h2>Zapytaj o Archiwum</h2>
          <p className="soft-copy recordings-copy-tight">Przeszukuj archiwalne spotkania, by przypomnieć sobie szczegóły lub dawne merytoryczne ustalenia.</p>
        </div>
      </div>
      <div className="panel-body">
        <form onSubmit={handleSearch} className="recordings-rag-form">
          <Input
            className="recordings-rag-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj kontekstu z każdego spotkania z twojej bazy danych..."
          />
          <button type="submit" className="primary-button recordings-rag-submit" disabled={loading || !query.trim()}>
            {loading ? "Szukam w wektorach..." : "Wyciągnij informację"}
          </button>
        </form>
        {answer && (
          <div className="recordings-rag-answer">
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
            <div className="recordings-diagnostics-copy">
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
            <Input
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

function UnifiedLibrary({ userMeetings, selectedMeeting, selectMeeting, setActiveTab, onDeleteMeeting }) {
  const [dateFilter, setDateFilter] = React.useState("");
  const [tagFilter, setTagFilter] = React.useState<string[]>([]);

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
      if (tagFilter && tagFilter.length > 0) {
        if (!Array.isArray(m.tags)) return false;
        const mt = m.tags.map(t=>t.trim());
        if (!tagFilter.every(tf => mt.includes(tf))) return false;
      }
      return true;
    }).sort(
      (a, b) => new Date(b.startsAt || b.createdAt).valueOf() - new Date(a.startsAt || a.createdAt).valueOf()
    );
  }, [userMeetings, dateFilter, tagFilter]);

  return (
    <section className="panel meetings-library recordings-library-panel">
      <div className="panel-header compact recordings-library-header">
        <div className="recordings-library-heading">
          <div className="eyebrow">Workspace</div>
          <h2>Baza spotkań i nagrań</h2>
        </div>
        <div className="recordings-library-filters">
          <Input 
            type="date" 
            className="studio-picker-search recordings-library-filter-control" 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <div style={{ flex: 1, minWidth: 200, maxWidth: 350 }}>
            <TagInput
              tags={tagFilter}
              suggestions={allTags}
              onChange={setTagFilter}
              placeholder="Filtruj wg tagów..."
            />
          </div>
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
              <th className="recordings-library-actions-col"></th>
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
                  <div className="recordings-library-tags">
                    {(Array.isArray(m.tags) ? m.tags : []).map((t, idx) => {
                      if (!t.trim()) return null;
                      return <span key={idx} className="status-chip status-chip-sm recordings-library-tag-chip">{t.trim()}</span>
                    })}
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    title="Usuń spotkanie i nagrania"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Czy na pewno chcesz usunąć "${m.title}" i wszystkie powiązane nagrania?`)) {
                        onDeleteMeeting?.(m.id);
                      }
                    }}
                    className="recordings-library-delete-btn"
                  >
                    🗑️
                  </button>
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
    deleteRecordingAndMeeting,
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
      Number.isFinite(Number(diagnostics.chunksSentToStt)) &&
      Number.isFinite(Number(diagnostics.chunksAttempted))
    ) {
      parts.push(`Chunki wyslane do STT: ${Number(diagnostics.chunksSentToStt)}/${Number(diagnostics.chunksAttempted)}`);
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
    if (latestSelectedRecording?.audioQuality?.qualityLabel) {
      parts.push(`Jakosc audio: ${latestSelectedRecording.audioQuality.qualityLabel}`);
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
    <div className="recordings-tab-container recordings-tab-shell">
      <header className="recordings-tab-header recordings-tab-header-shell">
        <div className="recordings-tab-upload-box recordings-tab-upload-box-fixed">
          {isUploading ? (
            <div className="recordings-upload-state">
              <div className="recordings-upload-label">Wgrywanie ({uploadProgress}%)</div>
              <div className="recordings-upload-track">
                <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#75d6c4', transition: 'width 0.2s ease-in-out' }} />
              </div>
            </div>
          ) : (
            <button 
              className="hover-pop recordings-upload-trigger"
              type="button" 
              onClick={() => mainFileInputRef.current?.click()} 
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
            className="recordings-hidden-input"
            onChange={handleMainFileUpload}
          />
        </div>
        <div className="recordings-tab-picker-col">
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
        <section className="panel recordings-status-panel">
          <div className="panel-header compact recordings-panel-header-flat">
            <div>
              <div className="eyebrow">Pipeline</div>
              <h2 className="recordings-section-title">Status przetwarzania nagrania</h2>
              <p className="soft-copy recordings-copy-md">
                {recordingMessage || "Nagranie jest aktualnie przetwarzane przez pipeline audio."}
              </p>
            </div>
          </div>
          <div className="panel-body recordings-panel-body-top">
            <RecordingPipelineStatus
              status={analysisStatus}
              progressMessage={recordingMessage}
              progressPercent={pipelineProgressPercent}
              stageLabel={pipelineStageLabel}
              errorMessage={recordingMessage}
            />
            {activeDiagnostics ? (
              <div className="recordings-diagnostics-copy recordings-diagnostics-top">
                {activeDiagnostics}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {selectedMeetingHasEmptyTranscript ? (
        <section className="panel recordings-section-panel">
          <div className="panel-header compact recordings-panel-header-flat">
            <div>
              <div className="eyebrow">Diagnostyka</div>
              <h2>Brak wykrytej mowy</h2>
              <p className="soft-copy recordings-copy-md">
                Nie wykryto wypowiedzi w nagraniu. Sprawdz audio albo ponow transkrypcje dla wybranego pliku.
              </p>
            </div>
          </div>
          <div className="panel-body recordings-panel-actions">
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
              <div className="recordings-diagnostics-copy recordings-diagnostics-md">
                {selectedMeetingEmptyDiagnostics}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {pendingImports.length ? (
        <section className="panel recordings-section-panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Import</div>
              <h2>Pliki wgrywane i przetwarzane</h2>
              <p className="soft-copy recordings-copy-md">
                Nowo dodane pliki pojawiaja sie tutaj od razu, zanim trafia do finalnej listy nagran.
              </p>
            </div>
          </div>
          <div className="panel-body recordings-pending-list">
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
                  className="pending-import-card recordings-pending-card"
                >
                  <div className="recordings-pending-meta">
                    <div className="recordings-pending-title">{item.meetingTitle || "Nowy import"}</div>
                    <div className="recordings-pending-date">
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
                      (item.status === "failed" || item.status === "failed_permanent") && retryRecordingQueueItem
                        ? () => retryRecordingQueueItem(item.recordingId)
                        : undefined
                    }
                    className="recordings-tab-pending-status"
                  />
                  {diagnostics ? (
                    <div className="recordings-pending-diagnostics">
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
          onDeleteMeeting={deleteRecordingAndMeeting}
        />
      </main>
    </div>
  );
}
