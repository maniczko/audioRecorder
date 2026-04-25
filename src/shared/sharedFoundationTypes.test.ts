import fs from 'node:fs';
import path from 'node:path';

describe('shared foundation typing guard', () => {
  test.each(['src/shared/contracts.ts', 'src/shared/MentionTextarea.tsx'])(
    '%s avoids explicit any in shared contracts',
    (relativePath) => {
      const source = fs.readFileSync(path.resolve(relativePath), 'utf8');

      expect(source).not.toMatch(/\bany\b|as any|@ts-ignore/);
    }
  );
});
