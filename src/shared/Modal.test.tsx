import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal (shared)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = '';
  });

  test('renders nothing when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('renders dialog with title and content when isOpen', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="My Dialog">
        <p>Hello world</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'My Dialog');
    expect(screen.getByText('My Dialog')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  test('closes on ESC key', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="ESC Test">
        <p>Content</p>
      </Modal>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('closes when clicking overlay (outside card)', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Click Test">
        <p>Content</p>
      </Modal>
    );
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('does NOT close when clicking inside card', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="Inner Click">
        <p>Content</p>
      </Modal>
    );
    fireEvent.click(screen.getByText('Content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  test('locks body scroll when open', () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Scroll Test">
        <p>Content</p>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  test('close button has aria-label', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="A11y">
        <p>Content</p>
      </Modal>
    );
    const closeBtn = screen.getByLabelText('Zamknij');
    expect(closeBtn).toBeInTheDocument();
  });

  test('uses custom ariaLabel when provided', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Title" ariaLabel="Custom label">
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Custom label');
  });

  test('applies size classes', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={vi.fn()} title="Small" size="sm">
        <p>Content</p>
      </Modal>
    );
    const card = screen.getByText('Small').closest('[class*="card"]');
    expect(card?.className).toContain('sm');

    rerender(
      <Modal isOpen={true} onClose={vi.fn()} title="Large" size="lg">
        <p>Content</p>
      </Modal>
    );
    const card2 = screen.getByText('Large').closest('[class*="card"]');
    expect(card2?.className).toContain('lg');
  });

  test('applies danger class', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Delete" danger>
        <p>Content</p>
      </Modal>
    );
    const card = screen.getByText('Delete').closest('[class*="card"]');
    expect(card?.className).toContain('danger');
  });

  test('hides header when hideHeader is true', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Hidden Header" hideHeader>
        <p>Content</p>
      </Modal>
    );
    expect(screen.queryByText('Hidden Header')).toBeNull();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
