import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { isDecorativeImageLine } = require('../scripts/accessibility-audit.cjs') as {
  isDecorativeImageLine: (line: string) => boolean;
};

describe('accessibility audit image alt rules', () => {
  it('accepts intentionally decorative images with empty alt and aria-hidden', () => {
    expect(
      isDecorativeImageLine('<img src={mascotSrc} alt="" aria-hidden="true" loading="eager" />')
    ).toBe(true);
  });

  it('does not treat empty alt without decorative semantics as decorative', () => {
    expect(isDecorativeImageLine('<img src={avatarSrc} alt="" loading="lazy" />')).toBe(false);
  });
});
