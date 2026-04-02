/**
 * Accessibility Audit Script
 *
 * Sprawdza podstawowe wymagania accessibility w kodzie źródłowym.
 * Może być używany w CI/CD.
 *
 * Uzycie:
 *   node scripts/accessibility-audit.js
 *   node scripts/accessibility-audit.js --ci
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '..', 'src');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');

// Kolory do outputu
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

/**
 * Check 1: Alt text for images
 */
function checkAltText() {
  const issues = [];
  const files = findFiles(SRC_DIR, ['.tsx', '.jsx']);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for img tags without alt
      if (/<img[^>]*>/i.test(line)) {
        if (!/alt\s*=/i.test(line) && !/aria-hidden\s*=\s*["']true["']/i.test(line)) {
          issues.push({
            file: path.relative(SRC_DIR, file),
            line: index + 1,
            rule: 'img-alt',
            message: 'Img tag without alt attribute',
            severity: 'error',
          });
        }
      }

      // Check for empty alt
      if (/<img[^>]*alt\s*=\s*["']{2}/i.test(line)) {
        issues.push({
          file: path.relative(SRC_DIR, file),
          line: index + 1,
          rule: 'img-alt-empty',
          message: 'Img tag with empty alt attribute',
          severity: 'warning',
        });
      }
    });
  }

  return issues;
}

/**
 * Check 2: ARIA labels for interactive elements
 */
function checkAriaLabels() {
  const issues = [];
  const files = findFiles(SRC_DIR, ['.tsx', '.jsx']);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for buttons with only icons
      if (/<button[^>]*>[^<]*<svg/i.test(line) || /<button[^>]*>[^<]*<i\s/i.test(line)) {
        if (!/aria-label\s*=/i.test(line) && !/aria-labelledby\s*=/i.test(line)) {
          issues.push({
            file: path.relative(SRC_DIR, file),
            line: index + 1,
            rule: 'button-aria-label',
            message: 'Icon button without aria-label',
            severity: 'error',
          });
        }
      }

      // Check for inputs without labels
      if (/<input[^>]*type\s*=\s*["'](text|email|password|search|tel|url)["'][^>]*>/i.test(line)) {
        if (
          !/aria-label\s*=/i.test(line) &&
          !/aria-labelledby\s*=/i.test(line) &&
          !/id\s*=/i.test(line)
        ) {
          issues.push({
            file: path.relative(SRC_DIR, file),
            line: index + 1,
            rule: 'input-label',
            message: 'Input without label or aria-label',
            severity: 'warning',
          });
        }
      }
    });
  }

  return issues;
}

/**
 * Check 3: Heading hierarchy
 */
function checkHeadingHierarchy() {
  const issues = [];
  const files = findFiles(SRC_DIR, ['.tsx', '.jsx']);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    let lastHeading = 0;

    lines.forEach((line, index) => {
      const headingMatch = line.match(/<h([1-6])[^>]*>/gi);
      if (headingMatch) {
        const headingLevel = parseInt(headingMatch[0].match(/h([1-6])/i)[1]);

        // Check for skipped heading levels
        if (headingLevel > lastHeading + 1 && lastHeading > 0) {
          issues.push({
            file: path.relative(SRC_DIR, file),
            line: index + 1,
            rule: 'heading-skip',
            message: `Heading hierarchy skip: h${lastHeading} → h${headingLevel}`,
            severity: 'warning',
          });
        }

        lastHeading = headingLevel;
      }
    });
  }

  return issues;
}

/**
 * Check 4: Focus management
 */
function checkFocusManagement() {
  const issues = [];
  const files = findFiles(SRC_DIR, ['.tsx', '.jsx']);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');

    // Check for tabIndex usage
    if (/tabIndex\s*=\s*["']-1["']/.test(content)) {
      // tabIndex=-1 is OK for programmatic focus
      continue;
    }

    if (
      /tabIndex\s*=\s*["'][0-9]+["']/.test(content) &&
      !/tabIndex\s*=\s*["']0["']/.test(content)
    ) {
      issues.push({
        file: path.relative(SRC_DIR, file),
        line: 0,
        rule: 'tabindex-positive',
        message: 'Positive tabIndex found - avoid manual tab order',
        severity: 'warning',
      });
    }
  }

  return issues;
}

/**
 * Check 5: Color contrast (basic check for inline styles)
 */
function checkColorContrast() {
  const issues = [];
  const files = findFiles(SRC_DIR, ['.tsx', '.jsx', '.css']);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for light gray text
      if (/(color|background-color):\s*#?(ccc|ddd|eee|f0f0f0|f5f5f5)/i.test(line)) {
        issues.push({
          file: path.relative(SRC_DIR, file),
          line: index + 1,
          rule: 'color-contrast',
          message: 'Potential low contrast color detected',
          severity: 'info',
        });
      }
    });
  }

  return issues;
}

/**
 * Check 6: Form accessibility
 */
function checkFormAccessibility() {
  const issues = [];
  const files = findFiles(SRC_DIR, ['.tsx', '.jsx']);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for select without label
      if (/<select[^>]*>/i.test(line)) {
        if (
          !/aria-label\s*=/i.test(line) &&
          !/aria-labelledby\s*=/i.test(line) &&
          !/id\s*=/i.test(line)
        ) {
          issues.push({
            file: path.relative(SRC_DIR, file),
            line: index + 1,
            rule: 'select-label',
            message: 'Select without label or aria-label',
            severity: 'warning',
          });
        }
      }
    });
  }

  return issues;
}

// Helper functions
function findFiles(dir, extensions) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        results = results.concat(findFiles(filePath, extensions));
      }
    } else if (extensions.includes(path.extname(file))) {
      results.push(filePath);
    }
  });

  return results;
}

function runAudit() {
  log('\n🔍 Starting Accessibility Audit...\n', 'cyan');

  const checks = [
    { name: 'Alt Text', fn: checkAltText },
    { name: 'ARIA Labels', fn: checkAriaLabels },
    { name: 'Heading Hierarchy', fn: checkHeadingHierarchy },
    { name: 'Focus Management', fn: checkFocusManagement },
    { name: 'Color Contrast', fn: checkColorContrast },
    { name: 'Form Accessibility', fn: checkFormAccessibility },
  ];

  const allIssues = [];

  for (const check of checks) {
    log(`  Running: ${check.name}...`, 'blue');
    const issues = check.fn();
    allIssues.push(...issues);

    if (issues.length === 0) {
      log(`    ✅ ${check.name}: No issues`, 'green');
    } else {
      log(`    ⚠️  ${check.name}: ${issues.length} issue(s)`, 'yellow');
    }
  }

  // Generate report
  ensureReportsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `a11y-audit-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(allIssues, null, 2));

  // Summary
  log('\n📊 Summary:', 'cyan');
  const bySeverity = {
    error: allIssues.filter((i) => i.severity === 'error').length,
    warning: allIssues.filter((i) => i.severity === 'warning').length,
    info: allIssues.filter((i) => i.severity === 'info').length,
  };

  log(`  Errors: ${bySeverity.error}`, bySeverity.error > 0 ? 'red' : 'green');
  log(`  Warnings: ${bySeverity.warning}`, bySeverity.warning > 0 ? 'yellow' : 'green');
  log(`  Info: ${bySeverity.info}`, 'blue');
  log(`\n📄 Report saved to: ${reportPath}`, 'cyan');

  // CI mode - exit with error if there are errors
  if (process.argv.includes('--ci') && bySeverity.error > 0) {
    log('\n❌ Accessibility audit failed with errors', 'red');
    process.exit(1);
  }

  return allIssues;
}

// Run if called directly
if (require.main === module) {
  runAudit();
}

module.exports = { runAudit, checkAltText, checkAriaLabels };
