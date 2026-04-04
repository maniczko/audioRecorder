import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/utils', () => ({
  cn: (...args: (string | undefined | false | null)[]) => args.filter(Boolean).join(' '),
}));

const { Button, buttonVariants } = await import('./button');

describe('buttonVariants (cva)', () => {
  test('returns default classes with no options', () => {
    const result = buttonVariants();
    expect(result).toContain('bg-primary');
    expect(result).toContain('text-primary-foreground');
  });

  test('returns outline variant classes', () => {
    const result = buttonVariants({ variant: 'outline' });
    expect(result).toContain('border-border');
    expect(result).toContain('bg-background');
  });

  test('returns secondary variant classes', () => {
    const result = buttonVariants({ variant: 'secondary' });
    expect(result).toContain('bg-secondary');
    expect(result).toContain('text-secondary-foreground');
  });

  test('returns ghost variant classes', () => {
    const result = buttonVariants({ variant: 'ghost' });
    expect(result).toContain('hover:bg-muted');
  });

  test('returns destructive variant classes', () => {
    const result = buttonVariants({ variant: 'destructive' });
    expect(result).toContain('bg-destructive/10');
    expect(result).toContain('text-destructive');
  });

  test('returns link variant classes', () => {
    const result = buttonVariants({ variant: 'link' });
    expect(result).toContain('underline');
    expect(result).toContain('text-primary');
  });

  test('returns default size classes', () => {
    const result = buttonVariants({ size: 'default' });
    expect(result).toContain('h-8');
  });

  test('returns xs size classes', () => {
    const result = buttonVariants({ size: 'xs' });
    expect(result).toContain('h-6');
    expect(result).toContain('text-xs');
  });

  test('returns sm size classes', () => {
    const result = buttonVariants({ size: 'sm' });
    expect(result).toContain('h-7');
  });

  test('returns lg size classes', () => {
    const result = buttonVariants({ size: 'lg' });
    expect(result).toContain('h-9');
  });

  test('returns icon size classes', () => {
    expect(buttonVariants({ size: 'icon' })).toContain('size-8');
    expect(buttonVariants({ size: 'icon-xs' })).toContain('size-6');
    expect(buttonVariants({ size: 'icon-sm' })).toContain('size-7');
    expect(buttonVariants({ size: 'icon-lg' })).toContain('size-9');
  });

  test('combines variant and size', () => {
    const result = buttonVariants({ variant: 'outline', size: 'sm' });
    expect(result).toContain('border-border');
    expect(result).toContain('h-7');
  });

  test('appends custom className', () => {
    const result = buttonVariants({ className: 'my-extra' });
    expect(result).toContain('my-extra');
  });
});

describe('Button component', () => {
  test('renders as button element', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn).toBeInTheDocument();
  });

  test('applies default variant and size classes', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button', { name: 'Default' });
    expect(btn).toHaveClass('bg-primary');
    expect(btn).toHaveClass('h-8');
  });

  test('applies outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole('button', { name: 'Outline' });
    expect(btn).toHaveClass('border-border');
  });

  test('applies destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn).toHaveClass('bg-destructive/10');
  });

  test('applies ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button', { name: 'Ghost' });
    expect(btn).toHaveClass('hover:bg-muted');
  });

  test('applies size prop', () => {
    render(<Button size="sm">Small</Button>);
    const btn = screen.getByRole('button', { name: 'Small' });
    expect(btn).toHaveClass('h-7');
  });

  test('applies lg size', () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole('button', { name: 'Large' });
    expect(btn).toHaveClass('h-9');
  });

  test('applies custom className', () => {
    render(<Button className="my-custom">Custom</Button>);
    const btn = screen.getByRole('button', { name: 'Custom' });
    expect(btn).toHaveClass('my-custom');
  });

  test('calls onClick handler', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Click' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('renders as link when type=button with href-like behavior is not tested, but data-slot is set', () => {
    render(<Button>Test</Button>);
    const btn = screen.getByRole('button', { name: 'Test' });
    expect(btn).toHaveAttribute('data-slot', 'button');
  });

  test('forwards disabled prop', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn).toBeDisabled();
  });

  test('forwards type prop', () => {
    render(<Button type="submit">Submit</Button>);
    const btn = screen.getByRole('button', { name: 'Submit' });
    expect(btn).toHaveAttribute('type', 'submit');
  });

  test('renders with icon variant', () => {
    render(
      <Button size="icon" aria-label="settings">
        ⚙
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'settings' });
    expect(btn).toHaveClass('size-8');
  });

  test('renders with xs icon variant', () => {
    render(
      <Button size="icon-xs" aria-label="close">
        ✕
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'close' });
    expect(btn).toHaveClass('size-6');
  });

  test('renders children including SVG', () => {
    render(
      <Button>
        <svg data-testid="icon" />
        Label
      </Button>
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
  });
});
