# Coverage Thresholds — Configuration Guide

## ✅ Configuration Status

Both frontend and backend coverage thresholds have been raised from **20-23%** to **80%+**.

---

## 📋 Threshold Values

| Metric         | Threshold | Description                                 |
| -------------- | --------- | ------------------------------------------- |
| **Lines**      | 80%       | 80% of all code lines must be executed      |
| **Functions**  | 80%       | 80% of all functions must be called         |
| **Statements** | 80%       | 80% of all statements must be executed      |
| **Branches**   | 75%       | 75% of all branches (if/else) must be taken |

---

## 📁 Configuration Files

### Backend (Server)

**File:** `server/vitest.config.ts`

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    statements: 80,
    branches: 75,
  },
  enabled: true,        // ✅ Enforce in CI
  autoUpdate: false,    // ✅ Fail if not met
}
```

### Frontend

**File:** `vitest.config.ts`

```typescript
coverage: {
  thresholds: {
    lines: 80,
    functions: 80,
    statements: 80,
    branches: 75,
  },
  enabled: true,        // ✅ Enforce in CI
  autoUpdate: false,    // ✅ Fail if not met
}
```

---

## 🧪 Running Coverage Tests

### Server Coverage

```bash
# Run server tests with coverage
pnpm run test:coverage:server

# View HTML report
pnpm run coverage:open
```

### Frontend Coverage

```bash
# Run frontend tests with coverage
pnpm run test:coverage

# View HTML report
pnpm run coverage:open:frontend
```

### All Coverage

```bash
# Run both server and frontend
pnpm run test:coverage:all

# Generate summary
pnpm run coverage:summary
```

---

## 📊 Coverage Reports Location

| Type                  | Path                                                       |
| --------------------- | ---------------------------------------------------------- |
| Server HTML           | `coverage/server/index.html`                               |
| Frontend HTML         | `coverage/frontend/index.html`                             |
| Server JSON Summary   | `coverage/server/coverage-summary.json`                    |
| Frontend JSON Summary | `coverage/frontend/coverage-summary.json`                  |
| LCOV (CI)             | `coverage/server/lcov.info`, `coverage/frontend/lcov.info` |

---

## ⚠️ CI/CD Behavior

### What Happens If Coverage < Threshold?

**Test run will FAIL** with an error like:

```
❌ Coverage for lines (65.2%) does not meet global threshold (80%)
❌ Coverage for functions (72.1%) does not meet global threshold (80%)
❌ Coverage for statements (68.9%) does not meet global threshold (80%)
❌ Coverage for branches (58.3%) does not meet global threshold (75%)
```

### How to Fix Low Coverage

1. **Identify uncovered files:**

   ```bash
   pnpm run test:coverage:server
   # Open coverage/server/index.html in browser
   ```

2. **Find uncovered lines:**
   - Open HTML report
   - Click on file with low coverage
   - Red lines = not covered
   - Yellow lines = partially covered (branches)

3. **Write tests for uncovered code:**

   ```typescript
   // Example: Add test for edge case
   test('handles null input gracefully', () => {
     const result = myFunction(null);
     expect(result).toBeNull();
   });
   ```

4. **Re-run coverage:**
   ```bash
   pnpm run test:coverage:server
   ```

---

## 🎯 Best Practices

### ✅ DO:

- Write tests **before** implementing features (TDD)
- Test happy path, edge cases, and error scenarios
- Use `describe()` blocks to organize tests by feature
- Mock external dependencies (API, database, filesystem)
- Test both success and failure paths

### ❌ DON'T:

- Write tests just to hit the threshold (test quality matters!)
- Test implementation details (test behavior, not internals)
- Skip error handling tests
- Forget to test edge cases (null, undefined, empty arrays)
- Use `// istanbul ignore` unless absolutely necessary

---

## 🔧 Excluding Files from Coverage

Some files should be excluded from coverage calculation:

**Already Excluded:**

- Test files (`*.test.ts`, `*.test.tsx`)
- Type definitions (`*.d.ts`)
- Setup files
- Scripts
- Build artifacts

**To Add More Exclusions:**

```typescript
coverage: {
  exclude: [
    // Add patterns here
    'src/deprecated/**',
    'src/legacy/**/*.ts',
  ],
}
```

---

## 📈 Monitoring Coverage Trends

### Weekly Coverage Report

Add to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Coverage Report
  run: |
    pnpm run test:coverage:all
    pnpm run coverage:summary

- name: Upload Coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/server/lcov.info,./coverage/frontend/lcov.info
```

### Coverage Trend Dashboard

Use services like:

- **Codecov** (free for open source)
- **Coveralls** (free tier available)
- **SonarQube** (self-hosted or cloud)

---

## 🚨 Troubleshooting

### "Coverage threshold not met" — What to do?

1. **Check which files have low coverage:**

   ```bash
   # Look at the HTML report
   start coverage/server/index.html
   ```

2. **Identify critical uncovered code:**
   - Focus on business logic
   - Focus on public APIs
   - Focus on error handling

3. **Write targeted tests:**

   ```typescript
   // Before: 60% coverage
   function calculateTotal(items) {
     return items.reduce((sum, item) => sum + item.price, 0);
   }

   // After: Add test
   test('calculates total for multiple items', () => {
     const items = [{ price: 10 }, { price: 20 }];
     expect(calculateTotal(items)).toBe(30);
   });
   ```

### "Tests are too slow with coverage"

Coverage measurement adds overhead. For local development:

```bash
# Run without coverage (faster)
pnpm run test:watch

# Run with coverage only when needed
pnpm run test:coverage  # Before committing
```

---

## 📚 Related Documentation

- [AGENTS.md](./AGENTS.md#2-testing--mandatory) — Testing requirements
- [TEST_IMPROVEMENTS_SUMMARY.md](./TEST_IMPROVEMENTS_SUMMARY.md) — Implementation details
- [Vitest Coverage Docs](https://vitest.dev/guide/coverage.html)

---

**Last Updated:** 2026-03-30  
**Status:** ✅ Active (enforced in CI)
