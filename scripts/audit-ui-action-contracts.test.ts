import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  collectUiActionsFromFiles,
  findUiActionContractIssues,
  loadUiActionContracts,
  mainViewTargets,
} from './audit-ui-action-contracts.mjs';

describe('audit-ui-action-contracts', () => {
  it('extracts button and role=button actions with stable metadata', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-ui-actions-'));
    const sourcePath = path.join(root, 'src/Example.tsx');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(
      sourcePath,
      [
        'export function Example() {',
        '  return <section>',
        '    <button type="button" aria-label="Save note" onClick={() => {}}>Save</button>',
        '    <div role="button" onClick={() => {}}>Open menu</div>',
        '  </section>;',
        '}',
      ].join('\n')
    );

    const actions = collectUiActionsFromFiles({
      root,
      targets: [{ screen: 'Example', file: 'src/Example.tsx' }],
    });

    expect(actions).toEqual([
      expect.objectContaining({
        screen: 'Example',
        file: 'src/Example.tsx',
        line: 3,
        kind: 'button',
        label: 'Save note',
        hasOnClick: true,
      }),
      expect.objectContaining({
        screen: 'Example',
        file: 'src/Example.tsx',
        line: 4,
        kind: 'role-button',
        label: 'Open menu',
        hasOnClick: true,
      }),
    ]);
  });

  it('extracts links, form controls, tabs, and menu items as UI actions', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'voicelog-ui-actions-'));
    const sourcePath = path.join(root, 'src/Example.tsx');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(
      sourcePath,
      [
        'export function Example() {',
        '  return <section>',
        '    <a href="/profile">Profil</a>',
        '    <input aria-label="Szukaj" />',
        '    <select aria-label="Status"><option>W toku</option></select>',
        '    <div role="tab" aria-label="Nagrania" />',
        '    <div role="menuitem" onClick={() => {}}>Usun</div>',
        '  </section>;',
        '}',
      ].join('\n')
    );

    const actions = collectUiActionsFromFiles({
      root,
      targets: [{ screen: 'Example', file: 'src/Example.tsx' }],
    });

    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'link', label: 'Profil' }),
        expect.objectContaining({ kind: 'input', label: 'Szukaj' }),
        expect.objectContaining({ kind: 'select', label: 'Status' }),
        expect.objectContaining({ kind: 'tab', label: 'Nagrania' }),
        expect.objectContaining({ kind: 'menuitem', label: 'Usun', hasOnClick: true }),
      ])
    );
  });

  it('reports an inventory mismatch when a tracked screen changes actions', () => {
    const actions = [
      {
        screen: 'Example',
        file: 'src/Example.tsx',
        line: 3,
        kind: 'button',
        label: 'Save note',
        hasOnClick: true,
        disabledExpression: '',
        actionId: '',
        signature: 'src/Example.tsx:3:button:Save note:onClick',
      },
    ];

    const issues = findUiActionContractIssues(actions, {
      schemaVersion: 1,
      screens: [
        {
          screen: 'Example',
          file: 'src/Example.tsx',
          expectedActionCount: 2,
          fingerprint: 'wrong',
          contractStatus: 'covered',
          testFiles: ['src/Example.test.tsx'],
          testEvidence: ['clicks Save note'],
          owner: 'frontend',
        },
      ],
      criticalActions: [],
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ screen: 'Example', type: 'action-count-mismatch' }),
        expect.objectContaining({ screen: 'Example', type: 'fingerprint-mismatch' }),
      ])
    );
  });

  it('keeps the repository main-view inventory covered by screen contracts', () => {
    const contracts = loadUiActionContracts();
    const actions = collectUiActionsFromFiles({ targets: mainViewTargets });

    expect(findUiActionContractIssues(actions, contracts)).toEqual([]);
  });

  it('requires the production rediarize action to have exact regression evidence', () => {
    const contracts = loadUiActionContracts();
    const rediarize = contracts.criticalActions.find(
      (action) => action.id === 'studio.rediarize-speakers'
    );

    expect(rediarize).toEqual(
      expect.objectContaining({
        screen: 'Studio',
        file: 'src/studio/StudioMeetingView.tsx',
        testFile: 'src/studio/StudioMeetingView.test.tsx',
        testTitle:
          'Regression: rediarize button uses display recording id when selected recording is missing',
      })
    );
  });

  it('requires the production voice-profile save action to have exact regression evidence', () => {
    const contracts = loadUiActionContracts();
    const saveVoiceProfile = contracts.criticalActions.find(
      (action) => action.id === 'studio.save-voice-profile-sample'
    );

    expect(saveVoiceProfile).toEqual(
      expect.objectContaining({
        screen: 'Studio',
        file: 'src/studio/StudioMeetingView.tsx',
        testFile: 'src/studio/StudioMeetingView.test.tsx',
        testTitle: 'Regression: maps voice profile 424 to an actionable audio recovery message',
      })
    );
  });

  it('requires the new-speaker action to prove it asks for a name before saving', () => {
    const contracts = loadUiActionContracts();
    const createNewSpeaker = contracts.criticalActions.find(
      (action) => action.id === 'studio.create-new-speaker'
    );

    expect(createNewSpeaker).toEqual(
      expect.objectContaining({
        screen: 'Studio',
        file: 'src/studio/StudioMeetingView.tsx',
        testFile: 'src/studio/StudioMeetingView.test.tsx',
        testTitle: 'Regression: clicking new speaker asks for a name before saving a voice profile',
      })
    );
  });

  it('requires every critical UI action to define production interaction evidence', () => {
    const contracts = loadUiActionContracts();

    for (const action of contracts.criticalActions) {
      expect(action, action.id).toEqual(
        expect.objectContaining({
          interactionContract: expect.objectContaining({
            expectedFeedback: expect.any(String),
            network: expect.objectContaining({
              method: expect.any(String),
              pathPattern: expect.any(String),
              allowedStatuses: expect.any(Array),
            }),
            persistence: expect.objectContaining({
              checked: expect.any(Boolean),
              evidence: expect.any(String),
            }),
            targetCommand: expect.any(String),
          }),
        })
      );
      expect(action.interactionContract.expectedFeedback.trim(), action.id).not.toBe('');
      expect(action.interactionContract.network.allowedStatuses.length, action.id).toBeGreaterThan(
        0
      );
      expect(action.interactionContract.persistence.evidence.trim(), action.id).not.toBe('');
      expect(action.interactionContract.targetCommand.trim(), action.id).not.toBe('');
    }
  });

  it('fails critical UI actions without feedback, network, persistence, or target command contracts', () => {
    const issues = findUiActionContractIssues(
      [
        {
          screen: 'Studio',
          file: 'src/studio/StudioMeetingView.tsx',
          line: 10,
          kind: 'button',
          label: 'Wykryj mowcow',
          actionId: '',
          hasOnClick: true,
          href: '',
          disabledExpression: '',
          signature: 'sig',
        },
      ],
      {
        schemaVersion: 1,
        screens: [
          {
            screen: 'Studio',
            file: 'src/studio/StudioMeetingView.tsx',
            expectedActionCount: 1,
            fingerprint: '4e9aeb513a7f8026',
            contractStatus: 'covered',
            testFiles: ['scripts/audit-ui-action-contracts.test.ts'],
            testEvidence: ['fails critical UI actions without feedback'],
            owner: 'frontend-studio',
          },
        ],
        criticalActions: [
          {
            id: 'studio.rediarize-speakers',
            screen: 'Studio',
            file: 'src/studio/StudioMeetingView.tsx',
            labelPattern: 'Wykryj',
            testFile: 'scripts/audit-ui-action-contracts.test.ts',
            testTitle: 'fails critical UI actions without feedback',
          },
        ],
      }
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'missing-critical-interaction-contract' }),
      ])
    );
  });

  it('requires ignored screen contracts to document an ignore reason', () => {
    const issues = findUiActionContractIssues([], {
      schemaVersion: 1,
      screens: [
        {
          screen: 'Legacy',
          file: 'src/Legacy.tsx',
          expectedActionCount: 0,
          fingerprint: '',
          contractStatus: 'ignored',
          testFiles: [],
          testEvidence: [],
          owner: 'frontend',
        },
      ],
      criticalActions: [],
    });

    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'missing-ignore-reason' })])
    );
  });
});
