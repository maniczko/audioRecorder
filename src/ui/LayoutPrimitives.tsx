import type { CSSProperties, ElementType, PropsWithChildren, ReactNode } from 'react';

type GapSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type Align = 'start' | 'center' | 'end' | 'stretch';
type Justify = 'start' | 'center' | 'end' | 'between';
type PageLayoutVariant = 'default' | 'wide' | 'centered' | 'studio';
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function gapToken(size: GapSize) {
  switch (size) {
    case 'xs':
      return 'var(--space-2)';
    case 'sm':
      return 'var(--space-3)';
    case 'lg':
      return 'var(--layout-gap-lg)';
    case 'xl':
      return 'var(--layout-gap-xl)';
    default:
      return 'var(--layout-gap-md)';
  }
}

function justifyValue(value: Justify) {
  switch (value) {
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'between':
      return 'space-between';
    default:
      return 'flex-start';
  }
}

type PrimitiveProps<T extends ElementType> = PropsWithChildren<{
  as?: T;
  className?: string;
  style?: CSSProperties;
}>;

export function PageLayout<T extends ElementType = 'section'>({
  as,
  className,
  style,
  children,
  variant = 'default',
}: PrimitiveProps<T> & { variant?: PageLayoutVariant }) {
  const Comp = (as || 'section') as ElementType;
  return (
    <Comp
      className={cx('ui-page-shell', `ui-page-layout--${variant}`, className)}
      data-layout-variant={variant}
      style={style}
    >
      {children}
    </Comp>
  );
}

export function PageShell<T extends ElementType = 'section'>(props: PrimitiveProps<T>) {
  return <PageLayout {...props} />;
}

export function Panel<T extends ElementType = 'section'>({
  as,
  className,
  style,
  children,
}: PrimitiveProps<T>) {
  const Comp = (as || 'section') as ElementType;
  return (
    <Comp className={cx('ui-panel', className)} style={style}>
      {children}
    </Comp>
  );
}

export function Stack<T extends ElementType = 'div'>({
  as,
  className,
  style,
  children,
  gap = 'md',
}: PrimitiveProps<T> & { gap?: GapSize }) {
  const Comp = (as || 'div') as ElementType;
  return (
    <Comp
      className={cx('ui-stack', className)}
      style={{ ...style, ['--ui-stack-gap' as string]: gapToken(gap) }}
    >
      {children}
    </Comp>
  );
}

export function SectionStack<T extends ElementType = 'div'>(
  props: PrimitiveProps<T> & { gap?: GapSize }
) {
  return <Stack {...props} />;
}

export function Cluster<T extends ElementType = 'div'>({
  as,
  className,
  style,
  children,
  gap = 'sm',
  align = 'center',
  justify = 'start',
}: PrimitiveProps<T> & { gap?: GapSize; align?: Align; justify?: Justify }) {
  const Comp = (as || 'div') as ElementType;
  return (
    <Comp
      className={cx('ui-cluster', className)}
      style={{
        ...style,
        ['--ui-cluster-gap' as string]: gapToken(gap),
        alignItems: align,
        justifyContent: justifyValue(justify),
      }}
    >
      {children}
    </Comp>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  headingLevel = 1,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headingLevel?: HeadingLevel;
}) {
  const Heading = `h${headingLevel}` as ElementType;

  return (
    <header className={cx('ui-page-header', className)}>
      <div className="ui-page-header__copy">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <Heading className="ui-page-header__title">{title}</Heading>
        {description ? <p className="ui-page-header__description">{description}</p> : null}
      </div>
      {actions ? (
        <Cluster className="ui-page-header__actions" gap="sm" justify="end">
          {actions}
        </Cluster>
      ) : null}
    </header>
  );
}

export function PageToolbar({
  children,
  className,
  style,
  'aria-label': ariaLabel,
}: PropsWithChildren<{
  className?: string;
  style?: CSSProperties;
  'aria-label': string;
}>) {
  return (
    <div
      aria-label={ariaLabel}
      className={cx('ui-cluster', className)}
      role="toolbar"
      style={style}
    >
      {children}
    </div>
  );
}

export function SplitPane({
  className,
  sidebar,
  main,
  aside,
  sidebarWidth = 'default',
}: {
  className?: string;
  sidebar?: ReactNode;
  main: ReactNode;
  aside?: ReactNode;
  sidebarWidth?: 'default' | 'wide';
}) {
  const columns = aside ? 'three' : sidebar ? 'two' : 'one';
  return (
    <div
      className={cx('ui-split-pane', className)}
      data-columns={columns}
      data-sidebar-width={sidebarWidth}
    >
      {sidebar ? <div className="ui-split-pane__sidebar">{sidebar}</div> : null}
      <div className="ui-split-pane__main">{main}</div>
      {aside ? <div className="ui-split-pane__aside">{aside}</div> : null}
    </div>
  );
}
