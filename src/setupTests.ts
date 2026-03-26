import React from 'react';
import '@testing-library/jest-dom';
import { vi, afterEach, type Mock } from 'vitest';
import { cleanup } from '@testing-library/react';

// Global cleanup after each test to prevent memory leaks and test interference
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.clearAllMocks();
});

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  stroke: vi.fn(),
})) as Mock;

window.HTMLElement.prototype.scrollIntoView = vi.fn();

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}

if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = vi.fn();
}

// Mock react-virtuoso to render all items in tests using standard JS (no JSX)
vi.mock('react-virtuoso', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    Virtuoso: ({ data, itemContent, style }: any) => {
      return React.createElement(
        'div',
        { style },
        (data as any[]).map((item, index) =>
          React.createElement('div', { key: index }, itemContent(index, item))
        )
      );
    },
  };
});
