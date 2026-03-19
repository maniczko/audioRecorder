// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { vi } from 'vitest';

/* eslint-disable no-undef */
window.jest = vi;
globalThis.jest = vi;
/* eslint-enable no-undef */

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
