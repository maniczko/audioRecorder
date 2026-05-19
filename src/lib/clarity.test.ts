import { describe, expect, it } from 'vitest';

import { initClarity } from './clarity';

function createDocument() {
  const doc = document.implementation.createHTMLDocument('clarity-test');
  const existingScript = doc.createElement('script');
  doc.head.appendChild(existingScript);
  return doc;
}

describe('initClarity', () => {
  it('does not inject a script when the project id is missing', () => {
    const doc = createDocument();
    const win = {} as Window & { clarity?: unknown };

    expect(initClarity('', win as never, doc)).toBe(false);
    expect(doc.querySelectorAll('script[src*="clarity.ms"]').length).toBe(0);
  });

  it('rejects unresolved Vite placeholder values', () => {
    const doc = createDocument();
    const win = {} as Window & { clarity?: unknown };

    expect(initClarity('%VITE_CLARITY_ID%', win as never, doc)).toBe(false);
    expect(doc.querySelectorAll('script[src*="clarity.ms"]').length).toBe(0);
  });

  it('injects Clarity only for an explicit configured id', () => {
    const doc = createDocument();
    const win = {} as Window & { clarity?: unknown };

    expect(initClarity('abc123', win as never, doc)).toBe(true);

    const script = doc.querySelector('script[src="https://www.clarity.ms/tag/abc123"]');
    expect(script).toBeTruthy();
    expect(typeof win.clarity).toBe('function');
  });

  it('does not inject a duplicate script when Clarity already exists', () => {
    const doc = createDocument();
    const win = { clarity: () => undefined } as Window & { clarity?: unknown };

    expect(initClarity('abc123', win as never, doc)).toBe(false);
    expect(doc.querySelectorAll('script[src*="clarity.ms"]').length).toBe(0);
  });
});
