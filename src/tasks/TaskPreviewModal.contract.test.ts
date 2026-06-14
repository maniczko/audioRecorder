import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const styles = readFileSync(resolve(__dirname, 'TasksWorkspaceViewStyles.css'), 'utf8');
const tasksTab = readFileSync(resolve(__dirname, '../TasksTab.tsx'), 'utf8');

describe('Task preview modal layout contract', () => {
  it('keeps the preview modal compact with internal scrolling', () => {
    expect(styles).toContain('max-height: min(820px, calc(100dvh - 48px))');
    expect(styles).toContain('.task-detail-form-modal-body');
    expect(styles).toMatch(/\.task-detail-form-modal-body\s*{[^}]*overflow-y:\s*auto/s);
    expect(styles).toMatch(/\.task-detail-form-modal-footer\s*{[^}]*position:\s*sticky/s);
  });

  it('uses accessible footer and close-button touch targets', () => {
    expect(styles).toMatch(/\.task-create-modal-close\s*{[^}]*width:\s*44px[^}]*height:\s*44px/s);
    expect(styles).toMatch(
      /\.task-create-modal-primary,\s*\.task-create-modal-secondary\s*{[^}]*min-height:\s*44px/s
    );
  });

  it('surfaces an explicit autosave status in the task preview footer', () => {
    expect(tasksTab).toContain('task-detail-save-status');
    expect(tasksTab).toContain('Zapisano automatycznie');
    expect(tasksTab).toContain('Zapisywanie...');
    expect(tasksTab).toContain('Błąd zapisu');
    expect(tasksTab).toContain('aria-live="polite"');
  });
});
