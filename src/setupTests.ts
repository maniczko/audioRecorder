```typescript
import React from 'react';
import '@testing-library/jest-dom';
import { vi, afterEach, type Mock } from 'vitest';
import { cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

fs.mkdirSync(path.resolve(process.cwd(), 'coverage/frontend/.tmp'), { recursive: true });

// ── Global mocks BEFORE any imports ──────────────────────────────────

// ── fetch mock ───────────────────────────────────────────────────────
// Global fetch mock to prevent network errors during tests.
// Individual tests can override with vi.spyOn or vi.mocked.
const fetchMock = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
  })
) as Mock;
global.fetch = fetchMock;

// ── localStorage / sessionStorage mock ───────────────────────────────
const mockStorage = () => {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const k in store) delete store[k];
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};
const mockLocalStorage = mockStorage();
const mockSessionStorage = mockStorage();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage, writable: true });

// ── matchMedia mock ──────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── ResizeObserver mock ──────────────────────────────────────────────
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── IntersectionObserver mock ────────────────────────────────────────
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── BroadcastChannel mock ────────────────────────────────────────────
global.BroadcastChannel = vi.fn().mockImplementation(() => ({
  postMessage: vi.fn(),
  close: vi.fn(),
  onmessage: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

// ── navigator.mediaDevices mock ──────────────────────────────────────
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn(() => []),
    }),
  },
});
```