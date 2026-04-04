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
import './StudioBriefModalStyles.css';
import '../tasks/TaskDetailsPanelStyles.css'; /* Upewniamy się, że klasy unified-field i detail-row są dostępne */

export default function StudioBriefModal({
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      ariaLabel={selectedMeeting ? 'Edytuj spotkanie' : 'Nowe spotkanie'}
      hideHeader
    >
      <div className="studio-brief-modal">
        <div className="studio-brief-modal-header">
          <div>
            <div className="eyebrow">Meeting brief</div>
            <h2>{selectedMeeting ? 'Edytuj spotkanie' : 'Nowe spotkanie'}</h2>
          </div>
          <button type="button" className="studio-brief-close" onClick={onClose} title="Zamknij">
            <X size={20} />
          </button>
        </div>

        <div className="studio-brief-modal-body ms-todo" data-clarity-mask="true">
          {/* Tytuł */}
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
                value={meetingDraft.title || ''}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, title: event.target.value }))
                }
                placeholder="np. Spotkanie z klientem"
                disabled={!canEditWorkspace}
              />
            </div>
          </div>

          {/* Kontekst */}
          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Kontekst">
              <AlignLeft size={18} />
            </span>
            <span className="todo-row-label">Kontekst</span>
            <div className="todo-detail-row-fill">
              <textarea
                className="todo-detail-unified-field brief-textarea"
                rows={2}
                value={meetingDraft.context || ''}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, context: event.target.value }))
                }
                placeholder="O czym będzie to spotkanie?"
                disabled={!canEditWorkspace}
              />
            </div>
          </div>

          {/* Termin */}
          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Termin">
              <Calendar size={18} />
            </span>
            <span className="todo-row-label">Termin</span>
            <div className="todo-detail-row-fill">
              <input
                type="datetime-local"
                className="todo-detail-unified-field"
                value={meetingDraft.startsAt || ''}
                onChange={(event) =>
                  setMeetingDraft((previous) => ({ ...previous, startsAt: event.target.value }))
                }
                disabled={!canEditWorkspace}
              />
            </div>
          </div>

          {/* Czas trwania */}
          <div className="todo-detail-row field-row">
            <span className="todo-row-icon" title="Czas trwania">
              <Clock size={18} />
            </span>
            <span className="todo-row-label">Czas trwania</span>
            <div className="todo-detail-row-fill duration-picker-fill">
              <select
                className="todo-detail-unified-field"
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

          {/* Uczestnicy */}
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
                    .map((t) => t.trim())
                    .filter(Boolean)}
                  suggestions={peopleOptions}
                  onChange={(newAttendees) => {
                    setMeetingDraft((previous) => ({
                      ...previous,
                      attendees: newAttendees.join('\n'),
                    }));
                    newAttendees.forEach((t) => addCustomTaskPerson(t));
                  }}
                  placeholder="Dodaj uczestnika..."
                />
              ) : (
                <div className="brief-attendees-chips">
                  {(meetingDraft.attendees || '')
                    .split('\n')
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((person) => (
                      <span key={person} className="brief-attendee-chip">
                        {person}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Tagi */}
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
                    .map((t) => t.trim())
                    .filter(Boolean)}
                  suggestions={tagOptions}
                  onChange={(newTags) => {
                    setMeetingDraft((previous) => ({
                      ...previous,
                      tags: newTags.join(', '),
                    }));
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

          <div className="brief-advanced-divider">
            <button
              type="button"
              className="brief-advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              Dodatkowe opcje {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {showAdvanced && (
            <div className="brief-advanced-section">
              {/* Lokalizacja */}
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

              {/* Potrzeby rozmówców */}
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

              {/* Oczekiwania */}
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
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              saveMeeting();
              if (onClose) onClose();
            }}
            disabled={!canEditWorkspace || !meetingDraft.title?.trim()}
          >
            {isDetachedMeetingDraft ? 'Utwórz spotkanie' : 'Zapisz zmiany'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
