/**
 * Build Output Sanity Tests
 *
 * These tests verify that our Vite config and Vercel deployment config
 * are in sync so that production deploys never fail silently.
 *
 * Catches the class of bug where:
 *  - vite.config.js outputs to "build/" but Vercel expects "dist/"
 *  - manualChunks uses an incompatible signature for the bundler version
 *  - vercel.json references a directory that doesn't match vite.config.js
 */
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

describe('Build & Deploy Configuration', () => {
  test('vite.config.js outDir matches vercel.json outputDirectory', () => {
    const viteConfig = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf-8');
    const outDirMatch = viteConfig.match(/outDir:\s*['"]([^'"]+)['"]/);
    expect(outDirMatch).not.toBeNull();
    const viteOutDir = outDirMatch![1];

    const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8'));
    expect(vercelJson.outputDirectory).toBe(viteOutDir);
  });

  test('vercel.json exists and has required fields', () => {
    const vercelPath = path.join(ROOT, 'vercel.json');
    expect(fs.existsSync(vercelPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
    expect(config.outputDirectory).toBeDefined();
    expect(config.buildCommand).toBeDefined();
  });

  test('vite.config.js manualChunks is a function (required by Rolldown/Vite 8+)', () => {
    const viteConfig = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf-8');
    
    // Object-style manualChunks: { 'name': ['path'] } is NOT supported by Rolldown
    const hasObjectChunks = /manualChunks:\s*\{/.test(viteConfig);
    expect(hasObjectChunks).toBe(false);

    // If manualChunks is present, it must be a function
    if (viteConfig.includes('manualChunks')) {
      const hasFunctionChunks = /manualChunks\s*\(/.test(viteConfig);
      expect(hasFunctionChunks).toBe(true);
    }
  });

  test('npm run build produces index.html in the configured output directory', async () => {
    const viteConfig = fs.readFileSync(path.join(ROOT, 'vite.config.js'), 'utf-8');
    const outDirMatch = viteConfig.match(/outDir:\s*['"]([^'"]+)['"]/);
    const outDir = outDirMatch ? outDirMatch[1] : 'dist';
    const indexPath = path.join(ROOT, outDir, 'index.html');
    
    // This test validates that a previous build succeeded.
    // CI runs `npm run build` before tests, so this file should exist.
    // Locally, skip gracefully if no build has been run.
    if (!fs.existsSync(path.join(ROOT, outDir))) {
      console.warn(`⚠ Build directory "${outDir}/" not found — skipping (run "npm run build" first)`);
      return;
    }
    
    expect(fs.existsSync(indexPath)).toBe(true);
  });
});
