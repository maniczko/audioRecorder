import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const mainViewTargets = [
  { screen: 'Auth', file: 'src/components/auth/AuthCredentialsForm.tsx' },
  { screen: 'Auth', file: 'src/components/auth/AuthModeTabs.tsx' },
  { screen: 'Auth', file: 'src/components/auth/PasswordResetForm.tsx' },
  { screen: 'Topbar', file: 'src/Topbar.tsx' },
  { screen: 'Studio', file: 'src/studio/StudioMeetingView.tsx' },
  { screen: 'Recordings', file: 'src/RecordingsTab.tsx' },
  { screen: 'Calendar', file: 'src/CalendarTab.tsx' },
  { screen: 'Tasks', file: 'src/TasksTab.tsx' },
  { screen: 'People', file: 'src/PeopleTab.tsx' },
  { screen: 'Notes', file: 'src/NotesTab.tsx' },
  { screen: 'Profile', file: 'src/ProfileTab.tsx' },
  { screen: 'CommandPalette', file: 'src/CommandPalette.tsx' },
  { screen: 'NotificationCenter', file: 'src/NotificationCenter.tsx' },
];

const defaultContractsPath = path.join(rootDir, 'docs/testing/ui-action-contracts.json');
const defaultReportDir = path.join(rootDir, 'reports/ui-action-inventory');

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function relativeToRoot(filePath, root = rootDir) {
  return toPosixPath(path.relative(root, filePath));
}

function getJsxAttribute(attributes, name) {
  return attributes.find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText() === name
  );
}

function attributeValue(attribute, sourceFile) {
  if (!attribute || !attribute.initializer) return '';
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text.trim();
  if (ts.isJsxExpression(attribute.initializer)) {
    return attribute.initializer.expression?.getText(sourceFile).trim() ?? '';
  }
  return attribute.initializer.getText(sourceFile).trim();
}

function jsxText(node, sourceFile) {
  const parts = [];

  function visit(child) {
    if (ts.isJsxText(child)) {
      const text = child.getText(sourceFile).replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
      return;
    }
    if (ts.isJsxExpression(child) && child.expression) {
      if (
        ts.isStringLiteral(child.expression) ||
        ts.isNoSubstitutionTemplateLiteral(child.expression)
      ) {
        const text = child.expression.text.replace(/\s+/g, ' ').trim();
        if (text) parts.push(text);
      } else {
        const text = child.expression.getText(sourceFile).replace(/\s+/g, ' ').trim();
        if (text && !/^[{}()[\].,?:+\-*/|&!<>=\s]+$/.test(text)) parts.push(`{${text}}`);
      }
      return;
    }
    ts.forEachChild(child, visit);
  }

  ts.forEachChild(node, visit);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function actionLabel(openingElement, node, sourceFile) {
  const attributes = openingElement.attributes.properties;
  const ariaLabel = attributeValue(getJsxAttribute(attributes, 'aria-label'), sourceFile);
  if (ariaLabel) return ariaLabel;
  const title = attributeValue(getJsxAttribute(attributes, 'title'), sourceFile);
  if (title) return title;
  const placeholder = attributeValue(getJsxAttribute(attributes, 'placeholder'), sourceFile);
  if (placeholder) return placeholder;
  const name = attributeValue(getJsxAttribute(attributes, 'name'), sourceFile);
  if (name) return name;
  const text = jsxText(node, sourceFile);
  if (text) return text;
  const actionId = attributeValue(getJsxAttribute(attributes, 'data-action-id'), sourceFile);
  if (actionId) return actionId;
  const className = attributeValue(getJsxAttribute(attributes, 'className'), sourceFile);
  return className ? `[class:${className}]` : '[unlabeled]';
}

function roleKind(openingElement, sourceFile) {
  const role = attributeValue(
    getJsxAttribute(openingElement.attributes.properties, 'role'),
    sourceFile
  );
  if (['button', 'menuitem', 'tab'].includes(role)) return role === 'button' ? 'role-button' : role;
  return '';
}

function nativeActionKind(tagName) {
  if (tagName === 'button') return 'button';
  if (tagName === 'a') return 'link';
  if (['input', 'select', 'textarea'].includes(tagName)) return tagName;
  return '';
}

function actionKind(openingElement, sourceFile) {
  const tagName = openingElement.tagName.getText(sourceFile);
  return nativeActionKind(tagName) || roleKind(openingElement, sourceFile);
}

function hasEventHandler(openingElement, handlerName) {
  return openingElement.attributes.properties.some(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText() === handlerName
  );
}

function buildAction({ screen, relativeFile, node, openingElement, sourceFile, kind }) {
  const attributes = openingElement.attributes.properties;
  const line =
    sourceFile.getLineAndCharacterOfPosition(openingElement.getStart(sourceFile)).line + 1;
  const label = actionLabel(openingElement, node, sourceFile);
  const actionId = attributeValue(getJsxAttribute(attributes, 'data-action-id'), sourceFile);
  const disabledExpression = attributeValue(getJsxAttribute(attributes, 'disabled'), sourceFile);
  const hasOnClick = hasEventHandler(openingElement, 'onClick');
  const href = attributeValue(getJsxAttribute(attributes, 'href'), sourceFile);
  const signature = [
    relativeFile,
    line,
    kind,
    actionId || '',
    label,
    hasOnClick ? 'onClick' : 'noOnClick',
    href ? `href:${href}` : '',
    disabledExpression ? `disabled:${disabledExpression}` : 'enabled-or-dynamic',
  ].join(':');

  return {
    screen,
    file: relativeFile,
    line,
    kind,
    label,
    actionId,
    hasOnClick,
    href,
    disabledExpression,
    signature,
  };
}

export function collectUiActionsFromFiles({ root = rootDir, targets = mainViewTargets } = {}) {
  const actions = [];

  for (const target of targets) {
    const absoluteFile = path.join(root, target.file);
    if (!fs.existsSync(absoluteFile)) continue;
    const content = fs.readFileSync(absoluteFile, 'utf8');
    const sourceFile = ts.createSourceFile(
      absoluteFile,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    const relativeFile = relativeToRoot(absoluteFile, root);

    function visit(node) {
      if (ts.isJsxElement(node)) {
        const openingElement = node.openingElement;
        const kind = actionKind(openingElement, sourceFile);
        if (kind) {
          actions.push(
            buildAction({
              screen: target.screen,
              relativeFile,
              node,
              openingElement,
              sourceFile,
              kind,
            })
          );
        }
      } else if (ts.isJsxSelfClosingElement(node)) {
        const kind = actionKind(node, sourceFile);
        if (kind) {
          actions.push(
            buildAction({
              screen: target.screen,
              relativeFile,
              node,
              openingElement: node,
              sourceFile,
              kind,
            })
          );
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return actions;
}

function screenKey(action) {
  return `${action.screen}::${action.file}`;
}

export function summarizeUiActions(actions) {
  const summaries = new Map();
  for (const action of actions) {
    const key = screenKey(action);
    const existing = summaries.get(key) ?? {
      screen: action.screen,
      file: action.file,
      actionCount: 0,
      fingerprint: '',
      signatures: [],
    };
    existing.actionCount += 1;
    existing.signatures.push(action.signature);
    summaries.set(key, existing);
  }

  return [...summaries.values()]
    .map((summary) => {
      const signatureText = summary.signatures.sort().join('\n');
      return {
        screen: summary.screen,
        file: summary.file,
        actionCount: summary.actionCount,
        fingerprint: crypto.createHash('sha256').update(signatureText).digest('hex').slice(0, 16),
      };
    })
    .sort((a, b) => `${a.screen}:${a.file}`.localeCompare(`${b.screen}:${b.file}`));
}

export function loadUiActionContracts({ contractsPath = defaultContractsPath } = {}) {
  return JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
}

function readContractEvidence(root, testFiles) {
  return testFiles
    .map((testFile) => {
      const absolute = path.join(root, testFile);
      return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
    })
    .join('\n');
}

function matchesCriticalAction(action, criticalAction) {
  if (criticalAction.file && action.file !== criticalAction.file) return false;
  if (criticalAction.actionId && action.actionId !== criticalAction.actionId) return false;
  if (criticalAction.labelPattern) {
    return new RegExp(criticalAction.labelPattern).test(action.label);
  }
  return action.screen === criticalAction.screen;
}

export function findUiActionContractIssues(actions, contracts, { root = rootDir } = {}) {
  const issues = [];
  const summaries = summarizeUiActions(actions);
  const summariesByKey = new Map(
    summaries.map((summary) => [`${summary.screen}::${summary.file}`, summary])
  );
  const contractsByKey = new Map(
    contracts.screens.map((screen) => [`${screen.screen}::${screen.file}`, screen])
  );

  for (const summary of summaries) {
    const contract = contractsByKey.get(`${summary.screen}::${summary.file}`);
    if (!contract) {
      issues.push({
        type: 'missing-screen-contract',
        screen: summary.screen,
        file: summary.file,
        message: `${summary.screen} has ${summary.actionCount} actions but no screen contract`,
      });
      continue;
    }

    if (summary.actionCount !== contract.expectedActionCount) {
      issues.push({
        type: 'action-count-mismatch',
        screen: summary.screen,
        file: summary.file,
        expected: contract.expectedActionCount,
        actual: summary.actionCount,
      });
    }

    if (summary.fingerprint !== contract.fingerprint) {
      issues.push({
        type: 'fingerprint-mismatch',
        screen: summary.screen,
        file: summary.file,
        expected: contract.fingerprint,
        actual: summary.fingerprint,
      });
    }
  }

  for (const contract of contracts.screens) {
    if (!contract.owner || !String(contract.owner).trim()) {
      issues.push({
        type: 'missing-screen-owner',
        screen: contract.screen,
        file: contract.file,
      });
    }

    if (!['covered', 'ignored'].includes(contract.contractStatus)) {
      issues.push({
        type: 'invalid-screen-contract-status',
        screen: contract.screen,
        file: contract.file,
        status: contract.contractStatus,
      });
    }

    if (contract.contractStatus === 'ignored' && !String(contract.ignoreReason || '').trim()) {
      issues.push({
        type: 'missing-ignore-reason',
        screen: contract.screen,
        file: contract.file,
      });
    }

    if (!summariesByKey.has(`${contract.screen}::${contract.file}`)) {
      issues.push({
        type: 'stale-screen-contract',
        screen: contract.screen,
        file: contract.file,
      });
    }

    for (const testFile of contract.testFiles ?? []) {
      if (!fs.existsSync(path.join(root, testFile))) {
        issues.push({ type: 'missing-test-file', screen: contract.screen, file: testFile });
      }
    }

    const evidence = readContractEvidence(root, contract.testFiles ?? []);
    for (const marker of contract.testEvidence ?? []) {
      if (!evidence.includes(marker)) {
        issues.push({
          type: 'missing-test-evidence',
          screen: contract.screen,
          file: contract.file,
          marker,
        });
      }
    }
  }

  for (const criticalAction of contracts.criticalActions ?? []) {
    const interactionContract = criticalAction.interactionContract;
    const network = interactionContract?.network;
    const persistence = interactionContract?.persistence;

    if (!interactionContract) {
      issues.push({
        type: 'missing-critical-interaction-contract',
        screen: criticalAction.screen,
        id: criticalAction.id,
      });
    } else {
      if (!String(interactionContract.expectedFeedback || '').trim()) {
        issues.push({
          type: 'missing-critical-feedback-contract',
          screen: criticalAction.screen,
          id: criticalAction.id,
        });
      }
      if (!network?.method || !network?.pathPattern || !Array.isArray(network.allowedStatuses)) {
        issues.push({
          type: 'invalid-critical-network-contract',
          screen: criticalAction.screen,
          id: criticalAction.id,
        });
      }
      if (!persistence || typeof persistence.checked !== 'boolean' || !persistence.evidence) {
        issues.push({
          type: 'invalid-critical-persistence-contract',
          screen: criticalAction.screen,
          id: criticalAction.id,
        });
      }
      if (!String(interactionContract.targetCommand || '').trim()) {
        issues.push({
          type: 'missing-critical-target-command',
          screen: criticalAction.screen,
          id: criticalAction.id,
        });
      }
    }

    const matchingAction = actions.find((action) => matchesCriticalAction(action, criticalAction));
    if (!matchingAction) {
      issues.push({
        type: 'missing-critical-action',
        screen: criticalAction.screen,
        id: criticalAction.id,
      });
      continue;
    }

    const testFile = path.join(root, criticalAction.testFile);
    if (!fs.existsSync(testFile)) {
      issues.push({
        type: 'missing-critical-test-file',
        screen: criticalAction.screen,
        id: criticalAction.id,
        file: criticalAction.testFile,
      });
      continue;
    }

    const content = fs.readFileSync(testFile, 'utf8');
    if (!content.includes(criticalAction.testTitle)) {
      issues.push({
        type: 'missing-critical-test-title',
        screen: criticalAction.screen,
        id: criticalAction.id,
        testTitle: criticalAction.testTitle,
      });
    }
  }

  return issues;
}

function markdownReport(actions, summaries, issues) {
  const lines = [
    '# UI Action Inventory',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    '| Screen | File | Actions | Fingerprint |',
    '| --- | --- | ---: | --- |',
    ...summaries.map(
      (summary) =>
        `| ${summary.screen} | \`${summary.file}\` | ${summary.actionCount} | \`${summary.fingerprint}\` |`
    ),
    '',
    '## Issues',
    '',
    issues.length === 0 ? 'No inventory contract issues.' : '',
    ...issues.map((issue) => `- ${issue.type}: ${issue.screen ?? ''} ${issue.file ?? ''}`.trim()),
    '',
    '## Actions',
    '',
    '| Screen | File:line | Kind | Label | onClick | Disabled | Action ID |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...actions.map(
      (action) =>
        `| ${action.screen} | \`${action.file}:${action.line}\` | ${action.kind} | ${action.label.replace(/\|/g, '\\|')} | ${action.hasOnClick ? 'yes' : 'no'} | ${action.disabledExpression ? `\`${action.disabledExpression.replace(/\|/g, '\\|')}\`` : '-'} | ${action.actionId || '-'} |`
    ),
    '',
  ];

  return lines.join('\n');
}

export function runUiActionContractAudit({
  root = rootDir,
  contractsPath = defaultContractsPath,
  reportDir = defaultReportDir,
  writeReport = false,
} = {}) {
  const actions = collectUiActionsFromFiles({ root, targets: mainViewTargets });
  const contracts = loadUiActionContracts({ contractsPath });
  const summaries = summarizeUiActions(actions);
  const issues = findUiActionContractIssues(actions, contracts, { root });

  if (writeReport) {
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, 'latest.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), summaries, actions, issues }, null, 2)
    );
    fs.writeFileSync(path.join(reportDir, 'latest.md'), markdownReport(actions, summaries, issues));
  }

  return { actions, summaries, issues };
}

const entrypointPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const isMainModule =
  entrypointPath === path.resolve(rootDir, 'scripts/audit-ui-action-contracts.mjs');

if (isMainModule) {
  const writeReport = process.argv.includes('--write-report');
  const json = process.argv.includes('--json');
  const result = runUiActionContractAudit({ writeReport });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const summary of result.summaries) {
      console.log(
        `${summary.screen}: ${summary.actionCount} actions (${summary.file}, ${summary.fingerprint})`
      );
    }
  }

  if (result.issues.length > 0) {
    console.error('\nUI action contract audit failed:');
    for (const issue of result.issues) {
      console.error(`- ${issue.type}: ${issue.screen ?? ''} ${issue.file ?? ''}`.trim());
    }
    process.exitCode = 1;
  } else {
    console.log('\nUI action contract audit passed.');
  }
}
