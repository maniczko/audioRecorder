import { describe, expect, it } from 'vitest';

import { buildFallbackRagAnswer, buildRagContext } from '../../lib/ragAnswer.ts';

describe('ragAnswer helpers', () => {
  it('builds readable RAG context from archive chunks', () => {
    const context = buildRagContext([
      { recording_id: 'rec-1', speaker_name: 'Anna', text: 'Ustalono budzet.' },
      { recording_id: 'rec-2', speaker_name: 'Piotr', text: 'Termin to przyszly tydzien.' },
    ]);

    expect(context).toContain('[Spotkanie: rec-1] Anna: Ustalono budzet.');
    expect(context).toContain('[Spotkanie: rec-2] Piotr: Termin to przyszly tydzien.');
  });

  it('returns a no-results message when fallback chunks are empty', () => {
    expect(
      buildFallbackRagAnswer({
        question: 'Co ustalono?',
        chunks: [],
      })
    ).toBe('Nie znalazlem trafnych fragmentow w archiwalnych spotkaniach.');
  });

  it('includes archive snippets and the original question in fallback output', () => {
    const answer = buildFallbackRagAnswer({
      question: 'Co ustalono?',
      chunks: [
        { recording_id: 'rec-1', speaker_name: 'Anna', text: '  Ustalono   budzet.  ' },
        { recording_id: 'rec-2', speaker_name: '', text: 'Termin to przyszly tydzien.' },
      ],
      errorMessage: 'Model niedostepny',
    });

    expect(answer).toContain('Model AI jest chwilowo niedostepny');
    expect(answer).toContain('Fragment 1 (Anna)');
    expect(answer).toContain('Ustalono budzet.');
    expect(answer).toContain('Fragment 2 (Nieznany)');
    expect(answer).toContain('Termin to przyszly tydzien.');
    expect(answer).toContain('Pytanie: Co ustalono?');
    expect(answer).not.toContain('rec-1');
    expect(answer).not.toContain('rec-2');
  });

  // -----------------------------------------------------------------
  // Issue #0 - RAG fallback leaked raw recording IDs into user copy
  // Date: 2026-04-05
  // Bug: when the LLM fallback was used, users saw technical IDs such as
  //      recording_xxx instead of readable fragment labels.
  // Fix: fallback now returns numbered archive fragments with speakers,
  //      without exposing storage-oriented recording identifiers.
  // -----------------------------------------------------------------
  it('Regression: #0 - hides raw recording ids in fallback answer copy', () => {
    const answer = buildFallbackRagAnswer({
      question: 'ile jatem spotkan',
      chunks: [
        {
          recording_id: 'recording_85dtyogr_mnk4bjal',
          speaker_name: 'Iwo',
          text: 'Robilam questa np. spotkanie po setce minutami.',
        },
      ],
      errorMessage: 'Timeout LLM',
    });

    expect(answer).toContain('Fragment 1 (Iwo)');
    expect(answer).not.toContain('recording_85dtyogr_mnk4bjal');
  });
});
