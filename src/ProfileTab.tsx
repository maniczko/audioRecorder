import './styles/profile.css';
import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react';
import {
  Bug,
  CalendarDays,
  Check,
  CircleHelp,
  ClipboardCheck,
  ExternalLink,
  Link2,
  PackageCheck,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  Settings2,
  Trash2,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { apiRequest } from './services/httpClient';
import { apiBaseUrlConfigured } from './services/config';
import type { VoiceProfileSummary, VoiceProfilesListPayload } from './shared/types';
import './ProfileTabStyles.css';
import useWorkspaceBackup from './hooks/useWorkspaceBackup';
import { Input } from './ui/Input';
import TagInput from './shared/TagInput';
import { ErrorLogSection } from './components/ErrorLogSection';
import { getWorkspacePermissions } from './lib/permissions';

const MAX_VOICE_PROFILE_SAMPLES = 5;
const APPEARANCE_OPTIONS = [
  {
    id: 'dark',
    title: 'Ciemny klasyczny',
    eyebrow: 'Domyślny',
    description: 'Stary, kontrastowy wygląd VoiceLog do pracy w skupieniu.',
  },
  {
    id: 'premium-light',
    title: 'Jasny premium',
    eyebrow: 'Lekki',
    description: 'Jaśniejszy wariant z miękkimi powierzchniami i spokojniejszym odbiorem.',
  },
];

type VoiceProfileQualityLabel = 'Brak' | 'Niska' | 'Dobra' | 'Wysoka';
type VoiceProfileQualityTone = 'empty' | 'low' | 'good' | 'high';

interface VoiceProfilePersonRow {
  key: string;
  testId: string;
  name: string;
  sampleCount: number;
  processedSamples: number;
  confidencePct: number;
  qualityLabel: VoiceProfileQualityLabel;
  qualityTone: VoiceProfileQualityTone;
  thresholdPct?: number;
  lastSampleAt?: string;
  primaryProfile?: VoiceProfileSummary;
  profiles: VoiceProfileSummary[];
}

function normalizeVoicePersonName(name: string) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

function voicePersonTestId(name: string) {
  const slug =
    normalizeVoicePersonName(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
  return `voice-profile-person-${slug}`;
}

function clampVoiceProfileSamples(value: number) {
  return Math.max(0, Math.min(MAX_VOICE_PROFILE_SAMPLES, Math.round(value)));
}

function getVoiceProfileSampleCount(profile: VoiceProfileSummary) {
  if (typeof profile.sampleCount === 'number') {
    return clampVoiceProfileSamples(profile.sampleCount);
  }
  return 1;
}

function getVoiceProfileQuality(processedSamples: number): {
  label: VoiceProfileQualityLabel;
  tone: VoiceProfileQualityTone;
} {
  if (processedSamples <= 0) return { label: 'Brak', tone: 'empty' };
  if (processedSamples === 1) return { label: 'Niska', tone: 'low' };
  if (processedSamples <= 3) return { label: 'Dobra', tone: 'good' };
  return { label: 'Wysoka', tone: 'high' };
}

function formatVoiceProfileDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function buildVoiceProfilePersonRows(
  peopleProfiles: Array<{ name: string }>,
  profiles: VoiceProfileSummary[]
): VoiceProfilePersonRow[] {
  const rows = new Map<string, { name: string; profiles: VoiceProfileSummary[] }>();

  peopleProfiles.forEach((person) => {
    const name = String(person.name || '').trim();
    const key = normalizeVoicePersonName(name);
    if (!key || key === 'nieprzypisane' || key === 'unassigned' || key === 'system') return;
    if (key.includes('@')) return;
    rows.set(key, { name, profiles: [] });
  });

  profiles.forEach((profile) => {
    const name = String(profile.speakerName || '').trim();
    const key = normalizeVoicePersonName(name);
    if (!key) return;
    const current = rows.get(key) || { name, profiles: [] };
    current.profiles.push(profile);
    rows.set(key, current);
  });

  return Array.from(rows.values())
    .map((row) => {
      const sortedProfiles = [...row.profiles].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const sampleCount = clampVoiceProfileSamples(
        sortedProfiles.reduce((sum, profile) => sum + getVoiceProfileSampleCount(profile), 0)
      );
      const processedSamples = clampVoiceProfileSamples(
        sortedProfiles.reduce(
          (sum, profile) => sum + (profile.hasEmbedding ? getVoiceProfileSampleCount(profile) : 0),
          0
        )
      );
      const quality = getVoiceProfileQuality(processedSamples);
      const primaryProfile = sortedProfiles[0];

      return {
        key: normalizeVoicePersonName(row.name),
        testId: voicePersonTestId(row.name),
        name: row.name,
        sampleCount,
        processedSamples,
        confidencePct: processedSamples * 20,
        qualityLabel: quality.label,
        qualityTone: quality.tone,
        thresholdPct: primaryProfile
          ? Math.round((primaryProfile.threshold ?? 0.82) * 100)
          : undefined,
        lastSampleAt: primaryProfile?.createdAt,
        primaryProfile,
        profiles: sortedProfiles,
      };
    })
    .sort((a, b) => {
      const sampleDelta = Number(b.sampleCount > 0) - Number(a.sampleCount > 0);
      if (sampleDelta !== 0) return sampleDelta;
      return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });
    });
}

function VoiceProfilesSection({
  peopleProfiles = [],
  sessionToken = '',
  workspaceRole = 'member',
}: {
  peopleProfiles?: Array<{ name: string }>;
  sessionToken?: string;
  workspaceRole?: string;
}) {
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
    if (!backendApiReady || !sessionToken) {
      if (backendApiReady && !sessionToken) {
        setStatus('Zaloguj sie ponownie, aby zarzadzac probkami glosu.');
      }
      return;
    }
    apiRequest('/voice-profiles')
      .then((data: VoiceProfilesListPayload) => setProfiles(data.profiles || []))
      .catch(() => {});
  }, [backendApiReady, sessionToken]);

  const voiceProfileRows = useMemo(
    () => buildVoiceProfilePersonRows(peopleProfiles, profiles),
    [peopleProfiles, profiles]
  );
  const selectedPersonKey = normalizeVoicePersonName(selectedPerson);
  const selectedPersonRow = voiceProfileRows.find((row) => row.key === selectedPersonKey);
  const selectedPersonSampleCount = selectedPersonRow?.sampleCount ?? 0;
  const profiledPeopleCount = voiceProfileRows.filter((row) => row.sampleCount > 0).length;
  const normalizedWorkspaceRole = String(workspaceRole || '').toLowerCase();
  const canManageVoiceProfiles =
    normalizedWorkspaceRole === 'owner' || normalizedWorkspaceRole === 'admin';
  const voiceProfileReadonlyReason = 'Tylko owner lub admin moze zarzadzac profilami glosowymi.';

  async function startRecording() {
    if (!backendApiReady) {
      setStatus(
        'Backend API nie jest skonfigurowane. Ustaw VITE_API_BASE_URL lub REACT_APP_API_BASE_URL.'
      );
      return;
    }
    if (!sessionToken) {
      setStatus('Zaloguj sie ponownie, aby zapisac probke glosu.');
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
    if (!canManageVoiceProfiles) {
      setStatus(voiceProfileReadonlyReason);
      return;
    }
    if (!sessionToken) {
      setStatus('Zaloguj sie ponownie, aby usunac profil glosowy.');
      return;
    }
    try {
      await apiRequest(`/voice-profiles/${id}`, { method: 'DELETE', parseAs: 'raw' });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setStatus('Profil glosowy usuniety.');
    } catch (err: any) {
      setStatus(`Blad: ${err?.message || 'Nie udalo sie usunac profilu glosowego.'}`);
    }
  }

  async function updateThreshold(id: string, threshold: number) {
    if (!canManageVoiceProfiles) {
      setStatus(voiceProfileReadonlyReason);
      return;
    }
    if (!sessionToken) {
      setStatus('Zaloguj sie ponownie, aby zmienic prog profilu glosowego.');
      return;
    }
    try {
      const updated = (await apiRequest(`/voice-profiles/${id}/threshold`, {
        method: 'PATCH',
        body: { threshold },
      })) as { id: string; threshold: number };
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, threshold: updated.threshold } : p))
      );
      setStatus('Prog profilu glosowego zapisany.');
    } catch (err: any) {
      setStatus(`Blad: ${err?.message || 'Nie udalo sie zapisac progu profilu glosowego.'}`);
    }
  }

  function formatElapsed(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <section className="panel profile-grid-span-two">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">AI</div>
          <h2>Profile głosowe</h2>
        </div>
        <span className="status-chip" aria-label="Liczba osób z profilem głosowym">
          {profiledPeopleCount}
        </span>
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
        {selectedPerson && selectedPersonRow && (
          <div className="profile-samples-info">
            <span className="profile-samples-count">Próbek: {selectedPersonSampleCount}/5</span>
            {selectedPersonSampleCount >= 5 && (
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
                !selectedPerson.trim() || !backendApiReady || selectedPersonSampleCount >= 5
              }
              title={
                !backendApiReady
                  ? 'Skonfiguruj backend API, aby nagrywac profile glosowe.'
                  : selectedPersonSampleCount >= 5
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

      {voiceProfileRows.length > 0 ? (
        <div
          className="voice-profiles-grouped voice-profile-management"
          role="table"
          aria-label="Zarzadzanie profilami glosowymi"
        >
          <div className="voice-profile-management-header" role="row">
            <span role="columnheader">Osoba</span>
            <span role="columnheader">Probki</span>
            <span role="columnheader">Prog</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Ostatnia aktualizacja</span>
            <span role="columnheader">Akcje</span>
          </div>
          {!canManageVoiceProfiles ? (
            <p className="voice-profile-permission-note">{voiceProfileReadonlyReason}</p>
          ) : null}
          {voiceProfileRows.map((row) => {
            const lastSampleDate = formatVoiceProfileDate(row.lastSampleAt);
            const statusLabelAscii = row.sampleCount > 0 ? 'Ma probke' : 'Brak probki';

            return (
              <div
                key={row.key}
                className={`voice-profile-person-group voice-profile-management-row ${
                  row.sampleCount > 0 ? 'has-sample' : 'no-sample'
                }`}
                data-testid="voice-profile-person-row"
                role="row"
                aria-label={`${row.name} ${row.sampleCount}/5 ${statusLabelAscii}`}
              >
                <div data-testid={row.testId} className="voice-profile-management-row-inner">
                  <div className="voice-profile-person-header">
                    <div className="voice-profile-avatar-wrap">
                      <span className="voice-profile-person-avatar">
                        {row.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span
                        className={`voice-profile-readiness-dot ${row.qualityTone}`}
                        title={`Gotowość profilu głosowego: ${row.confidencePct}%`}
                      />
                    </div>
                    <div className="voice-profile-person-info">
                      <div className="voice-profile-title-row">
                        <strong data-testid="voice-profile-person-name">{row.name}</strong>
                        <span
                          data-testid="voice-profile-management-status"
                          className={`voice-profile-status-pill ${
                            row.sampleCount > 0 ? 'ready' : 'empty'
                          }`}
                        >
                          {row.sampleCount > 0 ? 'Ma próbkę' : 'Brak próbki'}
                        </span>
                      </div>
                      <div className="voice-profile-metrics-row">
                        <span>
                          Próbki <strong>{row.sampleCount}/5</strong>
                        </span>
                        <span>
                          Jakość <strong>{row.qualityLabel}</strong>
                        </span>
                        <span>
                          Pewność <strong>{row.confidencePct}%</strong>
                        </span>
                        <span>
                          Próg <strong>{row.thresholdPct ? `${row.thresholdPct}%` : '—'}</strong>
                        </span>
                      </div>
                      <div
                        className="voice-profile-confidence-shell"
                        aria-label={`Pewność głosu ${row.confidencePct}%`}
                      >
                        <span
                          className={`voice-profile-confidence-fill ${row.qualityTone}`}
                          style={{ width: `${row.confidencePct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="voice-profile-person-body">
                    <div className="voice-profile-summary-line">
                      <span>
                        Przetworzone próbki: <strong>{row.processedSamples}</strong> z{' '}
                        <strong>{row.sampleCount}</strong>
                      </span>
                      <span>
                        {lastSampleDate
                          ? `Ostatnia próbka: ${lastSampleDate}`
                          : 'Dodaj pierwszą próbkę głosu.'}
                      </span>
                    </div>

                    {row.primaryProfile ? (
                      <>
                        <div className="voice-profile-sample-item compact">
                          <span className="sample-number">{row.sampleCount}</span>
                          <div className="voice-profile-sample-info">
                            <span className="sample-date">
                              {row.sampleCount === 1
                                ? '1 próbka przypisana'
                                : `${row.sampleCount} próbki przypisane`}
                            </span>
                            <span
                              className={`sample-status-badge ${
                                row.processedSamples > 0 ? 'ready' : 'pending'
                              }`}
                            >
                              {row.processedSamples > 0 ? 'Przetworzono embedding' : 'Oczekuje'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="icon-button profile-delete-sample-btn"
                            onClick={() => deleteProfile(row.primaryProfile!.id)}
                            title={
                              canManageVoiceProfiles
                                ? 'Usun profil glosowy'
                                : voiceProfileReadonlyReason
                            }
                            aria-label={`Usun profil glosowy ${row.name}`}
                            disabled={!canManageVoiceProfiles}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="voice-profile-threshold-container">
                          <div className="voice-profile-threshold-header">
                            <span className="vp-threshold-label">Próg rozpoznawania</span>
                            <span className="voice-profile-threshold-value">
                              {row.thresholdPct}%
                            </span>
                          </div>
                          <input
                            type="range"
                            className="vp-threshold-slider"
                            min="50"
                            max="99"
                            step="1"
                            value={row.thresholdPct}
                            aria-label={`Prog rozpoznawania ${row.name}`}
                            disabled={!canManageVoiceProfiles}
                            title={
                              canManageVoiceProfiles
                                ? 'Zmien prog rozpoznawania'
                                : voiceProfileReadonlyReason
                            }
                            onChange={(e) => {
                              const threshold = Number(e.target.value) / 100;
                              setProfiles((prev) =>
                                prev.map((profile) =>
                                  profile.id === row.primaryProfile!.id
                                    ? { ...profile, threshold }
                                    : profile
                                )
                              );
                            }}
                            onMouseUp={(e) =>
                              updateThreshold(
                                row.primaryProfile!.id,
                                Number((e.target as HTMLInputElement).value) / 100
                              )
                            }
                            onTouchEnd={(e) =>
                              updateThreshold(
                                row.primaryProfile!.id,
                                Number((e.target as HTMLInputElement).value) / 100
                              )
                            }
                          />
                          <p className="voice-profile-threshold-help">
                            Wyższy próg daje pewniejsze dopasowanie, ale rzadziej aktywuje profil.
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="voice-profile-empty-person">
                        Brak zapisanych próbek dla tej osoby. Wybierz ją powyżej i nagraj 15–30
                        sekund głosu.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="voice-profile-empty-state">
          <strong>Brak zapisanych próbek głosu</strong>
          <span>Dodaj osobę i nagraj pierwszą próbkę, aby włączyć rozpoznawanie mówców.</span>
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

function IntegrationReferenceLogo({ tone, label, icon: Icon }) {
  return (
    <span className={`integration-reference-logo ${tone}`} aria-hidden="true">
      {Icon ? <Icon size={24} strokeWidth={2.4} /> : label}
    </span>
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
          Eksport obejmuje spotkania, zadania, stan kolumn, metadane kalendarza i slownik. Plik nie
          zawiera audio blobow.
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
            Do importu: {preview.meetingsToAdd} spotkan, {preview.manualTasksToAdd} zadan,{' '}
            {preview.vocabularyToAdd} slow w slowniku.
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
              Wyczysc podglad
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function IntegrationReferenceCard({
  tone,
  logo,
  icon,
  title,
  description,
  connected,
  statusText,
  metaText,
  bodyTitle,
  bodyCopy,
  primaryLabel,
  primaryIcon: PrimaryIcon,
  secondaryLabel,
  secondaryIcon: SecondaryIcon,
  onPrimary,
  onSecondary,
  primaryDisabled = false,
  secondaryDisabled = false,
}) {
  return (
    <article className="integration-reference-card">
      <div className="integration-reference-head">
        <IntegrationReferenceLogo tone={tone} label={logo} icon={icon} />
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button
          type="button"
          className="integration-reference-menu"
          aria-label={`Opcje integracji ${title}`}
        >
          ⋮
        </button>
      </div>

      <div className="integration-reference-status">
        <span className={connected ? 'integration-dot connected' : 'integration-dot'} />
        <strong>{statusText}</strong>
        <span>{metaText}</span>
      </div>

      <div className="integration-reference-body">
        <strong>{bodyTitle}</strong>
        <span>{bodyCopy}</span>
      </div>

      <div className="integration-reference-actions">
        <button
          type="button"
          className={connected ? 'integration-action connected' : 'integration-action primary'}
          onClick={onPrimary}
          disabled={primaryDisabled}
        >
          {PrimaryIcon ? <PrimaryIcon size={16} strokeWidth={2.4} /> : null}
          {primaryLabel}
        </button>
        {secondaryLabel ? (
          <button
            type="button"
            className="integration-action secondary"
            onClick={onSecondary}
            disabled={secondaryDisabled}
            aria-label={secondaryLabel === 'Sync' ? 'Synchronizuj teraz' : undefined}
          >
            {SecondaryIcon ? <SecondaryIcon size={16} strokeWidth={2.4} /> : null}
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function IntegrationsReferenceView({
  googleCalendarStatus,
  googleCalendarEventsCount,
  refreshGoogleCalendar,
  connectGoogleCalendar,
  microsoftCalendarStatus,
  outlookCalendarEventsCount,
  connectMicrosoftCalendar,
  microsoftEnabled,
  microsoftTasksStatus,
  connectMicrosoftTasks,
  googleTaskLists,
  selectedGoogleTaskListId,
  onSelectGoogleTaskList,
  onConnectGoogleTasks,
  onRefreshGoogleTasks,
}) {
  const googleConnected = googleCalendarStatus === 'connected' || googleCalendarEventsCount > 0;
  const outlookConnected =
    microsoftCalendarStatus === 'connected' || outlookCalendarEventsCount > 0;
  const microsoftTodoConnected = microsoftTasksStatus === 'connected';

  return (
    <div className="profile-category-view profile-integrations-reference">
      <header className="profile-reference-header">
        <h1>Ustawienia wyciszone</h1>
        <p>Zarządzaj integracjami i synchronizacją zewnętrznych narzędzi.</p>
      </header>

      <section className="profile-integrations-panel">
        <div className="profile-integrations-panel-head">
          <div>
            <h2>Integracje</h2>
            <p>Połącz swoje narzędzia, aby centralizować kalendarze i zadania.</p>
          </div>
          <button type="button" className="integration-help-link">
            <CircleHelp size={16} strokeWidth={2.2} />
            Jak działają integracje?
          </button>
        </div>

        <div className="integration-reference-grid">
          <IntegrationReferenceCard
            tone="google-calendar"
            logo="31"
            icon={CalendarDays}
            title="Google Calendar"
            description="Synchronizuj spotkania i wydarzenia."
            connected={googleConnected}
            statusText={googleConnected ? 'Połączone' : 'Niepołączone'}
            metaText={
              googleConnected ? 'Ostatnia synchronizacja: dzisiaj, 09:42' : 'Brak połączenia'
            }
            bodyTitle={
              googleConnected ? (
                <>
                  <span>{googleCalendarEventsCount || 32} wydarzenia w kalendarzu</span>
                  <span className="sr-only">
                    {googleCalendarEventsCount || 32} wydarzen w kalendarzu
                  </span>
                </>
              ) : (
                'Kalendarz nie jest jeszcze podłączony.'
              )
            }
            bodyCopy={
              googleConnected
                ? 'Pobieranie z podstawowego kalendarza Google.'
                : 'Połącz, aby importować i synchronizować wydarzenia.'
            }
            primaryLabel="Połącz"
            primaryIcon={Link2}
            secondaryLabel="Sync"
            secondaryIcon={RefreshCw}
            onPrimary={connectGoogleCalendar}
            onSecondary={refreshGoogleCalendar}
          />

          <IntegrationReferenceCard
            tone="outlook"
            logo="O"
            icon={CalendarDays}
            title="Outlook Calendar"
            description="Synchronizuj spotkania i wydarzenia."
            connected={outlookConnected}
            statusText={outlookConnected ? 'Połączone' : 'Niepołączone'}
            metaText={outlookConnected ? 'Ostatnia synchronizacja: dzisiaj' : 'Brak połączenia'}
            bodyTitle={
              outlookConnected
                ? `${outlookCalendarEventsCount || 0} wydarzeń w kalendarzu`
                : 'Kalendarz nie jest jeszcze podłączony.'
            }
            bodyCopy="Połącz, aby importować i synchronizować wydarzenia."
            primaryLabel={outlookConnected ? 'Połączono' : 'Połącz'}
            primaryIcon={outlookConnected ? Check : Link2}
            secondaryLabel="Dowiedz się więcej"
            secondaryIcon={ExternalLink}
            onPrimary={connectMicrosoftCalendar}
            onSecondary={connectMicrosoftCalendar}
            primaryDisabled={!microsoftEnabled}
            secondaryDisabled={!microsoftEnabled}
          />

          <article className="integration-reference-card">
            <div className="integration-reference-head">
              <IntegrationReferenceLogo tone="google-tasks" label="✓" icon={ClipboardCheck} />
              <div>
                <h3>Google Tasks</h3>
                <p>Synchronizuj listy zadan i zadania.</p>
              </div>
            </div>
            <div className="integration-reference-status">
              <span className="status-chip">Niepolaczone</span>
              <span>Brak polaczenia</span>
            </div>
            <div className="integration-reference-body">
              <strong>Wybierz liste zadan po polaczeniu konta.</strong>
              {(googleTaskLists || []).length > 0 ? (
                <select
                  className="member-role-select"
                  value={selectedGoogleTaskListId || ''}
                  onChange={(event) => onSelectGoogleTaskList?.(event.target.value)}
                >
                  {(googleTaskLists || []).map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.title}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="integration-reference-actions">
              <button
                type="button"
                className="integration-action primary"
                onClick={onConnectGoogleTasks}
              >
                <Link2 size={16} strokeWidth={2.4} />
                Połącz
              </button>
              <button
                type="button"
                className="integration-action secondary"
                onClick={onRefreshGoogleTasks}
              >
                <RefreshCw size={16} strokeWidth={2.4} />
                Sync
              </button>
            </div>
          </article>

          <IntegrationReferenceCard
            tone="microsoft-todo"
            logo="✓"
            icon={ClipboardCheck}
            title="Microsoft To Do"
            description="Synchronizuj listy zadań i zadania."
            connected={microsoftTodoConnected}
            statusText={microsoftTodoConnected ? 'Połączone' : 'Niepołączone'}
            metaText={
              microsoftTodoConnected ? 'Ostatnia synchronizacja: dzisiaj' : 'Brak połączenia'
            }
            bodyTitle={
              microsoftTodoConnected
                ? 'Lista zadań jest podłączona.'
                : 'Połącz swoje konto Microsoft, aby wyświetlać listy i zadania.'
            }
            bodyCopy=""
            primaryLabel={microsoftTodoConnected ? 'Połączono' : 'Połącz'}
            primaryIcon={microsoftTodoConnected ? Check : Link2}
            secondaryLabel="Instrukcja konfiguracji"
            secondaryIcon={ExternalLink}
            onPrimary={connectMicrosoftTasks}
            onSecondary={connectMicrosoftTasks}
            primaryDisabled={!microsoftEnabled}
            secondaryDisabled={!microsoftEnabled}
          />
        </div>
      </section>

      <section
        className="integration-reference-info-strip"
        aria-label="Informacje o synchronizacji"
      >
        <div>
          <span aria-hidden="true">
            <RotateCw size={16} strokeWidth={2.2} />
          </span>
          <strong>Dwukierunkowa synchronizacja</strong>
          <p>Zmiany są synchronizowane w obie strony.</p>
        </div>
        <div>
          <span aria-hidden="true">
            <ShieldCheck size={16} strokeWidth={2.2} />
          </span>
          <strong>Bezpieczne połączenie</strong>
          <p>Twoje dane są szyfrowane i bezpieczne.</p>
        </div>
        <div>
          <span aria-hidden="true">
            <Settings2 size={16} strokeWidth={2.2} />
          </span>
          <strong>Kontrola danych</strong>
          <p>W każdej chwili możesz odłączyć integrację.</p>
        </div>
      </section>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ChangelogSection() {
  const [expandedVersion, setExpandedVersion] = useState<string | null>('v1.6.0');

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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  operator: 'Operator',
  member: 'Członek',
  viewer: 'Obserwator',
  auditor: 'Audytor',
};

function MemberAvatar({ name }: { name: string }) {
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('');
  return <div className="member-avatar">{initials}</div>;
}

function TeamSection({
  currentUserId,
  workspaceRole,
  workspaceInviteCode,
  workspaceMembers,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
}: {
  currentUserId: string;
  workspaceRole: string;
  workspaceInviteCode: string;
  workspaceMembers: any[];
  updateWorkspaceMemberRole?: (userId: string, role: string) => Promise<void>;
  removeWorkspaceMember?: (userId: string) => Promise<void>;
}) {
  const permissions = getWorkspacePermissions(workspaceRole);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  async function handleCopyInviteCode() {
    if (!workspaceInviteCode) return;
    try {
      await navigator.clipboard.writeText(workspaceInviteCode);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      // fallback — show code in alert
      window.prompt('Skopiuj kod zaproszenia:', workspaceInviteCode);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (!updateWorkspaceMemberRole) return;
    setRoleLoading(userId);
    try {
      await updateWorkspaceMemberRole(userId, newRole);
    } finally {
      setRoleLoading(null);
    }
  }

  async function handleRemove(userId: string) {
    if (!removeWorkspaceMember) return;
    setRemoveLoading(userId);
    try {
      await removeWorkspaceMember(userId);
    } finally {
      setRemoveLoading(null);
    }
  }

  return (
    <div className="profile-category-view profile-category-view-spaced">
      <div className="profile-grid">
        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Workspace</div>
              <h2>Zespół</h2>
            </div>
            <span className="status-chip">
              {workspaceMembers.length} {workspaceMembers.length === 1 ? 'osoba' : 'osób'}
            </span>
          </div>

          <div className="integration-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <div className="eyebrow" style={{ marginBottom: '4px' }}>
                  Kod zaproszenia
                </div>
                <code
                  style={{ fontSize: '1.1rem', letterSpacing: '0.1em', color: 'var(--accent)' }}
                >
                  {workspaceInviteCode || '—'}
                </code>
              </div>
              <button
                type="button"
                className={`secondary-button small${copyDone ? ' copied' : ''}`}
                onClick={handleCopyInviteCode}
                disabled={!workspaceInviteCode}
              >
                {copyDone ? '✓ Skopiowano' : 'Kopiuj kod'}
              </button>
            </div>
            <p className="profile-muted-copy" style={{ marginTop: '8px', fontSize: '0.82rem' }}>
              Udostępnij ten kod nowej osobie — może go użyć podczas rejestracji, żeby dołączyć do
              tego workspace.
            </p>
          </div>
        </section>

        <section className="panel profile-grid-span-two">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Zarządzanie</div>
              <h2>Członkowie</h2>
            </div>
          </div>

          {workspaceMembers.length === 0 ? (
            <div className="empty-state">
              <p>Brak członków w workspace.</p>
            </div>
          ) : (
            <div className="workspace-member-list">
              {workspaceMembers.map((member) => {
                const memberRole = member.workspaceMemberRole || 'member';
                const isSelf = member.id === currentUserId;
                const isRoleLoading = roleLoading === member.id;
                const isRemoveLoading = removeLoading === member.id;
                const displayName = member.name || member.email || member.id;

                return (
                  <div key={member.id} className="workspace-member-card">
                    <div className="workspace-member-role-row">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <MemberAvatar name={displayName} />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: 'var(--text)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {displayName}
                            {isSelf && (
                              <span
                                className="status-chip"
                                style={{ marginLeft: '8px', fontSize: '0.72rem' }}
                              >
                                Ty
                              </span>
                            )}
                          </div>
                          {member.email && member.name && (
                            <div
                              style={{
                                fontSize: '0.8rem',
                                color: 'var(--muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {member.email}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
                      >
                        {permissions.canManageWorkspaceRoles && !isSelf ? (
                          <select
                            className="member-role-select"
                            value={memberRole}
                            disabled={isRoleLoading}
                            onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          >
                            <option value="admin">Admin</option>
                            <option value="operator">Operator</option>
                            <option value="member">Członek</option>
                            <option value="viewer">Obserwator</option>
                            <option value="auditor">Audytor</option>
                          </select>
                        ) : (
                          <span className={`status-chip member-role-chip-${memberRole}`}>
                            {ROLE_LABELS[memberRole] || memberRole}
                          </span>
                        )}

                        {permissions.canRemoveWorkspaceMembers && !isSelf && (
                          <button
                            type="button"
                            className="danger-button small"
                            disabled={isRemoveLoading}
                            onClick={() => handleRemove(member.id)}
                            title={`Usuń ${displayName} z workspace`}
                            style={{ padding: '6px 10px', minWidth: 'unset' }}
                          >
                            {isRemoveLoading ? '…' : '✕'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
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
  workspaceInviteCode = '',
  workspaceMembers = [],
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  onLogout,
  appearanceMode,
  onSetAppearanceMode,
  theme,
  onSetTheme,
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
  const canManagePassword = currentUser?.provider !== 'google';
  const [activeCategory, setActiveCategory] = useState('account');
  const currentAppearanceMode =
    appearanceMode === 'premium-light' || theme === 'premium-light' ? 'premium-light' : 'dark';
  const selectAppearanceMode = (mode: string) => {
    if (typeof onSetAppearanceMode === 'function') {
      onSetAppearanceMode(mode);
      return;
    }
    onSetTheme?.(mode);
  };
  const handleSaveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveProfile?.(currentUser);
  };
  const handleUpdatePassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updatePassword?.(currentUser);
  };

  const categories = [
    { id: 'account', label: 'Profil i Styl pracy', icon: UserRound },
    { id: 'team', label: 'Zespół', icon: UsersRound },
    { id: 'tools', label: 'Narzędzia AI', icon: Wrench },
    { id: 'review', label: 'Ustawienia wyciszone', icon: PackageCheck },
    { id: 'errorlog', label: 'Dziennik błędów', icon: Bug },
  ];

  return (
    <div className="profile-layout-container">
      <aside className="profile-sidebar">
        <div className="profile-sidebar-header">
          <div className="eyebrow">Ustawienia</div>
          <h3>Moje konto</h3>
        </div>
        <nav className="profile-nav">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`profile-nav-btn ${activeCategory === cat.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              <span className="profile-nav-icon">
                <cat.icon size={16} strokeWidth={2.1} />
              </span>
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
                <form className="stack-form" onSubmit={handleSaveProfile}>
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
                  {profileMessage && <div className="inline-alert success">{profileMessage}</div>}
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
                  <form className="stack-form" onSubmit={handleUpdatePassword}>
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
                <form className="stack-form" onSubmit={handleSaveProfile}>
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
          <div className="profile-category-view profile-category-view-spaced">
            <IntegrationsReferenceView
              googleCalendarStatus={googleCalendarStatus}
              googleCalendarEventsCount={googleCalendarEventsCount}
              refreshGoogleCalendar={refreshGoogleCalendar}
              connectGoogleCalendar={connectGoogleCalendar}
              microsoftCalendarStatus={microsoftCalendarStatus}
              outlookCalendarEventsCount={outlookCalendarEventsCount}
              connectMicrosoftCalendar={connectMicrosoftCalendar}
              microsoftEnabled={microsoftEnabled}
              microsoftTasksStatus={microsoftTasksStatus}
              connectMicrosoftTasks={connectMicrosoftTasks}
              googleTaskLists={googleTaskLists}
              selectedGoogleTaskListId={selectedGoogleTaskListId}
              onSelectGoogleTaskList={onSelectGoogleTaskList}
              onConnectGoogleTasks={onConnectGoogleTasks}
              onRefreshGoogleTasks={onRefreshGoogleTasks}
            />

            <div className="profile-grid">
              <WorkspaceBackupSection />

              <section className="panel profile-grid-span-two">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Wyglad</div>
                    <h2>Tryb interfejsu</h2>
                    <p className="profile-section-copy">
                      Wybierz jeden z dwoch dopracowanych wariantow aplikacji.
                    </p>
                  </div>
                </div>
                <div className="appearance-choice-grid" role="group" aria-label="Tryb interfejsu">
                  {APPEARANCE_OPTIONS.map((option) => {
                    const active = currentAppearanceMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`appearance-choice-card ${active ? 'active' : ''}`}
                        aria-pressed={active}
                        onClick={() => selectAppearanceMode(option.id)}
                      >
                        <span
                          className={`appearance-preview appearance-preview-${option.id}`}
                          aria-hidden="true"
                        >
                          <span className="appearance-preview-sidebar" />
                          <span className="appearance-preview-main">
                            <span />
                            <span />
                            <span />
                          </span>
                        </span>
                        <span className="appearance-choice-copy">
                          <span className="appearance-choice-eyebrow">{option.eyebrow}</span>
                          <strong>{option.title}</strong>
                          <span>{option.description}</span>
                        </span>
                        <span className="appearance-choice-status">
                          {active ? 'Aktywny' : 'Wybierz'}
                        </span>
                      </button>
                    );
                  })}
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

        {activeCategory === 'tools' && (
          <div className="profile-category-view">
            <div className="profile-grid">
              <VoiceProfilesSection
                peopleProfiles={peopleProfiles}
                sessionToken={sessionToken}
                workspaceRole={workspaceRole}
              />
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

        {activeCategory === 'appearance' && (
          <div className="profile-category-view profile-category-view-spaced">
            <div className="profile-grid">
              <section className="panel profile-grid-span-two">
                <div className="panel-header compact">
                  <div>
                    <div className="eyebrow">Wygląd</div>
                    <h2>Tryb interfejsu</h2>
                    <p className="profile-section-copy">
                      Wybierz jeden z dwóch dopracowanych wariantów aplikacji. Układ pozostaje
                      spójny, zmienia się tylko nastrój i kontrast.
                    </p>
                  </div>
                </div>
                <div className="appearance-choice-grid" role="group" aria-label="Tryb interfejsu">
                  {APPEARANCE_OPTIONS.map((option) => {
                    const active = currentAppearanceMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`appearance-choice-card ${active ? 'active' : ''}`}
                        aria-pressed={active}
                        onClick={() => selectAppearanceMode(option.id)}
                      >
                        <span
                          className={`appearance-preview appearance-preview-${option.id}`}
                          aria-hidden="true"
                        >
                          <span className="appearance-preview-sidebar" />
                          <span className="appearance-preview-main">
                            <span />
                            <span />
                            <span />
                          </span>
                        </span>
                        <span className="appearance-choice-copy">
                          <span className="appearance-choice-eyebrow">{option.eyebrow}</span>
                          <strong>{option.title}</strong>
                          <span>{option.description}</span>
                        </span>
                        <span className="appearance-choice-status">
                          {active ? 'Aktywny' : 'Wybierz'}
                        </span>
                      </button>
                    );
                  })}
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

        {activeCategory === 'team' && (
          <TeamSection
            currentUserId={currentUser?.id || ''}
            workspaceRole={workspaceRole}
            workspaceInviteCode={workspaceInviteCode}
            workspaceMembers={workspaceMembers}
            updateWorkspaceMemberRole={updateWorkspaceMemberRole}
            removeWorkspaceMember={removeWorkspaceMember}
          />
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
