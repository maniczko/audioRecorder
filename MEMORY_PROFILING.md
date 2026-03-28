# Memory Profiling Guide

## 🎯 Cel

Profilowanie pamięci i wydajności serwera Node.js w production przy użyciu clinic.js i 0x.

---

## 📊 Narzędzia

### 1. **0x Profiler** - CPU & Memory Profiling

Flame graphs dla Node.js

```bash
# Build serwera
pnpm build:server

# Uruchom z 0x profiling
pnpm start:0x
```

**Output:**
- Generuje flame graph w HTML
- Lokalizacja: `./flamegraph.html`

**Analiza:**
1. Otwórz `flamegraph.html` w przeglądarce
2. Szukaj szerokich "płomieni" - to funkcje zużywające najwięcej CPU
3. Kliknij na płomień, aby zobaczyć szczegóły

---

### 2. **Clinic.js Doctor** - Automated Diagnostics

```bash
# Build serwera
pnpm build:server

# Uruchom Clinic Doctor
pnpm start:clinic
```

**Co robi:**
- Automatycznie wykrywa problemy z wydajnością
- Analizuje CPU, memory, event loop
- Generuje raport z rekomendacjami

**Output:**
- Raport w `./clinic-[pid].html`

---

## 🔬 Scenariusze testowe

### A. Memory Leak Detection

```bash
# 1. Uruchom z clinic.js
pnpm start:clinic

# 2. Wykonaj typowe operacje:
#    - Tworzenie nowych spotkań
#    - Przetwarzanie nagrań
#    - Eksport danych
#    - Przełączanie widoków

# 3. Zakończ proces (Ctrl+C)
# 4. Sprawdź raport
```

### B. CPU Profiling pod obciążeniem

```bash
# 1. Uruchom z 0x
pnpm start:0x

# 2. Generuj obciążenie:
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Meeting"}'

# Powtórz 100-1000 razy lub użyj:
pnpm test:load

# 3. Zakończ proces
# 4. Analizuj flamegraph.html
```

### C. Production Profiling

```bash
# Na production serwerze:

# 1. Zainstaluj clinic.js globalnie
npm install -g clinic

# 2. Uruchom z profilowaniem
clinic doctor -- node dist-server/index.js

# 3. Po 5-10 minutach zbierania danych:
#    - Naciśnij Ctrl+C
#    - Sprawdź wygenerowany raport
```

---

## 📈 Metryki do monitorowania

### Memory
- **Heap Used**: Powinien być stabilny
- **Heap Total**: Może rosnąć, ale nie powinien ciągle rosnąć
- **External**: Pamięć poza V8 (np. buffery)
- **RSS**: Całkowita pamięć procesu

### CPU
- **Event Loop Latency**: < 100ms (idealnie < 50ms)
- **CPU Usage**: < 70% średnio
- **GC Frequency**: Rzadkie GC = dobry znak

### I/O
- **File Descriptors**: Nie powinny wyciekać
- **Network Connections**: Powinny być zamykane

---

## 🚨 Typowe problemy

### 1. Memory Leak

**Objawy:**
- RSS ciągle rośnie
- GC nie odzyskuje pamięci
- Aplikacja zwalnia z czasem

**Przyczyny:**
- Globalne zmienne
- Zamknięcia (closures) z dużymi danymi
- Nieodpięte event listenery
- Zapomniane timery/intervale

**Naprawa:**
```javascript
// ŹLE - memory leak
const cache = new Map();
function processData(data) {
  cache.set(Date.now(), data); // Nigdy nie czyszczone
}

// DOBRZE
const cache = new Map();
const MAX_CACHE_SIZE = 1000;
function processData(data) {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(Date.now(), data);
}
```

### 2. CPU Bottleneck

**Objawy:**
- Wysokie CPU usage
- Wolne odpowiedzi API
- Event loop blocked

**Przyczyny:**
- Synchroniczne operacje
- Pętle na dużych tablicach
- Heavy computations w main thread

**Naprawa:**
```javascript
// ŹLE - blokuje event loop
function processLargeArray(arr) {
  return arr.map(item => heavyComputation(item));
}

// DOBRZE - użyj worker threads lub chunking
import { workerData, parentPort } from 'worker_threads';

// Lub chunking:
async function processInChunks(arr, chunkSize = 100) {
  const results = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const chunk = arr.slice(i, i + chunkSize);
    results.push(...chunk.map(item => heavyComputation(item)));
    await Promise.resolve(); // Odciąż event loop
  }
  return results;
}
```

### 3. Event Loop Lag

**Objawy:**
- Opóźnione callbacki
- Timeouty bez powodu
- Nieregularne odpowiedzi

**Diagnostyka:**
```javascript
const { monitorEventLoopDelay } = require('perf_hooks');
const { histogram } = monitorEventLoopDelay({ resolution: 10 });
histogram.enable();

// Co 5 sekund sprawdzaj opóźnienie
setInterval(() => {
  console.log('P50:', histogram.percentile(50) / 1e6, 'ms');
  console.log('P99:', histogram.percentile(99) / 1e6, 'ms');
}, 5000);
```

---

## 🛠️ Dodatkowe narzędzia

### Chrome DevTools Inspector

```bash
# Uruchom z inspect flag
node --inspect dist-server/index.js

# Otwórz w Chrome:
# chrome://inspect
```

### Heap Snapshot

```javascript
// W kodzie:
function takeHeapSnapshot() {
  const heapSnapshot = v8.getHeapSnapshot();
  // Zapisz do pliku do analizy
}
```

### Clinic.js Bubbleprof

```bash
# Analiza async/await i callbacków
clinic bubbleprof -- node dist-server/index.js
```

### Clinic.js Flame

```bash
# Szczegółowy CPU profiling
clinic flame -- node dist-server/index.js
```

---

## 📋 Checklista przed profilingiem

- [ ] Zbuduj serwer (`pnpm build:server`)
- [ ] Wyczyść stare raporty
- [ ] Przygotuj scenariusz testowy
- [ ] Zamknij inne aplikacje (czystszy sygnał)
- [ ] Zbieraj dane przez 5-10 minut minimum
- [ ] Testuj pod obciążeniem (nie tylko idle)

---

## 📝 Przykładowy workflow

```bash
# 1. Przygotowanie
pnpm build:server
rm -f clinic-*.html flamegraph.html

# 2. Uruchom profiling
pnpm start:clinic

# 3. Generuj obciążenie (w drugim terminalu)
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/meetings \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Meeting $i\"}"
done

# 4. Zakończ profiling (Ctrl+C w pierwszym terminalu)

# 5. Otwórz raport
open clinic-*.html  # macOS
xdg-open clinic-*.html  # Linux
start clinic-*.html  # Windows
```

---

## 🔗 Przydatne linki

- [Clinic.js Documentation](https://clinicjs.org/)
- [0x Profiler](https://github.com/davidmarkclements/0x)
- [Node.js Performance Profiling](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Chrome DevTools Memory](https://developer.chrome.com/docs/devtools/memory-problems/)

---

## 📊 Raportowanie

Po zebraniu danych:

1. **Dokumentuj znalezione problemy**
2. **Stwórz taski z priorytetami**
3. **Mierz poprawę po optymalizacji**
4. **Uruchom profiling ponownie** aby potwierdzić naprawę

Przykładowy raport:

```markdown
## Memory Profiling Report - 2026-03-28

### Znalezione problemy:
1. Memory leak w /api/meetings - 50MB/hour
2. Event loop lag przy przetwarzaniu nagrań - 250ms P99

### Akcje naprawcze:
1. Naprawiono wyciek streamów (#403)
2. Dodano chunking dla dużych plików (#404)

### Wyniki po naprawie:
- Memory: stabilny na 120MB
- Event loop: P99 < 50ms
```
