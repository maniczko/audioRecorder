```typescript
import './styles/recordings.css';
import React from 'react';
import { useToast } from './shared/Toast';
import Modal from './shared/Modal';
import { formatDateTime } from './lib/storage';
import { RecordingPipelineStatus } from './components/RecordingPipelineStatus';
import { ProgressBar } from './components/ProgressBar';
import { ProcessingTimer } from './components/ProcessingTimer';
import './RecordingsTabStyles.css';

import { Input } from './ui/Input';
import { EmptyState } from './components/Skeleton';
import TagInput from './shared/TagInput';
import TagBadge from './shared/TagBadge';
import { Search, Filter, Upload, Clock, Mic2, Users, Brain } from 'lucide-react';

interface Recording {
  id: string;
  meetingId: string;
  guests: string[];
  owner: string;
  // other properties...
}

function formatPipelineDiagnostics(item: any) {
  const details: string[] = [];
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

function getMeetingAiStatus(m: { analysis: any; latestRecordingId: any; recordings: Recording[] }) {
  if (
    m.analysis &&
    (m.analysis.summary || (m.analysis.decisions && m.analysis.decisions.length > 0))
  ) {
    return 'ai';
  }
  if (m.latestRecordingId || (Array.isArray(m.recordings) && m.recordings.length > 0)) {
    const latest = Array.isArray(m.recordings)
      ? m.recordings.find((r) => r.id === m.latestRecordingId)
      : null;
    // Additional logic for handling latest recording...
  }
  return null;
}
```
