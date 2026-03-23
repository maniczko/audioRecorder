import React from 'react';
import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/* eslint-disable no-undef */
window.jest = vi;
globalThis.jest = vi;
/* eslint-enable no-undef */

// Global cleanup after each test to prevent memory leaks and test interference
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.clearAllMocks();
});

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  fill: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  stroke: jest.fn(),
}));

window.HTMLElement.prototype.scrollIntoView = jest.fn();

if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = jest.fn(() => "blob:mock-url");
}

if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = jest.fn();
}

// Mock react-virtuoso to render all items in tests using standard JS (no JSX)
vi.mock('react-virtuoso', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Virtuoso: ({ data, itemContent, style }) => {
      return React.createElement(
        'div',
        { style },
        data.map((item, index) =>
          React.createElement('div', { key: index }, itemContent(index, item))
        )
      );
    },
  };
});


