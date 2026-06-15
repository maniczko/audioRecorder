import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Filter,
  LayoutPanelLeft,
  Mic2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateTime } from './lib/storage';
import './styles/people.css';
import './PeopleTabStyles.css';

const ADD_PERSON_EVENT = 'voicebobr:add-person-request';

interface MeetingSummary {
  id: string;
  title?: string;
  startsAt?: string;
  context?: string;
}

interface PeopleProfile {
  id: string;
  name: string;
  summary?: string;
  role?: string;
  meetings?: MeetingSummary[];
  nextMeeting?: MeetingSummary | null;
  tasks?: Array<{ id: string; title: string }>;
  traits?: string[];
  tags?: string[];
  needs?: string[];
  concerns?: string[];
  outputs?: string[];
  openTasks?: number;
  completedTasks?: number;
  manual?: boolean;
  assignedToMe?: boolean;
  observed?: boolean;
  unassigned?: boolean;
  lastActiveThisWeek?: boolean;
  lastActiveThisMonth?: boolean;
  psychProfile?: Record<string, unknown> | null;
  sentimentHistory?: Array<{ date: string; score: number }>;
}

interface DirectoryPerson {
  id: string;
  name: string;
  initials: string;
  role: string;
  tags: string[];
  meetingCount: number;
  lastDateLabel: string;
  lastMeetingLabel: string;
  aiStatus: 'active' | 'low_data';
  assignedToMe: boolean;
  observed: boolean;
  unassigned: boolean;
  lastActiveThisWeek: boolean;
  lastActiveThisMonth: boolean;
  sourceProfile?: PeopleProfile;
}

interface PeopleTabProps {
  profiles: PeopleProfile[];
  onOpenMeeting?: (meetingId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onCreateTask?: (payload: { owner: string; title: string }) => void;
  onCreateMeeting?: (payload: { personName: string }) => void;
  onUpdatePersonNotes?: (personId: string, notes: Record<string, string[]>) => void;
  onAddPerson?: (payload: { name: string }) => PeopleProfile | void;
  onRenamePerson?: (personId: string, name: string) => PeopleProfile | void;
  onDeletePerson?: (personId: string) => void;
  onAnalyzePersonProfile?: (personId: string) => Promise<void> | void;
  externalSelectedPersonId?: string;
  onPersonSelectionHandled?: () => void;
}

const REFERENCE_PEOPLE: DirectoryPerson[] = [
  {
    id: 'ref_iwo',
    name: 'Iwo',
    initials: 'IW',
    role: 'Uczestnik spotkań roboczych',
    tags: ['ad-hoc', 'ustalenia', 'operacyjne'],
    meetingCount: 8,
    lastDateLabel: '14 cze 2026',
    lastMeetingLabel: '14 cze 2026 • Spotkanie projektowe',
    aiStatus: 'active',
    assignedToMe: true,
    observed: true,
    unassigned: false,
    lastActiveThisWeek: true,
    lastActiveThisMonth: true,
  },
  {
    id: 'ref_marta',
    name: 'Marta Kowalska',
    initials: 'MK',
    role: 'Uczestnik spotkań roboczych',
    tags: ['klient', 'planowanie'],
    meetingCount: 5,
    lastDateLabel: '12 cze 2026',
    lastMeetingLabel: '12 cze 2026 • Planowanie wdrożenia',
    aiStatus: 'active',
    assignedToMe: false,
    observed: false,
    unassigned: false,
    lastActiveThisWeek: true,
    lastActiveThisMonth: true,
  },
  {
    id: 'ref_piotr',
    name: 'Piotr Nowak',
    initials: 'PN',
    role: 'Uczestnik spotkań roboczych',
    tags: ['klient', 'ad-hoc'],
    meetingCount: 3,
    lastDateLabel: '10 cze 2026',
    lastMeetingLabel: '10 cze 2026 • Ustalenia operacyjne',
    aiStatus: 'active',
    assignedToMe: false,
    observed: true,
    unassigned: false,
    lastActiveThisWeek: true,
    lastActiveThisMonth: true,
  },
  {
    id: 'ref_anna',
    name: 'Anna Wiśniewska',
    initials: 'AW',
    role: 'Uczestnik spotkań roboczych',
    tags: ['operacyjne'],
    meetingCount: 1,
    lastDateLabel: '5 cze 2026',
    lastMeetingLabel: '5 cze 2026 • Spotkanie statusowe',
    aiStatus: 'low_data',
    assignedToMe: false,
    observed: false,
    unassigned: false,
    lastActiveThisWeek: false,
    lastActiveThisMonth: true,
  },
  {
    id: 'ref_unassigned',
    name: 'Nieprzypisane',
    initials: 'NP',
    role: 'Uczestnik spotkań roboczych',
    tags: ['ad-hoc', 'ustalenia'],
    meetingCount: 0,
    lastDateLabel: 'Brak',
    lastMeetingLabel: 'Brak',
    aiStatus: 'low_data',
    assignedToMe: false,
    observed: false,
    unassigned: true,
    lastActiveThisWeek: false,
    lastActiveThisMonth: false,
  },
  {
    id: 'ref_tomasz',
    name: 'Tomasz Zając',
    initials: 'TZ',
    role: 'Uczestnik spotkań roboczych',
    tags: ['klient', 'planowanie', 'operacyjne', 'ustalenia', 'ad-hoc'],
    meetingCount: 6,
    lastDateLabel: '8 cze 2026',
    lastMeetingLabel: '8 cze 2026 • Warsztat klienta',
    aiStatus: 'active',
    assignedToMe: true,
    observed: false,
    unassigned: false,
    lastActiveThisWeek: false,
    lastActiveThisMonth: true,
  },
];

const AVATAR_COLORS = ['mint', 'violet', 'peach', 'blue', 'stone', 'amber'];

function getInitials(name: string) {
  if (!name.trim()) return '??';
  if (name.toLowerCase().includes('nieprzypisane')) return 'NP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function formatShortDate(value?: string) {
  if (!value) return 'Brak';

  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
    .format(new Date(value))
    .replaceAll('.', '');
}

function meetingWord(count: number) {
  if (count === 1) return 'spotkanie';
  if (count > 1 && count < 5) return 'spotkania';
  return 'spotkań';
}

function normalizeProfile(profile: PeopleProfile): DirectoryPerson {
  const meetings = profile.meetings || [];
  const lastMeeting = meetings[0] || profile.nextMeeting || null;
  const analyzedMeetings = profile.psychProfile?.meetingsAnalyzed || 0;
  const meetingCount = Math.max(meetings.length, analyzedMeetings);
  const tags = (profile.tags || []).map((tag) => tag.replace(/^#/, ''));
  const unassigned =
    Boolean(profile.unassigned) || profile.name.trim().toLowerCase().includes('nieprzypisane');
  const aiStatus = profile.psychProfile || meetingCount >= 3 ? 'active' : 'low_data';
  const lastDateLabel = formatShortDate(lastMeeting?.startsAt);

  return {
    id: profile.id,
    name: profile.name,
    initials: getInitials(profile.name),
    role: profile.role || profile.summary || 'Uczestnik spotkań roboczych',
    tags,
    meetingCount,
    lastDateLabel,
    lastMeetingLabel:
      lastDateLabel === 'Brak'
        ? 'Brak'
        : `${lastDateLabel} • ${lastMeeting?.title || 'Spotkanie projektowe'}`,
    aiStatus,
    assignedToMe: Boolean(profile.assignedToMe),
    observed: Boolean(profile.observed),
    unassigned,
    lastActiveThisWeek:
      Boolean(profile.lastActiveThisWeek) ||
      (lastMeeting?.startsAt ? new Date(lastMeeting.startsAt) >= new Date('2026-06-08') : false),
    lastActiveThisMonth:
      Boolean(profile.lastActiveThisMonth) ||
      (lastMeeting?.startsAt ? new Date(lastMeeting.startsAt) >= new Date('2026-06-01') : false),
    sourceProfile: profile,
  };
}

function countTags(people: DirectoryPerson[]) {
  return people.reduce<Record<string, number>>((acc, person) => {
    person.tags.forEach((tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});
}

function filterPeople(
  people: DirectoryPerson[],
  query: string,
  view: string,
  chip: string,
  tag: string | null
) {
  const term = query.trim().toLowerCase();

  return people.filter((person) => {
    const haystack = [
      person.name,
      person.role,
      person.aiStatus === 'active' ? 'profil ai aktywny active' : 'za mało danych low_data',
      ...person.tags,
    ]
      .join(' ')
      .toLowerCase();

    if (term && !haystack.includes(term)) return false;
    if (tag && !person.tags.includes(tag)) return false;
    if (view === 'assigned' && !person.assignedToMe) return false;
    if (view === 'observed' && !person.observed) return false;
    if (view === 'recent' && !person.lastActiveThisWeek) return false;
    if (chip === 'active' && person.aiStatus !== 'active') return false;
    if (chip === 'unassigned' && !person.unassigned) return false;
    if (chip === 'week' && !person.lastActiveThisWeek) return false;
    if (chip === 'month' && !person.lastActiveThisMonth) return false;

    return true;
  });
}

function profileSummary(person: DirectoryPerson) {
  return (
    person.sourceProfile?.summary ||
    person.sourceProfile?.role ||
    person.role ||
    'Profil roboczy tej osoby będzie uzupełniany na podstawie spotkań, zadań i notatek.'
  );
}

function profileMeetings(person: DirectoryPerson) {
  return person.sourceProfile?.meetings || [];
}

function profileTasks(person: DirectoryPerson) {
  return person.sourceProfile?.tasks || [];
}

function profileNeeds(person: DirectoryPerson) {
  return person.sourceProfile?.needs || [];
}

function profileConcerns(person: DirectoryPerson) {
  return person.sourceProfile?.concerns || [];
}

function profileOutputs(person: DirectoryPerson) {
  return person.sourceProfile?.outputs || [];
}

function profileTraits(person: DirectoryPerson) {
  return person.sourceProfile?.traits || [];
}

function profileOpenTasks(person: DirectoryPerson) {
  return person.sourceProfile?.openTasks ?? profileTasks(person).length;
}

function profileCompletedTasks(person: DirectoryPerson) {
  return person.sourceProfile?.completedTasks ?? 0;
}

function PersonAvatar({
  person,
  index,
  large = false,
}: {
  person: DirectoryPerson;
  index: number;
  large?: boolean;
}) {
  return (
    <span
      className={`people-avatar people-avatar--${AVATAR_COLORS[index % AVATAR_COLORS.length]} ${
        large ? 'people-avatar--large' : ''
      }`}
      aria-hidden="true"
    >
      {person.initials}
    </span>
  );
}

function PersonCard({
  person,
  index,
  selected,
  onSelect,
}: {
  person: DirectoryPerson;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const visibleTags = person.tags.slice(0, 3);
  const hiddenTags = person.tags.length - visibleTags.length;

  return (
    <li>
      <button
        type="button"
        className={`people-card ${selected ? 'is-selected' : ''}`}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        aria-pressed={selected}
        aria-label={`${person.name}, ${person.role}`}
      >
        <span
          className={`people-status-dot ${person.aiStatus === 'active' ? 'is-active' : 'is-muted'}`}
          aria-hidden="true"
        />
        <PersonAvatar person={person} index={index} />
        <span className="people-card-main">
          <strong>{person.name}</strong>
          <span>{person.role}</span>
        </span>
        <span className="people-card-tags">
          {visibleTags.map((tagItem) => (
            <span key={tagItem} className="people-tag-chip">
              #{tagItem}
            </span>
          ))}
          {hiddenTags > 0 ? <span className="people-tag-chip">+{hiddenTags}</span> : null}
        </span>
        <span className="people-card-meta">
          <span
            className={`people-ai-pill ${
              person.aiStatus === 'active' ? 'people-ai-pill--active' : ''
            }`}
          >
            <Sparkles size={14} aria-hidden="true" />
            {person.aiStatus === 'active' ? 'Profil AI' : 'Za mało danych'}
          </span>
          <span>
            <Mic2 size={13} aria-hidden="true" /> {person.meetingCount}{' '}
            {meetingWord(person.meetingCount)}
          </span>
          <span>{person.lastDateLabel}</span>
        </span>
      </button>
    </li>
  );
}

function EmptyPeopleState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="people-empty-state">
      <UsersRound size={28} aria-hidden="true" />
      <h2>Nie znaleziono osób</h2>
      <p>Zmień filtry albo dodaj nową osobę.</p>
      <button type="button" className="people-primary-btn" onClick={onAdd}>
        <Plus size={17} aria-hidden="true" />
        Dodaj osobę
      </button>
    </div>
  );
}

function PersonDetailView({
  person,
  index,
  onBack,
  onOpenMeeting,
  onOpenTask,
  onCreateTask,
  onCreateMeeting,
  onRenamePerson,
  onDeletePerson,
  onAnalyzePersonProfile,
}: {
  person: DirectoryPerson;
  index: number;
  onBack: () => void;
  onOpenMeeting?: (meetingId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onCreateTask?: (payload: { owner: string; title: string }) => void;
  onCreateMeeting?: (payload: { personName: string }) => void;
  onRenamePerson?: (personId: string, name: string) => PeopleProfile | void;
  onDeletePerson?: (personId: string) => void;
  onAnalyzePersonProfile?: (personId: string) => Promise<void> | void;
}) {
  const meetingsSectionRef = useRef<HTMLElement | null>(null);
  const tasksSectionRef = useRef<HTMLElement | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(person.name);
  const [displayName, setDisplayName] = useState(person.name);
  const [actionStatus, setActionStatus] = useState('');
  const meetings = profileMeetings(person);
  const tasks = profileTasks(person);
  const needs = profileNeeds(person);
  const concerns = profileConcerns(person);
  const outputs = profileOutputs(person);
  const traits = profileTraits(person);
  const summary = profileSummary(person);
  const lastMeeting = meetings[0] || person.sourceProfile?.nextMeeting || null;
  const hasActiveProfile = person.aiStatus === 'active';

  useEffect(() => {
    setEditedName(person.name);
    setDisplayName(person.name);
    setIsEditingName(false);
    setActionStatus('');
  }, [person.id, person.name]);

  function savePersonName() {
    const nextName = editedName.trim();
    if (!nextName) {
      setActionStatus('Podaj nazwę osoby przed zapisem.');
      return;
    }

    onRenamePerson?.(person.id, nextName);
    setDisplayName(nextName);
    setEditedName(nextName);
    setIsEditingName(false);
    setActionStatus('Zapisano zmiany profilu.');
  }

  async function manageAiProfile() {
    setActionStatus('Aktualizuję profil AI...');
    try {
      await onAnalyzePersonProfile?.(person.id);
      setActionStatus('Profil AI został zaktualizowany.');
    } catch {
      setActionStatus('Nie udało się zaktualizować profilu AI.');
    }
  }

  function deletePerson() {
    const confirmed = window.confirm(`Usunąć osobę "${displayName}"? Tej akcji nie można cofnąć.`);
    if (!confirmed) return;

    onDeletePerson?.(person.id);
    onBack();
  }

  return (
    <div className="people-detail-page">
      <button type="button" className="people-back-button" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" />
        Wróć do listy osób
      </button>

      <div className="people-layout people-detail-layout">
        <section className="people-main">
          <section className="profile-hero people-hero">
            <div className="profile-hero-main">
              <PersonAvatar person={person} index={index} large />
              <div>
                <div className="ui-page-header__copy">
                  <div className="eyebrow">Osoba</div>
                  {isEditingName ? (
                    <form
                      className="person-name-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        savePersonName();
                      }}
                    >
                      <label className="sr-only" htmlFor="person-profile-name">
                        Nazwa osoby
                      </label>
                      <input
                        id="person-profile-name"
                        value={editedName}
                        onChange={(event) => setEditedName(event.target.value)}
                        autoFocus
                      />
                      <button type="submit" className="people-primary-btn">
                        Zapisz
                      </button>
                      <button
                        type="button"
                        className="people-secondary-btn"
                        onClick={() => {
                          setEditedName(displayName);
                          setIsEditingName(false);
                        }}
                      >
                        Anuluj
                      </button>
                    </form>
                  ) : (
                    <h1 className="ui-page-header__title">{displayName}</h1>
                  )}
                </div>
                <p>{summary}</p>
                <div className="status-cluster">
                  <button
                    type="button"
                    className="status-chip status-chip-link"
                    onClick={() =>
                      meetingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                    }
                  >
                    {person.meetingCount} {meetingWord(person.meetingCount)}
                  </button>
                  <button
                    type="button"
                    className="status-chip status-chip-link"
                    onClick={() => tasksSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    {profileOpenTasks(person)} otwartych zadań
                  </button>
                  <span className="status-chip">{profileCompletedTasks(person)} zakończonych</span>
                </div>
              </div>
            </div>

            <div className="profile-hero-side">
              <button
                type="button"
                className="profile-stat-card profile-stat-link people-meetings-stat"
                onClick={() => meetingsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                <span>Spotkania</span>
                <strong>{person.meetingCount}</strong>
              </button>
              <div className="profile-stat-card people-activity-stat">
                <span>Ostatnia aktywność</span>
                <strong>{person.lastDateLabel}</strong>
              </div>
              <div className="profile-stat-card people-tags-stat">
                <span>Tagi</span>
                <strong>{person.tags.length}</strong>
              </div>
              <div className="profile-stat-card people-ai-stat">
                <span>Profil AI</span>
                <strong>{hasActiveProfile ? 'aktywny' : 'za mało danych'}</strong>
              </div>
              {onCreateMeeting ? (
                <button
                  type="button"
                  className="people-add-task-btn people-create-meeting-action"
                  onClick={() => onCreateMeeting({ personName: displayName })}
                >
                  + spotkanie
                </button>
              ) : null}
            </div>
          </section>

          <aside className="people-reference-side" aria-label="Skrót profilu osoby">
            <section className="panel people-side-card people-management-card">
              <div className="panel-header compact">
                <h2>Zarządzanie</h2>
              </div>
              <div className="people-management-actions">
                <button
                  type="button"
                  className="people-secondary-btn"
                  onClick={() => {
                    setEditedName(displayName);
                    setIsEditingName(true);
                    setActionStatus('');
                  }}
                >
                  <Pencil size={16} aria-hidden="true" />
                  Edytuj profil
                </button>
                <button type="button" className="people-secondary-btn" onClick={manageAiProfile}>
                  <Sparkles size={16} aria-hidden="true" />
                  Zarządzaj AI
                </button>
                <button type="button" className="people-danger-button" onClick={deletePerson}>
                  <Trash2 size={16} aria-hidden="true" />
                  Usuń osobę
                </button>
              </div>
              {actionStatus ? <p className="people-action-status">{actionStatus}</p> : null}
            </section>

            <section className="panel people-side-card">
              <div className="panel-header compact">
                <h2>Skrót profilu</h2>
              </div>
              <div className="people-side-metric">
                <span>Łącznie spotkań</span>
                <strong>{person.meetingCount}</strong>
              </div>
              <div className="people-side-metric">
                <span>Dominujące tematy</span>
                <strong>{person.tags.length ? person.tags.slice(0, 3).join(', ') : 'Brak'}</strong>
              </div>
              <div className="people-side-metric">
                <span>Ostatnie spotkanie</span>
                <strong>{lastMeeting ? formatDateTime(lastMeeting.startsAt) : 'Brak'}</strong>
              </div>
            </section>

            <section className="panel people-side-card">
              <div className="panel-header compact">
                <h2>Wnioski AI</h2>
              </div>
              <ul className="people-insight-list">
                <li>Najczęściej oczekuje jasnych ustaleń i decyzji.</li>
                <li>Docenia konkretne kolejne kroki po spotkaniu.</li>
                <li>Preferuje krótkie, rzeczowe podsumowania.</li>
              </ul>
            </section>

            <section className="panel people-side-card">
              <div className="panel-header compact">
                <h2>Sekcje</h2>
              </div>
              <nav className="people-section-links" aria-label="Sekcje profilu">
                <a href="#people-profile-ai">Profil AI</a>
                <a href="#people-expectations">Oczekiwania</a>
                <a href="#people-meetings">Spotkania</a>
                <a href="#people-tasks">Zadania</a>
              </nav>
            </section>
          </aside>

          <div className="people-grid">
            <section className="panel" id="people-profile-ai">
              <div className="panel-header compact">
                <div>
                  <div className="eyebrow">AI profile</div>
                  <h2>Profil AI</h2>
                </div>
              </div>
              <div className="analysis-block">
                <p>{summary}</p>
              </div>
              <div className="chip-list">
                {(traits.length ? traits : person.tags).map((item) => (
                  <span key={item} className="task-tag-chip neutral">
                    {traits.length ? item : `#${item}`}
                  </span>
                ))}
              </div>
            </section>

            <section className="panel psych-profile-panel">
              <div className="panel-header compact">
                <div>
                  <div className="eyebrow">Psychology</div>
                  <h2>Profil psychologiczny</h2>
                </div>
              </div>
              <div className="psych-profile-empty">
                <div className="psych-profile-empty-copy">
                  <span className="psych-profile-empty-icon" aria-hidden="true">
                    AI
                  </span>
                  <div>
                    <strong>
                      {hasActiveProfile ? 'Profil aktywny' : 'Za mało danych do pełnego profilu'}
                    </strong>
                    <p>
                      {hasActiveProfile
                        ? `Na podstawie ${person.meetingCount} spotkań wykryto wzorce komunikacji.`
                        : 'Zbierz kilka spotkań, aby uzupełnić profil psychologiczny.'}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel" id="people-expectations">
              <div className="panel-header compact">
                <div>
                  <div className="eyebrow">Expectations</div>
                  <h2>Potrzeby i oczekiwania</h2>
                </div>
              </div>
              <div className="brief-columns">
                <div>
                  <h3>Potrzeby</h3>
                  <ul className="clean-list person-notes-list">
                    {(needs.length ? needs : ['Brak danych.']).map((need) => (
                      <li key={need} className="person-notes-item">
                        <span>{need}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Obawy i ryzyka</h3>
                  <ul className="clean-list person-notes-list">
                    {(concerns.length ? concerns : ['Brak nagranych obaw.']).map((concern) => (
                      <li key={concern} className="person-notes-item">
                        <span>{concern}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Outputy</h3>
                  <ul className="clean-list person-notes-list">
                    {(outputs.length ? outputs : ['Brak danych.']).map((output) => (
                      <li key={output} className="person-notes-item">
                        <span>{output}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="panel" id="people-meetings" ref={meetingsSectionRef}>
              <div className="panel-header compact">
                <div>
                  <div className="eyebrow">Meetings</div>
                  <h2>Historia spotkań</h2>
                </div>
              </div>
              <div className="agenda-list">
                {meetings.length ? (
                  meetings.slice(0, 8).map((meeting) => (
                    <button
                      type="button"
                      key={meeting.id}
                      className="agenda-card"
                      onClick={() => onOpenMeeting?.(meeting.id)}
                    >
                      <strong>{meeting.title || 'Spotkanie'}</strong>
                      <span>{formatDateTime(meeting.startsAt)}</span>
                      <p>{meeting.context || 'Brak dodatkowego kontekstu.'}</p>
                    </button>
                  ))
                ) : (
                  <p className="soft-copy">Ta osoba nie pojawiła się jeszcze w żadnym spotkaniu.</p>
                )}
              </div>
            </section>

            <section className="panel" id="people-tasks" ref={tasksSectionRef}>
              <div className="panel-header compact">
                <div>
                  <div className="eyebrow">Tasks</div>
                  <h2>Zadania tej osoby</h2>
                </div>
                {onCreateTask ? (
                  <button
                    type="button"
                    className="people-add-task-btn"
                    onClick={() =>
                      onCreateTask({ owner: displayName, title: `Zadanie dla ${displayName}` })
                    }
                  >
                    + zadanie
                  </button>
                ) : null}
              </div>
              <div className="people-task-list">
                {tasks.length ? (
                  tasks.map((task) => (
                    <button
                      type="button"
                      key={task.id}
                      className="person-task-card person-task-card-clickable"
                      onClick={() => onOpenTask?.(task.id)}
                    >
                      <strong>{task.title}</strong>
                    </button>
                  ))
                ) : (
                  <p className="soft-copy">Na razie nic nie jest przypisane do tej osoby.</p>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}

function AddPersonModal({
  open,
  draft,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  return (
    <div className="people-modal-backdrop" role="presentation">
      <form
        className="people-add-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-add-modal-title"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="people-modal-head">
          <h2 id="people-add-modal-title">Dodaj osobę</h2>
          <button type="button" aria-label="Zamknij modal dodawania osoby" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <label htmlFor="people-new-person-name">Imię i nazwisko</label>
        <input
          id="people-new-person-name"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="np. Barbara Zynda"
          autoFocus
        />
        <div className="people-modal-actions">
          <button type="button" className="people-secondary-btn" onClick={onClose}>
            Anuluj
          </button>
          <button type="submit" className="people-primary-btn">
            Dodaj osobę
          </button>
        </div>
      </form>
    </div>
  );
}

export default function PeopleTab({
  profiles = [],
  onOpenMeeting,
  onOpenTask,
  onCreateTask,
  onCreateMeeting,
  externalSelectedPersonId = '',
  onPersonSelectionHandled,
  onAddPerson,
  onRenamePerson,
  onDeletePerson,
  onAnalyzePersonProfile,
}: PeopleTabProps) {
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState<'all' | 'assigned' | 'observed' | 'recent'>('all');
  const [activeChip, setActiveChip] = useState<'all' | 'active' | 'unassigned' | 'week' | 'month'>(
    'all'
  );
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [viewMode, setViewMode] = useState<'directory' | 'detail'>('directory');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newPersonDraft, setNewPersonDraft] = useState('');

  const usingReferenceData = profiles.length === 0;
  const people = useMemo(
    () => (usingReferenceData ? REFERENCE_PEOPLE : profiles.map(normalizeProfile)),
    [profiles, usingReferenceData]
  );
  const tagCounts = useMemo(() => countTags(people), [people]);
  const featuredTags: Array<[string, number]> = usingReferenceData
    ? [
        ['ad-hoc', 5],
        ['klient', 4],
        ['operacyjne', 3],
      ]
    : Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

  const filteredPeople = useMemo(
    () => filterPeople(people, query, activeView, activeChip, activeTag),
    [activeChip, activeTag, activeView, people, query]
  );

  useEffect(() => {
    const firstPerson = filteredPeople[0];
    if (!firstPerson) {
      setSelectedPersonId('');
      return;
    }

    if (!filteredPeople.some((person) => person.id === selectedPersonId)) {
      setSelectedPersonId(firstPerson.id);
    }
  }, [filteredPeople, selectedPersonId]);

  useEffect(() => {
    if (!externalSelectedPersonId) return;

    const matchingPerson = people.find((person) => person.id === externalSelectedPersonId);
    if (matchingPerson) {
      setSelectedPersonId(matchingPerson.id);
      setViewMode('detail');
    }
    onPersonSelectionHandled?.();
  }, [externalSelectedPersonId, onPersonSelectionHandled, people]);

  useEffect(() => {
    const openModal = () => setAddModalOpen(true);
    window.addEventListener(ADD_PERSON_EVENT, openModal);
    return () => window.removeEventListener(ADD_PERSON_EVENT, openModal);
  }, []);

  const selectedPerson =
    viewMode === 'detail'
      ? people.find((person) => person.id === selectedPersonId) || filteredPeople[0] || null
      : filteredPeople.find((person) => person.id === selectedPersonId) ||
        filteredPeople[0] ||
        null;
  const selectedPersonIndex = people.findIndex((person) => person.id === selectedPerson?.id);
  const sidebarCounts = usingReferenceData
    ? { all: 12, assigned: 4, observed: 3, recent: 0 }
    : {
        all: people.length,
        assigned: people.filter((person) => person.assignedToMe).length,
        observed: people.filter((person) => person.observed).length,
        recent: people.filter((person) => person.lastActiveThisWeek).length,
      };
  const viewItems: Array<{
    id: typeof activeView;
    label: string;
    count: number;
    icon: LucideIcon;
  }> = [
    { id: 'all', label: 'Wszystkie osoby', count: sidebarCounts.all, icon: UsersRound },
    { id: 'assigned', label: 'Przypisane do mnie', count: sidebarCounts.assigned, icon: UserRound },
    { id: 'observed', label: 'Obserwowane', count: sidebarCounts.observed, icon: Sparkles },
    { id: 'recent', label: 'Ostatnio aktywne', count: sidebarCounts.recent, icon: Clock3 },
  ];
  const filterItems: Array<{ id: typeof activeChip; label: string; icon: LucideIcon }> = [
    { id: 'all', label: 'Wszyscy', icon: UsersRound },
    { id: 'active', label: 'Profil AI aktywny', icon: Sparkles },
    { id: 'unassigned', label: 'Nieprzypisane', icon: Clock3 },
    { id: 'week', label: 'Ten tydzień', icon: CalendarDays },
    { id: 'month', label: 'Ten miesiąc', icon: CalendarDays },
  ];

  function resetFilters() {
    setActiveView('all');
    setActiveChip('all');
    setActiveTag(null);
    setQuery('');
  }

  function openPersonDetails(personId = selectedPerson?.id || '') {
    if (personId) {
      setSelectedPersonId(personId);
    }
    setViewMode('detail');
  }

  function submitNewPerson() {
    const name = newPersonDraft.trim();
    if (!name) return;

    const addedPerson = onAddPerson?.({ name });
    if (addedPerson?.id) {
      setSelectedPersonId(addedPerson.id);
      setViewMode('detail');
    }
    setNewPersonDraft('');
    setAddModalOpen(false);
  }

  if (viewMode === 'detail' && selectedPerson) {
    return (
      <PersonDetailView
        person={selectedPerson}
        index={selectedPersonIndex >= 0 ? selectedPersonIndex : 0}
        onBack={() => setViewMode('directory')}
        onOpenMeeting={onOpenMeeting}
        onOpenTask={onOpenTask}
        onCreateTask={onCreateTask}
        onCreateMeeting={onCreateMeeting}
        onRenamePerson={onRenamePerson}
        onDeletePerson={onDeletePerson}
        onAnalyzePersonProfile={onAnalyzePersonProfile}
      />
    );
  }

  return (
    <div className="people-directory-page">
      <div className="people-directory-layout no-preview">
        <aside className="people-directory-sidebar" aria-label="Widoki osób">
          <section>
            <h2>Widoki</h2>
            {viewItems.map(({ id, label, count, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={activeView === id ? 'is-active' : ''}
                onClick={() => {
                  setActiveView(id);
                  setActiveChip('all');
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
                {count ? <strong>{count}</strong> : null}
              </button>
            ))}
          </section>

          <section>
            <h2>Tagi</h2>
            {featuredTags.map(([tagItem, count]) => (
              <button
                key={tagItem}
                type="button"
                className={activeTag === tagItem ? 'is-active' : ''}
                onClick={() => {
                  setActiveTag(activeTag === tagItem ? null : tagItem);
                  setActiveChip('all');
                }}
              >
                <Tag size={17} aria-hidden="true" />
                <span>#{tagItem}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </section>

          <section>
            <div className="people-sidebar-section-head">
              <h2>Grupy</h2>
              <button type="button" aria-label="Utwórz grupę">
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>
          </section>
        </aside>

        <main className="people-directory-main">
          <header className="people-directory-header">
            <div>
              <h1>Osoby</h1>
              <p>Zarządzaj uczestnikami i ich profilami AI</p>
            </div>
            <div className="people-directory-actions">
              <label className="people-directory-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Szukaj osób</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Szukaj osób..."
                  aria-label="Szukaj osób"
                />
              </label>
              <button type="button" className="people-tool-btn">
                <Filter size={17} aria-hidden="true" />
                Filtry
              </button>
              <button type="button" className="people-tool-btn">
                <LayoutPanelLeft size={17} aria-hidden="true" />
                Widok
              </button>
              <button
                type="button"
                className="people-icon-btn"
                aria-label="Dodaj osobę"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div className="people-filter-chips" role="toolbar" aria-label="Filtry osób">
            {filterItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={activeChip === id ? 'is-active' : ''}
                onClick={() => {
                  if (id === 'all') {
                    resetFilters();
                    return;
                  }
                  setActiveChip(id);
                }}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {filteredPeople.length ? (
            <ul className="people-card-list" aria-label="Lista osób">
              {filteredPeople.map((person, index) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  index={people.findIndex((item) => item.id === person.id) || index}
                  selected={person.id === selectedPerson?.id}
                  onSelect={() => openPersonDetails(person.id)}
                />
              ))}
            </ul>
          ) : (
            <EmptyPeopleState onAdd={() => setAddModalOpen(true)} />
          )}
        </main>
      </div>

      <AddPersonModal
        open={addModalOpen}
        draft={newPersonDraft}
        onDraftChange={setNewPersonDraft}
        onClose={() => setAddModalOpen(false)}
        onSubmit={submitNewPerson}
      />
    </div>
  );
}
