import { describe, expect, test } from 'vitest';
import {
  MEETING_FEEDBACK_CATEGORIES,
  buildMeetingFeedbackFallback,
  normalizeMeetingFeedback,
  type MeetingFeedbackContext,
} from './meetingFeedback';

const baseContext: MeetingFeedbackContext = {
  summary: 'Sprint review',
  decisions: ['Ship beta'],
  actionItems: ['Prepare release notes'],
  followUps: ['Confirm QA sign-off'],
  participantInsights: [{ name: 'Anna', talkRatio: 0.45 }],
  transcriptLength: 12,
  meetingTitle: 'Sprint review',
};

describe('meetingFeedback', () => {
  test('returns fallback feedback for non-object payloads', () => {
    expect(normalizeMeetingFeedback(null, baseContext)).toEqual(
      buildMeetingFeedbackFallback(baseContext)
    );
  });

  test('maps category scores by canonical key', () => {
    const feedback = normalizeMeetingFeedback(
      {
        categoryScores: [
          {
            key: 'clarity',
            score: 9,
            observation: 'Bardzo klarowny przekaz.',
            improvementTip: 'Trzymaj ten poziom.',
          },
        ],
      },
      baseContext
    );

    expect(feedback.categoryScores.find((item) => item.key === 'clarity')).toMatchObject({
      score: 9,
      observation: 'Bardzo klarowny przekaz.',
      improvementTip: 'Trzymaj ten poziom.',
    });
  });

  test('maps category scores by label case-insensitively', () => {
    const feedback = normalizeMeetingFeedback(
      {
        categoryScores: [
          {
            label: 'tempo i zarządzanie czasem',
            score: 8,
            observation: 'Dobre tempo.',
            improvementTip: 'Zostaw krótką pauzę po decyzjach.',
          },
        ],
      },
      baseContext
    );

    expect(feedback.categoryScores.find((item) => item.key === 'pace')).toMatchObject({
      score: 8,
      observation: 'Dobre tempo.',
      improvementTip: 'Zostaw krótką pauzę po decyzjach.',
    });
  });

  test('ignores malformed category entries and keeps fallback structure', () => {
    const feedback = normalizeMeetingFeedback(
      {
        categoryScores: [null, 42, { foo: 'bar' }, { label: 'closing', score: 11 }],
      },
      baseContext
    );

    expect(feedback.categoryScores).toHaveLength(MEETING_FEEDBACK_CATEGORIES.length);
    expect(feedback.categoryScores.find((item) => item.key === 'closing')?.score).toBe(10);
    expect(feedback.categoryScores.every((item) => item.label.length > 0)).toBe(true);
  });

  test('clamps overall score into 1..10 range', () => {
    const feedback = normalizeMeetingFeedback(
      {
        overallScore: 999,
      },
      baseContext
    );

    expect(feedback.overallScore).toBe(10);
  });
});
