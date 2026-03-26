import './styles/recordings.css';
import React from 'react';
import { formatDateTime } from './lib/storage';
import { RecordingPipelineStatus } from './components/RecordingPipelineStatus';
import { ProgressBar } from './components/ProgressBar';
import './RecordingsTabStyles.css';

import { Input } from './ui/Input';
import { EmptyState } from './components/Skeleton';
import TagInput from './shared/TagInput';
import TagBadge from './shared/TagBadge';
import { Search, Filter, Upload } from 'lucide-react';

function formatPipelineDiagnostics(item) {
  const details = [];
  const transcriptOutcome = String(item?.transcriptOutcome || '').trim();
  const gitSha = String(item?.pipelineGitSha || '').trim();
  const version = String(item?.pipelineVersion || '').trim();
  const emptyReason = String(item?.emptyReason || '').trim();
  const diagnostics =
    item?.transcriptionDiagnostics && typeof item.transcriptionDiagnostics === 'object'
      ? item.transcriptionDiagnostics
      : null;
  const audioQuality =
    item?.audioQuality && typeof item.audioQuality === 'object' ? item.audioQuality : null;

  if (transcriptOutcome === 'empty') {
    details.push('Pipeline: empty transcript');
  }
  if (emptyReason) {
    details.push(`Reason: ${emptyReason}`);
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksSentToStt)) &&
    Number.isFinite(Number(diagnostics.chunksAttempted))
  ) {
    details.push(
      `Chunks sent to STT: ${Number(diagnostics.chunksSentToStt)}/${Number(diagnostics.chunksAttempted)}`
    );
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksFailedAtStt)) &&
    Number(diagnostics.chunksFailedAtStt) > 0
  ) {
    details.push(`Chunks failed at STT: ${Number(diagnostics.chunksFailedAtStt)}`);
  }
  if (diagnostics?.lastChunkErrorMessage) {
    details.push(`STT error: ${diagnostics.lastChunkErrorMessage}`);
  }
  if (
    diagnostics &&
    Number.isFinite(Number(diagnostics.chunksWithText)) &&
    Number.isFinite(Number(diagnostics.chunksAttempted))
  ) {
    details.push(
      `Chunks with text: ${Number(diagnostics.chunksWithText)}/${Number(diagnostics.chunksAttempted)}`
    );
  }
  if (gitSha) {
    details.push(`Build: ${gitSha.slice(0, 7)}`);
  } else if (version) {
    details.push(`Version: ${version}`);
  }
  if (audioQuality?.qualityLabel) {
    details.push(`Jakosc audio: ${audioQuality.qualityLabel}`);
  }

  return details.join(' · ');
}

function getSelectedMeetingDiagnostics(selectedMeeting) {
  if (!selectedMeeting) return '';
  const recordings = Array.isArray(selectedMeeting.recordings) ? selectedMeeting.recordings : [];
  const latest =
    recordings.find((recording) => recording.id === selectedMeeting.latestRecordingId) ||
    recordings[0] ||
    null;
  return formatPipelineDiagnostics(latest);
}

function getLatestRecording(selectedMeeting) {
  if (!selectedMeeting) return null;
  const recordings = Array.isArray(selectedMeeting.recordings) ? selectedMeeting.recordings : [];
  return (
    recordings.find((recording) => recording.id === selectedMeeting.latestRecordingId) ||
    recordings[0] ||
    null
  );
}



function UnifiedLibrary({
  userMeetings,
  selectedMeeting,
  selectMeeting,
  setActiveTab,
  onDeleteMeeting,
  onUploadClick,
  isUploading,
  uploadProgress,
  fileInputRef,
  handleFileUpload,
}) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [dateFilter, setDateFilter] = React.useState('');
  const [tagFilter, setTagFilter] = React.useState([]);
  const [participantFilter, setParticipantFilter] = React.useState([]);
  const [showFilters, setShowFilters] = React.useState(false);
  const filterDropdownRef = React.useRef(null);

  React.useEffect(() => {
    if (!showFilters) return;
    function onOutside(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) setShowFilters(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showFilters]);

  const allTags = React.useMemo(() => {
    const tags = new Set();
    userMeetings.forEach((m) => {
      if (Array.isArray(m.tags)) {
        m.tags.forEach((t) => {
          if (t && t.trim()) tags.add(t.trim());
        });
      }
    });
    return Array.from(tags).sort();
  }, [userMeetings]);

  const allParticipants = React.useMemo(() => {
    const parts = new Set();
    userMeetings.forEach((m) => {
      if (m.owner) parts.add(m.owner.trim());
      if (Array.isArray(m.guests)) {
        m.guests.forEach((g) => {
          if (g && g.trim()) parts.add(g.trim());
        });
      }
    });
    return Array.from(parts).sort();
  }, [userMeetings]);

  const [sortConfig, setSortConfig] = React.useState({ key: 'startsAt', direction: 'desc' });
  const [meetingToDelete, setMeetingToDelete] = React.useState(null);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedAndFiltered = React.useMemo(() => {
    return [...userMeetings]
      .filter((m) => {
        if (dateFilter) {
          const d = m.startsAt || m.createdAt;
          if (!d || !d.startsWith(dateFilter)) return false;
        }
        if (tagFilter && tagFilter.length > 0) {
          if (!Array.isArray(m.tags)) return false;
          const mt = m.tags.map((t) => t.trim());
          if (!tagFilter.every((tf) => mt.includes(tf))) return false;
        }
        if (participantFilter && participantFilter.length > 0) {
          const mParts = [m.owner, ...(m.guests || [])].filter(Boolean).map(p => p.trim());
          if (!participantFilter.every((pf) => mParts.includes(pf))) return false;
        }
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase();
          const titleMatch = (m.title || '').toLowerCase().includes(searchLower);
          const ownerMatch = (m.owner || '').toLowerCase().includes(searchLower);
          const guestMatch = (m.guests || []).some((g) => g.toLowerCase().includes(searchLower));
          if (!titleMatch && !ownerMatch && !guestMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let aVal, bVal;
        switch (sortConfig.key) {
          case 'title':
            aVal = (a.title || '').toLowerCase();
            bVal = (b.title || '').toLowerCase();
            break;
          case 'durationMinutes':
            aVal = a.durationMinutes || 0;
            bVal = b.durationMinutes || 0;
            break;
          case 'recordingsCount':
            aVal = (a.recordings || []).length;
            bVal = (b.recordings || []).length;
            break;
          case 'startsAt':
          default:
            aVal = new Date(a.startsAt || a.createdAt).valueOf();
            bVal = new Date(b.startsAt || b.createdAt).valueOf();
            break;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [userMeetings, searchQuery, dateFilter, tagFilter, participantFilter, sortConfig]);

  const [isDragging, setIsDragging] = React.useState(false);
  const dragCounter = React.useRef(0);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current++; setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragging(false); } };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false); dragCounter.current = 0;
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
      const dt = new DataTransfer(); dt.items.add(file);
      if (fileInputRef?.current) { fileInputRef.current.files = dt.files; fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  };

  return (
    <section
      className="panel meetings-library recordings-library-panel"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {isDragging && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 9999,
          background: 'rgba(117, 214, 196, 0.08)',
          border: '3px dashed var(--accent)',
          borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
            <Upload size={40} />
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Upuść plik audio/video tutaj</span>
          </div>
        </div>
      )}
      <div className="panel-header compact recordings-library-header" style={{ alignItems: 'center' }}>
        <div className="recordings-library-heading">
          <div className="eyebrow">Workspace</div>
          <h2>Baza spotkań i nagrań</h2>
        </div>
        
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, justifyContent: 'flex-end', marginLeft: 32 }}>
          {isUploading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Wgrywanie {uploadProgress}%</span>
              <ProgressBar value={uploadProgress} variant="upload" />
            </div>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={onUploadClick}
              style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', padding: '0 12px' }}
            >
              <Upload size={14} /> Wgraj
            </button>
          )}
          <input
            data-testid="recordings-file-input"
            type="file"
            ref={fileInputRef}
            accept="audio/*,video/*"
            className="recordings-hidden-input"
            onChange={handleFileUpload}
          />

          <div className="recordings-tab-filters-col" ref={filterDropdownRef} style={{ position: 'relative' }}>
            <button 
              type="button"
              className="secondary-button"
              onClick={() => setShowFilters(!showFilters)}
              style={{ height: 36, display: 'flex', alignItems: 'center', gap: 6, position: 'relative', fontSize: '0.82rem', padding: '0 12px' }}
            >
              <Filter size={14} /> Filters
              {(dateFilter || tagFilter.length > 0 || participantFilter.length > 0) && (
                <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: 'var(--accent)', borderRadius: '50%' }} />
              )}
            </button>
            
            {showFilters && (
              <div className="recordings-filters-dropdown" style={{
                position: 'absolute', top: 'calc(100% + 12px)', left: 0, zIndex: 9999, 
                background: '#101c1a', border: '1px solid rgba(117, 214, 196, 0.2)', 
                borderRadius: 12, padding: 24, width: 340, boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
                display: 'flex', flexDirection: 'column', gap: 20
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Filtry</h3>
                  {(dateFilter || tagFilter.length > 0 || participantFilter.length > 0) && (
                    <button 
                      type="button" 
                      className="ghost-button" 
                      onClick={() => { setDateFilter(''); setTagFilter([]); setParticipantFilter([]); }}
                      style={{ padding: '4px 8px', height: 'auto', color: 'var(--text-3)', fontSize: '0.8rem' }}
                    >
                      Wyczyść wszystko
                    </button>
                  )}
                </div>
                <div className="filter-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, display: 'block' }}>Data Spotkania</label>
                  <Input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    style={{ width: '100%', background: 'var(--surface-1)' }}
                  />
                </div>
                <div className="filter-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, display: 'block' }}>Tagi</label>
                  <TagInput
                    tags={tagFilter}
                    suggestions={allTags}
                    onChange={setTagFilter}
                    placeholder="Filtruj wg tagów..."
                  />
                </div>
                <div className="filter-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 8, display: 'block' }}>Uczestnicy</label>
                  <TagInput
                    tags={participantFilter}
                    suggestions={allParticipants}
                    onChange={setParticipantFilter}
                    placeholder="Dodaj uczestników..."
                  />
                </div>
              </div>
            )}
          </div>

          <div className="recordings-tab-search-col" style={{ flex: 1 }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
              <Input
                type="search"
                placeholder="Search host or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: 36, background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 8, height: 36, fontSize: '0.85rem' }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="studio-recordings-table-wrap">
        {sortedAndFiltered.length ? (
          <table className="studio-recordings-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('title')}
                  className="sortable-th"
                  style={{ width: '35%' }}
                >
                  Spotkanie{' '}
                  {sortConfig.key === 'title' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : null}
                </th>
                <th
                  onClick={() => handleSort('startsAt')}
                  className="sortable-th"
                  style={{ width: '20%' }}
                >
                  Data i godzina{' '}
                  {sortConfig.key === 'startsAt'
                    ? sortConfig.direction === 'asc'
                      ? '↑'
                      : '↓'
                    : null}
                </th>
                <th
                  onClick={() => handleSort('durationMinutes')}
                  className="sortable-th"
                  style={{ width: '15%' }}
                >
                  Czas trwania{' '}
                  {sortConfig.key === 'durationMinutes'
                    ? sortConfig.direction === 'asc'
                      ? '↑'
                      : '↓'
                    : null}
                </th>
                <th style={{ width: '25%' }}>Tagi</th>
                <th className="recordings-library-actions-col" style={{ width: '5%' }}></th>
              </tr>
            </thead>
            <tbody>
              {sortedAndFiltered.map((m) => (
                <tr
                  key={m.id}
                  className={m.id === selectedMeeting?.id ? 'active' : ''}
                  onClick={() => {
                    selectMeeting(m);
                    setActiveTab('studio');
                  }}
                >
                  <td className="recordings-library-meeting">
                    <strong>{m.title}</strong>
                  </td>
                  <td>{formatDateTime(m.startsAt || m.createdAt)}</td>
                  <td>{m.durationMinutes} min</td>
                  <td>
                    <div className="recordings-library-tags">
                      {(Array.isArray(m.tags) ? m.tags : []).map((t, idx) => {
                        if (!t.trim()) return null;
                        return <TagBadge key={idx} tag={t.trim()} />;
                      })}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      title="Usuń spotkanie i nagrania"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMeetingToDelete(m);
                      }}
                      className="recordings-library-delete-btn"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            icon="🎙️"
            title="Brak nagrań"
            message="Brak spotkań spełniających kryteria wyszukiwania."
          />
        )}
      </div>

      {meetingToDelete && (
        <div className="recordings-modal-overlay">
          <div className="recordings-delete-modal">
            <h3>Usuwanie spotkania</h3>
            <p>
              Czy na pewno chcesz usunąć spotkanie <strong>"{meetingToDelete.title}"</strong> oraz
              wszystkie powiązane nagrania z archiwalnej bazy wektorowej? Zmian tych nie można
              cofnąć.
            </p>
            <div className="recordings-delete-modal-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => setMeetingToDelete(null)}
              >
                Anuluj
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  if (onDeleteMeeting) {
                    onDeleteMeeting(meetingToDelete.id);
                  }
                  setMeetingToDelete(null);
                }}
              >
                Usuń powiązane nagrania do spotkania
              </button>
            </div>
          </div>
        </div>
      )}
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
    analysisStatus = 'idle',
    recordingMessage = '',
    pipelineProgressPercent = 0,
    pipelineStageLabel = '',
    retryRecordingQueueItem,
    retryStoredRecording,
    deleteRecordingAndMeeting,
  } = props;

  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const mainFileInputRef = React.useRef(null);
  const showPipelineStatus =
    Boolean(recordingMessage) ||
    ['queued', 'uploading', 'processing', 'diarization', 'review', 'failed', 'done'].includes(
      String(analysisStatus || '')
    );
  const pendingImports = React.useMemo(
    () =>
      [...(Array.isArray(recordingQueue) ? recordingQueue : [])].sort(
        (left, right) =>
          new Date(right.createdAt || 0).valueOf() - new Date(left.createdAt || 0).valueOf()
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
  const selectedMeetingHasEmptyTranscript = latestSelectedRecording?.transcriptOutcome === 'empty';
  const selectedMeetingEmptyDiagnostics = React.useMemo(() => {
    if (!selectedMeetingHasEmptyTranscript) return '';
    const diagnostics = latestSelectedRecording?.transcriptionDiagnostics || {};
    const parts = [];
    if (latestSelectedRecording?.emptyReason) {
      parts.push(`Powod: ${latestSelectedRecording.emptyReason}`);
    }
    if (
      Number.isFinite(Number(diagnostics.chunksSentToStt)) &&
      Number.isFinite(Number(diagnostics.chunksAttempted))
    ) {
      parts.push(
        `Chunki wyslane do STT: ${Number(diagnostics.chunksSentToStt)}/${Number(diagnostics.chunksAttempted)}`
      );
    }
    if (
      Number.isFinite(Number(diagnostics.chunksWithText)) &&
      Number.isFinite(Number(diagnostics.chunksAttempted))
    ) {
      parts.push(
        `Chunki z tekstem: ${Number(diagnostics.chunksWithText)}/${Number(diagnostics.chunksAttempted)}`
      );
    }
    if (latestSelectedRecording?.pipelineGitSha) {
      parts.push(`Build: ${String(latestSelectedRecording.pipelineGitSha).slice(0, 7)}`);
    }
    if (latestSelectedRecording?.audioQuality?.qualityLabel) {
      parts.push(`Jakosc audio: ${latestSelectedRecording.audioQuality.qualityLabel}`);
    }
    return parts.join(' · ');
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
          title: `Import: ${file.name.replace(/\.[^/.]+$/, '')}`,
          context: 'Zaimportowane nagranie audio z pliku.',
          startsAt: new Date().toISOString(),
        });

        const queuedId = await queueRecording(newMeeting.id, file);

        clearInterval(progressInterval);
        setUploadProgress(queuedId ? 100 : 0);
        setTimeout(
          () => {
            setIsUploading(false);
            setUploadProgress(0);
            if (queuedId) {
              selectMeeting(newMeeting);
            }
          },
          queuedId ? 350 : 0
        );
      }
    } catch (_) {
      setIsUploading(false);
      setUploadProgress(0);
      alert('Wystąpił błąd przy wgrywaniu pliku.');
    }
  };

  return (
    <div className="recordings-tab-container recordings-tab-shell">

      {showPipelineStatus ? (
        <section className="panel recordings-status-panel">
          <div className="panel-header compact recordings-panel-header-flat">
            <div>
              <div className="eyebrow">Pipeline</div>
              <h2 className="recordings-section-title">Status przetwarzania nagrania</h2>
              <p className="soft-copy recordings-copy-md">
                {recordingMessage || 'Nagranie jest aktualnie przetwarzane przez pipeline audio.'}
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
                Nie wykryto wypowiedzi w nagraniu. Sprawdz audio albo ponow transkrypcje dla
                wybranego pliku.
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
                Nowo dodane pliki pojawiaja sie tutaj od razu, zanim trafia do finalnej listy
                nagran.
              </p>
            </div>
          </div>
          <div className="panel-body recordings-pending-list">
            {pendingImports.map((item) => {
              const isActive = activeQueueItem?.recordingId === item.recordingId;
              const progressPercent = isActive
                ? pipelineProgressPercent
                : item.status === 'queued'
                  ? 8
                  : 0;
              const progressMessage = isActive
                ? recordingMessage
                : item.status === 'failed'
                  ? item.errorMessage
                  : 'Oczekiwanie na rozpoczecie przetwarzania...';
              const stageLabel = isActive ? pipelineStageLabel : 'Plik dodany do kolejki';
              const diagnostics = formatPipelineDiagnostics(item);

              return (
                <div key={item.recordingId} className="pending-import-card recordings-pending-card">
                  <div className="recordings-pending-meta">
                    <div className="recordings-pending-title">
                      {item.meetingTitle || 'Nowy import'}
                    </div>
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
                      (item.status === 'failed' || item.status === 'failed_permanent') &&
                      retryRecordingQueueItem
                        ? () => retryRecordingQueueItem(item.recordingId)
                        : undefined
                    }
                    className="recordings-tab-pending-status"
                  />
                  {diagnostics ? (
                    <div className="recordings-pending-diagnostics">{diagnostics}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <main className="recordings-tab-content">
        <UnifiedLibrary
          userMeetings={userMeetings}
          selectedMeeting={selectedMeeting}
          selectMeeting={selectMeeting}
          setActiveTab={setActiveTab}
          onDeleteMeeting={deleteRecordingAndMeeting}
          onUploadClick={() => mainFileInputRef.current?.click()}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          fileInputRef={mainFileInputRef}
          handleFileUpload={handleMainFileUpload}
        />
      </main>
    </div>
  );
}
