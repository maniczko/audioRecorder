/* global Chart */

// Dashboard Pro - Main Logic
// Handles data loading, calculations, and rendering

let dashboardData = null;
const charts = {};

// ─────────────────────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────────────────────

async function loadDashboard() {
  // Try to load from embedded script first (avoids CORS issues)
  if (window.TEST_DATA) {
    console.log('✓ Loading data from embedded script');
    dashboardData = window.TEST_DATA;
    renderDashboard(dashboardData);
    return;
  }

  // Fallback: try fetch (works when served from HTTP server)
  try {
    const response = await fetch('test-results.json');
    if (!response.ok) throw new Error('No test results found');
    dashboardData = await response.json();
    renderDashboard(dashboardData);
  } catch (error) {
    console.error('Failed to load test results:', error);
    showErrorMessage();
  }
}

function showErrorMessage() {
  document.querySelector('.header').innerHTML = `
    <h1>⚠️ Brak Danych Testowych</h1>
    <p style="margin-top: 1rem; opacity: 0.8;">
      Najpierw uruchom testy z generowaniem raportu:<br><br>
      <code style="background: rgba(0,0,0,0.3); padding: 0.5rem 1rem; border-radius: 0.5rem;">
        pnpm run test:with-report
      </code>
    </p>
  `;
}

// ─────────────────────────────────────────────────────────────
// CALCULATIONS & METRICS
// ─────────────────────────────────────────────────────────────

function calculateMetrics(data) {
  const { summary, files, coverage } = data;

  // Basic metrics
  const passRate = summary.total > 0 ? (summary.passed / summary.total) * 100 : 0;
  const failRate = summary.total > 0 ? (summary.failed / summary.total) * 100 : 0;

  // File metrics
  const totalFiles = files.length;
  const passingFiles = files.filter((f) => f.failed === 0).length;
  const failingFiles = files.filter((f) => f.failed > 0).length;
  const filePassRate = totalFiles > 0 ? (passingFiles / totalFiles) * 100 : 0;

  // Coverage metrics
  const avgCoverage = coverage ? coverage.lines || coverage.statements || 0 : 0;
  const highCoverageFiles = files.filter((f) => (f.coverage || 0) >= 80).length;
  const lowCoverageFiles = files.filter((f) => (f.coverage || 0) < 50).length;

  // Performance metrics
  const avgTestDuration = files.reduce((sum, f) => sum + (f.duration || 0), 0) / totalFiles;

  // Maturity level calculation (1-5)
  const maturityScore = calculateMaturityLevel(passRate, avgCoverage, filePassRate, summary.failed);

  // Health score (0-100)
  const healthScore = calculateHealthScore(passRate, avgCoverage, failingFiles, summary.failed);

  // Category breakdown
  const categories = categorizeFiles(files);

  return {
    passRate,
    failRate,
    totalFiles,
    passingFiles,
    failingFiles,
    filePassRate,
    avgCoverage,
    highCoverageFiles,
    lowCoverageFiles,
    avgTestDuration,
    maturityScore,
    healthScore,
    categories,
  };
}

function calculateMaturityLevel(passRate, coverage, filePassRate, failedCount) {
  let score = 0;

  // Test pass rate (0-25 points)
  if (passRate >= 95) score += 25;
  else if (passRate >= 80) score += 20;
  else if (passRate >= 60) score += 15;
  else if (passRate >= 40) score += 10;
  else score += 5;

  // Coverage (0-25 points)
  if (coverage >= 80) score += 25;
  else if (coverage >= 60) score += 20;
  else if (coverage >= 40) score += 15;
  else if (coverage >= 20) score += 10;
  else score += 5;

  // File pass rate (0-25 points)
  if (filePassRate === 100) score += 25;
  else if (filePassRate >= 80) score += 20;
  else if (filePassRate >= 60) score += 15;
  else if (filePassRate >= 40) score += 10;
  else score += 5;

  // Zero failures bonus (0-25 points)
  if (failedCount === 0) score += 25;
  else if (failedCount < 5) score += 20;
  else if (failedCount < 20) score += 15;
  else if (failedCount < 50) score += 10;
  else score += 5;

  // Convert to 1-5 level
  if (score >= 90) return { level: 5, score, label: 'Optimized', color: 'excellent' };
  if (score >= 75) return { level: 4, score, label: 'Managed', color: 'good' };
  if (score >= 60) return { level: 3, score, label: 'Defined', color: 'fair' };
  if (score >= 40) return { level: 2, score, label: 'Developing', color: 'fair' };
  return { level: 1, score, label: 'Initial', color: 'poor' };
}

function calculateHealthScore(passRate, coverage, failingFiles, failedCount) {
  let score = 0;

  // Pass rate weight: 40%
  score += (passRate / 100) * 40;

  // Coverage weight: 30%
  score += (coverage / 100) * 30;

  // File health weight: 20%
  const fileHealth = Math.max(0, 100 - failingFiles * 10);
  score += (fileHealth / 100) * 20;

  // Failure penalty: 10%
  const failurePenalty = Math.min(10, failedCount * 0.5);
  score += 10 - failurePenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function categorizeFiles(files) {
  const categories = {
    hooks: { name: 'Hooks', icon: '🪝', files: [], passed: 0, failed: 0 },
    components: { name: 'Components', icon: '🧩', files: [], passed: 0, failed: 0 },
    stores: { name: 'Stores', icon: '💾', files: [], passed: 0, failed: 0 },
    services: { name: 'Services', icon: '🔧', files: [], passed: 0, failed: 0 },
    context: { name: 'Context', icon: '🌐', files: [], passed: 0, failed: 0 },
    utils: { name: 'Utilities', icon: '🛠️', files: [], passed: 0, failed: 0 },
    pages: { name: 'Pages/Tabs', icon: '📄', files: [], passed: 0, failed: 0 },
    other: { name: 'Other', icon: '📦', files: [], passed: 0, failed: 0 },
  };

  files.forEach((file) => {
    const path = file.file.toLowerCase();
    let category = 'other';

    if (path.includes('/hooks/') || path.includes('use')) category = 'hooks';
    else if (path.includes('/components/')) category = 'components';
    else if (path.includes('/store/') || path.includes('store')) category = 'stores';
    else if (path.includes('/services/') || path.includes('service')) category = 'services';
    else if (path.includes('/context/')) category = 'context';
    else if (path.includes('/lib/') || path.includes('util')) category = 'utils';
    else if (path.includes('tab') || path.includes('page')) category = 'pages';

    categories[category].files.push(file);
    categories[category].passed += file.passed;
    categories[category].failed += file.failed;
  });

  return categories;
}

// ─────────────────────────────────────────────────────────────
// RENDERING
// ─────────────────────────────────────────────────────────────

function renderDashboard(data) {
  const metrics = calculateMetrics(data);

  renderHeader(data, metrics);
  renderKPIs(data, metrics);
  renderMaturityLevel(metrics);
  renderHealthScore(metrics);
  renderCharts(data, metrics);
  renderCategories(metrics);
  renderFileTree(data, metrics);
  renderFailures(data);
  renderMetrics(metrics);
  renderExternalServices();
}

function renderHeader(data, metrics) {
  // Status badge
  const badge = document.getElementById('status-badge');
  if (metrics.failingFiles === 0) {
    badge.className = 'status-badge success';
    badge.innerHTML = '✓ WSZYSTKIE TESTY PRZESZŁY';
  } else {
    badge.className = 'status-badge danger';
    badge.innerHTML = `✗ ${metrics.failingFiles} PLIKÓW Z BŁĘDAMI`;
  }

  // Timestamp
  const timestamp = new Date(data.timestamp).toLocaleString('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  document.getElementById('timestamp').textContent = `Ostatnia aktualizacja: ${timestamp}`;
}

function renderKPIs(data, metrics) {
  const grid = document.getElementById('kpi-grid');
  grid.innerHTML = `
    <div class="kpi-card success">
      <div class="kpi-icon">✅</div>
      <div class="kpi-label">Testy Przedszłe</div>
      <div class="kpi-value">${data.summary.passed}</div>
      <div class="kpi-trend positive">✓ ${metrics.passRate.toFixed(1)}% success rate</div>
    </div>
    
    <div class="kpi-card ${metrics.failingFiles > 0 ? 'danger' : 'success'}">
      <div class="kpi-icon">${metrics.failingFiles > 0 ? '❌' : '🎉'}</div>
      <div class="kpi-label">Testy Nieudane</div>
      <div class="kpi-value">${data.summary.failed}</div>
      <div class="kpi-trend ${metrics.failingFiles > 0 ? 'negative' : 'positive'}">
        ${metrics.failingFiles > 0 ? '⚠ Wymaga uwagi' : '✓ Perfect!'}
      </div>
    </div>
    
    <div class="kpi-card info">
      <div class="kpi-icon">📊</div>
      <div class="kpi-label">Całkowita Liczba Testów</div>
      <div class="kpi-value">${data.summary.total}</div>
      <div class="kpi-trend">w ${metrics.totalFiles} plikach</div>
    </div>
    
    <div class="kpi-card purple">
      <div class="kpi-icon">📈</div>
      <div class="kpi-label">Coverage (Lines)</div>
      <div class="kpi-value">${metrics.avgCoverage.toFixed(1)}%</div>
      <div class="kpi-trend">
        ${metrics.highCoverageFiles} plików ≥80% | ${metrics.lowCoverageFiles} plików <50%
      </div>
    </div>
    
    <div class="kpi-card warning">
      <div class="kpi-icon">📁</div>
      <div class="kpi-label">Pliki Testowe</div>
      <div class="kpi-value">${metrics.passingFiles}/${metrics.totalFiles}</div>
      <div class="kpi-trend">${metrics.filePassRate.toFixed(1)}% plików bez błędów</div>
    </div>
    
    <div class="kpi-card info">
      <div class="kpi-icon">⚡</div>
      <div class="kpi-label">Pomnijte Testy</div>
      <div class="kpi-value">${data.summary.skipped || 0}</div>
      <div class="kpi-trend">review needed</div>
    </div>
  `;
}

function renderMaturityLevel(metrics) {
  const container = document.getElementById('maturity-container');
  const { level, score, label, color } = metrics.maturityScore;

  const levelDescriptions = {
    5: 'Testy są w pełni zautomatyzowane, coverage >80%, zero błędów, regularne przeglądy',
    4: 'Większość testów zautomatyzowana, coverage >60%, kilka błędów do naprawy',
    3: 'Podstawowe testy istnieją, coverage >40%, ale wymaga poprawy jakości',
    2: 'Testy w rozwoju, coverage <40%, wiele błędów i brakujących mocków',
    1: 'Początkowe stadium, mało testów, coverage <20%, wiele problemów',
  };

  container.innerHTML = `
    <div class="maturity-level">
      <span class="maturity-badge level-${level}">Poziom ${level}/5 - ${label}</span>
      <div class="maturity-bar">
        <div class="maturity-fill ${color}" style="width: ${score}%"></div>
      </div>
      <span style="font-size: 1.5rem; font-weight: 900; color: var(--primary);">${score}%</span>
    </div>
    <p style="color: var(--text-muted); margin-top: 1rem;">
      ${levelDescriptions[level]}
    </p>
    <div style="margin-top: 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
      <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">Pass Rate</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${metrics.passRate.toFixed(1)}%</div>
      </div>
      <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">Coverage</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--purple);">${metrics.avgCoverage.toFixed(1)}%</div>
      </div>
      <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">File Health</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--info);">${metrics.filePassRate.toFixed(1)}%</div>
      </div>
      <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted);">Zero Failures</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: ${dashboardData.summary.failed === 0 ? 'var(--success)' : 'var(--danger)'};">
          ${dashboardData.summary.failed === 0 ? '✓' : `✗ ${dashboardData.summary.failed}`}
        </div>
      </div>
    </div>
  `;
}

function renderHealthScore(metrics) {
  const container = document.getElementById('health-score-container');
  const score = metrics.healthScore;

  let healthLabel, healthColor;
  if (score >= 90) {
    healthLabel = 'Excellent';
    healthColor = 'var(--success)';
  } else if (score >= 75) {
    healthLabel = 'Good';
    healthColor = 'var(--info)';
  } else if (score >= 60) {
    healthLabel = 'Fair';
    healthColor = 'var(--warning)';
  } else {
    healthLabel = 'Poor';
    healthColor = 'var(--danger)';
  }

  // SVG Gauge
  const circumference = Math.PI * 90;
  const offset = circumference - (score / 100) * circumference;

  container.innerHTML = `
    <div class="health-score">
      <div style="position: relative; display: inline-block;">
        <svg class="progress-ring" width="200" height="110">
          <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="var(--border)" stroke-width="12"/>
          <path class="progress-ring-circle" d="M 10 100 A 90 90 0 0 1 190 100" fill="none" 
                stroke="${healthColor}" stroke-width="12" 
                stroke-dasharray="${circumference}" 
                stroke-dashoffset="${offset}"
                stroke-linecap="round"/>
        </svg>
        <div class="progress-text" style="top: 50px; left: 50%; transform: translateX(-50%);">
          ${score}
        </div>
      </div>
      <div>
        <div style="font-size: 2rem; font-weight: 900; color: ${healthColor}; margin-bottom: 0.5rem;">
          ${healthLabel}
        </div>
        <div style="color: var(--text-muted); max-width: 300px;">
          Health Score bazuje na pass rate (40%), coverage (30%), health plików (20%) i liczbie błędów (10%)
        </div>
      </div>
    </div>
  `;
}

function renderCharts(data, metrics) {
  const container = document.getElementById('charts-container');
  container.innerHTML = `
    <div class="chart-card">
      <h3>📊 Rozkład Testów</h3>
      <canvas id="tests-chart"></canvas>
    </div>
    <div class="chart-card">
      <h3>📈 Coverage by Category</h3>
      <canvas id="category-chart"></canvas>
    </div>
    <div class="chart-card">
      <h3>⚡ Test Duration</h3>
      <canvas id="duration-chart"></canvas>
    </div>
    <div class="chart-card">
      <h3>🎯 Pass Rate Trend</h3>
      <canvas id="passrate-chart"></canvas>
    </div>
  `;

  // Tests Distribution Chart
  const testsCtx = document.getElementById('tests-chart').getContext('2d');
  charts.tests = new Chart(testsCtx, {
    type: 'doughnut',
    data: {
      labels: ['Passed', 'Failed', 'Skipped'],
      datasets: [
        {
          data: [data.summary.passed, data.summary.failed, data.summary.skipped || 0],
          backgroundColor: ['var(--success)', 'var(--danger)', 'var(--warning)'],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: 'var(--text)', padding: 20 } },
      },
    },
  });

  // Category Coverage Chart
  const categoryCtx = document.getElementById('category-chart').getContext('2d');
  const categoryLabels = Object.values(metrics.categories).map((c) => c.name);
  const categoryData = Object.values(metrics.categories).map((c) => {
    const total = c.passed + c.failed;
    return total > 0 ? (c.passed / total) * 100 : 0;
  });

  charts.category = new Chart(categoryCtx, {
    type: 'bar',
    data: {
      labels: categoryLabels,
      datasets: [
        {
          label: 'Pass Rate %',
          data: categoryData,
          backgroundColor: categoryData.map((v) =>
            v >= 80
              ? 'var(--success)'
              : v >= 60
                ? 'var(--info)'
                : v >= 40
                  ? 'var(--warning)'
                  : 'var(--danger)'
          ),
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: 'var(--text-muted)' },
          grid: { color: 'var(--border)' },
        },
        x: {
          ticks: { color: 'var(--text-muted)' },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });

  // Duration Chart (placeholder for now)
  const durationCtx = document.getElementById('duration-chart').getContext('2d');
  charts.duration = new Chart(durationCtx, {
    type: 'line',
    data: {
      labels: data.files.slice(0, 10).map((f) => f.file.split('/').pop()),
      datasets: [
        {
          label: 'Duration (ms)',
          data: data.files.slice(0, 10).map((f) => f.duration || 0),
          borderColor: 'var(--primary)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          ticks: { color: 'var(--text-muted)' },
          grid: { color: 'var(--border)' },
        },
        x: {
          ticks: { color: 'var(--text-muted)', maxRotation: 45 },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });

  // Pass Rate Gauge (simplified)
  const passrateCtx = document.getElementById('passrate-chart').getContext('2d');
  charts.passrate = new Chart(passrateCtx, {
    type: 'pie',
    data: {
      labels: ['Pass Rate', 'Fail Rate'],
      datasets: [
        {
          data: [metrics.passRate, metrics.failRate],
          backgroundColor: ['var(--success)', 'var(--danger)'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: 'var(--text)', padding: 20 } },
      },
    },
  });
}

function renderCategories(metrics) {
  const container = document.getElementById('categories-container');
  const categories = Object.values(metrics.categories).filter((c) => c.files.length > 0);

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
      ${categories
        .map((cat) => {
          const total = cat.passed + cat.failed;
          const passRate = total > 0 ? (cat.passed / total) * 100 : 0;
          const statusColor = cat.failed === 0 ? 'var(--success)' : 'var(--danger)';

          return `
          <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid var(--border);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">${cat.icon}</div>
            <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem;">${cat.name}</div>
            <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">
              ${cat.files.length} plików
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 1.5rem; font-weight: 900; color: ${statusColor};">
                ${cat.passed}/${total}
              </span>
              <span style="font-size: 0.9rem; color: var(--text-muted);">
                ${passRate.toFixed(0)}% pass
              </span>
            </div>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}

function renderFileTree(data, metrics) {
  const container = document.getElementById('file-tree-container');

  // Sort: failing files first, then by name
  const sortedFiles = [...data.files].sort((a, b) => {
    if (a.failed > 0 && b.failed === 0) return -1;
    if (a.failed === 0 && b.failed > 0) return 1;
    return a.file.localeCompare(b.file);
  });

  container.innerHTML = `
    <div class="file-tree">
      <div class="file-tree-item" style="background: rgba(0,0,0,0.2); font-weight: 700;">
        <div></div>
        <div>Plik Testowy</div>
        <div style="text-align: center;">Passed</div>
        <div style="text-align: center;">Failed</div>
        <div style="text-align: center;">Duration</div>
      </div>
      ${sortedFiles
        .map(
          (f) => `
        <div class="file-tree-item">
          <div class="file-status">${f.failed > 0 ? '❌' : '✅'}</div>
          <div class="file-name" title="${f.file}">${f.file.split('/').pop()}</div>
          <div class="file-stat pass">${f.passed}</div>
          <div class="file-stat ${f.failed > 0 ? 'fail' : 'pass'}">${f.failed}</div>
          <div class="file-stat" style="background: rgba(66, 153, 225, 0.2); color: var(--info);">
            ${((f.duration || 0) / 1000).toFixed(2)}s
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function renderFailures(data) {
  if (data.failures.length === 0) {
    document.getElementById('failures-section').style.display = 'none';
    return;
  }

  document.getElementById('failures-section').style.display = 'block';
  document.getElementById('fail-count').textContent = `${data.failures.length} nieudanych testów`;

  const container = document.getElementById('failures-container');
  container.innerHTML = data.failures
    .map(
      (f) => `
    <div class="failure-card">
      <div class="failure-file">📄 ${f.file}</div>
      <div class="failure-test">🧪 ${f.test}</div>
      <div class="failure-error">${f.error || 'Assertion failed'}</div>
    </div>
  `
    )
    .join('');
}

function renderMetrics(metrics) {
  const container = document.getElementById('metrics-container');

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
      <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 0.75rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Test Pass Rate</div>
        <div style="font-size: 2rem; font-weight: 900; color: var(--success);">${metrics.passRate.toFixed(2)}%</div>
        <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
          ${dashboardData.summary.passed} / ${dashboardData.summary.total} testów
        </div>
      </div>
      
      <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 0.75rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Test Fail Rate</div>
        <div style="font-size: 2rem; font-weight: 900; color: ${metrics.failRate > 0 ? 'var(--danger)' : 'var(--success)'};">
          ${metrics.failRate.toFixed(2)}%
        </div>
        <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
          ${dashboardData.summary.failed} nieudanych testów
        </div>
      </div>
      
      <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 0.75rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Avg Test Duration</div>
        <div style="font-size: 2rem; font-weight: 900; color: var(--info);">
          ${(metrics.avgTestDuration / 1000).toFixed(2)}s
        </div>
        <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
          na plik testowy
        </div>
      </div>
      
      <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 0.75rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">File Pass Rate</div>
        <div style="font-size: 2rem; font-weight: 900; color: var(--success);">
          ${metrics.filePassRate.toFixed(2)}%
        </div>
        <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
          ${metrics.passingFiles} / ${metrics.totalFiles} plików bez błędów
        </div>
      </div>
      
      <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 0.75rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">High Coverage Files (≥80%)</div>
        <div style="font-size: 2rem; font-weight: 900; color: var(--success);">
          ${metrics.highCoverageFiles}
        </div>
        <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
          plików z wysokim coverage
        </div>
      </div>
      
      <div style="background: rgba(0,0,0,0.2); padding: 1.5rem; border-radius: 0.75rem;">
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Low Coverage Files (<50%)</div>
        <div style="font-size: 2rem; font-weight: 900; color: ${metrics.lowCoverageFiles > 0 ? 'var(--danger)' : 'var(--success)'};">
          ${metrics.lowCoverageFiles}
        </div>
        <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">
          wymaga poprawy
        </div>
      </div>
    </div>
  `;
}

function renderExternalServices() {
  const container = document.getElementById('external-services-container');
  const services = window.EXTERNAL_SERVICES_DATA || dashboardData?.external_services;

  if (!services) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <p>No external services data available. Run:</p>
        <code style="background: rgba(0,0,0,0.3); padding: 0.5rem 1rem; border-radius: 0.5rem;">
          node scripts/monitor-external-services.js
        </code>
      </div>
    `;
    return;
  }

  const github = services.github || {};
  const sentry = services.sentry || {};
  const railway = services.railway || {};
  const vercel = services.vercel || {};

  container.innerHTML = `
    <div class="services-grid">
      <!-- GitHub Actions -->
      <div class="service-card">
        <div class="service-header">
          <div class="service-name">🐙 GitHub Actions</div>
          <span class="service-status-badge ${github.status === 'connected' ? 'connected' : github.status === 'local-only' ? 'configured' : 'not-configured'}">
            ${github.status === 'connected' ? '● Connected' : github.status === 'local-only' ? '◐ Local Only' : '○ Not Configured'}
          </span>
        </div>
        <div class="service-metrics">
          <div class="service-metric">
            <div class="service-metric-label">Workflows</div>
            <div class="service-metric-value">${github.total_workflows || github.total_runs || 0}</div>
          </div>
          <div class="service-metric">
            <div class="service-metric-label">Success Rate</div>
            <div class="service-metric-value" style="color: ${github.success_rate >= 80 ? 'var(--success)' : 'var(--warning)'};">
              ${github.success_rate || 'N/A'}%
            </div>
          </div>
        </div>
        ${github.note ? `<div class="service-note">💡 ${github.note}</div>` : ''}
      </div>

      <!-- Sentry -->
      <div class="service-card">
        <div class="service-header">
          <div class="service-name">🔴 Sentry</div>
          <span class="service-status-badge ${sentry.configured ? 'configured' : 'not-configured'}">
            ${sentry.configured ? '● Configured' : '○ Not Configured'}
          </span>
        </div>
        <div class="service-metrics">
          <div class="service-metric">
            <div class="service-metric-label">DSN Configured</div>
            <div class="service-metric-value" style="color: ${sentry.has_dsn ? 'var(--success)' : 'var(--danger)'};">
              ${sentry.has_dsn ? '✓ Yes' : '✗ No'}
            </div>
          </div>
          <div class="service-metric">
            <div class="service-metric-label">API Access</div>
            <div class="service-metric-value" style="color: ${sentry.has_dsn ? 'var(--warning)' : 'var(--text-muted)'};">
              ${sentry.has_dsn ? '⚠ Limited' : '○ None'}
            </div>
          </div>
        </div>
        ${sentry.note ? `<div class="service-note">💡 ${sentry.note}</div>` : ''}
      </div>

      <!-- Railway -->
      <div class="service-card">
        <div class="service-header">
          <div class="service-name">🚂 Railway</div>
          <span class="service-status-badge ${railway.configured ? 'configured' : 'not-configured'}">
            ${railway.configured ? '● Configured' : '○ Not Configured'}
          </span>
        </div>
        <div class="service-metrics">
          <div class="service-metric">
            <div class="service-metric-label">Token Configured</div>
            <div class="service-metric-value" style="color: ${railway.has_token ? 'var(--success)' : 'var(--warning)'};">
              ${railway.has_token ? '✓ Yes' : '⚠ No'}
            </div>
          </div>
          <div class="service-metric">
            <div class="service-metric-label">Deployments</div>
            <div class="service-metric-value">N/A</div>
          </div>
        </div>
        ${railway.note ? `<div class="service-note">💡 ${railway.note}</div>` : ''}
      </div>

      <!-- Vercel -->
      <div class="service-card">
        <div class="service-header">
          <div class="service-name">▲ Vercel</div>
          <span class="service-status-badge ${vercel.configured ? 'configured' : 'not-configured'}">
            ${vercel.configured ? '● Configured' : '○ Not Configured'}
          </span>
        </div>
        <div class="service-metrics">
          <div class="service-metric">
            <div class="service-metric-label">Project</div>
            <div class="service-metric-value">${vercel.project_name || 'N/A'}</div>
          </div>
          <div class="service-metric">
            <div class="service-metric-label">Framework</div>
            <div class="service-metric-value">${vercel.framework || 'N/A'}</div>
          </div>
        </div>
        ${vercel.note ? `<div class="service-note">💡 ${vercel.note}</div>` : ''}
      </div>
    </div>

    ${
      services.timestamp
        ? `
      <div style="margin-top: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
        Last checked: ${new Date(services.timestamp).toLocaleString('pl-PL')}
      </div>
    `
        : ''
    }
  `;
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function exportJSON() {
  const dataStr = JSON.stringify(dashboardData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test-results-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

window.exportJSON = exportJSON;

// ─────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', loadDashboard);
