# 📦 Bundle Size Monitoring

Monitorowanie rozmiaru bundle w projekcie VoiceLog.

---

## ✅ Wdrożone Funkcje

### 1. **Bundle Size Workflow** ✅ (20 min)

- **Plik:** `.github/workflows/bundle-size.yml`
- **Wyzwalacze:**
  - Pull request do main/master
  - Push do main/master
- **Narzędzie:** `preactjs/compressed-size-action`

**Działanie:**

- Buduje projekt
- Analizuje rozmiar plików JS/CSS
- Komentarz na PR z raportem
- Alert przy dużym wzroście

**Korzyść:** Wykrywa bundle bloat zanim trafi do production

---

## 📊 Przykładowy Raport

```markdown
## 📦 Bundle Size Report

### Build Artifacts

| Type       | Size          |
| ---------- | ------------- |
| JavaScript | 245.32 KB     |
| CSS        | 32.15 KB      |
| **Total**  | **277.47 KB** |

### Changes

⚠️ **Warning:** Bundle increased by +15.2 KB (+5.8%)

### Recommendations

- Keep bundle size under 500KB for optimal performance
- Use code splitting for large features
- Tree-shake unused dependencies
- Compress assets with gzip/brotli

---

_This is an automated report from Bundle Size Monitor._
```

---

## 🔄 Workflow

```
Pull Request
        ↓
GitHub Actions
- Checkout code
- Install dependencies
- Build project
- Analyze bundle size
        ↓
Comment on PR
- Show current size
- Show change from base
- Alert if over threshold
        ↓
Review & Merge
```

---

## ⚙️ Konfiguracja

### Thresholds

| Metryka          | Threshold      | Action                 |
| ---------------- | -------------- | ---------------------- |
| **Warning**      | >500KB         | Comment alert          |
| **Critical**     | >1MB           | Block merge (optional) |
| **Change Alert** | >10KB increase | Comment alert          |

### Exclude Patterns

```yaml
exclude: '**/*.map,**/*.svg,**/*.png,**/*.jpg'
```

### Minimum Change Threshold

```yaml
minimum-change-threshold: '1KB'
```

---

## 📁 Pliki

| Plik                                | Opis                 |
| ----------------------------------- | -------------------- |
| `.github/workflows/bundle-size.yml` | Bundle size workflow |

---

## 🎯 Best Practices

### ✅ DOBRE

```javascript
// Code splitting
const LazyComponent = lazy(() => import('./HeavyComponent'));

// Tree-shaking
import { debounce } from 'lodash-es'; // ✅
// vs
import _ from 'lodash'; // ❌

// Dynamic imports
if (condition) {
  const module = await import('./module');
}
```

### ❌ ZŁE

```javascript
// Importing entire libraries
import moment from 'moment'; // ❌ 67KB
import dayjs from 'dayjs'; // ✅ 6KB

// Large inline assets
const logo = 'data:image/png;base64,...'; // ❌
// Use external file instead
```

---

## 📈 Metryki

| Metryka          | Cel    | Current | Status |
| ---------------- | ------ | ------- | ------ |
| **Total Bundle** | <500KB | ~277KB  | ✅     |
| **JavaScript**   | <400KB | ~245KB  | ✅     |
| **CSS**          | <50KB  | ~32KB   | ✅     |
| **Initial Load** | <300KB | ~250KB  | ✅     |

---

## 🐛 Troubleshooting

### Problem: Bundle size too large

**Rozwiązanie:**

```bash
# Analyze bundle
npm run build -- --analyze

# Or use webpack-bundle-analyzer
pnpm add -D webpack-bundle-analyzer

# Check which dependencies are largest
npm ls --depth=0 --size
```

### Problem: Workflow nie działa

**Rozwiązanie:**

1. Sprawdź `.github/workflows/bundle-size.yml`
2. Sprawdź GitHub Actions logs
3. Upewnij się że `npm run build` działa lokalnie

### Problem: False positive alerts

**Rozwiązanie:**

```yaml
# Increase threshold
minimum-change-threshold: '5KB' # Instead of 1KB
```

---

## 🚀 Optymalizacje

### 1. Code Splitting

```javascript
// React.lazy for route-based splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
```

### 2. Tree Shaking

```javascript
// Use ES modules
import { debounce } from 'lodash-es';

// Avoid side effects in imports
```

### 3. Compression

```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          utils: ['lodash-es', 'dayjs'],
        },
      },
    },
  },
};
```

### 4. Image Optimization

```bash
pnpm add -D imagemin-cli
npx imagemin dist/images/* --out-dir=dist/images
```

---

## 📊 Przykładowy Growth Alert

```
## 📦 Bundle Size Alert

### ⚠️ Bundle Size Increased

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total | 250KB | 320KB | +70KB (+28%) |
| JS | 200KB | 260KB | +60KB |
| CSS | 50KB | 60KB | +10KB |

### Cause
- New dependency: `chart.js` (+45KB)
- New component: `Dashboard` (+25KB)

### Recommendations
1. Use dynamic import for chart.js
2. Lazy load Dashboard component
3. Consider alternative: `chartjs` → `recharts` (smaller)
```

---

## 📚 Powiązane Dokumenty

- **AUTOMATION_GUIDE.md** - Podstawowa automatyzacja
- **AUTOMATION_COMPLETE.md** - Kompletna automatyzacja
- **AUTOMATION_ADVANCED.md** - Zaawansowana automatyzacja
- **AUTOMATION_AI.md** - AI-powered automation
- **AUTOMATION_OPTIMIZATION.md** - Optymalizacja
- **AUTOMATION_MIGRATION.md** - Code migration
- **AUTOMATION_CHANGELOG.md** - Automated changelog
- **AUTOMATION_BUNDLE_SIZE.md** - Ten dokument

---

**Ostatnia aktualizacja:** 2026-03-24  
**Wersja:** 9.0 (Bundle Size Monitoring)
