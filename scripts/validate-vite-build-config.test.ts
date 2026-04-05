import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const viteConfigPath = path.resolve(process.cwd(), 'vite.config.js');
const entryPath = path.resolve(process.cwd(), 'src/index.tsx');
const cssPath = path.resolve(process.cwd(), 'src/index.css');

// ---------------------------------------------------------------
// Issue #0 - Vite build emits avoidable config and font warnings
// Date: 2026-04-04
// Bug: the frontend build warned about mixed oxc/esbuild settings and
//      unresolved Geist font files imported through CSS.
// Fix: load Geist from the entrypoint and keep Vite config free of the
//      redundant esbuild override that conflicts with OXC defaults.
// ---------------------------------------------------------------
describe('Regression: Issue #0 - Vite build stays free of avoidable warnings', () => {
  it('loads Geist from the application entrypoint instead of CSS @import', () => {
    const entry = fs.readFileSync(entryPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(entry).toContain("import '@fontsource-variable/geist';");
    expect(css).not.toContain("@import '@fontsource-variable/geist';");
  });

  it('does not keep the redundant esbuild override in Vite config', () => {
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');

    expect(viteConfig).not.toContain('esbuild:');
  });
});
