```typescript
import { useState, useRef } from 'react';
import { formatDateTime, formatDuration } from '../lib/storage';
import { RecordingPipelineStatus } from '../components/RecordingPipelineStatus';
import TagInput from '../shared/TagInput';
import { addCustomTaskPerson, addCustomTaskTag } from '../lib/tasks';
import { X } from 'lucide-react';
import './StudioBriefModalStyles.css';

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
  const [activeSection, setActiveSection] = useState('basic');
  const [attendeeInput, setAttendeeInput] = useState('');
  const [showAttendeeSuggestions, setShowAttendeeSuggestions] = useState(false);
  const attendeeWrapRef = useRef(null);

  return (
    <div className="studio-brief-modal-overlay" onClick={onClose}>
      <div className="studio-brief-modal" onClick={(e) => e.stopPropagation()}>
        <div className="studio-brief-modal-header">
          <div>
            <div className="eyebrow">Meeting brief</div>
            <h2>{selectedMeeting ? 'Edytuj spotkanie' : 'Nowe spotkanie'}</h2>
          </div>
          <button type="button" className="studio-brief-close" onClick={onClose} title="Zamknij">
            <X size={20} />
          </button>
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
                placeholder="Dodaj kontekst"
                disabled={!canEditWorkspace}
              />
            </label>
          </div>
        ) : (
          <div className="advanced-form-section">
            {/* Advanced section content */}
          </div>
        )}
      </div>
    </div>
  );
}
```
