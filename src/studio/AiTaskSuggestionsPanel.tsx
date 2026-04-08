import { useState, useMemo, useEffect, useRef, memo } from 'react';
import { suggestTasksFromTranscript } from '../lib/aiTaskSuggestions';
import { createId } from '../lib/storage';
import './AiTaskSuggestionsPanelStyles.css';
import TagBadge from '../shared/TagBadge';
import TagInput from '../shared/TagInput';
import type { AiSuggestedTask } from '../shared/contracts';

const PRIORITY_LABELS = { high: 'Wysoki', medium: 'Średni', low: 'Niski' };
const PRIORITY_FLAGS = { high: 'overdue', medium: 'in-progress', low: 'neutral' };

interface EditDraft {
  title?: string;
  description?: string;
  owner?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
}

interface SuggestedTaskDraft extends AiSuggestedTask {
  _id: string;
}

interface PeopleProfileLike {
  name?: string;
  displayName?: string;
  email?: string;
}

interface RecordingLike {
  id?: string;
  meetingId?: string;
  meetingTitle?: string;
  transcript?: Array<{ speakerId?: number | string } & Record<string, unknown>>;
}

function AiTaskSuggestionsPanel({
  selectedRecording,
  displaySpeakerNames,
  peopleProfiles = [],
  onCreateTask,
  canEdit = true,
}: {
  selectedRecording?: RecordingLike | null;
  displaySpeakerNames?: Record<string, string>;
  peopleProfiles?: PeopleProfileLike[];
  onCreateTask?: (task: Record<string, unknown>) => void;
  canEdit?: boolean;
}) {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedTaskDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({});

  const peopleSuggestions = useMemo(() => {
    const names = new Set<string>();
    (peopleProfiles || []).forEach((p) => {
      const name = (p?.name || p?.displayName || '').trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [peopleProfiles]);

  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const autoTriggeredRef = useRef<string | null>(null);

  // Auto-generate suggestions when a recording with transcript becomes available
  useEffect(() => {
    const recId = selectedRecording?.id;
    const hasTranscript = (selectedRecording?.transcript?.length ?? 0) > 0;
    if (apiKey && recId && hasTranscript && status === 'idle' && autoTriggeredRef.current !== recId) {
      autoTriggeredRef.current = recId;
      handleGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecording?.id, selectedRecording?.transcript?.length, apiKey, status]);

  if (!apiKey) {
    return null;
  }

  async function handleGenerate() {
    if (!selectedRecording || status === 'loading') {
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    setSuggestions([]);

    try {
      const enrichedTranscript = (selectedRecording.transcript || []).map((seg) => ({
        ...seg,
        speakerName:
          (displaySpeakerNames || {})[String(seg.speakerId)] ||
          `Speaker ${Number(seg.speakerId || 0) + 1}`,
      }));

      const results = (await suggestTasksFromTranscript(
        enrichedTranscript,
        peopleProfiles as Array<{ name?: string; email?: string }>
      )) as AiSuggestedTask[];
      setSuggestions(results.map((task) => ({ ...task, _id: createId('sug') })));
      setStatus('done');
    } catch (error) {
      console.error('AI suggestion error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Blad generowania sugestii');
      setStatus('error');
    }
  }

  function handleApprove(suggestion: SuggestedTaskDraft) {
    if (typeof onCreateTask !== 'function') {
      return;
    }

    onCreateTask({
      title: suggestion.title || 'Zadanie AI',
      description: suggestion.description || '',
      assignedTo: suggestion.owner ? [suggestion.owner] : [],
      dueDate: suggestion.dueDate || null,
      priority: suggestion.priority || 'medium',
      tags: Array.isArray(suggestion.tags) ? suggestion.tags : [],
      sourceType: 'ai-suggestion',
      sourceMeetingId: selectedRecording?.meetingId || '',
      sourceRecordingId: selectedRecording?.id || '',
      sourceMeetingTitle: selectedRecording?.meetingTitle || 'Spotkanie',
    });

    setSuggestions((previous) => previous.filter((s) => s._id !== suggestion._id));
  }

  function handleReject(suggestionId: string) {
    setSuggestions((previous) => previous.filter((s) => s._id !== suggestionId));
  }

  function handleStartEdit(suggestion: SuggestedTaskDraft) {
    setEditingId(suggestion._id);
    setEditDraft({
      title: suggestion.title,
      description: suggestion.description || undefined,
      owner: suggestion.owner || undefined,
      dueDate: suggestion.dueDate || undefined,
      priority: suggestion.priority,
      tags: Array.isArray(suggestion.tags) ? suggestion.tags : [],
    });
  }

  function handleSaveEdit() {
    setSuggestions((previous) =>
      previous.map((s) => (s._id === editingId ? { ...s, ...editDraft } : s))
    );
    setEditingId(null);
    setEditDraft({});
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditDraft({});
  }

  return (
    <section className="panel ai-suggestions-panel">
      <div className="panel-header compact">
        <div>
          <div className="eyebrow">AI — zadania</div>
          <h2>Sugestie zadan ze spotkania</h2>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={handleGenerate}
          disabled={!selectedRecording || status === 'loading' || !canEdit}
        >
          {status === 'loading' ? 'Generowanie...' : 'Generuj sugestie AI'}
        </button>
      </div>

      {status === 'error' ? <div className="inline-alert error">{errorMessage}</div> : null}

      {status === 'done' && suggestions.length === 0 ? (
        <div className="inline-alert success">
          Brak nowych sugestii — wszystkie zatwierdzone lub brak zadan w transkrypcji.
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="ai-suggestions-list">
          <div className="ai-suggestions-count">{suggestions.length} sugestii do przejrzenia</div>
          {suggestions.map((suggestion) =>
            editingId === suggestion._id ? (
              <article key={suggestion._id} className="ai-suggestion-card editing">
                <input
                  className="ai-suggestion-input"
                  value={editDraft.title || ''}
                  onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Tytul zadania"
                />
                <textarea
                  className="ai-suggestion-textarea"
                  value={editDraft.description || ''}
                  onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={2}
                  placeholder="Opis"
                />
                <div className="ai-suggestion-meta-row" style={{ overflow: 'visible' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TagInput
                      tags={editDraft.owner ? [editDraft.owner] : []}
                      suggestions={peopleSuggestions}
                      onChange={(arr) => setEditDraft((d) => ({ ...d, owner: arr[0] || '' }))}
                      placeholder="Osoba odpowiedzialna"
                      type="person"
                    />
                  </div>
                  <input
                    className="ai-suggestion-input"
                    type="datetime-local"
                    value={editDraft.dueDate || ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, dueDate: e.target.value }))}
                  />
                  <select
                    value={editDraft.priority || 'medium'}
                    onChange={(e) =>
                      setEditDraft((d) => ({
                        ...d,
                        priority: e.target.value as 'high' | 'medium' | 'low',
                      }))
                    }
                  >
                    <option value="high">Wysoki</option>
                    <option value="medium">Średni</option>
                    <option value="low">Niski</option>
                  </select>
                </div>
                <div className="button-row">
                  <button type="button" className="primary-button small" onClick={handleSaveEdit}>
                    Zapisz
                  </button>
                  <button type="button" className="ghost-button small" onClick={handleCancelEdit}>
                    Anuluj
                  </button>
                </div>
              </article>
            ) : (
              <article key={suggestion._id} className="ai-suggestion-card">
                <div className="ai-suggestion-header">
                  <strong className="ai-suggestion-title">{suggestion.title}</strong>
                  <span
                    className={`task-flag ${PRIORITY_FLAGS[suggestion.priority || 'medium'] || 'in-progress'}`}
                  >
                    {PRIORITY_LABELS[suggestion.priority || 'medium'] || 'Sredni'}
                  </span>
                  <span className="task-flag neutral ai-badge">AI</span>
                </div>
                {suggestion.description ? (
                  <p className="ai-suggestion-desc">{suggestion.description}</p>
                ) : null}
                <div className="ai-suggestion-meta">
                  {suggestion.owner ? (
                    <span className="task-tag-chip neutral">@{suggestion.owner}</span>
                  ) : null}
                  {suggestion.dueDate ? (
                    <span className="task-tag-chip neutral">{suggestion.dueDate}</span>
                  ) : null}
                  <div
                    style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}
                  >
                    {(Array.isArray(suggestion.tags) ? suggestion.tags : []).map((tag) => (
                      <TagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="primary-button small"
                    onClick={() => handleApprove(suggestion)}
                    disabled={!canEdit}
                  >
                    Zatwierdz
                  </button>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => handleStartEdit(suggestion)}
                    disabled={!canEdit}
                  >
                    Edytuj
                  </button>
                  <button
                    type="button"
                    className="ghost-button small"
                    onClick={() => handleReject(suggestion._id)}
                  >
                    Odrzuc
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      ) : null}
    </section>
  );
}

// Memoize to prevent unnecessary re-renders when parent updates
export default memo(AiTaskSuggestionsPanel, (prevProps, nextProps) => {
  return (
    prevProps.selectedRecording === nextProps.selectedRecording &&
    prevProps.displaySpeakerNames === nextProps.displaySpeakerNames
  );
});
