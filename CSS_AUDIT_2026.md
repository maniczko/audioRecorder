# CSS Layout Audit Report

**Data audytu:** 2026-03-24  
**Audytor:** Qwen Code  
**Standardy:** BEM, SMACSS, CSS Modules best practices

---

## 📊 Executive Summary

| Kategoria | Status | Liczba problemów | Priorytet |
|-----------|--------|------------------|-----------|
| `!important` usage | ❌ Critical | 13 | P0 |
| Inline styles | ⚠️ Warning | 100+ | P1 |
| Duplicate CSS | ⚠️ Warning | 40+ bloków | P1 |
| Hardcoded values | ⚠️ Warning | 200+ | P2 |
| Token consistency | ✅ Good | - | - |

**Overall Score: 6/10** ⚠️

---

## 🔴 P0: Critical Issues - `!important` Usage

### Problem
Użycie `!important` łamie kaskadę CSS i utrudnia utrzymanie kodu.

### Wystąpienia (13):

| Plik | Linia | Problem |
|------|-------|---------|
| `App.css` | 848, 850, 852 | `.energy-high`, `.energy-medium`, `.energy-low` |
| `App.css` | 1305 | `transform: none !important` |
| `App.css` | 1532 | `overflow: visible !important` |
| `NotesTabStyles.css` | 73 | `padding-top: 0 !important` |
| `AiTaskSuggestionsPanelStyles.css` | 53, 178 | `color: #fff !important` |
| `layout.css` | 308 | `overflow: visible !important` |
| `studio.css` | 540, 542, 544 | `.energy-*` duplicate z App.css |
| `tasks.css` | 5512 | `transform: none !important` |

### 🔧 Fix Plan:

```css
/* ❌ BEFORE */
.energy-high { 
  background: rgba(116,208,191,0.12) !important; 
}

/* ✅ AFTER */
.energy-high { 
  background: var(--energy-high-bg); 
}

/* W index.css dodać: */
:root {
  --energy-high-bg: rgba(116,208,191,0.12);
  --energy-high-text: rgba(116,208,191,0.9);
  --energy-medium-bg: rgba(255,200,80,0.1);
  --energy-medium-text: rgba(255,200,80,0.85);
  --energy-low-bg: rgba(255,255,255,0.06);
  --energy-low-text: var(--muted);
}
```

**Priority files to fix:**
1. `src/App.css` - 5 wystąpień
2. `src/styles/studio.css` - 3 wystąpienia (duplicate!)
3. `src/tasks.css` - 1 wystąpienie (transform jitter fix)

---

## 🟡 P1: High Priority - Inline Styles

### Problem
Inline styles (`style={{...}}`) omijają CSS pipeline, utrudniają theme'owanie i responsive design.

### Wystąpienia (100+):

#### Najgorsze przestępcy:

| Komponent | Liczba | Przykład |
|-----------|--------|----------|
| `JapaneseThemeSelector.tsx` | 25+ | `style={{ backgroundColor: themeData.colors.primary }}` |
| `TaskKanbanView.tsx` | 6 | `style={{ "--column-color": column.color }}` |
| `CalendarTab.tsx` | 2 | `style={{ top: `${nowOffset}%` }}` |
| `RecordingsTab.tsx` | 2 | `style={{ width: `${uploadProgress}%` }}` |
| `LayoutPrimitives.tsx` | 4 | `style={style}` (prop drilling) |

### 🔧 Fix Plan:

#### 1. JapaneseThemeSelector - migrate to CSS variables

```tsx
/* ❌ BEFORE */
<div 
  className="theme-preview-swatch"
  style={{ backgroundColor: themeData.colors.primary }}
/>

/* ✅ AFTER */
<div 
  className="theme-preview-swatch"
  style={{ 
    "--theme-primary": themeData.colors.primary,
    "--theme-secondary": themeData.colors.secondary,
    "--theme-accent": themeData.colors.accent,
  } as React.CSSProperties}
/>
```

```css
/* theme-preview.css */
.theme-preview-swatch {
  background-color: var(--theme-primary, #000);
}
```

#### 2. TaskKanbanView - use CSS custom properties

```tsx
/* ❌ BEFORE */
<header 
  className="todo-kanban-header"
  style={{ "--column-color": column.color }}
/>

/* ✅ AFTER - already using CSS vars, just consolidate */
<header 
  className="todo-kanban-header"
  data-column-color={column.color}
/>
```

```css
.todo-kanban-header {
  border-left: 4px solid var(--column-color, #5a92ff);
}
```

#### 3. Progress bars - create reusable component

```tsx
// ❌ BEFORE
<div style={{ width: `${uploadProgress}%`, background: '#75d6c4' }} />

// ✅ AFTER
<ProgressBar value={uploadProgress} variant="upload" />
```

```css
/* components/ProgressBar.css */
.progress-bar {
  width: var(--progress-value, 0%);
  background: var(--progress-color, var(--accent));
  transition: width 0.2s ease-in-out;
}
```

---

## 🟡 P1: Duplicate CSS Blocks

### Problem
Te same deklaracje CSS powtarzają się wielokrotnie, zwiększając rozmiar bundle.

### Przykłady:

#### `tasks.css` - 4x duplicate panel styles:

```css
/* Lines 39-45, 47-53, 55-61, 63-69 - ALL IDENTICAL */
.tasks-brand-panel,
.tasks-list-panel,
.tasks-main-panel,
.task-detail-panel {
  backdrop-filter: blur(18px);
  background: linear-gradient(180deg, rgba(11, 25, 40, 0.92) 0%, rgba(8, 20, 31, 0.94) 100%);
  border: 1px solid rgba(170, 216, 255, 0.12);
  box-shadow: var(--shadow);
  border-radius: 28px;
}
```

**Fix:** Remove duplicates, keep single declaration.

#### `App.css` + `studio.css` - duplicate `.energy-*` classes:

```css
/* App.css:848-852 */
.energy-high   { background: rgba(116,208,191,0.12) !important; }
.energy-medium { background: rgba(255,200,80,0.1) !important; }
.energy-low    { background: rgba(255,255,255,0.06) !important; }

/* studio.css:540-544 - EXACT DUPLICATE */
.energy-high   { background: rgba(116,208,191,0.12) !important; }
```

**Fix:** Keep only in `studio.css`, remove from `App.css`.

---

## 🟡 P2: Hardcoded Values

### Problem
Hardcoded pixel values, colors i spacing utrudniają theme'owanie i responsive design.

### Categories:

#### 1. Hardcoded spacing (200+ instances):

```css
/* ❌ BEFORE */
.kanban-card-description {
  margin: 2px 0 4px;  /* Magic numbers */
  font-size: 0.8rem;
}

/* ✅ AFTER */
.kanban-card-description {
  margin: var(--space-1) 0 var(--space-2);
  font-size: var(--font-size-sm);
}
```

#### 2. Hardcoded colors:

```css
/* ❌ BEFORE */
.todo-big-green-button {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
}

/* ✅ AFTER */
.todo-big-green-button {
  background: linear-gradient(135deg, var(--success-500) 0%, var(--success-600) 100%);
}
```

#### 3. Hardcoded dimensions:

```css
/* ❌ BEFORE */
.todo-kanban-column {
  min-width: 280px;
  max-width: 420px;
}

/* ✅ AFTER */
.todo-kanban-column {
  min-width: var(--kanban-col-min, 280px);
  max-width: var(--kanban-col-max, 420px);
}
```

---

## ✅ Good Practices Found

### 1. Design Tokens (index.css)

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  /* ... */
  
  --radius-xs: 8px;
  --radius-sm: 12px;
  /* ... */
  
  --control-height-sm: 34px;
  --control-height-md: 42px;
  /* ... */
}
```

**Status:** ✅ Excellent token system in place.

### 2. Responsive breakpoints

```css
@media (max-width: 768px) { ... }
@media (max-width: 1024px) { ... }
```

**Status:** ✅ Standard breakpoints used.

### 3. CSS custom properties usage

```css
.tasks-layout {
  gap: var(--layout-gap-lg);
}

.todo-panel {
  padding: var(--panel-padding);
  border-radius: var(--panel-radius);
}
```

**Status:** ✅ Good adoption of tokens.

---

## 📋 Action Plan

### Phase 1: Critical Fixes (Week 1)

| Task | Files | Est. Time |
|------|-------|-----------|
| Remove `!important` from App.css | `App.css`, `studio.css` | 2h |
| Remove duplicate `.energy-*` classes | `studio.css` | 30min |
| Fix `tasks.css` duplicate blocks | `tasks.css` | 1h |
| Create CSS variables for energy colors | `index.css` | 30min |

**Total Phase 1:** ~4h

### Phase 2: Inline Styles Migration (Week 2)

| Task | Files | Est. Time |
|------|-------|-----------|
| Create `<ProgressBar>` component | `components/ProgressBar.tsx` | 2h |
| Migrate `JapaneseThemeSelector` | `JapaneseThemeSelector.tsx` | 3h |
| Consolidate TaskKanbanView styles | `TaskKanbanView.tsx` | 2h |
| Fix LayoutPrimitives inline styles | `LayoutPrimitives.tsx` | 1h |

**Total Phase 2:** ~8h

### Phase 3: Token Consolidation (Week 3)

| Task | Files | Est. Time |
|------|-------|-----------|
| Add missing color tokens | `index.css` | 1h |
| Replace hardcoded spacing | All CSS files | 4h |
| Replace hardcoded dimensions | All CSS files | 3h |
| Add font-size tokens | `index.css` | 1h |

**Total Phase 3:** ~9h

### Phase 4: Cleanup & Optimization (Week 4)

| Task | Files | Est. Time |
|------|-------|-----------|
| Remove unused CSS rules | All CSS files | 4h |
| Minify CSS for production | Build config | 1h |
| Add CSS linting rules | `.stylelintrc` | 2h |
| Document CSS conventions | `CSS_GUIDELINES.md` | 2h |

**Total Phase 4:** ~9h

---

## 📊 Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| `!important` count | 13 | 0 | -100% |
| Inline styles | 100+ | <20 | -80% |
| Duplicate CSS | 40+ blocks | 0 | -100% |
| CSS bundle size | ~180KB | ~120KB | -33% |
| Maintainability | 6/10 | 9/10 | +50% |

---

## 🛠️ Tools & Linting

### Recommended additions:

```json
// package.json
{
  "devDependencies": {
    "stylelint": "^16.0.0",
    "stylelint-config-standard": "^36.0.0",
    "stylelint-order": "^6.0.0",
    "postcss": "^8.4.0"
  },
  "scripts": {
    "lint:css": "stylelint 'src/**/*.css'",
    "lint:css:fix": "stylelint 'src/**/*.css' --fix"
  }
}
```

```json
// .stylelintrc.json
{
  "extends": ["stylelint-config-standard"],
  "plugins": ["stylelint-order"],
  "rules": {
    "order/properties-alphabetical-order": true,
    "declaration-no-important": true,
    "max-nesting-depth": 3,
    "selector-max-class": 4
  }
}
```

---

## 📖 CSS Conventions

### Naming: BEM-lite

```css
/* ✅ Good */
.task-card {}
.task-card--completed {}
.task-card__title {}
.task-card__title--large {}

/* ❌ Bad */
.taskCard {}
.task_card_completed {}
.tc-title {}
```

### Structure: Mobile-first

```css
/* Base styles (mobile) */
.task-card {
  padding: var(--space-3);
}

/* Tablet */
@media (min-width: 768px) {
  .task-card {
    padding: var(--space-4);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .task-card {
    padding: var(--space-5);
  }
}
```

### Specificity: Keep it low

```css
/* ✅ Good (specificity: 0,1,0) */
.task-card { }

/* ✅ Good (specificity: 0,2,0) */
.task-list .task-card { }

/* ❌ Bad (specificity: 1,0,0) */
#task-card { }

/* ❌ Bad (specificity: 0,4,0) */
.task-list .task-card .task-card__title span { }
```

---

**Next Steps:**
1. Review this report
2. Prioritize phases
3. Create GitHub issues for each phase
4. Start with Phase 1 (critical fixes)
