import { useState, useRef } from 'react';
import { formatDateTime, formatDuration } from '../lib/storage';
import { RecordingPipelineStatus } from '../components/RecordingPipelineStatus';
import TagInput from '../shared/TagInput';
import { addCustomTaskPerson, addCustomTaskTag } from '../lib/tasks';
import './StudioSidebarStyles.css';

export default function StudioSidebar({
  currentWorkspacePermissions,
  isDetachedMeetingDraft,
  meetingDraft,
  setMeetingDraft,
  activeStoredMeetingDraft,
  clearMeetingDraft,
  saveMeeting,
  startNewMeetingDraft,
  workspaceMessage,
  selectedMeeting,
  peopleOptions = [],
  tagOptions = [],
  userMeetings = [],
  selectMeeting,
  selectedRecordingId,
  setSelectedRecordingId,
  onClose,
}) {
  const canEditWorkspace = Boolean(currentWorkspacePermissions?.canEditWorkspace);
  const [activeSection, setActiveSection] = useState('basic');
  const [attendeeInput, setAttendeeInput] = useState('');
  const [showAttendeeSuggestions, setShowAttendeeSuggestions] = useState(false);
  const attendeeWrapRef = useRef(null);

  return (
    <aside className="workspace-sidebar">
      <section className="panel">
        <div className="panel-header compact">
          <div>
            <div className="eyebrow">Meeting brief</div>
            <h2>{selectedMeeting ? 'Edytuj spotkanie' : 'Nowe spotkanie'}</h2>
          </div>
        </div>

        <div className="brief-tab-bar">
          <button
            type="button"
            className={activeSection === 'basic' ? 'brief-tab active' : 'brief-tab'}
            onClick={() => setActiveSection('basic')}
          >
            Podstawowe
          </button>
          <button
            type="button"
            className={activeSection === 'advanced' ? 'brief-tab active' : 'brief-tab'}
            onClick={() => setActiveSection('advanced')}
          >
            Szczegóły
          </button>
        </div>

        {activeSection === 'basic' ? (
          <div className="stack-form brief-form-section">
            <label>
              <span>
                Tytuł <span className="required-star">*</span>
              </span>
              <input
                value={meetingDraft.title}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, title: event.target.value }))
                }
                placeholder="np. Spotkanie z klientem"
                disabled={!canEditWorkspace}
              />
            </label>
            <label>
              <span>Kontekst</span>
              <textarea
                rows={3}
                value={meetingDraft.context}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, context: event.target.value }))
                }
                placeholder="O czym będzie to spotkanie?"
                disabled={!canEditWorkspace}
              />
            </label>
            <label className="full">
              <span>Termin</span>
              <input
                type="datetime-local"
                value={meetingDraft.startsAt}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, startsAt: event.target.value }))
                }
                disabled={!canEditWorkspace}
              />
            </label>
            <label>
              <span>Czas trwania</span>
              <div className="duration-picker">
                <select
                  value={
                    [15, 30, 45, 60].includes(Number(meetingDraft.durationMinutes))
                      ? String(meetingDraft.durationMinutes)
                      : 'custom'
                  }
                  onChange={(event) => {
                    if (event.target.value !== 'custom') {
                      setMeetingDraft((previous) => ({
                        ...previous,
                        durationMinutes: Number(event.target.value),
                      }));
                    }
                  }}
                  disabled={!canEditWorkspace}
                >
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 godz</option>
                  <option value="custom">Własny czas</option>
                </select>
                {![15, 30, 45, 60].includes(Number(meetingDraft.durationMinutes)) && (
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={meetingDraft.durationMinutes}
                    onChange={(event) =>
                      setMeetingDraft((previous) => ({
                        ...previous,
                        durationMinutes: event.target.value,
                      }))
                    }
                    disabled={!canEditWorkspace}
                    placeholder="min"
                    className="duration-custom-input"
                  />
                )}
              </div>
            </label>
            <div className="brief-attendees-field">
              <span className="brief-field-label">Uczestnicy</span>
              <div className="brief-attendees-chips">
                {(meetingDraft.attendees || '')
                  .split('\n')
                  .filter(Boolean)
                  .map((name) => (
                    <span key={name} className="brief-attendee-chip">
                      {name}
                      <button
                        type="button"
                        className="brief-attendee-remove"
                        onClick={() =>
                          setMeetingDraft((previous) => ({
                            ...previous,
                            attendees: (previous.attendees || '')
                              .split('\n')
                              .filter((n) => n.trim() && n.trim() !== name.trim())
                              .join('\n'),
                          }))
                        }
                        disabled={!canEditWorkspace}
                      >
                        ×
                      </button>
                    </span>
                  ))}
              </div>
              {canEditWorkspace && (
                <div className="brief-attendee-input-wrap" ref={attendeeWrapRef}>
                  <input
                    value={attendeeInput}
                    onChange={(e) => {
                      setAttendeeInput(e.target.value);
                      setShowAttendeeSuggestions(true);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ',') && attendeeInput.trim()) {
                        e.preventDefault();
                        const name = attendeeInput.trim().replace(/,$/, '');
                        setMeetingDraft((previous) => ({
                          ...previous,
                          attendees: previous.attendees
                            ? previous.attendees.trim() + '\n' + name
                            : name,
                        }));
                        // Persist custom person to localStorage
                        addCustomTaskPerson(name);
                        setAttendeeInput('');
                        setShowAttendeeSuggestions(false);
                      } else if (e.key === 'Escape') {
                        setShowAttendeeSuggestions(false);
                      }
                    }}
                    onFocus={() => setShowAttendeeSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowAttendeeSuggestions(false), 150)}
                    placeholder="Dodaj uczestnika..."
                    className="brief-attendee-input"
                  />
                  {showAttendeeSuggestions &&
                    peopleOptions.filter(
                      (p) =>
                        p.toLowerCase().includes(attendeeInput.toLowerCase()) &&
                        !(meetingDraft.attendees || '')
                          .split('\n')
                          .map((n) => n.trim())
                          .includes(p)
                    ).length > 0 && (
                      <div className="attendee-suggestions-dropdown">
                        {peopleOptions
                          .filter(
                            (p) =>
                              p.toLowerCase().includes(attendeeInput.toLowerCase()) &&
                              !(meetingDraft.attendees || '')
                                .split('\n')
                                .map((n) => n.trim())
                                .includes(p)
                          )
                          .map((person) => (
                            <button
                              key={person}
                              type="button"
                              className="attendee-suggestion-item"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setMeetingDraft((previous) => ({
                                  ...previous,
                                  attendees: previous.attendees
                                    ? previous.attendees.trim() + '\n' + person
                                    : person,
                                }));
                                setAttendeeInput('');
                                setShowAttendeeSuggestions(false);
                              }}
                            >
                              {person}
                            </button>
                          ))}
                      </div>
                    )}
                </div>
              )}
            </div>
            <div className="brief-attendees-field">
              <span className="brief-field-label">Tagi</span>
              {canEditWorkspace ? (
                <TagInput
                  tags={(meetingDraft.tags || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)}
                  suggestions={tagOptions}
                  onChange={(newTags) => {
                    setMeetingDraft((previous) => ({
                      ...previous,
                      tags: newTags.join(', '),
                    }));
                    // Persist custom tags to localStorage
                    newTags.forEach((t) => addCustomTaskTag(t));
                  }}
                  placeholder="Dodaj tag..."
                />
              ) : (
                <div className="brief-attendees-chips">
                  {(meetingDraft.tags || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag} className="brief-attendee-chip">
                        {tag}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="stack-form brief-form-section">
            <label>
              <span>Potrzeby rozmówców</span>
              <textarea
                rows={3}
                value={meetingDraft.needs}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, needs: event.target.value }))
                }
                placeholder={'np. Potrzebuję wybudować dom\nChcę refinansować kredyt'}
                disabled={!canEditWorkspace}
              />
            </label>
            <label>
              <span>Co wyciagnac po spotkaniu</span>
              <textarea
                rows={3}
                value={meetingDraft.desiredOutputs}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({
                    ...previous,
                    desiredOutputs: event.target.value,
                  }))
                }
                placeholder={'np. Kolejne kroki\nOwnerzy zadan'}
                disabled={!canEditWorkspace}
              />
            </label>
            <label>
              <span>Lokalizacja</span>
              <input
                value={meetingDraft.location}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, location: event.target.value }))
                }
                placeholder="np. Sala konferencyjna A"
                disabled={!canEditWorkspace}
              />
            </label>
          </div>
        )}

        <div className="button-row brief-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              saveMeeting();
              if (onClose) onClose();
            }}
            disabled={!canEditWorkspace || !meetingDraft.title?.trim()}
          >
            {isDetachedMeetingDraft ? 'Zapisz' : 'Zapisz zmiany'}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              clearMeetingDraft();
              if (onClose) onClose();
            }}
            disabled={!canEditWorkspace}
          >
            Anuluj
          </button>
        </div>
      </section>

      <RecordingsSidebarPanel
        userMeetings={userMeetings}
        selectedMeeting={selectedMeeting}
        selectedRecordingId={selectedRecordingId}
        selectMeeting={selectMeeting}
        setSelectedRecordingId={setSelectedRecordingId}
      />
    </aside>
  );
}

function RecordingsSidebarPanel({
  userMeetings,
  selectedMeeting,
  selectedRecordingId,
  selectMeeting,
  setSelectedRecordingId,
}) {
  const [search, setSearch] = useState('');

  const allRecordings = userMeetings
    .flatMap((m) =>
      (m.recordings || []).map((r) => ({ ...r, meetingId: m.id, meetingTitle: m.title }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = search.trim()
    ? allRecordings.filter(
        (r) =>
          r.meetingTitle.toLowerCase().includes(search.toLowerCase()) ||
          formatDateTime(r.createdAt).includes(search)
      )
    : allRecordings;

  if (!allRecordings.length) return null;

  return (
    <section className="panel sidebar-recordings-panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">Archiwum</div>
          <h2>Nagrania</h2>
        </div>
        <span className="status-chip">{allRecordings.length}</span>
      </div>
      {allRecordings.length > 5 && (
        <input
          className="sidebar-recordings-search"
          type="search"
          placeholder="Szukaj nagrania…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <ul className="sidebar-recordings-list">
        {filtered.map((rec) => {
          const isActive = rec.id === selectedRecordingId;
          const isMeetingActive = rec.meetingId === selectedMeeting?.id;
          return (
            <li
              key={rec.id}
              className={`sidebar-recording-item${isActive ? ' active' : ''}${isMeetingActive ? ' meeting-active' : ''}`}
              onClick={() => {
                const meeting = userMeetings.find((m) => m.id === rec.meetingId);
                if (meeting && selectMeeting) selectMeeting(meeting);
                if (setSelectedRecordingId) setSelectedRecordingId(rec.id);
              }}
            >
              <div className="sidebar-recording-title">{rec.meetingTitle}</div>
              <div className="sidebar-recording-meta">
                <span>{formatDateTime(rec.createdAt)}</span>
                <span>{formatDuration(rec.duration)}</span>
                <RecordingPipelineStatus status={rec.pipelineStatus || 'done'} />
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="sidebar-recording-empty">Brak wyników</li>}
      </ul>
    </section>
  );
}
