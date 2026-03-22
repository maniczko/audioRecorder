#!/usr/bin/env node
/**
 * Skrypt wyświetla podsumowanie coverage w terminalu
 * i aktualizuje raport HTML o tabelę jakości testów
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = path.join(__dirname, '..', 'coverage', 'server', 'coverage-summary.json');
const COVERAGE_HTML = path.join(__dirname, '..', 'coverage', 'server', 'index.html');

// Dane o jakości testów z audytu
const TEST_QUALITY_DATA = [
  { category: 'Backend (server/)', files: 18, tests: '~50', passRate: '95%', score: '🟢 9/10', scoreNum: 9 },
  { category: 'Frontend Components', files: 15, tests: '~60', passRate: '85%', score: '🟡 7/10', scoreNum: 7 },
  { category: 'Hooks', files: 12, tests: '~50', passRate: '60%', score: '🔴 5/10', scoreNum: 5 },
  { category: 'Services', files: 6, tests: '~30', passRate: '50%', score: '🔴 4/10', scoreNum: 4 },
  { category: 'Stores (Zustand)', files: 5, tests: '~30', passRate: '70%', score: '🟡 6/10', scoreNum: 6 },
  { category: 'Lib (pure functions)', files: 15, tests: '~50', passRate: '98%', score: '🟢 9/10', scoreNum: 9 },
  { category: 'Context Providers', files: 2, tests: '~10', passRate: '50%', score: '🔴 5/10', scoreNum: 5 },
  { category: 'Integration/E2E', files: 2, tests: '~15', passRate: '70%', score: '🟡 6/10', scoreNum: 6 },
];

function formatPercent(value) {
  const pct = Math.round(value * 100) / 100;
  if (pct >= 80) return `\x1b[32m${pct}%\x1b[0m`;
  if (pct >= 50) return `\x1b[33m${pct}%\x1b[0m`;
  return `\x1b[31m${pct}%\x1b[0m`;
}

function getStatusIcon(pct) {
  if (pct >= 80) return '🟢';
  if (pct >= 50) return '🟡';
  return '🔴';
}

function getScoreColor(score) {
  if (score.includes('🟢')) return `\x1b[32m${score}\x1b[0m`;
  if (score.includes('🟡')) return `\x1b[33m${score}\x1b[0m`;
  return `\x1b[31m${score}\x1b[0m`;
}

function getScoreBadge(scoreNum) {
  if (scoreNum >= 8) return '<span class="score-good">🟢 ' + scoreNum + '/10</span>';
  if (scoreNum >= 5) return '<span class="score-medium">🟡 ' + scoreNum + '/10</span>';
  return '<span class="score-bad">🔴 ' + scoreNum + '/10</span>';
}

function printTestQualityTable() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 JAKOŚĆ TESTÓW WG KATEGORII');
  console.log('='.repeat(80));
  console.log('');

  const header = [
    'Kategoria'.padEnd(25),
    'Plików'.padStart(8),
    'Testów'.padStart(8),
    'Pass Rate'.padStart(11),
    'Ocena'.padStart(10)
  ].join(' │ ');

  console.log(header);
  console.log('─'.repeat(80));

  TEST_QUALITY_DATA.forEach(row => {
    const line = [
      row.category.padEnd(25),
      row.files.toString().padStart(8),
      row.tests.padStart(8),
      row.passRate.padStart(11),
      getScoreColor(row.score).padStart(10)
    ].join(' │ ');
    console.log(line);
  });

  console.log('─'.repeat(80));
  console.log('');
  console.log('Legenda: 🟢 Dobrze (≥80%)  |  🟡 Średnio (50-79%)  |  🔴 Źle (<50%)');
  console.log('');
}

function generateQualityTableHTML() {
  const rows = TEST_QUALITY_DATA.map(row => {
    const scoreClass = row.scoreNum >= 8 ? 'score-good' : (row.scoreNum >= 5 ? 'score-medium' : 'score-bad');
    return `
      <tr>
        <td class="category">${row.category}</td>
        <td class="number">${row.files}</td>
        <td class="number">${row.tests}</td>
        <td class="percent">${row.passRate}</td>
        <td><span class="${scoreClass}">${row.score}</span></td>
      </tr>`;
  }).join('');

  return `
  <div class="quality-section">
    <h2>📋 Jakość testów wg kategorii</h2>
    <p class="section-desc">Podsumowanie jakości testów na podstawie audytu kodu</p>
    <table class="quality-table">
      <thead>
        <tr>
          <th>Kategoria</th>
          <th>Plików</th>
          <th>Testów</th>
          <th>Pass Rate</th>
          <th>Ocena</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div class="legend">
      <strong>Legenda:</strong>
      <span class="legend-item"><span class="score-good">🟢 Dobrze</span> (≥80%)</span>
      <span class="legend-item"><span class="score-medium">🟡 Średnio</span> (50-79%)</span>
      <span class="legend-item"><span class="score-bad">🔴 Źle</span> (&lt;50%)</span>
    </div>
  </div>`;
}

function updateHTMLReport() {
  if (!fs.existsSync(COVERAGE_HTML)) {
    console.log('⚠️  Brak pliku index.html - raport HTML nie został jeszcze wygenerowany');
    return;
  }

  let htmlContent = fs.readFileSync(COVERAGE_HTML, 'utf8');

  // Sprawdź czy tabela już istnieje
  if (htmlContent.includes('class="quality-section"')) {
    console.log('✅ Tabela jakości testów już istnieje w raporcie HTML');
    return;
  }

  // Znajdź miejsce do wstawienia (przed zamknięciem body)
  const insertPosition = htmlContent.lastIndexOf('</body>');
  if (insertPosition === -1) {
    console.log('⚠️  Nie znaleziono tagu </body> w raporcie HTML');
    return;
  }

  // Dodaj style CSS
  const cssStyles = `
  <style>
    .quality-section {
      margin: 30px 20px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 8px;
      border: 1px solid #ddd;
    }
    .quality-section h2 {
      margin-top: 0;
      color: #333;
      font-size: 1.4em;
    }
    .section-desc {
      color: #666;
      margin-bottom: 15px;
    }
    .quality-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 14px;
    }
    .quality-table th {
      background: #444;
      color: white;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
    }
    .quality-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #ddd;
    }
    .quality-table tr:hover {
      background: #f0f0f0;
    }
    .quality-table .category {
      font-weight: 500;
    }
    .quality-table .number,
    .quality-table .percent {
      text-align: right;
      font-family: monospace;
    }
    .score-good {
      background: #d4edda;
      color: #155724;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .score-medium {
      background: #fff3cd;
      color: #856404;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .score-bad {
      background: #f8d7da;
      color: #721c24;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .legend {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      font-size: 13px;
    }
    .legend-item {
      margin-left: 15px;
    }
  </style>`;

  // Wstaw style przed </head>
  const headEnd = htmlContent.indexOf('</head>');
  if (headEnd !== -1) {
    htmlContent = htmlContent.slice(0, headEnd) + cssStyles + '\n' + htmlContent.slice(headEnd);
  }

  // Wstaw tabelę przed </body>
  const qualityTableHTML = generateQualityTableHTML();
  htmlContent = htmlContent.slice(0, insertPosition) + qualityTableHTML + '\n' + htmlContent.slice(insertPosition);

  // Zapisz zaktualizowany plik
  fs.writeFileSync(COVERAGE_HTML, htmlContent, 'utf8');
  console.log('✅ Dodano tabelę jakości testów do raportu HTML');
}

try {
  if (!fs.existsSync(COVERAGE_FILE)) {
    console.error('❌ Brak pliku coverage-summary.json');
    console.error('Uruchom najpierw: npm run test:coverage:server');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8'));
  const total = data.total;

  console.log('\n' + '='.repeat(50));
  console.log('📊 PODSUMOWANIE COVERAGE - SERVER');
  console.log('='.repeat(50));
  console.log('\n');
  console.log(`Statements:  ${formatPercent(total.statements.pct)}  ${getStatusIcon(total.statements.pct)}`);
  console.log(`Branches:    ${formatPercent(total.branches.pct)}  ${getStatusIcon(total.branches.pct)}`);
  console.log(`Functions:   ${formatPercent(total.functions.pct)}  ${getStatusIcon(total.functions.pct)}`);
  console.log(`Lines:       ${formatPercent(total.lines.pct)}  ${getStatusIcon(total.lines.pct)}`);
  console.log('\n');
  console.log('Szczegóły: coverage/server/index.html');
  console.log('='.repeat(50) + '\n');

  if (data['c:\\Users\\user\\new\\audioRecorder\\server\\audioPipeline.ts']) {
    const pipeline = data['c:\\Users\\user\\new\\audioRecorder\\server\\audioPipeline.ts'];
    console.log('\n📁 audioPipeline.ts:');
    console.log(`  Lines:      ${formatPercent(pipeline.lines.pct)}`);
    console.log(`  Branches:   ${formatPercent(pipeline.branches.pct)}`);
    console.log(`  Functions:  ${formatPercent(pipeline.functions.pct)}`);
  }

  printTestQualityTable();

  updateHTMLReport();

} catch (error) {
  console.error('❌ Błąd:', error.message);
  process.exit(1);
}
