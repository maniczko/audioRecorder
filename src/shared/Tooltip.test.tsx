import { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { Tooltip } from './Tooltip';

vi.mock('@base-ui/react', () => ({
  Tooltip: {
    Provider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Root: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Trigger: ({ render }: { render: ReactNode }) => <>{render}</>,
    Portal: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Positioner: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Popup: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Arrow: () => null,
  },
}));

describe('Tooltip', () => {
  it('returns children when content is empty', () => {
    render(
      <Tooltip content={null}>
        <button type="button">Hover target</button>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Hover target' })).toBeInTheDocument();
    expect(screen.queryByText('Helpful hint')).not.toBeInTheDocument();
  });

  it('renders content through tooltip popup when provided', () => {
    render(
      <Tooltip content={<span>Helpful hint</span>}>
        <button type="button">Hover target</button>
      </Tooltip>
    );

    expect(screen.getByText('Helpful hint')).toBeInTheDocument();
  });
});
