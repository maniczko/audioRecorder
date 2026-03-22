#!/usr/bin/env node
/**
 * Skrypt wyświetla podsumowanie coverage w terminalu
 * po uruchomieniu testów z coverage
 */

const fs = require('fs');
const path = require('path');

const COVERAGE_FILE = path.join(__dirname, '..', 'coverage', 'server', 'coverage-summary.json');

// Dane o jakości testów z audytu
const TEST_QUALITY_DATA = [
  { category: 'Backend (server/)', files: 18, tests: '~50', passRate: '95%', score: '🟢 9/10' },
  { category: 'Frontend Components', files: 15, tests: '~60', passRate: '85%', score: '🟡 7/10' },
  { category: 'Hooks', files: 12, tests: '~50', passRate: '60%', score: '🔴 5/10' },
  { category: 'Services', files: 6, tests: '~30', passRate: '50%', score: '🔴 4/10' },
  { category: 'Stores (Zustand)', files: 5, tests: '~30', passRate: '70%', score: '🟡 6/10' },
  { category: 'Lib (pure functions)', files: 15, tests: '~50', passRate: '98%', score: '🟢 9/10' },
  { category: 'Context Providers', files: 2, tests: '~10', passRate: '50%', score: '🔴 5/10' },
  { category: 'Integration/E2E', files: 2, tests: '~15', passRate: '70%', score: '🟡 6/10' },
];

function formatPercent(value) {
  const pct = Math.round(value * 100) / 100;
  if (pct >= 80) return `\x1b[32m${pct}%\x1b[0m`;  // Zielony
  if (pct >= 50) return `\x1b[33m${pct}%\x1b[0m`;  // Żółty
  return `\x1b[31m${pct}%\x1b[0m`;                  // Czerwony
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

function printTestQualityTable() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 JAKOŚĆ TESTÓW WG KATEGORII');
  console.log('='.repeat(80));
  console.log('');

  // Nagłówek tabeli
  const header = [
    'Kategoria'.padEnd(25),
    'Plików'.padStart(8),
    'Testów'.padStart(8),
    'Pass Rate'.padStart(11),
    'Ocena'.padStart(10)
  ].join(' │ ');

  console.log(header);
  console.log('─'.repeat(80));

  // Wiersze danych
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

  // Sprawdź najważniejsze pliki
  if (data['c:\\Users\\user\\new\\audioRecorder\\server\\audioPipeline.ts']) {
    const pipeline = data['c:\\Users\\user\\new\\audioRecorder\\server\\audioPipeline.ts'];
    console.log('\n📁 audioPipeline.ts:');
    console.log(`  Lines:      ${formatPercent(pipeline.lines.pct)}`);
    console.log(`  Branches:   ${formatPercent(pipeline.branches.pct)}`);
    console.log(`  Functions:  ${formatPercent(pipeline.functions.pct)}`);
  }

  // Dodaj tabelę jakości testów
  printTestQualityTable();

} catch (error) {
  console.error('❌ Błąd czytania coverage:', error.message);
  process.exit(1);
}
