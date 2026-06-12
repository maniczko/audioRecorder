import { useState } from 'react';
import TagInput from '../shared/TagInput';
import Modal from '../shared/Modal';
import { addCustomTaskPerson, addCustomTaskTag } from '../lib/tasks';
import {
  X,
  Type,
  Calendar,
  Clock,
  Users,
  Tag,
  AlignLeft,
  MapPin,
  Target,
  ChevronDown,
  ChevronUp,
  ListTodo,
} from 'lucide-react';
import '../tasks/TaskDetailsPanelStyles.css';
import './StudioBriefModalStyles.css';

const COMMON_DURATIONS = [15, 30, 45, 60];

export default function StudioBriefModal({
  currentWorkspacePermissions,
  isDetachedMeetingDraft,
  meetingDraft,
  setMeetingDraft,
  clearMeetingDraft,
  saveMeeting,
  selectedMeeting,
  peopleOptions = [] as string[],
  tagOptions = [] as string[],
  onClose,
}) {
  const canEditWorkspace = Boolean(currentWorkspacePermissions?.canEditWorkspace);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const startsAtValue = meetingDraft.startsAt || '';
  const [datePart = '', rawTimePart = ''] = startsAtValue.split('T');
  const timePart = rawTimePart.slice(0, 5);
  const titleMissing = !meetingDraft.title?.trim();
  const dateMissing = !datePart || !timePart;
  const durationMissing = !Number(meetingDraft.durationMinutes);
  const contextLength = (meetingDraft.context || '').length;
  const isNewMeeting = !selectedMeeting || isDetachedMeetingDraft;
  const disabledReason = !canEditWorkspace
    ? 'Brak uprawnień do edycji workspace.'
    : titleMissing
      ? 'Tytuł spotkania jest wymagany.'
      : dateMissing
        ? 'Termin spotkania jest wymagany.'
        : durationMissing
          ? 'Czas trwania jest wymagany.'
          : '';
  const canSubmit = !disabledReason;

  const updateStartsAt = (nextDate: string, nextTime: string) => {
    setMeetingDraft((previous) => ({
      ...previous,
      startsAt: nextDate ? `${nextDate}T${nextTime || '09:00'}` : '',
    }));
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      ariaLabel={selectedMeeting ? 'Edytuj spotkanie' : 'Nowe spotkanie'}
      className="studio-brief-shell-card"
      bodyClassName="studio-brief-shell-body"
      hideHeader
    >
      <div className="studio-brief-modal">
        <div className="studio-brief-modal-header">
          <div>
            <div className="eyebrow">Brief spotkania</div>
            <h2>{selectedMeeting ? 'Edytuj spotkanie' : 'Nowe spotkanie'}</h2>
            <p>Dodaj szczegóły spotkania, aby AI mogło lepiej przygotować analizę.</p>
          </div>
          <button
            type="button"
            className="studio-brief-close"
            onClick={onClose}
            aria-label="Zamknij brief spotkania"
            title="Zamknij"
          >
            <X size={20} />
          </button>
        </div>

        <div className="studio-brief-modal-body ms-todo" data-clarity-mask="true">
          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Tytuł">
              <Type size={18} />
            </span>
            <span className="todo-row-label">
              Tytuł <span className="required-star">*</span>
            </span>
            <div className="todo-detail-row-fill">
              <input
                className="todo-detail-unified-field"
                aria-invalid={titleMissing}
                aria-describedby={titleMissing ? 'studio-brief-title-error' : undefined}
                value={meetingDraft.title || ''}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, title: event.target.value }))
                }
                placeholder="np. Spotkanie z klientem"
                disabled={!canEditWorkspace}
              />
              {titleMissing ? (
                <div id="studio-brief-title-error" className="studio-brief-field-error">
                  Tytuł spotkania jest wymagany.
                </div>
              ) : null}
            </div>
          </div>

          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Kontekst">
              <AlignLeft size={18} />
            </span>
            <span className="todo-row-label">Kontekst</span>
            <div className="todo-detail-row-fill">
              <textarea
                className="todo-detail-unified-field brief-textarea"
                rows={2}
                maxLength={1000}
                value={meetingDraft.context || ''}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, context: event.target.value }))
                }
                placeholder="O czym będzie to spotkanie?"
                disabled={!canEditWorkspace}
              />
              <div className="studio-brief-field-help studio-brief-field-help--split">
                <span>Im więcej kontekstu, tym lepsza analiza AI.</span>
                <span>{contextLength} / 1000</span>
              </div>
            </div>
          </div>

          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Termin">
              <Calendar size={18} />
            </span>
            <span className="todo-row-label">
              Termin <span className="required-star">*</span>
            </span>
            <div className="todo-detail-row-fill studio-brief-date-time">
              <label className="studio-brief-date-time-segment">
                <Calendar size={17} aria-hidden="true" />
                <input
                  type="date"
                  className="todo-detail-unified-field"
                  aria-label="Data spotkania"
                  aria-invalid={dateMissing}
                  value={datePart}
                  onChange={(event) => updateStartsAt(event.target.value, timePart)}
                  disabled={!canEditWorkspace}
                />
              </label>
              <span className="studio-brief-date-time-divider" aria-hidden="true" />
              <label className="studio-brief-date-time-segment">
                <Clock size={17} aria-hidden="true" />
                <input
                  type="time"
                  className="todo-detail-unified-field"
                  aria-label="Godzina spotkania"
                  aria-invalid={dateMissing}
                  value={timePart}
                  onChange={(event) => updateStartsAt(datePart, event.target.value)}
                  disabled={!canEditWorkspace || !datePart}
                />
                <ChevronDown
                  className="studio-brief-date-time-chevron"
                  size={17}
                  aria-hidden="true"
                />
              </label>
            </div>
          </div>

          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Czas trwania">
              <Clock size={18} />
            </span>
            <span className="todo-row-label">
              Czas trwania <span className="required-star">*</span>
            </span>
            <div className="todo-detail-row-fill duration-picker-fill">
              <select
                className="todo-detail-unified-field"
                aria-invalid={durationMissing}
                value={
                  COMMON_DURATIONS.includes(Number(meetingDraft.durationMinutes))
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
              {!COMMON_DURATIONS.includes(Number(meetingDraft.durationMinutes)) && (
                <input
                  type="number"
                  min="5"
                  step="5"
                  className="todo-detail-unified-field duration-custom-input"
                  value={meetingDraft.durationMinutes}
                  onChange={(event) =>
                    setMeetingDraft((previous) => ({
                      ...previous,
                      durationMinutes: event.target.value ? Number(event.target.value) : 0,
                    }))
                  }
                  disabled={!canEditWorkspace}
                  placeholder="min"
                />
              )}
            </div>
          </div>

          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Uczestnicy">
              <Users size={18} />
            </span>
            <span className="todo-row-label">Uczestnicy</span>
            <div className="todo-detail-row-fill">
              {canEditWorkspace ? (
                <TagInput
                  type="person"
                  tags={(meetingDraft.attendees || '')
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean)}
                  suggestions={peopleOptions}
                  onChange={(newAttendees) => {
                    setMeetingDraft((previous) => ({
                      ...previous,
                      attendees: newAttendees.join('\n'),
                    }));
                    newAttendees.forEach((item) => addCustomTaskPerson(item));
                  }}
                  placeholder="Dodaj uczestnika..."
                />
              ) : (
                <div className="brief-attendees-chips">
                  {(meetingDraft.attendees || '')
                    .split('\n')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((person) => (
                      <span key={person} className="brief-attendee-chip">
                        {person}
                      </span>
                    ))}
                </div>
              )}
              <div className="studio-brief-field-help">Wpisz imię, nazwisko lub e-mail</div>
            </div>
          </div>

          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Tagi">
              <Tag size={18} />
            </span>
            <span className="todo-row-label">Tagi</span>
            <div className="todo-detail-row-fill">
              {canEditWorkspace ? (
                <TagInput
                  tags={(meetingDraft.tags || '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)}
                  suggestions={tagOptions}
                  onChange={(newTags) => {
                    setMeetingDraft((previous) => ({
                      ...previous,
                      tags: newTags.join(', '),
                    }));
                    newTags.forEach((item) => addCustomTaskTag(item));
                  }}
                  placeholder="Dodaj tag..."
                />
              ) : (
                <div className="brief-attendees-chips">
                  {(meetingDraft.tags || '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span key={tag} className="brief-attendee-chip">
                        {tag}
                      </span>
                    ))}
                </div>
              )}
              <div className="studio-brief-field-help">np. ad-hoc, klient, wewnętrzne</div>
            </div>
          </div>

          <div className="brief-advanced-divider">
            <button
              type="button"
              className="brief-advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Dodatkowe opcje
              <span>Mówcy, agenda, integracje i inne</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="brief-advanced-section">
              <div className="todo-detail-row field-row">
                <span className="todo-row-icon" title="Lokalizacja">
                  <MapPin size={18} />
                </span>
                <span className="todo-row-label">Lokalizacja</span>
                <div className="todo-detail-row-fill">
                  <input
                    className="todo-detail-unified-field"
                    value={meetingDraft.location || ''}
                    onChange={(event) =>
                      setMeetingDraft((previous) => ({ ...previous, location: event.target.value }))
                    }
                    placeholder="np. Sala konferencyjna A"
                    disabled={!canEditWorkspace}
                  />
                </div>
              </div>

              <div className="todo-detail-row field-row">
                <span className="todo-row-icon" title="Potrzeby">
                  <Target size={18} />
                </span>
                <span className="todo-row-label">Potrzeby</span>
                <div className="todo-detail-row-fill">
                  <textarea
                    className="todo-detail-unified-field brief-textarea"
                    rows={2}
                    value={meetingDraft.needs || ''}
                    onChange={(event) =>
                      setMeetingDraft((previous) => ({ ...previous, needs: event.target.value }))
                    }
                    placeholder={'np. Potrzebuję wybudować dom\nChcę refinansować kredyt'}
                    disabled={!canEditWorkspace}
                  />
                </div>
              </div>

              <div className="todo-detail-row field-row">
                <span className="todo-row-icon" title="Oczekiwania">
                  <ListTodo size={18} />
                </span>
                <span className="todo-row-label">Oczekiwania</span>
                <div className="todo-detail-row-fill">
                  <textarea
                    className="todo-detail-unified-field brief-textarea"
                    rows={2}
                    value={meetingDraft.desiredOutputs || ''}
                    onChange={(event) =>
                      setMeetingDraft((previous) => ({
                        ...previous,
                        desiredOutputs: event.target.value,
                      }))
                    }
                    placeholder={'np. Kolejne kroki\nOwnerzy zadań'}
                    disabled={!canEditWorkspace}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="button-row brief-actions">
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
          <div className="studio-brief-submit-stack">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                saveMeeting();
                if (onClose) onClose();
              }}
              disabled={!canSubmit}
              data-disabled-reason={disabledReason}
              title={disabledReason || undefined}
            >
              {isNewMeeting ? 'Utwórz spotkanie' : 'Zapisz zmiany'}
            </button>
            <span className="studio-brief-footer-hint">
              {disabledReason ? 'Wypełnij wymagane pola (*)' : 'Gotowe do zapisania'}
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
