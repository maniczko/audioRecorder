# CSS Conventions & Guidelines

> Ten dokument opisuje konwencje i najlepsze praktyki dla stylów CSS w projekcie VoiceLog.

## Spis treści

1. [Struktura plików](#struktura-plików)
2. [Nazewnictwo](#nazewnictwo)
3. [Specyficzność selektorów](#specyficzność-selektorów)
4. [Zmienne CSS](#zmienne-css)
5. [Formatowanie](#formatowanie)
6. [Mobile-first](#mobile-first)
7. [Unikanie `!important`](#unikanie-important)

---

## Struktura plików

```
src/
├── index.css                 # Główny plik z tokenami designu
├── styles/
│   ├── variables.css         # Zmienne CSS (deprecated, używaj index.css)
│   ├── foundation.css        # Podstawowe komponenty UI
│   ├── layout.css            # Layouty i struktura
│   ├── reset.css             # Reset i normalize
│   ├── animations.css        # Animacje
│   ├── auth.css              # Style specyficzne dla widoków
│   ├── calendar.css
│   ├── people.css
│   ├── profile.css
│   ├── recordings.css
│   ├── studio.css
│   └── tasks.css
├── components/
│   ├── ProgressBar.css       # Style komponentów
│   └── ...
└── tasks/
    ├── TaskDetailsPanelStyles.css
    └── ...
```

### Zasady:

- **Globalne tokeny**: Wszystkie zmienne CSS definiuj w `src/index.css`
- **Style widoków**: Style specyficzne dla widoków w `src/styles/{view}.css`
- **Style komponentów**: Style komponentów w tym samym katalogu co komponent
- **Importowanie**: Importuj pliki CSS w plikach TypeScript/TSX

---

## Nazewnictwo

### Klasy

Używaj **kebab-case** dla klas CSS:

```css
/* ✅ DOBRZE */
.user-profile-card {
}
.task-list-item {
}
.btn-primary {
}

/* ❌ ŹLE */
.userProfileCard {
}
.task_list_item {
}
```

### Zmienne CSS

Używaj **kebab-case** z prefiksem typu:

```css
:root {
  /* Kolory */
  --color-primary: #3b82f6;
  --color-danger: #ef4444;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;

  /* Font sizes */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
}
```

### Keyframes

Używaj **kebab-case** z sufiksem animacji:

```css
/* ✅ DOBRZE */
@keyframes fade-in {
}
@keyframes slide-up {
}
@keyframes comic-pop {
}

/* ❌ ŹLE */
@keyframes fadeIn {
}
@keyframes SlideUp {
}
```

---

## Specyficzność selektorów

### Zasada najniższej specyficzności

Zawsze używaj **najmniej specyficznego** selektora który działa:

```css
/* ✅ DOBRZE - niska specyficzność */
.btn {
}
.card-title {
}

/* ❌ ŹLE - wysoka specyficzność */
div.container .card .card-body .card-title {
}
#main .btn {
}
```

### Unikaj ID w selectorach

```css
/* ❌ ŹLE */
#header {
}
#sidebar-nav {
}

/* ✅ DOBRZE */
.header {
}
.sidebar-nav {
}
```

### BEM-lite (opcjonalnie)

Dla złożonych komponentów używaj uproszczonego BEM:

```css
/* Blok */
.card {
}

/* Element */
.card-title {
}
.card-body {
}

/* Modyfikator */
.card--highlighted {
}
.btn--large {
}
```

---

## Zmienne CSS

### Dostępne tokeny

Zobacz `src/index.css` dla pełnej listy dostępnych tokenów:

```css
/* Przykład użycia */
.button {
  background: var(--accent);
  color: var(--text);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
}
```

### Definiowanie nowych tokenów

1. Dodaj zmienną do `src/index.css` w odpowiedniej sekcji
2. Używaj logicznych nazw (np. `--color-*`, `--space-*`, `--font-*`)
3. Dokumentuj nowe tokeny w komentarzu

---

## Formatowanie

### Wcięcia i spacing

```css
/* ✅ DOBRZE */
.selector {
  property: value;
  property: value;
}

/* ❌ ŹLE */
.selector {
  property: value;
}
.selector {
  property: value;
}
```

### Kolejność właściwości (zalecana)

Grupuj właściwości logicznie:

```css
.card {
  /* Pozycjonowanie */
  position: relative;
  z-index: 10;
  top: 0;

  /* Display & Box */
  display: flex;
  flex-direction: column;
  width: 100%;
  height: auto;

  /* Spacing */
  margin: 0;
  padding: 16px;

  /* Border */
  border: 1px solid var(--border);
  border-radius: var(--radius-md);

  /* Colors & Background */
  background: var(--surface);
  color: var(--text);

  /* Typography */
  font-size: var(--font-size-base);
  line-height: 1.5;

  /* Effects */
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}
```

---

## Mobile-first

Pisz style mobile-first, dodawaj media queries dla większych ekranów:

```css
/* ✅ DOBRZE - mobile-first */
.card {
  padding: 16px;
}

@media (min-width: 768px) {
  .card {
    padding: 24px;
  }
}

/* ❌ ŹLE - desktop-first */
.card {
  padding: 24px;
}

@media (max-width: 767px) {
  .card {
    padding: 16px;
  }
}
```

### Breakpointy

```css
/* Dostępne breakpointy (zdefiniowane w index.css) */
--breakpoint-sm: 640px; /* Small devices (landscape phones) */
--breakpoint-md: 768px; /* Medium devices (tablets) */
--breakpoint-lg: 1024px; /* Large devices (desktops) */
--breakpoint-xl: 1280px; /* Extra large devices */
--breakpoint-2xl: 1536px; /* 2X extra large devices */
```

---

## Unikanie `!important`

### Zasada

**NIGDY** nie używaj `!important` chyba że to absolutnie konieczne (np. override biblioteki zewnętrznej).

### Dlaczego?

- Łamie kaskadę CSS
- Utrudnia utrzymanie kodu
- Wymusza użycie `!important` w innych miejscach

### Rozwiązania alternatywne

```css
/* ❌ ŹLE */
.button {
  background: red !important;
}

/* ✅ DOBRZE - zwiększ specyficzność */
.toolbar .button {
  background: red;
}

/* ✅ DOBRZE - użyj bardziej specyficznego selektora */
.button.primary {
  background: red;
}

/* ✅ DOBRZE - użyj klasy utility */
.bg-red {
  background: red;
}
```

### Narzędzia

Uruchom Stylelint aby wykryć `!important`:

```bash
pnpm run lint:css
```

Reguła: `declaration-no-important: true`

---

## Stylelint

Projekt używa Stylelint do automatycznego sprawdzania stylu CSS.

### Uruchamianie

```bash
# Sprawdzenie wszystkich plików CSS
pnpm run lint:css

# Auto-fix (gdzie możliwe)
pnpm run lint:css:fix
```

### Konfiguracja

Konfiguracja w `.stylelintrc.json`:

- Zakaz `!important`
- Wymagany kebab-case dla klas i keyframes
- Limit ID selectorów: 0
- Max nesting depth: 4

---

## Przykłady

### ✅ Dobry kod CSS

```css
/* Komponent: Karta zadania */
.task-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
  margin: var(--space-2) 0;
  background: var(--surface-panel);
  border: 1px solid var(--stroke);
  border-radius: var(--radius-md);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.task-card--completed {
  opacity: 0.6;
}

.task-card-title {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text);
}

.task-card-meta {
  display: flex;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--muted);
}

@media (min-width: 768px) {
  .task-card {
    padding: var(--space-5);
  }
}
```

### ❌ Zły kod CSS

```css
/* Zbyt wysoka specyficzność, ID, !important */
#task-list .task-container .card .task-card {
  background: white !important;
  padding: 16px !important;
}

#task-list .task-container .card .task-card .title {
  font-size: 16px;
  color: #333;
}

.task-card:hover {
  background: #f0f0f0 !important;
}
```

---

## Checklista przed commit

- [ ] Czy użyłem zmiennych CSS zamiast hardcoded values?
- [ ] Czy klasy są w kebab-case?
- [ ] Czy unikałem `!important`?
- [ ] Czy unikałem selectorów ID?
- [ ] Czy sprawdziłem `pnpm run lint:css`?
- [ ] Czy style są mobile-first?
- [ ] Czy nazwy keyframes są w kebab-case?

---

_Ostatnia aktualizacja: 2026-03-26_
