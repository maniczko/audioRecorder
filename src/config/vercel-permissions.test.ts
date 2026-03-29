// ─────────────────────────────────────────────────────────────────
// Issue #0 — Permissions-Policy header blocked microphone & camera
// Date: 2026-03-29
// Bug: vercel.json had microphone=(), camera=() which completely
//      blocked getUserMedia even when the user granted browser permission.
//      Console showed: "[Violation] Permissions policy violation:
//      microphone is not allowed in this document."
// Fix: changed to microphone=(self), camera=(self) to allow own origin
// ─────────────────────────────────────────────────────────────────
import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

function getPermissionsPolicy(): string {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8'));
  const globalHeaders = config.headers.find(
    (h: { source: string }) => h.source === '/(.*)'
  );
  const ppHeader = globalHeaders.headers.find(
    (h: { key: string }) => h.key === 'Permissions-Policy'
  );
  return ppHeader.value as string;
}

describe('Regression: #0 — Permissions-Policy must allow microphone and camera', () => {
  test('Permissions-Policy header allows microphone=(self)', () => {
    expect(getPermissionsPolicy()).toContain('microphone=(self)');
  });

  test('Permissions-Policy header allows camera=(self)', () => {
    expect(getPermissionsPolicy()).toContain('camera=(self)');
  });

  test('Permissions-Policy header does NOT block microphone with empty ()', () => {
    // microphone=() means "deny all" — must never appear
    expect(getPermissionsPolicy()).not.toMatch(/microphone=\(\)/);
  });
});
