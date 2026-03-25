function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function section(title, content) {
  return `
    <section class="doc-section">
      <h2>${escapeHtml(title)}</h2>
      ${content}
    </section>
  `;
}

function list(items) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!safeItems.length) {
    return '<p class="doc-muted">Brak danych.</p>';
  }

  return `<ul>${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function slugifyExportTitle(value, fallback = 'meeting') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

export function buildMeetingNotesText(meeting, analysis, formatDateTime) {
  if (!meeting) {
    return '';
  }

  const safeAnalysis = analysis || {};
  const debrief = meeting.aiDebrief || null;
  const debriefLines = ['Debrief AI:', debrief?.summary || 'Brak debriefu AI.'];
  if (debrief?.decisions?.length) {
    debriefLines.push('', 'Decyzje debriefu:', ...debrief.decisions.map((item) => `- ${item}`));
  }
  if (debrief?.risks?.length) {
    debriefLines.push('', 'Ryzyka debriefu:', ...debrief.risks.map((item) => `- ${item}`));
  }
  if (debrief?.followUps?.length) {
    debriefLines.push(
      '',
      'Nastepne kroki debriefu:',
      ...debrief.followUps.map((item) => `- ${item}`)
    );
  }
  return [
    `Spotkanie: ${meeting.title}`,
    `Start: ${formatDateTime(meeting.startsAt)}`,
    `Tagi: ${(meeting.tags || []).join(', ') || 'Brak'}`,
    `Potrzeby: ${(meeting.needs || []).join(', ') || 'Brak'}`,
    `Outputy: ${(meeting.desiredOutputs || []).join(', ') || 'Brak'}`,
    '',
    'Podsumowanie:',
    safeAnalysis.summary || 'Brak',
    '',
    'Decyzje:',
    ...(safeAnalysis.decisions || []).map((item) => `- ${item}`),
    '',
    'Zadania:',
    ...(safeAnalysis.actionItems || []).map((item) => `- ${item}`),
    '',
    ...debriefLines,
  ].join('\n');
}

export function printMeetingPdf(meeting, recording, speakerNames, formatDateTime, formatDuration) {
  if (typeof window === 'undefined' || !meeting) {
    return;
  }

  const transcript = (recording?.transcript || []).map((segment) => {
    const speaker =
      speakerNames?.[String(segment.speakerId)] || `Speaker ${Number(segment.speakerId) + 1}`;
    const verification =
      segment.verificationStatus === 'review'
        ? `<span class="doc-badge warning">Do weryfikacji</span>`
        : `<span class="doc-badge success">Zweryfikowane</span>`;
    return `
      <article class="doc-transcript-row">
        <div class="doc-transcript-meta">
          <strong>${escapeHtml(speaker)}</strong>
          <span>${escapeHtml(formatDuration(segment.timestamp))}</span>
          ${verification}
        </div>
        <p>${escapeHtml(segment.text)}</p>
      </article>
    `;
  });

  const analysis = recording?.analysis || meeting.analysis || {};
  const debrief = meeting.aiDebrief || recording?.aiDebrief || null;
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=980,height=900');
  if (!popup) {
    return;
  }

  popup.document.write(`
    <!doctype html>
    <html lang="pl">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(meeting.title)} - PDF export</title>
        <style>
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            margin: 0;
            color: #10233a;
            background: #f6f8fc;
          }
          .doc-shell {
            max-width: 900px;
            margin: 0 auto;
            padding: 32px;
          }
          .doc-card,
          .doc-section {
            background: #ffffff;
            border: 1px solid #dde5f1;
            border-radius: 18px;
            padding: 22px;
            margin-bottom: 18px;
            box-shadow: 0 12px 28px rgba(15, 35, 64, 0.08);
          }
          .doc-eyebrow {
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 11px;
            color: #62758f;
          }
          h1, h2 {
            margin: 8px 0 0;
          }
          h1 {
            font-size: 30px;
          }
          h2 {
            font-size: 19px;
          }
          p, li, span {
            line-height: 1.6;
          }
          ul {
            margin: 12px 0 0;
            padding-left: 20px;
          }
          .doc-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-top: 16px;
          }
          .doc-stat {
            border-radius: 14px;
            background: #f5f8ff;
            border: 1px solid #dce6f9;
            padding: 14px;
          }
          .doc-stat span {
            display: block;
            color: #5e6f87;
            font-size: 13px;
          }
          .doc-transcript-row {
            padding: 14px 0;
            border-top: 1px solid #edf1f7;
          }
          .doc-transcript-row:first-child {
            border-top: none;
            padding-top: 0;
          }
          .doc-transcript-meta {
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
          }
          .doc-badge {
            display: inline-flex;
            align-items: center;
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            border: 1px solid transparent;
          }
          .doc-badge.warning {
            background: #fff4e5;
            color: #8a5400;
            border-color: #ffd7a1;
          }
          .doc-badge.success {
            background: #ecfdf3;
            color: #146c43;
            border-color: #b7f0cc;
          }
          .doc-muted {
            color: #70839b;
          }
          @media print {
            body {
              background: #ffffff;
            }
            .doc-shell {
              max-width: none;
              padding: 0;
            }
            .doc-card,
            .doc-section {
              box-shadow: none;
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <main class="doc-shell">
          <section class="doc-card">
            <div class="doc-eyebrow">VoiceLog export</div>
            <h1>${escapeHtml(meeting.title)}</h1>
            <p>${escapeHtml(meeting.context || 'Brak dodatkowego kontekstu.')}</p>
            <div class="doc-grid">
              <div class="doc-stat">
                <span>Start</span>
                <strong>${escapeHtml(formatDateTime(meeting.startsAt))}</strong>
              </div>
              <div class="doc-stat">
                <span>Czas</span>
                <strong>${escapeHtml(String(meeting.durationMinutes || 0))} min</strong>
              </div>
              <div class="doc-stat">
                <span>Rozmowcy</span>
                <strong>${escapeHtml(String(recording?.speakerCount || meeting.speakerCount || 0))}</strong>
              </div>
            </div>
          </section>

          ${section(
            'Tagi i potrzeby',
            `
            <p><strong>Tagi:</strong> ${escapeHtml((meeting.tags || []).join(', ') || 'Brak')}</p>
            <p><strong>Potrzeby:</strong> ${escapeHtml((meeting.needs || []).join(', ') || 'Brak')}</p>
            <p><strong>Oczekiwane outputy:</strong> ${escapeHtml((meeting.desiredOutputs || []).join(', ') || 'Brak')}</p>
          `
          )}

          ${section('Podsumowanie', `<p>${escapeHtml(analysis.summary || 'Brak podsumowania.')}</p>`)}
          ${section('Decyzje', list(analysis.decisions))}
          ${section('Zadania i follow-upy', list([...(analysis.actionItems || []), ...(analysis.followUps || [])]))}
          ${
            debrief
              ? section(
                  'Debrief AI',
                  `
            <p>${escapeHtml(debrief.summary || 'Brak debriefu AI.')}</p>
            <p><strong>Decyzje:</strong> ${escapeHtml((debrief.decisions || []).join(', ') || 'Brak')}</p>
            <p><strong>Ryzyka:</strong> ${escapeHtml((debrief.risks || []).join(', ') || 'Brak')}</p>
            <p><strong>Następne kroki:</strong> ${escapeHtml((debrief.followUps || []).join(', ') || 'Brak')}</p>
          `
                )
              : ''
          }
          ${section('Notatki i transkrypcja', transcript.length ? transcript.join('') : '<p class="doc-muted">Brak transkrypcji.</p>')}
        </main>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}
