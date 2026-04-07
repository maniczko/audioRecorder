# 🧪 P4 Testing Improvements - Implementation Guide

## 1. Mutation Testing (Stryker Mutator)

### What is it?
Mutation testing validates test effectiveness beyond line coverage. Stryker makes small changes ("mutations") to your code and checks if your tests catch them.

**Current Status:** ✅ Configured

### Usage

```bash
# Run mutation testing
pnpm run test:mutation

# Run in CI mode (with JSON + HTML reports)
pnpm run test:mutation:ci
```

### Configuration
- Config file: `stryker.config.json`
- Reports: `mutation-reports/` (HTML)
- Thresholds:
  - High: 90%
  - Low: 70%
  - Break: 50%

### What it does:
1. Takes your code and makes small changes (mutations)
2. Runs your tests against mutated code
3. Reports which mutations were caught (killed) vs survived

### Example Mutation Types:
- Change `+` to `-`
- Change `===` to `!==`
- Remove function calls
- Change boolean values

### Interpreting Results:
- **Killed mutants**: Your tests caught the change ✅
- **Survived mutants**: Your tests didn't catch the change ❌
- **Timeout mutants**: Tests took too long (may indicate infinite loop)
- **No coverage mutants**: Code not covered by tests

---

## 2. Visual Regression Testing (Playwright)

### What is it?
Automated screenshot comparison to detect unintended UI changes.

**Current Status:** ✅ Implemented

### Usage

```bash
# Update baseline screenshots
pnpm run test:visual

# Check for visual regressions
pnpm run test:visual:check

# Interactive UI mode
pnpm run test:visual:ui
```

### Test File
- Location: `tests/e2e/visual-regression.spec.ts`

### What it tests:
1. **Main app** - Full page screenshot
2. **All tabs** - Studio, Calendar, Tasks, People, Recordings, Notes, Profile
3. **Topbar component**
4. **Responsive breakpoints**:
   - Mobile: 375px
   - Tablet: 768px
   - Desktop: 1440px
5. **Dark mode**

### How it works:
1. Takes screenshot of current UI
2. Compares against baseline screenshot
3. Reports differences if threshold exceeded

### Configuration:
- Threshold: 0.1 (10% pixel difference allowed)
- Full page screenshots enabled
- Max diff pixel ratio: 0.05

### Updating Baselines:
```bash
# After intentional UI changes, update baselines:
pnpm run test:visual
```

---

## 3. API Contract Testing (OpenAPI + Prism)

### What is it?
Validates frontend-backend API contract consistency using OpenAPI specification.

**Current Status:** ✅ Implemented

### Files:
- **OpenAPI Spec:** `docs/openapi.yaml`
- **Contract Tests:** `server/tests/contract/api-contract.test.ts`
- **Prism Config:** `prism.config.yaml`

### Usage

```bash
# Run contract validation tests
pnpm run test:contract

# Start mock API server with Prism
pnpm run mock:api

# Run contract tests against mock server
pnpm run test:contract:mock
```

### OpenAPI Specification Coverage:
The `docs/openapi.yaml` defines:

**Endpoints:**
- `GET /api/health` - Health check
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET/POST /api/meetings` - Meeting CRUD
- `GET /api/meetings/{id}` - Get meeting
- `GET /api/meetings/{id}/transcript` - Get transcript
- `GET /api/meetings/{id}/analysis` - Get AI analysis
- `POST /api/ai/ask` - AI queries
- `GET/POST /api/tasks` - Task CRUD
- `GET/PUT /api/users/profile` - User profile

**Schemas:**
- HealthResponse, RegisterRequest, LoginRequest
- AuthResponse, User, Workspace
- Meeting, CreateMeetingRequest
- TranscriptResponse, TranscriptSegment
- MeetingAnalysis, MeetingFeedback
- Task, CreateTaskRequest
- UserProfile, UpdateProfileRequest

### What it validates:
1. **OpenAPI spec validity** - Proper YAML structure
2. **Required paths** - All endpoints defined
3. **HTTP methods** - GET, POST, PUT, DELETE properly configured
4. **Request schemas** - Required fields, types, formats
5. **Response schemas** - All endpoints have response definitions
6. **Security schemes** - Bearer auth properly configured
7. **Mock responses** - Match OpenAPI schemas

### Mock API Server (Prism):
```bash
# Start mock server on http://localhost:4010
pnpm run mock:api

# Test against mock server
curl http://localhost:4010/api/health
curl -X POST http://localhost:4010/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass123"}'
```

### Benefits:
- ✅ Prevents frontend-backend drift
- ✅ Catch breaking changes early
- ✅ Documentation stays in sync with code
- ✅ Mock server for frontend development
- ✅ Automated contract validation in CI

---

## 🚀 CI/CD Integration

### GitHub Actions Workflow:

```yaml
name: P4 Testing
on: [push, pull_request]

jobs:
  mutation-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm run test:mutation:ci
      - uses: actions/upload-artifact@v3
        with:
          name: mutation-report
          path: mutation-reports/

  visual-regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm run test:visual:check
      - uses: actions/upload-artifact@v3
        with:
          name: visual-screenshots
          path: tests/e2e/.screenshots/

  api-contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm install
      - run: pnpm run test:contract
```

---

## 📊 Summary

| Testing Type | Status | Command | Coverage |
|-------------|--------|---------|----------|
| **Mutation Testing** | ✅ Ready | `pnpm run test:mutation` | Validates test quality |
| **Visual Regression** | ✅ Ready | `pnpm run test:visual:check` | 14 visual tests |
| **API Contract** | ✅ Ready | `pnpm run test:contract` | 15+ endpoints |

---

**Last Updated:** 2026-04-06  
**Priority:** P4 (Nice to have, medium/low impact)
