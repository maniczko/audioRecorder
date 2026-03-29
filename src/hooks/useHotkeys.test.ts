import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHotkeys } from './useHotkeys';

describe('useHotkeys', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fireKey(opts: Partial<KeyboardEvent> & { key: string }) {
    const event = new KeyboardEvent('keydown', {
      key: opts.key,
      code: opts.code || '',
      ctrlKey: opts.ctrlKey || false,
      metaKey: opts.metaKey || false,
      shiftKey: opts.shiftKey || false,
      altKey: opts.altKey || false,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    return event;
  }

  it('registers keydown listener on mount', () => {
    renderHook(() => useHotkeys([]));
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('removes keydown listener on unmount', () => {
    const { unmount } = renderHook(() => useHotkeys([]));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('calls handler when key matches', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 'k', handler }]));

    fireKey({ key: 'k' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('matches key case-insensitively', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 'K', handler }]));

    fireKey({ key: 'k' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('matches by event.code', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 'Space', handler }]));

    fireKey({ key: ' ', code: 'Space' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('requires ctrlKey when specified', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 's', ctrlKey: true, handler }]));

    fireKey({ key: 's' }); // no ctrl
    expect(handler).not.toHaveBeenCalled();

    fireKey({ key: 's', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('treats metaKey as ctrlKey equivalent', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 's', ctrlKey: true, handler }]));

    fireKey({ key: 's', metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('requires shiftKey when specified', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 'n', shiftKey: true, handler }]));

    fireKey({ key: 'n' });
    expect(handler).not.toHaveBeenCalled();

    fireKey({ key: 'n', shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('requires altKey when specified', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 't', altKey: true, handler }]));

    fireKey({ key: 't' });
    expect(handler).not.toHaveBeenCalled();

    fireKey({ key: 't', altKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire when ctrlKey is pressed but not configured', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 'a', handler }]));

    fireKey({ key: 'a', ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not trigger inside HTMLInputElement', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 'k', handler }]));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true });
    input.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('does not trigger inside HTMLTextAreaElement', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 'k', handler }]));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true });
    textarea.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('does not trigger inside contentEditable element', () => {
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ key: 'k', handler }]));

    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    div.focus();

    // jsdom may not set isContentEditable properly, so we ensure it
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });

    const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true });
    div.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('handles multiple configs simultaneously', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    renderHook(() =>
      useHotkeys([
        { key: 'a', handler: handler1 },
        { key: 'b', handler: handler2 },
      ])
    );

    fireKey({ key: 'a' });
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();

    fireKey({ key: 'b' });
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('does nothing with empty configs array', () => {
    renderHook(() => useHotkeys([]));
    // Should not throw
    fireKey({ key: 'a' });
  });
});
