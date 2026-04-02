# 🔧 Troubleshooting - Lazy Loading Errors

## Problem

```
TypeError: Failed to fetch dynamically imported module
```

## Przyczyny

1. **Vite cache** - przestarzałe chunki w `node_modules/.vite`
2. **Code splitting** - Vite zmienia nazwy chunków między buildami
3. **Browser cache** - przeglądarka ładuje stare pliki JS

## Rozwiązania

### 1. Szybka naprawa (Development)

```bash
# Wyczyść cache Vite i restart
pnpm run build:fix

# Lub ręcznie
rm -rf node_modules/.vite
pnpm start
```

### 2. Production Build

```bash
# Clean build
pnpm run build:clean

# Lub
rm -rf build node_modules/.vite
pnpm run build
```

### 3. Browser Cache

**Hard reload:**

- Windows/Linux: `Ctrl + Shift + R`
- macOS: `Cmd + Shift + R`

**Wyczyść cache przeglądarki:**

1. DevTools (F12)
2. Application tab
3. Clear storage → Clear site data

### 4. Vite Config (już zastosowane)

```javascript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
      },
    },
  },
  sourcemap: true,
}
```

## Zapobieganie

### ✅ Zastosowane rozwiązania:

1. **createLazyComponent wrapper** (`TabRouter.tsx`)
   - Automatyczny retry logic
   - Przyjazny UI z przyciskiem reload
   - Logowanie błędów do konsoli

2. **Stable chunk names** (`vite.config.js`)
   - `manualChunks` dla vendorów
   - Mniejsza szansa na cache misses

3. **Error Boundary**
   - Przechwytuje błędy React Suspense
   - Pokazuje fallback UI

### 📋 Dobre praktyki:

```bash
# Przed commitowaniem
pnpm run build:fix

# Po pull z git
rm -rf node_modules/.vite && pnpm install

# CI/CD pipeline
- run: pnpm run build:clean
```

## Debugowanie

### 1. Sprawdź które chunki są ładowane

```javascript
// W konsoli przeglądarki
performance
  .getEntriesByType('resource')
  .filter((r) => r.name.includes('ProfileTab'))
  .forEach((r) => console.log(r.name, r.encodedBodySize));
```

### 2. Loguj błędy lazy loading

```javascript
// Już dodane w createLazyComponent
console.error('[LazyComponent] Failed to load:', error);
```

### 3. Sprawdź rozmiar chunków

```bash
pnpm run analyze:bundle
# Otwórz build/bundle-stats.html
```

## Kiedy nic nie pomaga

### Ostateczność - disable lazy loading:

```typescript
// TabRouter.tsx - tymczasowo
import ProfileTab from './ProfileTab'; // Zamiast lazy()

// W render:
{activeTab === 'profile' && <ProfileTab {...props} />}
```

**Uwaga:** To zwiększy rozmiar głównego bundle!

## Powiązane Issues

- [Vite #5234](https://github.com/vitejs/vite/issues/5234)
- [React #14572](https://github.com/facebook/react/issues/14572)
- [Rollup #3618](https://github.com/rollup/rollup/issues/3618)
