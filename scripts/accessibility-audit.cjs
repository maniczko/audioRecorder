/**
 * Accessibility Audit Script
 *
 * Sprawdza podstawowe wymagania accessibility w kodzie zrodlowym.
 * Moze byc uzywany w CI/CD.
 *
 * Uzycie:
 *   node scripts/accessibility-audit.js
 *   node scripts/accessibility-audit.js --ci
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const TEST_FILE_PATTERN = /\.(test|spec)\.(tsx|jsx)$/i;

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

function lineNumberAt(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

function collectOpeningTags(content, tagName) {
  const tags = [];
  const pattern = new RegExp(`<${tagName}\\b[\\s\\S]*?>`, 'gi');
  for (const match of content.matchAll(pattern)) {
    tags.push({
      tag: match[0],
      line: lineNumberAt(content, match.index || 0),
    });
  }
  return tags;
}

function collectElements(content, tagName) {
  const elements = [];
  const pattern = new RegExp(`<${tagName}\\b[\\s\\S]*?<\\/${tagName}>`, 'gi');
  for (const match of content.matchAll(pattern)) {
    elements.push({
      element: match[0],
      line: lineNumberAt(content, match.index || 0),
    });
  }
  return elements;
}

function hasAttribute(markup, attributeName) {
  return new RegExp(`\\b${attributeName}\\s*=`, 'i').test(markup);
}

function isAriaHidden(markup) {
  return /\baria-hidden\s*=\s*["']true["']/i.test(markup);
}

function hasEmptyAlt(markup) {
  return /\balt\s*=\s*["']\s*["']/i.test(markup);
}

function hasVisibleText(markup) {
  const withoutIcons = markup
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<i\b[\s\S]*?<\/i>/gi, ' ');
  const text = withoutIcons
    .replace(/<[^>]+>/g, ' ')
    .replace(/[{}"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /[\p{L}\p{N}]/u.test(text);
}

/**
 * Check 1: Alt text for images
 */
function checkAltText() {
  const issues = [];
  const files = findFiles(SRC_DIR, ['.tsx', '.jsx']);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const tags = collectOpeningTags(content, 'img');

    tags.forEach(({ tag, line }) => {
      if (!hasAttribute(tag, 'alt') && !isAriaHidden(tag)) {
        issues.push({
          file: path.relative(SRC_DIR, file),
          line,
          rule: 'img-alt',
          message: 'Img tag without alt attribute',
          severity: 'error',
        });
      }

      if (hasEmptyAlt(tag) && !isAriaHidden(tag)) {
        issues.push({
          file: path.relative(SRC_DIR, file),
          line,
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
    const buttons = collectElements(content, 'button');
    const inputs = collectOpeningTags(content, 'input');

    buttons.forEach(({ element, line }) => {
      if (/<svg\b/i.test(element) || /<i\s/i.test(element)) {
        if (
          !hasAttribute(element, 'aria-label') &&
          !hasAttribute(element, 'aria-labelledby') &&
          !hasVisibleText(element)
        ) {
          issues.push({
            file: path.relative(SRC_DIR, file),
            line,
            rule: 'button-aria-label',
            message: 'Icon button without aria-label',
            severity: 'error',
          });
        }
      }
    });

    inputs.forEach(({ tag, line }) => {
      if (/\btype\s*=\s*["'](text|email|password|search|tel|url)["']/i.test(tag)) {
        if (
          !hasAttribute(tag, 'aria-label') &&
          !hasAttribute(tag, 'aria-labelledby') &&
          !hasAttribute(tag, 'id')
        ) {
          issues.push({
            file: path.relative(SRC_DIR, file),
            line,
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
            message: `Heading hierarchy skip: h${lastHeading} -> h${headingLevel}`,
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
    const selects = collectOpeningTags(content, 'select');

    selects.forEach(({ tag, line }) => {
      if (
        !hasAttribute(tag, 'aria-label') &&
        !hasAttribute(tag, 'aria-labelledby') &&
        !hasAttribute(tag, 'id')
      ) {
        issues.push({
          file: path.relative(SRC_DIR, file),
          line,
          rule: 'select-label',
          message: 'Select without label or aria-label',
          severity: 'warning',
        });
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
    } else if (extensions.includes(path.extname(file)) && !TEST_FILE_PATTERN.test(filePath)) {
      results.push(filePath);
    }
  });

  return results;
}

function runAudit() {
  log('\nStarting Accessibility Audit...\n', 'cyan');

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
      log(`    PASS ${check.name}: No issues`, 'green');
    } else {
      log(`    WARN ${check.name}: ${issues.length} issue(s)`, 'yellow');
    }
  }

  // Generate report
  ensureReportsDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `a11y-audit-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(allIssues, null, 2));

  // Summary
  log('\nSummary:', 'cyan');
  const bySeverity = {
    error: allIssues.filter((i) => i.severity === 'error').length,
    warning: allIssues.filter((i) => i.severity === 'warning').length,
    info: allIssues.filter((i) => i.severity === 'info').length,
  };

  log(`  Errors: ${bySeverity.error}`, bySeverity.error > 0 ? 'red' : 'green');
  log(`  Warnings: ${bySeverity.warning}`, bySeverity.warning > 0 ? 'yellow' : 'green');
  log(`  Info: ${bySeverity.info}`, 'blue');
  log(`\nReport saved to: ${reportPath}`, 'cyan');

  if (process.argv.includes('--ci') && bySeverity.error > 0) {
    log('\nAccessibility audit failed with errors', 'red');
    process.exit(1);
  }

  return allIssues;
}

// Run if called directly
if (require.main === module) {
  runAudit();
}

module.exports = { runAudit, checkAltText, checkAriaLabels };
