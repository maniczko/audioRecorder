import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

interface AccessibilityIssue {
  file: string;
  line: number;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

const { checkAltText } = require('./accessibility-audit.cjs') as {
  checkAltText: () => AccessibilityIssue[];
};

describe('accessibility audit', () => {
  it('allows decorative hidden images with empty alt text', () => {
    const issues = checkAltText().filter(
      (issue) =>
        issue.file.replace(/\\/g, '/').endsWith('components/brand/VoiceBobrBrand.tsx') &&
        issue.rule === 'img-alt-empty'
    );

    expect(issues).toEqual([]);
  });
});
