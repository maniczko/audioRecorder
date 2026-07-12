import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader, PageLayout, PageToolbar, SectionStack, SplitPane } from './LayoutPrimitives';

describe('LayoutPrimitives', () => {
  it('renders a semantic page layout variant with the shared page-shell class', () => {
    render(<PageLayout variant="wide">Content</PageLayout>);

    expect(screen.getByText('Content')).toHaveClass('ui-page-shell', 'ui-page-layout--wide');
    expect(screen.getByText('Content')).toHaveAttribute('data-layout-variant', 'wide');
  });

  it('keeps the route title as the primary heading and renders header actions', () => {
    render(
      <PageHeader
        title="Recordings"
        description="Browse every uploaded recording."
        actions={<button type="button">Upload</button>}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Recordings' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeVisible();
    expect(screen.getByText('Browse every uploaded recording.')).toHaveClass(
      'ui-page-header__description'
    );
  });

  it('creates a labelled toolbar and keeps its controls available to assistive technology', () => {
    render(
      <PageToolbar aria-label="Recording filters">
        <button type="button">Filter</button>
      </PageToolbar>
    );

    expect(screen.getByRole('toolbar', { name: 'Recording filters' })).toHaveClass('ui-cluster');
    expect(screen.getByRole('button', { name: 'Filter' })).toBeVisible();
  });

  it('maps a section stack gap to the existing layout token', () => {
    render(<SectionStack gap="xl">Section content</SectionStack>);

    expect(screen.getByText('Section content')).toHaveStyle({
      '--ui-stack-gap': 'var(--layout-gap-xl)',
    });
  });

  it('derives a three-column split pane from sidebar, main, and aside content', () => {
    render(
      <SplitPane
        sidebarWidth="wide"
        sidebar={<nav aria-label="Workspace">Navigation</nav>}
        main={<p>Main workspace</p>}
        aside={<aside>Details</aside>}
      />
    );

    const pane = screen.getByText('Main workspace').closest('.ui-split-pane');
    expect(pane).toHaveAttribute('data-columns', 'three');
    expect(pane).toHaveAttribute('data-sidebar-width', 'wide');
    expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  });
});
