import { describe, expect, it } from 'vitest';
import { isAddColumnAlreadyAppliedMigrationError } from '../database.ts';

describe('migration idempotency helpers', () => {
  it('treats duplicate ADD COLUMN errors as already applied', () => {
    expect(
      isAddColumnAlreadyAppliedMigrationError(
        "ALTER TABLE workspace_state ADD COLUMN vocabulary_json TEXT NOT NULL DEFAULT '[]'",
        new Error('duplicate column name: vocabulary_json')
      )
    ).toBe(true);

    expect(
      isAddColumnAlreadyAppliedMigrationError(
        "ALTER TABLE workspace_state ADD COLUMN vocabulary_json TEXT NOT NULL DEFAULT '[]'",
        new Error('column "vocabulary_json" of relation "workspace_state" already exists')
      )
    ).toBe(true);
  });

  it('does not hide unrelated migration errors', () => {
    expect(
      isAddColumnAlreadyAppliedMigrationError(
        'CREATE TABLE workspace_state (workspace_id TEXT PRIMARY KEY)',
        new Error('relation "workspace_state" already exists')
      )
    ).toBe(false);

    expect(
      isAddColumnAlreadyAppliedMigrationError(
        'ALTER TABLE workspace_state ADD COLUMN vocabulary_json TEXT NOT NULL DEFAULT []',
        new Error('syntax error near "["')
      )
    ).toBe(false);
  });
});
