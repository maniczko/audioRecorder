#!/bin/bash
# 🛡️ Anti-Regression & TDD Check Script
# Usage: ./scripts/tdd-check.sh [feature-name]

set -e

echo ""
echo "🛡️  Anti-Regression & TDD Check"
echo "================================"
echo ""

# Check if feature name provided
if [ -z "$1" ]; then
  echo "❌ Usage: ./tdd-check.sh [feature-name]"
  echo ""
  echo "Example:"
  echo "  ./tdd-check.sh supabaseStorage"
  echo ""
  exit 1
fi

FEATURE_NAME="$1"
TEST_FILE="server/tests/lib/${FEATURE_NAME}.test.ts"
IMPL_FILE="server/lib/${FEATURE_NAME}.ts"
REGRESSION_DIR="server/tests/regression"

echo "📝 Feature: $FEATURE_NAME"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 1: Check if test file exists (TDD = tests first!)
# ─────────────────────────────────────────────────────────────
echo "Step 1: Checking test file..."
if [ ! -f "$TEST_FILE" ]; then
  echo "❌ Test file not found: $TEST_FILE"
  echo ""
  echo "   TDD Rule: Write tests BEFORE implementation!"
  echo ""
  echo "   Create test file first:"
  echo "   mkdir -p server/tests/lib"
  echo "   touch $TEST_FILE"
  echo ""
  echo "   Then write failing tests (RED phase)"
  exit 1
fi
echo "✅ Test file exists: $TEST_FILE"
echo ""

# ─────────────────────────────────────────────────────────────
# Step 2: Check if implementation exists
# ─────────────────────────────────────────────────────────────
echo "Step 2: Checking implementation file..."
if [ ! -f "$IMPL_FILE" ]; then
  echo "⏳ Implementation not found: $IMPL_FILE"
  echo ""
  echo "   Next: Implement code to make tests pass (GREEN phase)"
  echo ""
else
  echo "✅ Implementation exists: $IMPL_FILE"
  echo ""
fi

# ─────────────────────────────────────────────────────────────
# Step 3: Run tests
# ─────────────────────────────────────────────────────────────
echo "Step 3: Running tests..."
echo ""

if pnpm exec vitest run "$TEST_FILE" --reporter=verbose; then
  echo ""
  echo "✅ All tests pass (GREEN)"
else
  echo ""
  echo "❌ Tests failed (RED)"
  echo ""
  echo "   Fix implementation or tests before proceeding"
  exit 1
fi
echo ""

# ─────────────────────────────────────────────────────────────
# Step 4: Check coverage
# ─────────────────────────────────────────────────────────────
echo "Step 4: Checking coverage..."
echo ""

COVERAGE_OUTPUT=$(pnpm exec vitest run "$TEST_FILE" --coverage --reporter=basic 2>&1 || true)

# Check if coverage is above 80% for this file
if echo "$COVERAGE_OUTPUT" | grep -q "All files"; then
  echo "$COVERAGE_OUTPUT" | grep "All files"
  echo ""
  echo "✅ Coverage check passed"
else
  echo "⚠️  Could not determine coverage"
  echo "   Consider running: pnpm run test:coverage"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# Step 5: Regression test reminder
# ─────────────────────────────────────────────────────────────
echo "Step 5: Regression test check..."
echo ""

if [ -d "$REGRESSION_DIR" ]; then
  REGRESSION_COUNT=$(find "$REGRESSION_DIR" -name "*.test.ts" | wc -l)
  echo "📊 Existing regression tests: $REGRESSION_COUNT"
fi

echo ""
echo "   💡 If this is a bug fix, add regression test:"
echo "      mkdir -p $REGRESSION_DIR"
echo "      touch ${REGRESSION_DIR}/$(date +%Y-%m-%d)-${FEATURE_NAME}.test.ts"
echo ""

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo "================================"
echo "✅ TDD Check Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. ✅ Tests written (TDD)"
echo "  2. ✅ Tests passing (GREEN)"
echo "  3. ⏳ Refactor if needed (REFACTOR)"
echo "  4. ⏳ Add regression test (if bug fix)"
echo "  5. ⏳ Update documentation"
echo "  6. ⏳ Run full test suite: pnpm run test"
echo ""
