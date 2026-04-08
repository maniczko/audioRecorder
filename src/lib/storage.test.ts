/**
 * @vitest-environment jsdom
 * storage lib tests - focused coverage
 *
 * Tests for formatDuration and createId utility functions
 */

import { describe, it, expect } from 'vitest';

import { formatDuration, createId } from './storage';

describe('storage lib - utility functions', () => {
  describe('formatDuration', () => {
    it('formats zero seconds', () => {
      expect(formatDuration(0)).toBe('00:00');
    });

    it('formats seconds only', () => {
      expect(formatDuration(30)).toBe('00:30');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(90)).toBe('01:30');
    });

    it('formats 1 hour as minutes', () => {
      // formatDuration returns MM:SS format
      expect(formatDuration(3600)).toBe('60:00');
    });

    it('handles large durations', () => {
      expect(formatDuration(7200)).toBe('120:00');
    });

    it('pads minutes correctly', () => {
      expect(formatDuration(65)).toBe('01:05');
    });

    it('pads seconds correctly', () => {
      expect(formatDuration(61)).toBe('01:01');
    });

    it('handles fractional seconds', () => {
      expect(formatDuration(61.9)).toBe('01:01');
    });

    it('handles negative seconds', () => {
      expect(formatDuration(-10)).toBe('00:00');
    });

    it('handles null input', () => {
      expect(formatDuration(null)).toBe('00:00');
    });

    it('handles undefined input', () => {
      expect(formatDuration(undefined)).toBe('00:00');
    });
  });

  describe('createId', () => {
    it('creates ID with prefix', () => {
      const id = createId('test');
      expect(id).toMatch(/^test_/);
      expect(id.length).toBeGreaterThan(5);
    });

    it('creates unique IDs', () => {
      const id1 = createId('test');
      const id2 = createId('test');
      expect(id1).not.toBe(id2);
    });

    it('handles empty prefix', () => {
      const id = createId('');
      expect(id).toMatch(/^_/);
    });

    it('handles different prefixes', () => {
      const id1 = createId('user');
      const id2 = createId('task');
      expect(id1).toMatch(/^user_/);
      expect(id2).toMatch(/^task_/);
    });

    it('creates ID with timestamp component', () => {
      const id = createId('test');
      // ID format: prefix_random_timestamp
      const parts = id.split('_');
      expect(parts.length).toBe(3);
    });
  });
});
