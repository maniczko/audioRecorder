import { describe, test, expect } from 'vitest';
import { bootstrap } from '../index.js';

describe('index.ts', () => {
  test('exports bootstrap function', () => {
    expect(typeof bootstrap).toBe('function');
  });
});
