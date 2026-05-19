import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Clarity release configuration', () => {
  it('does not keep a Vite placeholder in index.html', () => {
    const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

    expect(html).not.toContain('%VITE_CLARITY_ID%');
    expect(html).not.toContain('clarity.ms/tag/%');
  });
});
