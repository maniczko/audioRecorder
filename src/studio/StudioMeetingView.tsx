```typescript
import { useEffect, useMemo, useRef, useState, useCallback, Suspense, lazy } from 'react';
import TagInput from '../shared/TagInput';
import {
  addCustomTaskPerson,
  addCustomTaskTag,
  getCustomTaskPeople,
  getCustomTaskTags,
} from '../lib/tasks';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useMeetingsCtx } from '../context/MeetingsContext';
import StudioBriefModal from './StudioBriefModal';
import TaskCreateModal from '../tasks/TaskCreateModal';
import Modal from '../shared/Modal';
import { ChevronDown, PenTool } from 'lucide-react';

import PropTypes from 'prop-types';
import { formatDateTime, formatDuration } from '../lib/storage';
import { getSpeakerColor } from '../lib/speakerColors';
import { labelSpeaker } from '../lib/recording';
import { analyzeSpeakingStyle } from '../lib/speakerAnalysis';
import { buildSketchnoteSvg } from '../lib/sketchnote';
import { normalizeMeetingFeedback } from '../shared/meetingFeedback';
import { apiRequest } from '../services/httpClient';
import { remoteApiEnabled } from '../services/config';
import { RecordingPipelineStatus } from '../components/RecordingPipelineStatus';
import '../styles/studio.css';
import './StudioMeetingViewStyles.css';

// Lazy load AI Task Suggestions Panel for code splitting
const AiTaskSuggestionsPanel = lazy(() => import('./AiTaskSuggestionsPanel'));

/**
 * Fireflies-style speaker picker dropdown for a single transcript segment.
 * Shows all existing speakers (checkmark on current), option to rename,
 * and option to add a new speaker slot.
 */
function SpeakerDropdown({
  seg,
  currentSpeakerId,
  speakers,
  nextSpeakerId,
  displaySpeakerNames,
  onReassign,
  onReassignAll,
  onRename,
  onClose,
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="ff-speaker-dropdown" ref={ref} role="menu">
      {speakers.map((sp) => {
        const isCurrent = sp.id === currentSpeakerId;
        return (
          <div key={sp.id} className="ff-speaker-dropdown-split">
            <button
              type="button"
              role="menuitem"
              className={`ff-speaker-dropdown-item${isCurrent ? ' current' : ''}`}
              onClick={() => {
                if (!isCurrent) onReassign(sp.id);
              }}
            >
              <span className="ff-spk-dot" style={{ background: getSpeakerColor(sp.id) }} />
              <span className="ff-spk-label">{sp.name}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

SpeakerDropdown.propTypes = {
  seg: PropTypes.object.isRequired,
  currentSpeakerId: PropTypes.string.isRequired,
  speakers: PropTypes.array.isRequired,
  nextSpeakerId: PropTypes.string,
  displaySpeakerNames: PropTypes.bool.isRequired,
  onReassign: PropTypes.func.isRequired,
  onReassignAll: PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default SpeakerDropdown;
```