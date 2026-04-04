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
    expect(answer).toContain('- Spotkanie rec-1, Anna: Ustalono budzet.');
    expect(answer).toContain('- Spotkanie rec-2, Nieznany: Termin to przyszly tydzien.');
    expect(answer).toContain('Pytanie: Co ustalono?');
  });
});
