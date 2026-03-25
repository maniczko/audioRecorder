import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationCenter from './NotificationCenter';

vi.mock('./lib/storage', () => ({
  formatDateTime: vi.fn((date) => {
    const d = new Date(date as string);
    return d.toLocaleString('pl-PL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }),
}));

describe('NotificationCenter', () => {
  const mockItems = [
    {
      id: '1',
      title: 'Spotkanie za 15 minut',
      body: 'Przypomnienie o spotkaniu z klientem',
      tone: 'warning' as const,
      sortAt: '2026-03-24T10:00:00Z',
      deliverAt: '2026-03-24T10:00:00Z',
    },
    {
      id: '2',
      title: 'Task po terminie',
      body: 'Task "Przygotowac prezentacje" jest po terminie',
      tone: 'danger' as const,
      sortAt: '2026-03-23T09:00:00Z',
      deliverAt: '2026-03-23T09:00:00Z',
    },
  ];

  const defaultProps = {
    open: false,
    unreadCount: 0,
    items: [] as typeof mockItems,
    permissionState: 'default' as 'default' | 'granted' | 'denied',
    browserNotificationsSupported: true,
    onToggle: vi.fn(),
    onClose: vi.fn(),
    onRequestPermission: vi.fn(),
    onDismiss: vi.fn(),
    onActivate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders notification trigger button', () => {
      render(<NotificationCenter {...defaultProps} />);

      const triggerButton = screen.getByLabelText('Powiadomienia');
      expect(triggerButton).toBeInTheDocument();
    });

    it('shows unread count badge when there are unread notifications', () => {
      render(<NotificationCenter {...defaultProps} unreadCount={5} />);

      const badge = screen.getByText('5');
      expect(badge).toBeInTheDocument();
    });

    it('renders panel when open', () => {
      render(<NotificationCenter {...defaultProps} open={true} />);

      expect(screen.getByText('Powiadomienia')).toBeInTheDocument();
      expect(screen.getByText('Centrum alertow')).toBeInTheDocument();
    });

    it('shows empty state when no notifications', () => {
      render(<NotificationCenter {...defaultProps} open={true} items={[]} />);

      expect(screen.getByText('Na razie spokoj')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onToggle when trigger button is clicked', () => {
      const onToggle = vi.fn();
      render(<NotificationCenter {...defaultProps} onToggle={onToggle} />);

      fireEvent.click(screen.getByLabelText('Powiadomienia'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onDismiss when dismiss button is clicked', () => {
      render(<NotificationCenter {...defaultProps} open={true} items={mockItems} />);

      const dismissButtons = screen.getAllByText('Zamknij');
      fireEvent.click(dismissButtons[0]);

      expect(defaultProps.onDismiss).toHaveBeenCalledWith(mockItems[0].id);
    });

    it('calls onClose when clicking outside the panel', () => {
      render(<NotificationCenter {...defaultProps} open={true} />);

      fireEvent.mouseDown(document.body);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when pressing Escape key', () => {
      render(<NotificationCenter {...defaultProps} open={true} />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Notification Display', () => {
    it('renders notification items', () => {
      render(<NotificationCenter {...defaultProps} open={true} items={mockItems} />);

      expect(screen.getByText('Spotkanie za 15 minut')).toBeInTheDocument();
      expect(screen.getByText('Task po terminie')).toBeInTheDocument();
    });

    it('renders tone badges', () => {
      render(<NotificationCenter {...defaultProps} open={true} items={mockItems} />);

      expect(screen.getByText('Uwaga')).toBeInTheDocument();
      expect(screen.getByText('Pilne')).toBeInTheDocument();
    });
  });

  describe('Browser Notifications', () => {
    it('shows enable button when notifications not granted', () => {
      render(<NotificationCenter {...defaultProps} open={true} />);

      expect(screen.getByText('Wlacz w przegladarce')).toBeInTheDocument();
    });

    it('hides enable button when permission granted', () => {
      render(<NotificationCenter {...defaultProps} open={true} permissionState="granted" />);

      expect(screen.queryByText('Wlacz w przegladarce')).not.toBeInTheDocument();
    });

    it('calls onRequestPermission when enable button clicked', () => {
      render(<NotificationCenter {...defaultProps} open={true} />);

      fireEvent.click(screen.getByText('Wlacz w przegladarce'));
      expect(defaultProps.onRequestPermission).toHaveBeenCalledTimes(1);
    });
  });
});
