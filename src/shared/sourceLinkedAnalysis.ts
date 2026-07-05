import type {
  AnalysisSourceEvidence,
  AnalysisUnsupportedClaim,
  TranscriptSegment,
} from './types.js';

export type SourceLinkedArea = AnalysisUnsupportedClaim['area'];

export interface SourceLinkedClaim {
  text: string;
  sourceQuote?: string;
  segmentId?: string;
  sourceSegmentId?: string;
  timestamp?: number;
  sourceTimestamp?: number;
  speaker?: string;
  unsupported?: boolean;
  reviewReason?: string;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function compactText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeEvidence(value: unknown): AnalysisSourceEvidence {
  const item = isRecord(value) ? value : {};
  return {
    sourceQuote: compactText(item.sourceQuote || item.quote),
    segmentId: compactText(item.segmentId || item.sourceSegmentId),
    timestamp: Number.isFinite(Number(item.timestamp ?? item.sourceTimestamp))
      ? Number(item.timestamp ?? item.sourceTimestamp)
      : undefined,
    speaker: compactText(item.speaker),
    unsupported: Boolean(item.unsupported),
    reviewReason: compactText(item.reviewReason),
  };
}

function findEvidenceInTranscript(
  evidence: AnalysisSourceEvidence,
  segments: TranscriptSegment[]
): AnalysisSourceEvidence {
  if (!segments.length || evidence.segmentId || evidence.timestamp !== undefined) {
    return evidence;
  }

  const quote = compactText(evidence.sourceQuote).toLowerCase();
  if (!quote) return evidence;

  const match = segments.find((segment) => {
    const text = compactText(segment.text).toLowerCase();
    const snippet = text.slice(0, 80);
    return text.includes(quote) || (snippet.length >= 12 && quote.includes(snippet));
  });

  if (!match) return evidence;
  return {
    ...evidence,
    segmentId: match.id,
    timestamp: match.timestamp,
    speaker: evidence.speaker || compactText(match.speakerName || match.rawSpeakerLabel),
  };
}

function hasSourceEvidence(evidence: AnalysisSourceEvidence): boolean {
  return Boolean(
    compactText(evidence.sourceQuote) ||
    compactText(evidence.segmentId) ||
    evidence.timestamp !== undefined
  );
}

function sourceLinkedText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!isRecord(value)) return '';
  return compactText(value.text || value.title || value.summary || value.risk || value.quote);
}

function normalizeSourceLinkedList(
  area: SourceLinkedArea,
  values: unknown,
  segments: TranscriptSegment[],
  unsupportedClaims: AnalysisUnsupportedClaim[]
): { texts: string[]; evidence: AnalysisSourceEvidence[] } {
  if (!Array.isArray(values)) {
    return { texts: [], evidence: [] };
  }

  const texts: string[] = [];
  const evidence: AnalysisSourceEvidence[] = [];

  values.forEach((value) => {
    const text = sourceLinkedText(value);
    if (!text) return;

    const normalizedEvidence = findEvidenceInTranscript(normalizeEvidence(value), segments);
    const supported = hasSourceEvidence(normalizedEvidence);
    const nextEvidence = supported
      ? normalizedEvidence
      : {
          ...normalizedEvidence,
          unsupported: true,
          reviewReason: normalizedEvidence.reviewReason || 'missing-source-evidence',
        };

    texts.push(text);
    evidence.push(nextEvidence);

    if (!supported) {
      unsupportedClaims.push({
        area,
        index: texts.length - 1,
        text,
        reason: nextEvidence.reviewReason || 'missing-source-evidence',
      });
    }
  });

  return { texts, evidence };
}

function normalizeTaskEvidence(
  tasks: unknown,
  segments: TranscriptSegment[],
  unsupportedClaims: AnalysisUnsupportedClaim[]
) {
  if (!Array.isArray(tasks)) return { tasks: [], evidence: [] };

  const normalizedTasks: unknown[] = [];
  const evidence: AnalysisSourceEvidence[] = [];

  tasks.forEach((task) => {
    const taskRecord = isRecord(task) ? task : {};
    const title = sourceLinkedText(task);
    if (!title) return;

    const normalizedEvidence = findEvidenceInTranscript(normalizeEvidence(taskRecord), segments);
    const supported = hasSourceEvidence(normalizedEvidence);
    const nextEvidence = supported
      ? normalizedEvidence
      : {
          ...normalizedEvidence,
          unsupported: true,
          reviewReason: normalizedEvidence.reviewReason || 'missing-source-evidence',
        };

    normalizedTasks.push({
      ...taskRecord,
      title,
      sourceQuote: nextEvidence.sourceQuote || '',
      sourceSegmentId: nextEvidence.segmentId || '',
      sourceTimestamp: nextEvidence.timestamp,
      sourceUnsupported: Boolean(nextEvidence.unsupported),
    });
    evidence.push(nextEvidence);

    if (!supported) {
      unsupportedClaims.push({
        area: 'tasks',
        index: normalizedTasks.length - 1,
        text: title,
        reason: nextEvidence.reviewReason || 'missing-source-evidence',
      });
    }
  });

  return { tasks: normalizedTasks, evidence };
}

export function normalizeSourceLinkedAnalysis<T extends Record<string, unknown>>(
  analysis: T,
  segments: TranscriptSegment[] = []
): T & {
  decisions?: string[];
  actionItems?: string[];
  tasks?: unknown[];
  sourceEvidence: Partial<Record<SourceLinkedArea, AnalysisSourceEvidence[]>>;
  unsupportedClaims: AnalysisUnsupportedClaim[];
} {
  const unsupportedClaims: AnalysisUnsupportedClaim[] = [];
  const sourceEvidence: Partial<Record<SourceLinkedArea, AnalysisSourceEvidence[]>> = {};
  const decisions = normalizeSourceLinkedList(
    'decisions',
    analysis.decisions,
    segments,
    unsupportedClaims
  );
  const actionItems = normalizeSourceLinkedList(
    'actionItems',
    analysis.actionItems,
    segments,
    unsupportedClaims
  );
  const tasks = normalizeTaskEvidence(analysis.tasks, segments, unsupportedClaims);

  if (decisions.evidence.length) sourceEvidence.decisions = decisions.evidence;
  if (actionItems.evidence.length) sourceEvidence.actionItems = actionItems.evidence;
  if (tasks.evidence.length) sourceEvidence.tasks = tasks.evidence;

  const existingSourceEvidence = isRecord(analysis.sourceEvidence)
    ? (analysis.sourceEvidence as Partial<Record<SourceLinkedArea, AnalysisSourceEvidence[]>>)
    : {};

  return {
    ...analysis,
    decisions: decisions.texts.length ? decisions.texts : (analysis.decisions as string[]),
    actionItems: actionItems.texts.length ? actionItems.texts : (analysis.actionItems as string[]),
    tasks: tasks.tasks.length ? tasks.tasks : (analysis.tasks as unknown[]),
    sourceEvidence: {
      ...existingSourceEvidence,
      ...sourceEvidence,
    },
    unsupportedClaims: [
      ...(Array.isArray(analysis.unsupportedClaims)
        ? (analysis.unsupportedClaims as AnalysisUnsupportedClaim[])
        : []),
      ...unsupportedClaims,
    ],
  };
}
