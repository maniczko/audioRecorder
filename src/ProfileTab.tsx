import './styles/profile.css';
import { useEffect, useRef, useState, useMemo } from 'react';
import { apiRequest } from './services/httpClient';
import { apiBaseUrlConfigured } from './services/config';
import type { VoiceProfileSummary, VoiceProfilesListPayload } from './shared/types';
import './ProfileTabStyles.css';
import useWorkspaceBackup from './hooks/useWorkspaceBackup';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { JapaneseThemeSelector } from './components/JapaneseThemeSelector';
import { type JapaneseTheme } from './styles/japaneseThemes';
import './styles/JapaneseFlatDesign.css';
import TagInput from './shared/TagInput';
import { ErrorLogSection } from './components/ErrorLogSection';

function VoiceProfilesSection({ peopleProfiles = [] }) {
  const [profiles, setProfiles] = useState<VoiceProfileSummary[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedPerson, setSelectedPerson] = useState('');
  const [status, setStatus] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backendApiReady = apiBaseUrlConfigured();

  // Filtracja sugestii - tylko prawdziwe osoby, bez emaili i systemowych
  const peopleSuggestions = useMemo(() => {
    return peopleProfiles
      .map((p) => p.name)
      .filter((name) => {
        const n = String(name || '')
          .trim()
          .toLowerCase();
        return (
          n && n !== 'nieprzypisane' && n !== 'unassigned' && n !== 'system' && !n.includes('@')
        );
      })
      .sort()
      .filter((value, index, self) => self.indexOf(value) === index); // unikalne
  }, [peopleProfiles]);

  useEffect(() => {
    if (!backendApiReady) return;
    apiRequest('/voice-profiles')
      .then((data: VoiceProfilesListPayload) => setProfiles(data.profiles || []))
      .catch(() => {});
  }, [backendApiReady]);

  // Grupowanie profili po osobie
  const profilesByPerson = useMemo(() => {
    const groups: Record<string, VoiceProfileSummary[]> = {};
    profiles.forEach((p) => {
      const key = p.speakerName;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    // Sortuj próbki wewnątrz grupy po dacie
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });
    return groups;
  }, [profiles]);

  async function startRecording() {
    if (!backendApiReady) {
      setStatus(
        'Backend API nie jest skonfigurowane. Ustaw VITE_API_BASE_URL lub REACT_APP_API_BASE_URL.'
      );
      return;
    }
    if (!selectedPerson.trim()) {
      setStatus('Wybierz osobę przed nagraniem.');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) {
      setStatus('Brak dostępu do mikrofonu.');
      return;
    }
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setElapsed(0);
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      setStatus('Przetwarzanie…');
      try {
        const data = (await apiRequest('/voice-profiles', {
          method: 'POST',
          body: blob,
          headers: {
            'Content-Type': blob.type,
            'X-Speaker-Name': selectedPerson.trim(),
          },
        })) as VoiceProfileSummary & { isUpdate?: boolean };
        setProfiles((prev) => {
          const idx = prev.findIndex(
            (p) => p.speakerName.toLowerCase() === data.speakerName.toLowerCase()
          );
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = data;
            return updated;
          }
          return [data, ...prev];
        });
        const sampleCount = data.sampleCount || 1;
        if (sampleCount >= 5) {
          setStatus(`Maksymalna liczba próbek (5) dla osoby ${data.speakerName}.`);
          setSelectedPerson('');
        } else if (data.isUpdate) {
          setStatus(`Próbka ${sampleCount}/5 dodana do profilu ${data.speakerName}.`);
        } else {
          setStatus(
            data.hasEmbedding
              ? `Profil głosowy ${data.speakerName} zapisany (próbka 1/5).`
              : 'Profil zapisany. Zainstaluj ffmpeg dla automatycznego rozpoznawania.'
          );
        }
      } catch (err: any) {
        setStatus(`Błąd: ${err?.message || 'Nieznany błąd'}`);
      }
    };
    recorder.start(500);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setElapsed(0);
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 300);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function deleteProfile(id: string) {
    await apiRequest(`/voice-profiles/${id}`, { method: 'DELETE', parseAs: 'raw' });
    setProfiles((prev) => prev.filter((p: any) => p.id !== id));
  }

  async function updateThreshold(id: string, threshold: number) {
    try {
      const updated = (await apiRequest(`/voice-profiles/${id}/threshold`, {
        method: 'PATCH',
        body: { threshold },
      })) as { id: string; threshold: number };
      setProfiles((prev) =>
        prev.map((p: any) => (p.id === updated.id ? { ...p, threshold: updated.threshold } : p))
      );
    } catch (_) {}
  }

  function formatElapsed(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">AI</div>
          <h2>Profile głosowe</h2>
        </div>
        <span className="status-chip">{profiles.length}</span>
      </div>
      <p className="profile-muted-copy profile-copy-bottom">
        Nagraj 15–30 sekund głosu każdej osoby. Dodaj do 5 próbek dla lepszego rozpoznawania.
      </p>
      <div className="stack-form profile-form-bottom">
        <label>
          <span>Wybierz osobę</span>
          <TagInput
            tags={selectedPerson ? [selectedPerson] : []}
            suggestions={peopleSuggestions}
            onChange={(tags) => setSelectedPerson(tags[0] || '')}
            placeholder="Wpisz lub wybierz z listy..."
          />
        </label>
        {selectedPerson && profilesByPerson[selectedPerson] && (
          <div className="profile-samples-info">
            <span className="profile-samples-count">
              Próbek: {profilesByPerson[selectedPerson].length}/5
            </span>
            {profilesByPerson[selectedPerson].length >= 5 && (
              <span className="profile-samples-max"> (maksimum osiągnięte)</span>
            )}
          </div>
        )}
        <div className="button-row">
          {isRecording ? (
            <>
              <button type="button" className="danger-button" onClick={stopRecording}>
                ■ Stop ({formatElapsed(elapsed)})
              </button>
              <span className="profile-recording-label">Nagrywa…</span>
            </>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={startRecording}
              disabled={
                !selectedPerson.trim() ||
                !backendApiReady ||
                (profilesByPerson[selectedPerson]?.length || 0) >= 5
              }
              title={
                !backendApiReady
                  ? 'Skonfiguruj backend API, aby nagrywac profile glosowe.'
                  : (profilesByPerson[selectedPerson]?.length || 0) >= 5
                    ? 'Osiągnięto maksymalną liczbę próbek (5) dla tej osoby.'
                    : undefined
              }
            >
              ● Nagraj głos
            </button>
          )}
        </div>
        {!backendApiReady ? (
          <div className="inline-alert info">
            Profile glosowe wymagaja backend API. Ustaw `VITE_API_BASE_URL` albo
            `REACT_APP_API_BASE_URL`.
          </div>
        ) : null}
        {status ? (
          <div className={`inline-alert ${status.startsWith('Błąd') ? 'error' : 'info'}`}>
            {status}
          </div>
        ) : null}
      </div>

      {profiles.length > 0 && (
        <div className="voice-profiles-grouped">
          {Object.entries(profilesByPerson).map(([personName, samples]) => (
            <div key={personName} className="voice-profile-person-group">
              <div className="voice-profile-person-header">
                <span className="voice-profile-person-avatar">
                  {personName.slice(0, 2).toUpperCase()}
                </span>
                <div className="voice-profile-person-info">
                  <strong>{personName}</strong>
                  <span className="voice-profile-samples-count">{samples.length}/5 próbek</span>
                </div>
              </div>
              <ul className="voice-profile-samples-list">
                {samples.map((p, idx) => (
                  <li key={p.id} className="voice-profile-sample-item">
                    <span className="sample-number">{idx + 1}</span>
                    <div className="voice-profile-sample-info">
                      <span className="sample-date">
                        {new Date(p.createdAt).toLocaleDateString('pl-PL', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {p.hasEmbedding && (
                        <span className="sample-status-badge">✓ Przetworzono</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="icon-button profile-delete-sample-btn"
                      onClick={() => deleteProfile(p.id)}
                      title="Usuń tę próbkę"
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
              <div className="voice-profile-threshold-container">
                <span className="vp-threshold-label">
                  Próg rozpoznawania: {Math.round((samples[0]?.threshold ?? 0.82) * 100)}%
                </span>
                <input
                  type="range"
                  className="vp-threshold-slider"
                  min="50"
                  max="99"
                  step="1"
                  value={Math.round((samples[0]?.threshold ?? 0.82) * 100)}
                  onChange={(e) => {
                    const t = Number(e.target.value) / 100;
                    setProfiles((prev) =>
                      prev.map((x) => (x.id === samples[0].id ? { ...x, threshold: t } : x))
                    );
                  }}
                  onMouseUp={(e) =>
                    updateThreshold(
                      samples[0].id,
                      Number((e.target as HTMLInputElement).value) / 100
                    )
                  }
                  onTouchEnd={(e) =>
                    updateThreshold(
                      samples[0].id,
                      Number((e.target as HTMLInputElement).value) / 100
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function VocabularyManagerSection({ vocabulary, onUpdateVocabulary }) {
  const [newTerm, setNewTerm] = useState('');

  function handleAdd(e) {
    e.preventDefault();
    const term = newTerm.trim();
    if (term && !vocabulary.includes(term)) {
      onUpdateVocabulary([...vocabulary, term]);
      setNewTerm('');
    }
  }

  function removeTerm(term) {
    onUpdateVocabulary(vocabulary.filter((t) => t !== term));
  }

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Audio Engine</div>
          <h2>Słownik (Vocabulary)</h2>
        </div>
        <span className="status-chip">{vocabulary.length}</span>
      </div>
      <p className="profile-muted-copy profile-copy-bottom">
        Dodaj nazwy projektów, żargon techniczny lub nazwiska. AI będzie ich używać do poprawy
        celności transkrypcji.
      </p>

      <form className="stack-form profile-form-bottom" onSubmit={handleAdd}>
        <div className="button-row profile-button-row-tight">
          <Input
            className="profile-input-flex"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            placeholder="np. Antigravity, Kubernetes, Kowalski"
          />
          <button type="submit" className="secondary-button" disabled={!newTerm.trim()}>
            Dodaj
          </button>
        </div>
      </form>

      <div className="chip-list profile-chip-list-top">
        {vocabulary.length > 0 ? (
          vocabulary.map((term) => (
            <span key={term} className="task-tag-chip neutral profile-vocabulary-chip">
              {term}
              <button
                type="button"
                className="profile-chip-remove"
                onClick={() => removeTerm(term)}
              >
                ×
              </button>
            </span>
          ))
        ) : (
          <p className="profile-muted-copy">Brak słów w słowniku.</p>
        )}
      </div>
    </section>
  );
}

function TagManagerSection({ allTags, onRenameTag, onDeleteTag }) {
  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState('');

  function startEdit(tag) {
    setEditingTag(tag);
    setEditValue(tag);
  }

  function commitEdit(tag) {
    if (editValue.trim() && editValue.trim() !== tag) {
      onRenameTag(tag, editValue.trim().toLowerCase());
    }
    setEditingTag(null);
    setEditValue('');
  }

  function handleKeyDown(e, tag) {
    if (e.key === 'Enter') commitEdit(tag);
    if (e.key === 'Escape') {
      setEditingTag(null);
      setEditValue('');
    }
  }

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Workspace</div>
          <h2>Zarządzanie tagami</h2>
        </div>
        <span className="status-chip">{allTags.length}</span>
      </div>

      {allTags.length === 0 ? (
        <div className="integration-card">
          <p className="profile-muted-copy">
            Brak tagów w workspace. Dodaj tagi do zadań lub spotkań.
          </p>
        </div>
      ) : (
        <div className="tag-manager-list">
          {allTags.map(({ tag, taskCount, meetingCount }) => (
            <div key={tag} className="tag-manager-row">
              {editingTag === tag ? (
                <Input
                  className="tag-manager-edit-input"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitEdit(tag)}
                  onKeyDown={(e) => handleKeyDown(e, tag)}
                />
              ) : (
                <button
                  type="button"
                  className="tag-manager-name"
                  onClick={() => startEdit(tag)}
                  title="Kliknij, aby zmienić nazwę"
                >
                  #{tag}
                </button>
              )}
              <div className="tag-manager-counts">
                {taskCount > 0 && (
                  <span className="tag-count-chip tasks">
                    {taskCount} {taskCount === 1 ? 'zadanie' : 'zadań'}
                  </span>
                )}
                {meetingCount > 0 && (
                  <span className="tag-count-chip meetings">
                    {meetingCount} {meetingCount === 1 ? 'spotkanie' : 'spotkań'}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="tag-manager-delete"
                title={`Usuń tag #${tag}`}
                onClick={() => onDeleteTag(tag)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) {
    return '0 MB';
  }

  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function AudioStorageSection({
  audioStorageState,
  onRefreshAudioStorageState,
  onDeleteStoredRecordingAudio,
}) {
  const items = audioStorageState?.items || [];
  const usageRatio = Number(audioStorageState?.usageRatio || 0);
  const usagePercent = Math.round(usageRatio * 100);
  const warningMessage = audioStorageState?.warningMessage || '';

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Storage</div>
          <h2>Pamięć audio</h2>
        </div>
        <span
          className="status-chip"
          style={
            audioStorageState?.isNearQuota
              ? { background: 'rgba(243, 202, 114, 0.12)', color: 'var(--warning)' }
              : undefined
          }
        >
          {usagePercent || 0}%
        </span>
      </div>
      <div className="integration-card profile-card-grid">
        <div>
          <p className="profile-paragraph-reset profile-text-main">
            Użyto {formatBytes(audioStorageState?.usageBytes)} z{' '}
            {formatBytes(audioStorageState?.quotaBytes)}.
          </p>
          <p className="profile-paragraph-subtle">
            Wolne miejsce: {formatBytes(audioStorageState?.freeBytes)}.
          </p>
        </div>

        {warningMessage ? (
          <div className="inline-alert info profile-alert-warning-border">{warningMessage}</div>
        ) : null}

        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => onRefreshAudioStorageState?.()}
          >
            Odśwież
          </button>
        </div>

        <div className="voice-profile-list">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.recordingId} className="voice-profile-item profile-audio-item">
                <span className="voice-profile-avatar">A</span>
                <div className="voice-profile-info">
                  <strong>{item.recordingId.slice(0, 12)}...</strong>
                  <span>
                    {formatBytes(item.sizeBytes)}
                    {item.mimeType ? ` • ${item.mimeType}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="danger-button profile-ghost-button-compact"
                  onClick={() => onDeleteStoredRecordingAudio?.(item.recordingId)}
                >
                  Usuń audio z pamięci lokalnej
                </button>
              </div>
            ))
          ) : (
            <p className="profile-paragraph-reset profile-muted-copy">
              Brak lokalnie zapisanych plików audio.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function WorkspaceBackupSection() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    exportWorkspace,
    importWorkspaceFile,
    applyWorkspaceImport,
    clearImportState,
    preview,
    statusMessage,
    isImporting,
    hasPendingImport,
  } = useWorkspaceBackup();

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Backup</div>
          <h2>Eksport i import danych</h2>
        </div>
      </div>
      <div className="integration-card profile-card-grid">
        <p className="profile-paragraph-reset profile-muted-copy">
          Eksport obejmuje spotkania, zadania, stan kolumn, metadane kalendarza i słownik. Plik nie
          zawiera audio blobów.
        </p>
        <div className="button-row">
          <button type="button" className="primary-button" onClick={exportWorkspace}>
            Eksportuj dane workspace
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => inputRef.current?.click()}
          >
            Importuj dane
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="profile-hidden-input"
          onChange={async (event) => {
            const file = event.target.files?.[0] || null;
            await importWorkspaceFile(file);
            event.target.value = '';
          }}
        />
        {preview ? (
          <div className="inline-alert info">
            Do importu: {preview.meetingsToAdd} spotkań, {preview.manualTasksToAdd} zadań,{' '}
            {preview.vocabularyToAdd} słów w słowniku.
          </div>
        ) : null}
        {statusMessage ? <div className="inline-alert info">{statusMessage}</div> : null}
        <div className="button-row">
          <button
            type="button"
            className="secondary-button"
            disabled={!hasPendingImport || isImporting}
            onClick={applyWorkspaceImport}
          >
            {isImporting ? 'Importowanie...' : 'Zastosuj import'}
          </button>
          {preview ? (
            <button type="button" className="ghost-button" onClick={clearImportState}>
              Wyczyść podgląd
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function integrationStatusLabel(status, connectedCount) {
  if (connectedCount) {
    return `${connectedCount} wydarzen w kalendarzu`;
  }

  if (status === 'connected') {
    return 'Polaczone, ale w tym miesiacu nie ma jeszcze wydarzen.';
  }

  if (status === 'loading') {
    return 'Trwa pobieranie wydarzen';
  }

  return 'Kalendarz nie jest jeszcze podpiety';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ChangelogSection() {
  const [expandedVersion, setExpandedVersion] = useState('v1.6.0');

  const changelogData = [
    {
      version: 'v1.6.0',
      date: '22 marca 2026',
      title: 'Stabilizacja i Poprawki Krytyczne',
      changes: [
        'Naprawiono błędy CORS blokujące komunikację między frontendem (Vercel) a backendem (Railway)',
        "Zmieniono weryfikację wersji (Build ID mismatch) na nieblokujące ostrzeżenie – eliminuje błąd 'nieaktualny preview'",
        'Wyeliminowano race conditions przy usuwaniu spotkań poprzez mechanizm wstrzymywania odświeżania (pauseRemotePull)',
        'Oczyszczono osierocone dane w bazie Supabase (media_assets i workspace_state) przywracając spójność',
        'Poprawiono obsługę błędów audio hydration w celu wyeliminowania błędów 404 w konsoli dla starych nagrań',
        "Refaktoryzacja backendu: wydzielenie czystych funkcji do audioPipeline.utils.ts i optymalizacja pipeline'u",
      ],
    },
    {
      version: 'v1.5.0',
      date: '20 marca 2026',
      title: 'Uporządkowanie Nagrań i Filtrowanie',
      changes: [
        'Jeden zintegrowany widok nagrań i spotkań zamiast dwóch oddzielnych paneli',
        'Dodano możliwość filtrowania spotkań i nagrań po wybranej dacie (kalendarzyk)',
        'Rozwinięto widok tabeli o tagi oraz możliwość natychmiastowego filtrowania (dropdown tagów)',
        'Nowe chipy tagów widoczne bezpośrednio na liście bez wchodzenia w detale',
        'Wyeliminowano błędy Service Workera i przystosowano testy Playwright E2E',
      ],
    },
    {
      version: 'v1.4.2',
      date: '19 marca 2026',
      title: 'Audio Pipeline i Backend',
      changes: [
        'Przeprowadzono migrację bazy IndexedDB do produkcyjnego silnika SQLite + Hono',
        'Uporządkowano zarządzanie zduplikowanymi plikami logiki i poprawiono deploy na Vercel',
        'Wprowadzono stabilny routing oraz natywne asercje w procesach rejestracji i resetu haseł',
        'Zaimplementowano poprawki estetyki dashboardu dla Google Login',
      ],
    },
    {
      version: 'v1.4.0',
      date: '18 marca 2026',
      title: 'Core UX',
      changes: [
        'Odtwarzacz plików reaguje asynchronicznie i naprawiono testy widoczności status bara',
        "Refaktoryzacja bazy E2E – zadania potwierdzane są klasą complete zamiast toggle'a",
      ],
    },
  ];

  return (
    <section className="panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Dziennik zmian</div>
          <h2>Changelog</h2>
        </div>
      </div>
      <div className="integration-card profile-card-stack">
        {changelogData.map((item, idx) => {
          const isExpanded = expandedVersion === item.version || (idx === 0 && !expandedVersion);
          return (
            <div
              key={idx}
              className={`profile-changelog-item${idx < changelogData.length - 1 ? ' is-separated' : ''}`}
            >
              <div
                className="profile-changelog-header"
                onClick={() => setExpandedVersion(isExpanded ? null : item.version)}
              >
                <div>
                  <strong className="profile-changelog-title">
                    {item.version} - {item.title}
                  </strong>
                  <p className="profile-changelog-date">{item.date}</p>
                </div>
                <span className="profile-changelog-toggle">{isExpanded ? '▴' : '▾'}</span>
              </div>

              {isExpanded && (
                <ul className="profile-changelog-list">
                  {item.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ProfileTab({
  currentUser,
  profileDraft,
  setProfileDraft,
  saveProfile,
  profileMessage,
  googleEnabled,
  googleCalendarStatus,
  googleCalendarMessage,
  googleCalendarEventsCount,
  googleCalendarLastSyncedAt,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  refreshGoogleCalendar,
  passwordDraft,
  setPasswordDraft,
  updatePassword,
  securityMessage,
  googleTasksEnabled,
  googleTasksStatus,
  googleTasksMessage,
  googleTasksLastSyncedAt,
  googleTaskLists = [],
  selectedGoogleTaskListId,
  onSelectGoogleTaskList,
  onConnectGoogleTasks,
  onImportGoogleTasks,
  onExportGoogleTasks,
  onRefreshGoogleTasks,
  microsoftEnabled,
  microsoftCalendarStatus,
  microsoftCalendarMessage,
  outlookCalendarEventsCount,
  microsoftCalendarLastSyncedAt,
  connectMicrosoftCalendar,
  disconnectMicrosoftCalendar,
  microsoftTasksStatus,
  microsoftTasksMessage,
  microsoftTaskLists = [],
  selectedMicrosoftTaskListId,
  onSelectMicrosoftTaskList,
  connectMicrosoftTasks,
  disconnectMicrosoftTasks,
  workspaceRole,
  onLogout,
  theme,
  onSetTheme,
  layoutPreset = 'default',
  onSetLayoutPreset,
  allTags = [],
  onRenameTag,
  onDeleteTag,
  vocabulary = [],
  onUpdateVocabulary,
  peopleProfiles = [],
  audioStorageState,
  onRefreshAudioStorageState,
  onDeleteStoredRecordingAudio,
  sessionToken,
  apiBaseUrl,
}) {
  const canManagePassword = Boolean(currentUser?.passwordHash);
  const [activeCategory, setActiveCategory] = useState('account');
  const [japaneseTheme, setJapaneseTheme] = useState<JapaneseTheme>(() => {
    const saved = localStorage.getItem('profile-theme') as JapaneseTheme;
    return saved || 'sakura';
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.className = `theme-${japaneseTheme}`;
    localStorage.setItem('profile-theme', japaneseTheme);
  }, [japaneseTheme]);

  const categories = [
    { id: 'account', label: 'Profil i Styl pracy', icon: '👤' },
    { id: 'tools', label: 'Narzędzia AI', icon: '🛠️' },
    { id: 'review', label: 'Ustawienia wyciszone', icon: '📦' },
    { id: 'errorlog', label: 'Dziennik błędów', icon: '🐛' },
  ];

  return (
    <div className="profile-layout-container">
      <aside className="profile-sidebar">
        <div className="profile-sidebar-header">
          <div className="eyebrow">Ustawienia</div>
          <h3>Twoje konto</h3>
        </div>
        <nav className="profile-nav">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`profile-nav-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="profile-nav-icon">{cat.icon}</span>
              <span className="profile-nav-label">{cat.label}</span>
            </button>
          ))}
        </nav>

        <div className="profile-sidebar-footer">
          <button type="button" className="profile-logout-btn" onClick={onLogout}>
            <span>🚪</span> Wyloguj się
          </button>
        </div>
      </aside>

      <main className="profile-main-content">
        {activeCategory === 'account' && (
          <div className="profile-category-view">
            <section className="profile-hero">
              <div className="profile-hero-main">
                {profileDraft.avatarUrl ? (
                  <img
                    src={profileDraft.avatarUrl}
                    alt={profileDraft.name || currentUser.email}
                    className="profile-avatar-lg"
                  />
                ) : (
                  <div className="profile-avatar-fallback">
                    {(profileDraft.name || currentUser.email || 'U').slice(0, 1)}
                  </div>
                )}
                <div>
                  <div className="eyebrow">Profil</div>
                  <h2>{profileDraft.name || 'Uzupełnij dane'}</h2>
                  <p>
                    {profileDraft.role || 'Bez roli'}
                    {profileDraft.company ? ` @ ${profileDraft.company}` : ''}
                  </p>
                </div>
              </div>
              <div className="profile-hero-side">
                <div className="profile-stat-card">
                  <span>Email</span>
                  <strong>{currentUser.email}</strong>
                </div>
                <div className="profile-stat-card">
                  <span>Typ konta</span>
                  <strong>{currentUser.provider === 'google' ? 'Google' : 'Lokalne'}</strong>
                </div>
              </div>
            </section>

            <div className="profile-grid">
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Account</div>
                    <h2>Dane podstawowe</h2>
                  </div>
                </div>
                <form className="stack-form" onSubmit={saveProfile}>
                  <label>
                    <span>Imię i nazwisko</span>
                    <Input
                      value={profileDraft.name}
                      onChange={(e) => setProfileDraft((p) => ({ ...p, name: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Rola i Firma</span>
                    <div className="profile-two-column-fields">
                      <Input
                        placeholder="Rola"
                        value={profileDraft.role}
                        onChange={(e) => setProfileDraft((p) => ({ ...p, role: e.target.value }))}
                      />
                      <Input
                        placeholder="Firma"
                        value={profileDraft.company}
                        onChange={(e) =>
                          setProfileDraft((p) => ({ ...p, company: e.target.value }))
                        }
                      />
                    </div>
                  </label>
                  <label>
                    <span>Bio</span>
                    <textarea
                      rows={3}
                      value={profileDraft.bio}
                      onChange={(e) => setProfileDraft((p) => ({ ...p, bio: e.target.value }))}
                    />
                  </label>
                  <button type="submit" className="primary-button">
                    Zapisz profil
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Security</div>
                    <h2>Hasło</h2>
                  </div>
                </div>
                {canManagePassword ? (
                  <form className="stack-form" onSubmit={updatePassword}>
                    <Input
                      type="password"
                      placeholder="Aktualne hasło"
                      value={passwordDraft.currentPassword}
                      onChange={(e) =>
                        setPasswordDraft((p) => ({ ...p, currentPassword: e.target.value }))
                      }
                    />
                    <Input
                      type="password"
                      placeholder="Nowe hasło"
                      value={passwordDraft.newPassword}
                      onChange={(e) =>
                        setPasswordDraft((p) => ({ ...p, newPassword: e.target.value }))
                      }
                    />
                    <button type="submit" className="secondary-button">
                      Zmień hasło
                    </button>
                    {securityMessage && (
                      <div className="inline-alert success">{securityMessage}</div>
                    )}
                  </form>
                ) : (
                  <div className="inline-alert info">Konto Google - hasło zewnętrzne.</div>
                )}
              </section>

              <section className="panel profile-grid-span-two">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Preferences</div>
                    <h2>Styl pracy</h2>
                  </div>
                </div>
                <form className="stack-form" onSubmit={saveProfile}>
                  <div className="toggle-grid">
                    <label className="toggle-card">
                      <input
                        className="ui-checkbox"
                        type="checkbox"
                        checked={profileDraft.autoTaskCapture}
                        onChange={(e) =>
                          setProfileDraft((p) => ({ ...p, autoTaskCapture: e.target.checked }))
                        }
                      />
                      <div>
                        <strong>Auto task capture</strong>
                        <span>Automatycznie wykrywaj zadania.</span>
                      </div>
                    </label>
                    <label className="toggle-card">
                      <input
                        className="ui-checkbox"
                        type="checkbox"
                        checked={profileDraft.notifyDailyDigest}
                        onChange={(e) =>
                          setProfileDraft((p) => ({ ...p, notifyDailyDigest: e.target.checked }))
                        }
                      />
                      <div>
                        <strong>Daily digest</strong>
                        <span>Codzienne podsumowanie mailowe.</span>
                      </div>
                    </label>
                    <label className="toggle-card">
                      <input
                        className="ui-checkbox"
                        type="checkbox"
                        checked={profileDraft.autoLearnSpeakerProfiles}
                        onChange={(e) =>
                          setProfileDraft((p) => ({
                            ...p,
                            autoLearnSpeakerProfiles: e.target.checked,
                          }))
                        }
                      />
                      <div>
                        <strong>Auto-learn speaker profiles</strong>
                        <span>Po zmianie nazwy mowcy zapisuj probki do profilu glosu.</span>
                      </div>
                    </label>
                  </div>
                  <label>
                    <span>Priorytetowe insighty</span>
                    <textarea
                      rows={2}
                      value={profileDraft.preferredInsights}
                      onChange={(e) =>
                        setProfileDraft((p) => ({ ...p, preferredInsights: e.target.value }))
                      }
                    />
                  </label>
                  <button type="submit" className="secondary-button">
                    Zapisz preferencje
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}

        {activeCategory === 'review' && (
          <div className="profile-category-view">
            <div className="profile-grid">
              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Calendar</div>
                    <h2>Google Calendar</h2>
                  </div>
                </div>
                <div className="integration-card">
                  <p>{integrationStatusLabel(googleCalendarStatus, googleCalendarEventsCount)}</p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={connectGoogleCalendar}
                    >
                      Połącz
                    </button>
                    <button type="button" className="ghost-button" onClick={refreshGoogleCalendar}>
                      Sync
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Calendar</div>
                    <h2>Outlook Calendar</h2>
                  </div>
                </div>
                <div className="integration-card">
                  <p>
                    {integrationStatusLabel(microsoftCalendarStatus, outlookCalendarEventsCount)}
                  </p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={connectMicrosoftCalendar}
                      disabled={!microsoftEnabled}
                    >
                      Połącz
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={disconnectMicrosoftCalendar}
                    >
                      Rozłącz
                    </button>
                  </div>
                  {!microsoftEnabled && (
                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
                      Microsoft integration not configured. Set VITE_MICROSOFT_CLIENT_ID in .env
                    </p>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Tasks</div>
                    <h2>Google Tasks</h2>
                  </div>
                </div>
                <div className="integration-card">
                  <div style={{ marginBottom: '12px' }}>
                    <Select
                      value={selectedGoogleTaskListId || ''}
                      onChange={(e) => onSelectGoogleTaskList?.(e.target.value)}
                    >
                      <option value="">Wybierz listę...</option>
                      {googleTaskLists.map((l: any) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="button-row profile-button-row-top">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={onConnectGoogleTasks}
                    >
                      Połącz
                    </button>
                    <button type="button" className="ghost-button" onClick={onRefreshGoogleTasks}>
                      Sync
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Tasks</div>
                    <h2>Microsoft To Do</h2>
                  </div>
                </div>
                <div className="integration-card">
                  <p>{microsoftTasksStatus === 'connected' ? 'Połączono' : microsoftTasksStatus}</p>
                  <div style={{ marginBottom: '12px' }}>
                    <Select
                      value={selectedMicrosoftTaskListId || ''}
                      onChange={(e) => onSelectMicrosoftTaskList?.(e.target.value)}
                    >
                      <option value="">Wybierz listę...</option>
                      {microsoftTaskLists.map((l: any) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="button-row profile-button-row-top">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={connectMicrosoftTasks}
                      disabled={!microsoftEnabled}
                    >
                      Połącz
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={disconnectMicrosoftTasks}
                    >
                      Rozłącz
                    </button>
                  </div>
                  {!microsoftEnabled && (
                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '8px' }}>
                      Microsoft integration not configured. Set VITE_MICROSOFT_CLIENT_ID in .env
                    </p>
                  )}
                </div>
              </section>

              <WorkspaceBackupSection />
            </div>
          </div>
        )}

        {activeCategory === 'tools' && (
          <div className="profile-category-view">
            <div className="profile-grid">
              <VoiceProfilesSection peopleProfiles={peopleProfiles} />
              <VocabularyManagerSection
                vocabulary={vocabulary}
                onUpdateVocabulary={onUpdateVocabulary}
              />
              <TagManagerSection
                allTags={allTags}
                onRenameTag={onRenameTag}
                onDeleteTag={onDeleteTag}
              />
              <AudioStorageSection
                audioStorageState={audioStorageState}
                onRefreshAudioStorageState={onRefreshAudioStorageState}
                onDeleteStoredRecordingAudio={onDeleteStoredRecordingAudio}
              />
            </div>
          </div>
        )}

        {activeCategory === 'review' && (
          <div className="profile-category-view profile-category-view-spaced">
            <div className="profile-grid">
              {/* Japanese Flat Design Theme Selector */}
              <section className="panel profile-grid-span-two" style={{ gridColumn: 'span 2' }}>
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">🎨 Japanese Flat Design</div>
                    <h2>Wybierz Motyw</h2>
                  </div>
                </div>
                <JapaneseThemeSelector
                  currentTheme={japaneseTheme}
                  onThemeChange={setJapaneseTheme}
                />
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Settings</div>
                    <h2>Wygląd i Layout</h2>
                  </div>
                </div>
                <div className="stack-form">
                  <div className="integration-row">
                    <span>
                      Motyw: <strong>{theme}</strong>
                    </span>
                    <div className="button-row">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onSetTheme('dark')}
                      >
                        🌙
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onSetTheme('light')}
                      >
                        ☀️
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onSetTheme('beaver')}
                      >
                        🦫
                      </button>
                    </div>
                  </div>
                  <div className="integration-row">
                    <span>
                      Zagęszczenie: <strong>{layoutPreset}</strong>
                    </span>
                    <div className="button-row">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onSetLayoutPreset?.('default')}
                      >
                        Default
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onSetLayoutPreset?.('compact')}
                      >
                        Compact
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => onSetLayoutPreset?.('flat')}
                      >
                        Flat
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Status</div>
                    <h2>Połączenie API</h2>
                  </div>
                  <span
                    className={
                      typeof navigator !== 'undefined' && navigator.onLine
                        ? 'status-chip success'
                        : 'status-chip danger'
                    }
                  >
                    {typeof navigator !== 'undefined' && navigator.onLine ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="integration-card">
                  <p>
                    Base URL: <code>{apiBaseUrl || 'localhost:3000'}</code>
                  </p>
                  <p>
                    Rola: <strong>{workspaceRole}</strong>
                  </p>
                </div>
              </section>

              <section className="panel profile-grid-span-two">
                <ChangelogSection />
              </section>
            </div>
          </div>
        )}

        {activeCategory === 'errorlog' && (
          <div className="profile-category-view profile-category-view-spaced">
            <div className="profile-grid">
              <ErrorLogSection />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
