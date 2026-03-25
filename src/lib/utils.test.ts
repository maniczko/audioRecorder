/**
 * @vitest-environment jsdom
 * utils lib tests
 */
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility function', () => {
  it('merges class names correctly', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(result).toBe('base active');
  });

  it('handles false conditional classes', () => {
    const isActive = false;
    const result = cn('base', isActive && 'active');
    expect(result).toBe('base');
  });

  it('handles null and undefined', () => {
    const result = cn('base', null, undefined, 'end');
    expect(result).toBe('base end');
  });

  it('handles array of classes', () => {
    const result = cn(['foo', 'bar']);
    expect(result).toBe('foo bar');
  });

  it('handles object with boolean values', () => {
    const result = cn({ foo: true, bar: false, baz: true });
    expect(result).toBe('foo baz');
  });

  it('merges tailwind classes correctly', () => {
    const result = cn('px-2 py-1', 'px-4');
    expect(result).toBe('py-1 px-4');
  });

  it('handles empty input', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('handles single class', () => {
    const result = cn('single');
    expect(result).toBe('single');
  });

  it('handles nested arrays', () => {
    const result = cn(['foo', ['bar', 'baz']]);
    expect(result).toBe('foo bar baz');
  });
});
